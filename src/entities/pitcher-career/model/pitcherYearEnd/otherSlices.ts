/**
 * 연말 사슬이 쓰는 **다른 조각**(시즌 끝 이벤트 번호 · 수상 · 국가대항전 · 포스트시즌 · 이벤트 보상)의 값 — 조각 경계를 넘는 import 를
 * 이 파일 한 곳에 모은다(`lint.boundaries-baseline.js` 의 cross-slice 예외는 이 파일 하나).
 */
export type { SeasonEndState } from '@/entities/career/model/playerCareer'
export {
  FINAL_RETIREMENT_EVENT_ID,
  GOAL_INTRO_EVENT_ID,
  goalResultEventId,
  NO_ENDING_JUDGEMENT,
  RELEASE_EVENT_ID,
  RETIREMENT_CHOICE_EVENT_ID,
  SALARY_ACCEPT_EVENT_ID,
  SALARY_EVENT_ID,
  SALARY_FIRM_EVENT_ID,
  SALARY_POLITE_EVENT_ID,
  salaryResultEventId,
} from '@/entities/career/model/seasonFlow'
export { leagueDayCounterOf } from '@/entities/career/model/leagueGameSetup'
export { entersYearEndChainInPostseason } from '@/entities/career/model/postseasonFlow'
export { MVP_INTRO_EVENT_ID, mvpResultEventId, TITLE_INTRO_EVENT_ID, titleResultEventId } from '@/entities/awards/model/seasonAwards'
export type { NationalCup } from '@/entities/national-cup/model/nationalCup'
export { careerNationalTeamEventId, isCareerNationalCupYear } from '@/entities/national-cup/model/nationalCupFlow'
export { rewardsIn, type EventReward } from '@/entities/story/model/eventReward'
export type { OriginalEvent } from '@/shared/config/original/eventTypes'
