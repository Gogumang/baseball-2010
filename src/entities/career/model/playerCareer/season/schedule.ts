import { opponentOf } from '@/entities/league/model/league'
import { GAMES_PER_MANAGEMENT_CYCLE, GAMES_PER_SEASON } from '@/entities/career/model/playerCareer/constants'
import type { PlayerCareer } from '@/entities/career/model/playerCareer/types/playerCareer'

/**
 * 다음 경기 상대 (0xb765c).
 * 정규시즌은 일정표 0xd89cb 에서 그날 상대를 읽고, 포스트시즌은 지금 시리즈의 맞은편이다.
 * 포스트시즌인데 내 팀이 그 시리즈에 없으면(진출 실패) 상대가 없다 — 그때는 일정표로 돌아간다 (추정).
 */
export function nextOpponentOf(career: PlayerCareer): number {
  const series = career.postseason
  if (series !== null && series.round !== '종료') {
    if (series.teams[0] === career.teamId) return series.teams[1]
    if (series.teams[1] === career.teamId) return series.teams[0]
  }
  return opponentOf(career.gamesPlayed, career.teamId)
}

export function isManagementCycleOpen(career: PlayerCareer): boolean {
  return career.gamesPlayed > 0 && career.gamesPlayed % GAMES_PER_MANAGEMENT_CYCLE === 0
}

export function isSeasonFinished(career: PlayerCareer): boolean {
  return career.gamesPlayed >= GAMES_PER_SEASON
}
