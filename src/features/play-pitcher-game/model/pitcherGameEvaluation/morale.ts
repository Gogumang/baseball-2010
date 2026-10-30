import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import type { PitcherEvaluationContext } from '@/features/play-pitcher-game/model/pitcherGameEvaluation/types'

/* ── 5-4. 사기 0xa73c4 ─────────────────────────────────────────────────────────── */

/**
 * 사기 변화. 투수편 **선발만** 한 줄이 더 있다 — p 를 반으로 줄여 타자 눈금과 맞춘다 (0xa73e6).
 */
export function moraleChangeOf(context: PitcherEvaluationContext, popularity: number): number {
  let change = context.won ? 5 : -7
  if (context.isRivalGame === true) change *= 2
  let p = popularity
  if (context.role === PITCHER_ROLE.starter && p > 0) p = Math.trunc(p / 2)
  if (change < 0 && p > 1) change += Math.trunc(p / 2)
  if (context.hasLuckSkill === true) change += 1
  return change
}
