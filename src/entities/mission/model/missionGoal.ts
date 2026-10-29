/**
 * 미션 모드 목표 판정.
 *
 * 원작 설명서: "타자편, 투수편으로 나누어지며 총 28개의 미션이 준비되어 있습니다.
 * 육성 선수 혹은 팀을 조작하여 제한 조건 내에서 게임 내 목표를..."
 *
 * 목표 이름과 필요 개수는 모두 원본 레코드에 있다 (goalCounts — 레코드 뒤쪽 칸).
 * 설명문의 숫자("2안타와 1타점을 올리자!")와 전부 일치하고, 설명문에 숫자가 없는
 * 목표(투수 1번 아웃 3)도 레코드에는 있다.
 *
 * 공개 이름 모음 — 하위 폴더 (`missionGoal/`): `missionLists`(목록 28개 · 대결 레코드 · 올클리어 0xa5184) · `goals`(진행 꼴 · 목표 개수 ·
 * 판정 0xaaa6c 의 목표 칸) · `batterRecord`(타자 목표 이름 · 정산 0xa8024) · `pitcherRecord`(투수 목표 · 아웃 콜 0xa7d0c) ·
 * `otherSlices`(다른 조각)
 */
export {
  ACE_CHALLENGE_MISSIONS,
  BATTER_MISSIONS,
  isEveryMissionCleared,
  isMissionSideAllCleared,
  MISSION_ALL_CLEAR_HIDDEN_ID,
  missionKeyOf,
  PITCHER_MISSIONS,
} from '@/entities/mission/model/missionGoal/missionLists'
export {
  createProgress,
  goalsOf,
  inningGoalOf,
  isCleared,
  judgedGoalsOf,
  OUTS_PER_INNING,
  requiredCountOf,
  unlistedGoalNamesOf,
  type MissionProgress,
} from '@/entities/mission/model/missionGoal/goals'
export { goalNamesFor, recordOutcome, recordSteal } from '@/entities/mission/model/missionGoal/batterRecord'
export { pitcherGoalNamesFor, recordPitcherOutcome, withOutCalls } from '@/entities/mission/model/missionGoal/pitcherRecord'
