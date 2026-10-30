/**
 * 투수편 **경기 뒤 평가** (binary.mod 인기도 0xa690c · 평판 0xa6218 · 사기 0xa73c4 ·
 * 감독 글 0x1278c — P1 5절 전체, 확정).
 *
 * 순서도 원본 그대로다: **인기도 → 평판 → 사기**. 인기도 함수가 마지막에 `career+0x4a = p` 를 적고
 * 평판·사기가 그 p 를 읽으므로 앞뒤를 바꾸면 값이 달라진다 (P1 5-2 의 정정).
 *
 * 하위 폴더 (`pitcherGameEvaluation/`): `types` · `completeGame`(완투 계열 0xa6b3a) · `scoreSteps`(문턱 사다리) · `popularity`(인기도 0xa690c) ·
 * `reputation`(평판 0xa6218 · 꼬리 0xa6686) · `morale`(사기 0xa73c4) · `managerComment`(감독 글 0x1278c) · `evaluate`(한꺼번에)
 */
export {
  EMPTY_PITCHER_EVALUATION_RECORD,
  type PitcherEvaluationContext,
  type PitcherEvaluationRecord,
  type PitcherGameEvaluation,
} from '@/features/play-pitcher-game/model/pitcherGameEvaluation/types'
export { completeGameKindOf } from '@/features/play-pitcher-game/model/pitcherGameEvaluation/completeGame'
export { popularityChangeOf } from '@/features/play-pitcher-game/model/pitcherGameEvaluation/popularity'
export {
  applyReputationTail,
  REPUTATION_GAIN_TABLE,
  REPUTATION_PENALTY_TABLE,
  reputationPartsOf,
} from '@/features/play-pitcher-game/model/pitcherGameEvaluation/reputation'
export { moraleChangeOf } from '@/features/play-pitcher-game/model/pitcherGameEvaluation/morale'
export { managerCommentIndexOf, MANAGER_TEXT_SECTION_STARTS } from '@/features/play-pitcher-game/model/pitcherGameEvaluation/managerComment'
export { evaluatePitcherGame } from '@/features/play-pitcher-game/model/pitcherGameEvaluation/evaluate'
