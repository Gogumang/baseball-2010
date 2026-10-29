import { isStarterTypePosition } from '@/entities/pitcher-career/model/pitcherRole'
import { completeGameKindOf } from '@/features/play-pitcher-game/model/pitcherGameEvaluation/completeGame'
import { managerCommentIndexOf } from '@/features/play-pitcher-game/model/pitcherGameEvaluation/managerComment'
import { moraleChangeOf } from '@/features/play-pitcher-game/model/pitcherGameEvaluation/morale'
import { popularityChangeOf } from '@/features/play-pitcher-game/model/pitcherGameEvaluation/popularity'
import { applyReputationTail, reputationPartsOf } from '@/features/play-pitcher-game/model/pitcherGameEvaluation/reputation'
import type {
  PitcherEvaluationContext,
  PitcherEvaluationRecord,
  PitcherGameEvaluation,
} from '@/features/play-pitcher-game/model/pitcherGameEvaluation/types'

/** 순서도 원본 그대로다: **인기도 → 평판 → 사기** — 평판·사기가 인기도 p 를 읽는다 */
export function evaluatePitcherGame(record: PitcherEvaluationRecord, context: PitcherEvaluationContext): PitcherGameEvaluation {
  const popularityChange = popularityChangeOf(record, context)
  const parts = reputationPartsOf(record, context, popularityChange)
  return {
    popularityChange,
    reputationChange: applyReputationTail(parts, context.reputation),
    moraleChange: moraleChangeOf(context, popularityChange),
    managerCommentIndex: managerCommentIndexOf(context, popularityChange),
    completeGame: completeGameKindOf(record, context),
    countedCompleteGame: isStarterTypePosition(context.positionCode) && context.won ? completeGameKindOf(record, context) : '없음',
  }
}
