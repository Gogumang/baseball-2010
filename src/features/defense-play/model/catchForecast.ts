import type { BattedBallTrajectory, CatchTable, CatchOpportunity, ChaseChoice } from '@/entities/fielding/model/catchPrediction'
import {
  CATCH_KIND,
  catchKindsAt,
  chooseChaser,
  EMPTY_CATCH_TABLE,
} from '@/entities/fielding/model/catchPrediction'
import { horizontalDistance, stepToward, type WorldPoint } from '@/entities/fielding/model/fieldGeometry'
import type { FielderState } from '@/entities/fielding/model/fieldingState'

/**
 * 포구 예보 — 타구가 떠난 순간 "누가 몇 틱에 잡는가" 를 한 번에 정한다.
 *
 * 원본 0xb12d0 은 야수 9명을 **복제해**(new 0xf4 + 0xa0e08 + 0xf4 바이트 통째 복사 — 위치 · 동작 잠금 +0xb4 · +0xcc 까지)
 * 궤적 점마다 굴려 보고 종류별 가장 이른 포구 틱 표를 만든다 (P2 2a). 직접 뜬 틱 루프:
 * ```
 * b13b2  t = 1 → ; P(t) = 0xa25b0(공, min(t, 공+0x6c − 1))     ; 궤적 끝을 넘으면 마지막 점(멈춘 공)을 계속 본다
 * b13e4  j == 추적야수(+0x130) && t ≤ 4 → 건너뜀(b1840 — 복제 틱도 안 돈다)
 * b1410  움직임허용[j](a == 1 이면 모두) :
 * b1416    +0x127 && 공+0xaa0 ≥ t → 복제.vt14(P(aa0)) — 낙구 지점(x, 0, z)으로 실제로 달린다 (정지 아님)
 * b1452    아니면 정지 = 1 ; n[j]++
 * b146c  복제.vtc8()(0xa2118 = +0xb1 == 0 && +0xcc ≤ 0) && 복제+0xb4 ≤ 0 이 아니면 →
 * b148e    정지면 n[j]−− (그 틱은 안 뛴 것으로) ; 복제.vt0c() ; 다음 야수          ; 판정 없음
 * b14d0  정지면 복제.vt10()(0xa124c → 0xbf2b0 목표 = 위치 · 멈춤) ; 판정(d = 거리 − 220 × n[j] · 정지일 때만 뺀다)
 * b17fc  복제.vt0c() = 야수 틱 0xa1284 — +0xb4 > 0 이면 −1(0 이 되면 vt10)만 하고 끝, 아니면 +0xcc −1 · 이동(0xbf094)
 * b185e  +0x11c ≤ 0xfffe 면 남은틱−− ; 0 이면 끝. t 는 궤적 끝에서 멈추지 않는다(a == 1 — 0xb18bc t++)
 * ```
 * 그래서 n 은 "판정받은 틱 수" 다 — 추적야수가 건너뛴 4틱과 동작 잠금 틱은 세지 않는다. 낙구 지점으로 달리는 동안(+0x127)도
 * 안 센다. 거리 `d` 가 정해지고 나서야 포구 반경 `R = (칸 ≤ 5) ? 500 : 300` · 땅볼 반경 1000 · 점프 상자 ±299 ·
 * 슬라이딩 창 `1999 < d ≤ 3000` 이 갈린다.
 *
 * **웹 다리**: `window` — 원본은 틱 구간을 자르지 않는다. 웹은 타자주자의 운명을 결과 코드가 먼저 정하므로 구간 밖 틱은
 * **판정만** 안 적는다(복제의 n · 잠금 · 이동은 t = 1 부터 원본대로 돈다).
 * **안 옮긴 것**: +0xb1(던진 동작 표시 — 판 시작 예보에선 늘 0)과 복제가 물려받는 움직이던 목표점(+0x2c). 정지 판정 틱의
 * vt10 이 곧바로 멈추고, 잠금 · +0xcc 틱엔 이동 조건(vtc8)이 닫혀 판 시작 예보에선 결과가 같다.
 */

/** 표를 만들 때 살펴볼 최대 틱 — 원본은 끝이 없다(첫 포구 가능 틱 뒤 5틱에서 끝). n 이 쌓여 그 전에 늘 누군가 닿는다 */
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
  /**
   * **플레이 +0x127** — 타구 시작 0x51408 이 0 으로 비운 뒤 뽑은 패턴이 `0xb07c8 == 1`(패턴 플래그 비트 1)이면 세운다
   * (0x514e6), 쥐기 0xb2710 이 지운다. 서 있으면 낙구 틱까지 복제가 낙구 지점으로 **실제로 달린다**(b1416).
   */
  readonly chaseToLanding?: boolean
}

/** 추적야수를 건너뛰는 구간 (P2 2a) */
const CHASER_SKIP_TICKS = 4
/** 원본 틱 루프는 1 부터 돈다 (t = 1 → tmax) */
const FIRST_FORECAST_TICK = 1

/**
 * @param window 판정을 적을 틱 구간. 뜬공(잡히는 타구)은 `[0, 낙구 틱]`, 굴러간 타구는 `[낙구 틱, ∞)` 를 본다.
 *   구간을 밖에서 주는 이유는 **타자주자의 운명이 결과 코드로 이미 정해져 있기 때문**이다 (위 웹 다리).
 * @param options 필살수비 굴림(0x66b30 / 0x66be4)이 연 창 · 추적야수 · +0x127.
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
  const landing = trajectory.pointAt(trajectory.landingTick)
  // vt14 → 0xa100c(야수, x, 0, z) — 낙구 지점의 높이는 버린다
  const landingTarget: WorldPoint = { x: landing.x, y: 0, z: landing.z }
  // 복제 9명 — 위치 · n · 동작 잠금 +0xb4 · +0xcc 를 원본 복제처럼 따로 굴린다
  const clones = fielders.map((fielder) => ({
    position: fielder.position,
    runTicks: 0,
    lockTicks: fielder.actionLockTicks,
    slackTicks: fielder.arrivalSlackTicks,
  }))
  let remainingTicks = EXTRA_TICKS_AFTER_FIRST
  for (let tick = FIRST_FORECAST_TICK; tick <= last; tick += 1) {
    const ball = trajectory.pointAt(tick)
    const recording = tick >= window.from
    for (const [index, fielder] of fielders.entries()) {
      const clone = clones[index]
      if (fielder.slot === initialChaserSlot && tick <= CHASER_SKIP_TICKS) continue
      // b1416 — +0x127 && aa0 ≥ t 면 낙구 지점으로 달린다(정지 아님 · n 안 셈)
      const runningToLanding = options.chaseToLanding === true && trajectory.landingTick >= tick
      const standing = !runningToLanding
      if (standing) clone.runTicks += 1
      // b146c — vtc8(+0xcc ≤ 0) && +0xb4 ≤ 0 이 아니면 판정 없이 복제 틱만 (정지면 n 을 되돌린다)
      if (!(clone.slackTicks <= 0 && clone.lockTicks <= 0)) {
        if (standing) clone.runTicks -= 1
        tickClone(clone, runningToLanding ? landingTarget : null, fielder.speed)
        continue
      }
      if (recording) {
        const kinds = catchKindsAt({
          slot: fielder.slot,
          // 정지면 복제는 제자리(vt10)이고 "그 사이 뛴 만큼"(속도 × n)을 거리에서 뺀다 — 원본 직선 근사
          fielder: clone.position,
          runTicks: standing ? clone.runTicks : 0,
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
      // b17fc 복제.vt0c — 낙구 지점으로 달리는 중이면 한 틱 이동(정지면 vt10 이 이미 멈췄다)
      tickClone(clone, runningToLanding ? landingTarget : null, fielder.speed)
    }
    // 끝내기 0xb185e: 한 종류라도 적히고 나면 5틱만 더 보고 끝낸다 (P2 2a "남은틱 = 5")
    if (table.low !== null || table.chest !== null || table.grounder !== null || table.jump !== null || table.slide !== null) {
      remainingTicks -= 1
      if (remainingTicks <= 0) break
    }
  }

  // 0xb3b38: Q = 공점(lo 틱) — lo 가 없으면 100000(0xb3b60)이라 0xa25b0 이 궤적 마지막 점으로 자른다
  const lowPoint = trajectory.pointAt(table.low?.tick ?? NO_LOW_TICK)
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

/** 0xb3b60 — 표가 비었을 때의 틱 100000 */
const NO_LOW_TICK = 100_000

interface ForecastClone {
  position: WorldPoint
  runTicks: number
  lockTicks: number
  slackTicks: number
}

/**
 * 복제의 야수 틱 0xa1284 — 동작 잠금 +0xb4 가 있으면 −1 만 하고 끝(a12b4~a12d6), 아니면 +0xcc −1(a1330) 뒤
 * 이동 조건(vtc8 && +0xb4 ≤ 0, a1346~a1376)이 서면 목표로 한 틱(기반 캐릭터 이동 0xbf158 = `stepToward`).
 */
function tickClone(clone: ForecastClone, target: WorldPoint | null, speed: number): void {
  if (clone.lockTicks > 0) {
    clone.lockTicks -= 1
    return
  }
  if (clone.slackTicks > 0) clone.slackTicks = Math.max(0, clone.slackTicks - 1)
  if (target !== null && clone.slackTicks <= 0) clone.position = stepToward(clone.position, target, speed)
}

/**
 * 낮은 공 지점에 가장 가까운 야수 (0xb3b38 이 우선순위 1·8 에서 쓰는 야수) — 0xb3c00~0xb3c6c:
 * 거리 0xbf9f0(isqrt(dx² + dz²)) < 지금 최소(처음 0x40000000) && 진짜 야수의 +0xb4 ≤ 0 && +0xbc == 0 인 야수, 없으면 0.
 * (+0xbc 는 vta0 0xa1e94 가 세우고 다음 야수 틱에 지우는 칸이라 이 웹 모델엔 없다)
 */
export function nearestSlotTo(fielders: readonly FielderState[], point: WorldPoint): number {
  let best = 0
  let bestDistance = 0x40000000
  for (const fielder of fielders) {
    const distance = horizontalDistance(fielder.position, point)
    if (distance < bestDistance && fielder.actionLockTicks <= 0) {
      bestDistance = distance
      best = fielder.slot
    }
  }
  return best
}
