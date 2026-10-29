import { applyPitchResolution } from '@/entities/at-bat/model/atBatState'
import type { AtBatState } from '@/entities/at-bat/model/atBatState'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow'
import { pitchResultEntryDelayTicksOf, pitchSceneBusyTicksOf } from '@/widgets/batting-stage/lib/pitcherSideStage'
import { teamPitcherSideStageOf } from '@/pages/team-game/lib/teamMatchupCards'
import { resultWaitTicksOf } from './otherSlices'

type ThrownResolution = NonNullable<TeamGameProgress['lastResolution']>

/** 던진 공으로 끝난 타석 결과의 0x12 대기 틱 (15, 타석 끝 31 — 0x4e6d4) */
export function thrownWaitTicksOf(atBatBeforeThrow: AtBatState, thrown: ThrownResolution): number {
  return resultWaitTicksOf(applyPitchResolution(atBatBeforeThrow, thrown).outcome)
}

/** 놓은 공의 남은 0x11 비행 + 0x12 대기 — 마투수가 던졌으면 공 틱이 오르는 단계가 0xcfbe4[순번]이라 0x11 이 그만큼 길다 (0x3f378) */
export function thrownBusyTicksOf(progress: TeamGameProgress, waitTicks: number): number {
  return pitchSceneBusyTicksOf(progress.lastPitch?.frameCount ?? 0, waitTicks, teamPitcherSideStageOf(progress).acePitcher?.order)
}

/** 내 공의 공 끝 대기 — 놓은 틱부터 0x12 틱 0 까지(`pitchResultEntryDelayTicksOf`)를 앞에 붙인다 */
export function thrownPitchEndTicksOf(progress: TeamGameProgress, waitTicks: number): number {
  return pitchResultEntryDelayTicksOf(progress.lastPitch?.frameCount ?? 0, teamPitcherSideStageOf(progress).acePitcher?.order) - 1 + waitTicks
}
