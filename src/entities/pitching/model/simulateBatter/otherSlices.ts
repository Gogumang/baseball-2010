/**
 * CPU 타자 반응이 쓰는 **다른 조각**(타석 판정 꼴 · batting 스윙 판정 0xab214 · 보정 구조체 0x34d6c · 필살 · 타이밍 · 방향 · 타구 패턴)의
 * 값 — 조각 경계를 넘는 import 를 이 파일 한 곳에 모은다(`lint.boundaries-baseline.js` 의 cross-slice 예외는 이 파일 하나).
 */
export type { PitchResolution } from '@/entities/at-bat/model/atBatState'
export { contactOfPattern, drawScenePattern, launchPatternOf } from '@/entities/batting/model/battedBallOutcome'
export { provisionalOutcomeOf, registerContact, type BattedContact } from '@/entities/batting/model/battedContact'
export type { BatterAbility } from '@/entities/batting/model/batter'
export { hitDirectionOf } from '@/entities/batting/model/hitDirection'
export { remainingAfterSpecialSwing, rollSpecialSwing } from '@/entities/batting/model/specialSwing'
export { pitcherBoostSideOf, swingBoostOf } from '@/entities/batting/model/swingBoost'
export { swingResultOf } from '@/entities/batting/model/swingResult'
export type { SwingMode, SwingResultInput } from '@/entities/batting/model/swingResult'
export type { SwingSituation } from '@/entities/batting/model/swingSkills'
export { timingOf } from '@/entities/batting/model/swingTiming'
