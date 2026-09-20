import type { BattedBallTrajectory, CatchTable, CatchOpportunity, ChaseChoice } from '@/entities/fielding/model/catchPrediction'
import {
  CATCH_KIND,
  catchKindsAt,
  chooseChaser,
  EMPTY_CATCH_TABLE,
} from '@/entities/fielding/model/catchPrediction'
import {
  horizontalDistance,
  ticksToReach,
  type WorldPoint,
} from '@/entities/fielding/model/fieldGeometry'
import type { FielderState } from '@/entities/fielding/model/fieldingState'

/**
 * 포구 예보 — 타구가 떠난 순간 "누가 몇 틱에 잡는가" 를 한 번에 정한다.
 *
 * 원본 0xb12d0 은 야수 9명을 **복제해** 궤적 점마다 굴려 보고 종류별 가장 이른 포구 틱 표를 만든다
 * (P2 2a). 여기서는 복제 대신 **"그 점에 제 시간에 닿을 수 있는 야수는 그 점에 서 있다고 본다"** 로
 * 줄였다 — `ticksToReach(시작 위치, 그 점) ≤ 틱` 이면 후보로 넣고, 그 다음은 원본 `catchKindsAt` 의
 * 높이 창이 종류를 가른다. **근사이고, 원본 궤적 루프는 건드리지 않는다.**
 */

/** 표를 만들 때 살펴볼 최대 틱 — 궤적이 짧아도 `pointAt` 이 마지막 점을 물고 있어 굴러 멈춘 공까지 찾는다 */
const FORECAST_TICKS = 200

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

/**
 * @param window 살펴볼 틱 구간. 뜬공(잡히는 타구)은 `[0, 낙구 틱]`, 굴러간 타구는 `[낙구 틱, ∞)` 를 본다.
 *   구간을 밖에서 주는 이유는 **타자주자의 운명이 결과 코드로 이미 정해져 있기 때문**이다 (아래 주석 참고).
 */
export function forecastCatch(
  trajectory: BattedBallTrajectory,
  fielders: readonly FielderState[],
  window: { readonly from: number; readonly to: number },
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
  for (let tick = Math.max(0, window.from); tick <= last; tick += 1) {
    const ball = trajectory.pointAt(tick)
    for (const fielder of fielders) {
      if (ticksToReach(fielder.position, ball, fielder.speed) > tick) continue
      const kinds = catchKindsAt({
        slot: fielder.slot,
        // 제 시간에 닿는 야수는 그 점에 서 있다고 본다 (위 주석의 근사)
        fielder: ball,
        ball,
        tick,
        landingTick: trajectory.landingTick,
      })
      for (const kind of kinds) {
        const key = keyOf[kind]
        if (table[key] === null) table[key] = { tick, slot: fielder.slot }
      }
    }
    // 종류가 다 찼으면 더 볼 것이 없다
    if (table.low !== null && table.chest !== null && table.grounder !== null) break
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
