import type { GameEvaluationInput } from '@/entities/career/model/gameEvaluation/game/types'
import { isSkillEquipped, type PlayerCareer } from '@/entities/career/model/playerCareer'

const WIN_MORALE = 5
const NOT_WIN_MORALE = -7
const LUCK_SKILL = 6
/** 라이벌 팀 쌍 (0xb8f68) — 이 두 팀이 붙으면 사기 변화가 2배다 */
const RIVAL_PAIRS: readonly (readonly [number, number])[] = [
  [0, 1],
  [2, 7],
  [3, 6],
  [4, 5],
  [8, 9],
]

export function isRivalGame(ourTeamId: number, opponentTeamId: number): boolean {
  return RIVAL_PAIRS.some(
    ([first, second]) => (first === ourTeamId && second === opponentTeamId) || (second === ourTeamId && first === opponentTeamId),
  )
}

/**
 * 사기 변화 (0xa73c4) — 승리 +5, 무승부 포함 그 밖은 −7.
 * 순서 (점검 9차 확정): 라이벌전 ×2 → 음수이고 인기도 변화가 2 이상이면 +절반 → 행운 스킬 +1.
 */
export function moraleChangeOf(career: PlayerCareer, game: GameEvaluationInput, popularityChange: number): number {
  let change = game.result === '승' ? WIN_MORALE : NOT_WIN_MORALE
  if (isRivalGame(game.ourTeamId, game.opponentTeamId)) change *= 2
  if (change < 0 && popularityChange > 1) change += Math.trunc(popularityChange / 2)
  // 행운은 장착 비트로 본다 (0xa741c → 0xa4bf8)
  return change + (isSkillEquipped(career, LUCK_SKILL) ? 1 : 0)
}
