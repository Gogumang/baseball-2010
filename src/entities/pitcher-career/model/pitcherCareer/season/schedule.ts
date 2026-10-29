import { opponentOf } from '@/entities/league/model/league'
import { GAMES_PER_MANAGEMENT_CYCLE, GAMES_PER_SEASON } from '@/entities/pitcher-career/model/pitcherCareer/constants'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer/types/pitcherCareer'

/** 다음 경기 상대 (0xb765c) — 타자편 `nextOpponentOf` 와 같은 규칙이다 */
export function nextPitcherOpponentOf(career: PitcherCareer): number {
  const series = career.postseason
  if (series !== null && series.round !== '종료') {
    if (series.teams[0] === career.teamId) return series.teams[1]
    if (series.teams[1] === career.teamId) return series.teams[0]
  }
  return opponentOf(career.gamesPlayed, career.teamId)
}

export function isPitcherManagementCycleOpen(career: PitcherCareer): boolean {
  return career.gamesPlayed > 0 && career.gamesPlayed % GAMES_PER_MANAGEMENT_CYCLE === 0
}

export function isPitcherSeasonFinished(career: PitcherCareer): boolean {
  return career.gamesPlayed >= GAMES_PER_SEASON
}
