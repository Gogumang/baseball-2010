import { missionBatterSlotOf, offenseOf } from '@/entities/mission/model/missionRunners/offense'
import {
  EMPTY_BASE_RUNNERS,
  effectiveRunnersOf,
  lineupSlotOf,
  runnersAfterPlay,
  runnersBehindCursor,
  survivorsWithoutPlayOf,
  type BaseRunners,
  type BaseState,
} from '@/entities/mission/model/missionRunners/otherSlices'
import type { MissionRunnerSituation } from '@/entities/mission/model/missionRunners/types'

/** **시작 주자** — 0xaae7c aafbc → 0xa9a10 (`runnersBehindCursor`) */
export function missionStartRunnersOf(run: Omit<MissionRunnerSituation, 'runners'>): BaseRunners {
  return runnersBehindCursor(run.bases, missionBatterSlotOf(run))
}

/** 지금 루에 선 주자의 신원 — 들고 있는 신원이 루와 맞으면 그것, 아니면 예전 근사(지금 타순 칸에서 거꾸로 b 번째가 b 루) */
export function missionRunnersOf(run: MissionRunnerSituation): BaseRunners {
  const order = offenseOf(run)?.order ?? 0
  return effectiveRunnersOf(run.bases, run.runners, (ordersBack) => lineupSlotOf(order - ordersBack))
}

/** 판의 살아남은 주자 — 운명이 있으면 그것, 없고 결과 종류를 알면 진행기를 안 도는 결과의 정산 목록 */
function survivorsOf(
  before: MissionRunnerSituation,
  change: { readonly survivorsFromBase?: readonly number[]; readonly outcomeKind?: string },
): readonly number[] | null {
  if (change.survivorsFromBase !== undefined) return change.survivorsFromBase
  return change.outcomeKind === undefined ? null : survivorsWithoutPlayOf(before.bases, change.outcomeKind)
}

/**
 * 플레이 하나 뒤의 신원 — 지금 타석 타자 칸(판 앞 타순)과 판의 살아남은 주자(`survivorsFromBase` — 주자 운명의 득점도 처리 끝도
 * 아닌 주자, 0 = 타자주자)로 앉힌다. 운명이 없으면 진행기를 안 도는 결과의 정산 목록(`survivorsWithoutPlayOf`)으로.
 * 3아웃이면 빈 루.
 */
export function missionRunnersAfterPlay(
  before: MissionRunnerSituation,
  next: { readonly bases: BaseState; readonly inningOver: boolean },
  change: {
    readonly batterReached: boolean
    readonly runsScored: number
    readonly survivorsFromBase?: readonly number[]
    readonly outcomeKind?: string
  },
): BaseRunners {
  if (next.inningOver) return EMPTY_BASE_RUNNERS
  const survivors = survivorsOf(before, change)
  return runnersAfterPlay(missionRunnersOf(before), next.bases, {
    batter: missionBatterSlotOf(before),
    batterReached: change.batterReached,
    runsScored: change.runsScored,
    ...(survivors === null ? {} : { survivorsFromBase: survivors }),
  })
}
