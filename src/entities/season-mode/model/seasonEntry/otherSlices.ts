/**
 * 시즌 엔트리 명단이 쓰는 **다른 조각**(마선수 · 로테이션 · 체력 · 팀 표 · 마선수 레벨)의 값 — 조각 경계를 넘는 import 를 이 파일 한 곳에 모은다.
 * 안쪽 파일은 이 이름들을 여기서만 꺼낸다(`lint.boundaries-baseline.js` 의 cross-slice 예외는 이 파일 하나).
 */
export { ACE_BATTERS, ACE_PITCHERS } from '@/entities/game/model/aceOpponent'
export { aceLevelOf, aceLevelSlotOf, aceRecordAbilityAtLevel } from '@/entities/mission/model/aceLevel'
export type { PitcherRole } from '@/entities/pitcher-career/model/pitcherRole'
export { ROTATION_SIZE, rotationSlotOf } from '@/entities/pitcher-career/model/pitcherRotation'
export { staminaCapacityOf } from '@/entities/pitcher-career/model/pitcherStamina'
export { recordAbilityOf } from '@/entities/team/model/recordAbility'
export { teamBatters, teamPitchers } from '@/entities/team/model/teamRoster'
