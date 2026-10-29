/**
 * **루 커버 매 틱 다시 고르기** — 플레이 vt30 = `0xb1c90` 의 커버 부분과 커버 칸 넘기기 0xb2a48.
 *
 * 공개 이름 모음 — 하위 폴더 (`coverAssignment/`): `types`(입력 · 답) · `coverNeed`(0xb1b88 커버가 필요한가 · 0xb1268 · +0x168) ·
 * `assign/`(0xb1c90 차례 — 머리말은 `assignCovers` · 넘기기 b1d0a · 2루 커버와 도움 b1d96 · 되찾기 b23dc · 커버 상태 b2564) ·
 * `applyCover`(답 적기 · 0xb2a48 · AI 2~5 의 vt14)
 */
export { baseAtPoint, batterRunnerNeedsCover, needsCover, PLAY_FIELD_0X168 } from '@/entities/fielding/model/coverAssignment/coverNeed'
export { assignCoversForTick } from '@/entities/fielding/model/coverAssignment/assign/assignCovers'
export { applyCoverAssignment, claimCoverOfBase, withCoverBaseTarget } from '@/entities/fielding/model/coverAssignment/applyCover'
