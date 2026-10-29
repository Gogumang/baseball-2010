import { isBugFixed } from '@/shared/config/bugfixes'
import { isFightingSpiritSituationOf, isLiveGameFightingSpiritSituation, sideFightingSpiritStateOf } from '@/shared/lib/liveGameState/liveGameState'

/** CPU 끼리 경기 자신의 상태 한 벌 — 반 이닝 앞 (B-107 고친 길) */
export interface LeagueHalfInningGameState {
  /** +0x6b — 0 부터 */
  readonly inningIndex: number
  /** +0x28 · +0x29 — 원정 · 홈 */
  readonly sideTeamIds: readonly [number, number]
  /** +0x7e · +0x7f — 반 이닝 앞 점수 (원정 · 홈) */
  readonly scoresBefore: readonly [number, number]
  /** 이번 반 이닝 공격 측 — 득점이 이 측에 오른다 */
  readonly offenseSide: 0 | 1
}

/**
 * CPU 끼리 경기의 스킬 14(투지) 갈래 경기 상태가 `teamId` 에게 서는가 (`HalfInningDefense.fightingSpiritAt`).
 * - 원본(B-107): 0xb570c b5a16 이 늘 전역 [0x1552d0c] 를 읽어 **마지막 사람 경기**의 이닝 · 팀 · 점수를 본다
 *   (`isLiveGameFightingSpiritSituation`) — 사람 경기가 원정 승리로 끝났으면 그 +0x28 팀 말고 모든 팀이 내내 지는 측이다.
 * - 고친 길: 이 경기 자신의 상태 — 6회(+0x6b > 4)부터 지금 점수로 지는 측
 */
export function leagueFightingSpiritOf(game: LeagueHalfInningGameState, runsThisHalf: number, teamId: number): boolean {
  if (!isBugFixed('B-107')) return isLiveGameFightingSpiritSituation(teamId)
  const scores: [number, number] = [game.scoresBefore[0], game.scoresBefore[1]]
  scores[game.offenseSide] += runsThisHalf
  return isFightingSpiritSituationOf(sideFightingSpiritStateOf(game.inningIndex, game.sideTeamIds, scores), teamId)
}
