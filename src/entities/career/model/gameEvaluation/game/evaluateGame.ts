import { managerCommentIndexOf } from '@/entities/career/model/gameEvaluation/game/managerComment'
import { moraleChangeOf } from '@/entities/career/model/gameEvaluation/game/morale'
import { popularityChangeOf } from '@/entities/career/model/gameEvaluation/game/popularityChange'
import { reputationChangeOf } from '@/entities/career/model/gameEvaluation/game/reputationChange'
import type { GameEvaluation, GameEvaluationInput } from '@/entities/career/model/gameEvaluation/game/types'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'

/** 경기 뒤 평가 — 인기도 → 평판 → 사기 차례, 인기도 변화(−2~6)가 곧 평가 등급이다 */
export function evaluateGame(career: PlayerCareer, game: GameEvaluationInput): GameEvaluation {
  const popularityChange = popularityChangeOf(game.popularityPoints, game.stats)
  return {
    popularityChange,
    // 평판 구간 보정은 **경기 전 평판**으로 칸을 고른다 (0xa6218 이 먼저 읽는다)
    reputationChange: reputationChangeOf(popularityChange, game, career.reputation),
    moraleChange: moraleChangeOf(career, game, popularityChange),
    commentIndex: managerCommentIndexOf(career, popularityChange),
  }
}
