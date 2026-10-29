/**
 * 나만의리그 한 해의 흐름 — 누락 탐색 에이전트가 binary.mod 에서 읽은 규칙.
 *   22경기 뒤 중간평가(0x11e84) → 45경기 뒤 목표 평가 392 → 393~396 → 타이틀 370 → 371~374
 *   → MVP 375 → 376/377 → 포스트시즌 대진 128 → 연말(0x10c54)
 *   연말: 방출 501 · 13년차 은퇴식 504 · 7년차 이상 은퇴 선택 502 · 그 밖 연봉협상 380
 * 사슬 잇기는 `app/model/seasonEvents.nextSeasonStep`, 타이틀·MVP 판정은 `entities/awards/model/seasonAwards`.
 *
 * 공개 이름 모음 — 하위 폴더 (`seasonFlow/`): `yearGoals`(올해의 목표 0xd7f9e · 창 0x8656c · 중간평가 0x11e84 · 392~396) ·
 * `ending`(엔딩 판정 0xa3a84 · B-76 · 저장 141 · 연애 엔딩 0x87c7c) · `endingAftermath`(보너스 0xcc40c · 이어하기 0x1bd36 · 연말 이벤트) ·
 * `salary`(연봉 제시 0xa39fc · 변동 0x8cac0 · B-69 · 레코드 +0x1b 0xa4fd8)
 */
export {
  achievedGoalCount,
  GOAL_INTRO_EVENT_ID,
  goalResultEventId,
  MID_SEASON_GAME,
  midSeasonEventId,
  midSeasonTitlesOf,
  yearGoalsOf,
  yearGoalWindowValuesOf,
  type YearGoalWindowValues,
} from '@/entities/career/model/seasonFlow/yearGoals'
export { judgeEnding, NO_ENDING_JUDGEMENT, romanceEndingIndexOf, romanceEventsSeenOf, savedCareerOf } from '@/entities/career/model/seasonFlow/ending'
export {
  applyEndingBonus,
  canContinueAfterEnding,
  continueAfterEnding,
  continueAfterEndingPayment,
  CONTINUE_COST_GAME_POINT,
  endingBonusOf,
  FINAL_RETIREMENT_EVENT_ID,
  INJURY_ENDING_EVENT_ID,
  INJURY_ENDING_INDEX,
  isContinuableEnding,
  RELEASE_EVENT_ID,
  RETIREMENT_CHOICE_EVENT_ID,
  yearEndEventId,
} from '@/entities/career/model/seasonFlow/endingAftermath'
export {
  applySalaryChange,
  nariRecordSalaryGradeOf,
  nariRecordSalaryGradeOfCareer,
  SALARY_ACCEPT_EVENT_ID,
  SALARY_EVENT_ID,
  SALARY_FIRM_EVENT_ID,
  SALARY_POLITE_EVENT_ID,
  salaryOfferOf,
  salaryResultEventId,
  type SalaryHolder,
} from '@/entities/career/model/seasonFlow/salary'
