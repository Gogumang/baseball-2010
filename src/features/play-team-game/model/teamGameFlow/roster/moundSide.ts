import type { TeamEntryPitcher } from '@/features/play-team-game/model/teamGameRoster'
import type { MoundPitcherCounters } from '@/entities/pitching/model/pitcherChange'
import { pitcherEntriesOf } from '@/features/play-team-game/model/teamGameFlow/roster/pitchers'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/**
 * **한쪽 마운드** — 우리 · 상대 투수 칸을 칸마다 `ours ? … : …` 로 고르지 않도록 한 번에 모은 것.
 * 우리 마운드 스태미나는 `stamina`, 상대는 `opponentStamina` 다(내려간 투수 몫은 `*PitcherStaminas`).
 */
export interface MoundSide {
  readonly ours: boolean
  readonly teamId: number
  readonly entries: readonly TeamEntryPitcher[]
  /** 지금 마운드 투수의 명단 칸 */
  readonly pitcherIndex: number
  readonly usedPitchers: readonly number[]
  readonly stamina: number
  readonly staminas: readonly number[]
  readonly counters: MoundPitcherCounters
}

export function moundSideOf(progress: TeamGameProgress, ours: boolean): MoundSide {
  const teamId = ours ? progress.options.ourTeamId : progress.options.opponentTeamId
  const entries = pitcherEntriesOf(progress, teamId)
  if (ours) {
    return {
      ours,
      teamId,
      entries,
      pitcherIndex: progress.ourPitcherIndex,
      usedPitchers: progress.ourUsedPitchers,
      stamina: progress.stamina,
      staminas: progress.ourPitcherStaminas,
      counters: progress.ourPitcherCounters,
    }
  }
  return {
    ours,
    teamId,
    entries,
    pitcherIndex: progress.opponentPitcherIndex,
    usedPitchers: progress.opponentUsedPitchers,
    stamina: progress.opponentStamina,
    staminas: progress.opponentPitcherStaminas,
    counters: progress.opponentPitcherCounters,
  }
}
