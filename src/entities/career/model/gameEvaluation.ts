/**
 * 경기 후 평가 (누락 탐색 3차 — binary.mod 0xa719c · 0xa59c0 · 0xa690c · 0xa6218 · 0xa73c4 · 0x1278c · 0x8a6fc).
 * 매 경기 뒤 인기도 → 평판 → 사기 순으로 바뀌고, 인기도 변화(−2~6)가 곧 평가 등급이다.
 * **덜 읽은 것**: 평판 변화 뒷부분의 의미 미확인 항목, 인기도 카운터 +0x108, 진루 보너스(r6).
 *
 * 공개 이름 모음 — 하위 폴더 (`gameEvaluation/`): `atBat/`(타석 인기도 0xa59c0 · 감점 칸 a5ab2) ·
 * `game/`(입력 · 평판 가산 칸 0xa57f8 · 인기도 변화 0xa690c · 평판 변화 0xa6218 · 사기 0xa73c4 · 감독 평가 글 0x1278c · 평가 차례) ·
 * `streak/`(연속 기록 칸 0xa719c · 알림 · 보상 명령 0x8a6fc) · `otherSlices`(다른 조각)
 */
export { atBatPopularityPoints } from '@/entities/career/model/gameEvaluation/atBat/popularityPoints'
export { atBatPenaltyCounts } from '@/entities/career/model/gameEvaluation/atBat/penaltyCounts'
export { EMPTY_REPUTATION_COUNTS, type GameEvaluation, type ReputationCounts } from '@/entities/career/model/gameEvaluation/game/types'
export { popularityChangeOf } from '@/entities/career/model/gameEvaluation/game/popularityChange'
export { managerCommentIndexOf } from '@/entities/career/model/gameEvaluation/game/managerComment'
export { evaluateGame } from '@/entities/career/model/gameEvaluation/game/evaluateGame'
export { advanceStreaks } from '@/entities/career/model/gameEvaluation/streak/advanceStreaks'
export type { StreakNotice } from '@/entities/career/model/gameEvaluation/streak/streakNotices'
export { streakEventOf, updateStreaks } from '@/entities/career/model/gameEvaluation/streak/streakEvent'
