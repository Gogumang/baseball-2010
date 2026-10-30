import type {
  CompleteGameKind,
  PitcherEvaluationContext,
  PitcherEvaluationRecord,
} from '@/features/play-pitcher-game/model/pitcherGameEvaluation/types'

/** 완투인가 — `아웃 == 3·(state 이닝) + 3` (0xa6b3a) */
export function isCompleteGame(record: PitcherEvaluationRecord, endedInningIndex: number): boolean {
  return record.outsRecorded === 3 * endedInningIndex + 3
}

/** 정규 경기 아웃 수 — 퍼펙트·노히트 판정이 `아웃 ≤ 27` 을 함께 본다 */
export const REGULATION_OUTS = 27

/** 내준 것이 하나도 없는가 — 볼넷 · 사구 · 피안타 · 실점 0 이고 정규 아웃 안 (0xa6b2c) */
function isPerfectRecord(record: PitcherEvaluationRecord): boolean {
  const allowedNothing = record.walksAllowed === 0 && record.hitByPitch === 0 && record.hitsAllowed === 0
  return allowedNothing && record.runsAllowedField === 0 && record.outsRecorded <= REGULATION_OUTS
}

export function completeGameKindOf(record: PitcherEvaluationRecord, context: PitcherEvaluationContext): CompleteGameKind {
  if (!isCompleteGame(record, context.endedInningIndex)) return '없음'
  if (isPerfectRecord(record)) return '퍼펙트'
  const noRuns = record.runsAllowedField === 0
  if (record.hitsAllowed === 0 && noRuns) return '노히트'
  return noRuns ? '완봉' : '완투'
}
