/**
 * 기록연감 · 명예의 전당이 쓰는 **다른 조각**(타자편 · 투수편 커리어 — 능력치 · 장비 · 시즌 줄 · 엔딩)의 값 —
 * 조각 경계를 넘는 import 를 이 파일 한 곳에 모은다. 안쪽 파일은 이 이름들을 여기서만 꺼낸다(`lint.boundaries-baseline.js` 의
 * cross-slice 예외는 이 파일 하나).
 */
export type { BatterAbility } from '@/entities/batting/model/batter'
export { equippedAbilityOf } from '@/entities/career/model/condition'
export { FIRST_HIDDEN_LEVEL, hiddenOpenIdOf, ownsEquipment } from '@/entities/career/model/equipment'
export type { PlayerCareer } from '@/entities/career/model/playerCareer'
export { nariRecordSalaryGradeOfCareer, romanceEndingIndexOf } from '@/entities/career/model/seasonFlow'
export { batterRecordLineOf } from '@/entities/career/model/seasonStats'
export { PITCHER_ABILITY_ORDER, type PitcherAbility } from '@/entities/pitcher-career/model/pitcherAbility'
export { equippedPitcherAbilityOf, pitcherRecordLineOf, type PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
export { ownsPitcherEquipment, pitcherHiddenOpenIdOf } from '@/entities/pitcher-career/model/pitcherEquipment'
export type { PitcherRole } from '@/entities/pitcher-career/model/pitcherRole'
export { FULL_STAMINA } from '@/entities/pitcher-career/model/pitcherStamina'
