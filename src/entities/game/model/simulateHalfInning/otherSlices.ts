/**
 * 반 이닝 엔진이 쓰는 **다른 조각**(투수 · 투수편 · 타석 결과)의 값 — 조각 경계를 넘는 import 를 이 파일 한 곳에 모은다.
 * 엔진 안 파일은 이 이름들을 여기서만 꺼낸다(`lint.boundaries-baseline.js` 의 cross-slice 예외는 이 파일 하나).
 */
export type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
export { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
export type { PitcherRole } from '@/entities/pitcher-career/model/pitcherRole'
export {
  FULL_STAMINA,
  abilityAfterFatigue,
  consumeStamina,
  pitchStaminaCostOf,
  staminaCapacityOf,
  staminaPercentOf,
} from '@/entities/pitcher-career/model/pitcherStamina'
export { judgePitcherChange, replacementPitcherSlotOf } from '@/entities/pitching/model/pitcherChange'
export type { ReplacementCandidate } from '@/entities/pitching/model/pitcherChange'
export { withFightingSpirit } from '@/entities/pitching/model/pitcherGameStats'
