/**
 * **사람 타자의 투구 하나 판정** (원본 0x51294 ~ 0x51682 · 상태 0x12 진입 0x3dfac) — 공개 이름 모음.
 *
 * 하위 폴더 (`resolvePitch/`): `types`(스윙 입력 0x53670 · 판정 문맥 · 결과 칸) · `plateJudgement`(판정 오차 0x51226 · 사구 상자 0x35a20 ·
 * 스트라이크 상자 0x3dfd8) · `takenPitch`(안 친 공 · 판정 없는 스윙) · `rollSwingResult`(스윙 판정 0xab214) ·
 * `contactDetail`(헛스윙 0x51350 · 맞은 공 파울 각 0x9d660) · `resolve`(차례 묶음) · `contactOutcome`(판 입력의 쏜 공 결과)
 */
export type { BattingContext, BattingSwing, PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch/types'
export { isHitByPitch, isStrikeZonePitch, plateErrorOf, STRIKE_ZONE_BOXES } from '@/features/play-at-bat/model/resolvePitch/plateJudgement'
export { unjudgedSwingDetailOf } from '@/features/play-at-bat/model/resolvePitch/takenPitch'
export { resolvePitch } from '@/features/play-at-bat/model/resolvePitch/resolve'
export { contactOutcomeOfDetail } from '@/features/play-at-bat/model/resolvePitch/contactOutcome'
