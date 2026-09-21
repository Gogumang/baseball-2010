import type { BattedBallTrajectory, CatchTable, CatchOpportunity, ChaseChoice } from '@/entities/fielding/model/catchPrediction'
import {
  CATCH_KIND,
  catchKindsAt,
  chooseChaser,
  EMPTY_CATCH_TABLE,
} from '@/entities/fielding/model/catchPrediction'
import { horizontalDistance, type WorldPoint } from '@/entities/fielding/model/fieldGeometry'
import type { FielderState } from '@/entities/fielding/model/fieldingState'

/**
 * 포구 예보 — 타구가 떠난 순간 "누가 몇 틱에 잡는가" 를 한 번에 정한다.
 *
 * 원본 0xb12d0 은 야수 9명을 **복제해** 궤적 점마다 굴려 보고 종류별 가장 이른 포구 틱 표를 만든다
 * (P2 2a). 복제를 실제로 움직이지 않는 틱에는 **직선 근사**를 쓴다:
 * `d = 거리(복제 위치, P(t))`, `정지면 d −= 복제 속도(220) × n` (그 사이 뛴 만큼 당겨 준다).
 * 거리 `d` 가 정해지고 나서야 포구 반경 `R = (칸 ≤ 5) ? 500 : 300` · 땅볼 반경 1000 ·
 * 점프 상자 ±299 · 슬라이딩 창 `1999 < d ≤ 3000` 이 갈린다.
 *
 * ⚠️ **여기서 고친 것**: 전에는 "제 시간에 닿는 야수는 그 점에 서 있다"(`fielder: ball`)로 두어
 * **d 가 늘 0** 이었다. 그래서 반경도 슬라이딩 창도 영원히 닫혀 있었다. 이제 야수는 제자리에 두고
 * 원본 식으로 `d` 를 만든다.
 *
 * **근사로 남는 것**: 원본은 궤적 끝에서 한 번 더(`t = 10` 부터) 도는 두 패스 구조이고 `n` 은 둘째
 * 패스에서만 오른다. 여기서는 한 패스만 돌리므로 **n = t**(타구 순간부터 계속 뛴 것)로 둔다.
 * 원본 궤적 물리 루프(0xb3b38·0xb401c)는 건드리지 않는다.
 */

/** 표를 만들 때 살펴볼 최대 틱 — 궤적이 짧아도 `pointAt` 이 마지막 점을 물고 있어 굴러 멈춘 공까지 찾는다 */
const FORECAST_TICKS = 200

/** 첫 포구 가능 틱(+0x11c)이 잡힌 뒤 더 보는 틱 수 — 원본 `남은틱 = 5` (0xb185e) */
const EXTRA_TICKS_AFTER_FIRST = 5

export interface CatchForecast {
  readonly table: CatchTable
  readonly choice: ChaseChoice
  /** 표 전체에서 가장 이른 포구 틱 (플레이 +0x11c). 없으면 0xffff */
  readonly earliestCatchTick: number
  /** 포구 지점 */
  readonly point: WorldPoint
}

/** 아무도 못 잡을 때 원본이 쓰는 큰 값 (플레이 +0x11c 초기값) */
const NO_CATCH_TICK = 0xffff

export interface CatchForecastOptions {
  /** 필살 점프 창 (플레이 +0x1f5) — `rollSpecialDefense` 의 A 굴림이 성공했을 때만 선다 */
  readonly jumpUnlocked?: boolean
  /** 필살 슬라이딩 창 (플레이 +0x1f6) — B 굴림 */
  readonly slideUnlocked?: boolean
  /** 지정 야수만 잡게 하는 모드 (플레이 +0x1e8 · +0x154) */
  readonly onlySlot?: number
  /**
   * 표를 만들 때의 추적야수 +0x130 — **타구 시작(0xb280a)에서는 1(포수)** 이고,
   * 원본은 그 야수만 `t ≤ 4` 동안 건너뛴다 (P2 2a `if j == 추적야수 && t ≤ 4 : 건너뜀`).
   * 그 가드가 "포수가 홈플레이트 위 타구를 그 자리에서 주워 버리는 것" 을 막는다.
   */
  readonly initialChaserSlot?: number
}

/** 추적야수를 건너뛰는 구간 (P2 2a) */
const CHASER_SKIP_TICKS = 4
/** 원본 틱 루프는 1 부터 돈다 (t = 1 → tmax) */
const FIRST_FORECAST_TICK = 1

/**
 * @param window 살펴볼 틱 구간. 뜬공(잡히는 타구)은 `[0, 낙구 틱]`, 굴러간 타구는 `[낙구 틱, ∞)` 를 본다.
 *   구간을 밖에서 주는 이유는 **타자주자의 운명이 결과 코드로 이미 정해져 있기 때문**이다 (아래 주석 참고).
 * @param options 필살수비 굴림(0x66b30 / 0x66be4)이 연 창. 안 주면 보통 포구 세 종류만 본다.
 */
export function forecastCatch(
  trajectory: BattedBallTrajectory,
  fielders: readonly FielderState[],
  window: { readonly from: number; readonly to: number },
  options: CatchForecastOptions = {},
): CatchForecast {
  const table: { -readonly [K in keyof CatchTable]: CatchOpportunity | null } = { ...EMPTY_CATCH_TABLE }
  const keyOf: Readonly<Record<number, keyof CatchTable>> = {
    [CATCH_KIND.LOW]: 'low',
    [CATCH_KIND.CHEST]: 'chest',
    [CATCH_KIND.GROUNDER]: 'grounder',
    [CATCH_KIND.JUMP]: 'jump',
    [CATCH_KIND.SLIDE]: 'slide',
  }

  const last = Math.min(window.to, FORECAST_TICKS)
  const initialChaserSlot = options.initialChaserSlot ?? 1
  let remainingTicks = EXTRA_TICKS_AFTER_FIRST
  for (let tick = Math.max(FIRST_FORECAST_TICK, window.from); tick <= last; tick += 1) {
    const ball = trajectory.pointAt(tick)
    for (const fielder of fielders) {
      if (fielder.slot === initialChaserSlot && tick <= CHASER_SKIP_TICKS) continue
      const kinds = catchKindsAt({
        slot: fielder.slot,
        // 야수는 제자리에 두고, "그 사이 뛴 만큼"(속도 × n)은 거리에서 뺀다 — 원본 직선 근사
        fielder: fielder.position,
        runTicks: tick,
        speed: fielder.speed,
        ball,
        tick,
        landingTick: trajectory.landingTick,
        jumpUnlocked: options.jumpUnlocked,
        slideUnlocked: options.slideUnlocked,
        onlySlot: options.onlySlot,
      })
      for (const kind of kinds) {
        const key = keyOf[kind]
        if (table[key] === null) table[key] = { tick, slot: fielder.slot }
      }
    }
    // 끝내기 0xb185e: 한 종류라도 적히고 나면 5틱만 더 보고 끝낸다 (P2 2a "남은틱 = 5")
    if (table.low !== null || table.chest !== null || table.grounder !== null || table.jump !== null || table.slide !== null) {
      remainingTicks -= 1
      if (remainingTicks <= 0) break
    }
  }

  const lowTick = table.low?.tick ?? trajectory.landingTick
  const lowPoint = trajectory.pointAt(lowTick)
  const nearestSlot = nearestSlotTo(fielders, lowPoint)
  const choice = chooseChaser(table, trajectory.landingTick, nearestSlot)
  const ticks = [table.low, table.chest, table.grounder, table.jump, table.slide]
    .filter((entry): entry is CatchOpportunity => entry !== null)
    .map((entry) => entry.tick)

  return {
    table,
    choice,
    earliestCatchTick: ticks.length === 0 ? NO_CATCH_TICK : Math.min(...ticks),
    point: trajectory.pointAt(choice.catchTick),
  }
}

/** 낮은 공 지점에 가장 가까운 야수 (0xb3b38 이 우선순위 1·8 에서 쓰는 야수) */
export function nearestSlotTo(fielders: readonly FielderState[], point: WorldPoint): number {
  let best = 0
  let bestDistance = Number.POSITIVE_INFINITY
  for (const fielder of fielders) {
    const distance = horizontalDistance(fielder.position, point)
    if (distance < bestDistance) {
      bestDistance = distance
      best = fielder.slot
    }
  }
  return best
}
