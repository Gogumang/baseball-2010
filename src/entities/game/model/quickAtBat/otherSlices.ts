/**
 * 간이 타석이 쓰는 **다른 조각**(타석 결과 · 스윙 판정 0xab214 · 보정 구조체)의 값 — 조각 경계를 넘는 import 를 이 파일 한 곳에 모은다
 * (`lint.boundaries-baseline.js` 의 cross-slice 예외는 이 파일 하나).
 */
export type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
export type { SwingBoost } from '@/entities/batting/model/swingBoost'
export { swingResultOf } from '@/entities/batting/model/swingResult'
export type { SwingMode, SwingResultInput } from '@/entities/batting/model/swingResult'
