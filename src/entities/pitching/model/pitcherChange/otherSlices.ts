/**
 * 투수 교체가 쓰는 **다른 조각**(투수 커리어의 보직 · 스태미나)의 값 — 조각 경계를 넘는 import 를 이 파일 한 곳에 모은다
 * (`lint.boundaries-baseline.js` 의 cross-slice 예외는 이 파일 하나).
 */
export { PITCHER_ROLE, type PitcherRole } from '@/entities/pitcher-career/model/pitcherRole'
export { FULL_STAMINA, staminaPercentOf } from '@/entities/pitcher-career/model/pitcherStamina'
