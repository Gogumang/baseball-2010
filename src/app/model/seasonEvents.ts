import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import {
  achievedGoalCount,
  ENDING_EVENT_IDS,
  GOAL_INTRO_EVENT_ID,
  goalResultEventId,
  judgeEnding,
  RELEASE_EVENT_ID,
  SALARY_ACCEPT_EVENT_ID,
  SALARY_FIRM_EVENT_ID,
  SALARY_POLITE_EVENT_ID,
  salaryResultEventId,
  yearEndEventId,
} from '@/entities/career/model/seasonFlow'

/** 시즌 이벤트 하나를 마친 뒤 할 일 */
export type SeasonStep =
  | { readonly kind: '이벤트'; readonly eventId: number }
  | { readonly kind: '새시즌' }
  | { readonly kind: '엔딩'; readonly endingIndex: number }
  | { readonly kind: '관리' }

const GOAL_RESULT_EVENT_IDS = [393, 394, 395, 396]
const SALARY_RESULT_EVENT_IDS = [384, 385, 386, 387, 388, 389, 390, 391]
const INJURY_ENDING_EVENT_ID = 500
const INJURY_ENDING = 0
const RELEASE_ENDING = 1
const RETIREMENT_ENDING = 2
/** 개인 타이틀·MVP 가 아직 없어 연봉 등급은 0 이다 */
const TITLE_RANK = 0

/**
 * 연말 이벤트 연결 (누락 탐색 에이전트: 0x10bb0 · 0x8d0dc · 0x10c54 · 0x8d05a).
 * 선택지로 이어진 이벤트까지 본 번호 목록으로 다음 단계를 정한다.
 */
export function nextSeasonStep(career: PlayerCareer, viewed: readonly number[]): SeasonStep {
  const saw = (id: number) => viewed.includes(id)

  if (viewed.some((id) => ENDING_EVENT_IDS.has(id))) {
    const endingIndex = saw(INJURY_ENDING_EVENT_ID)
      ? INJURY_ENDING
      : saw(RELEASE_EVENT_ID)
        ? RELEASE_ENDING
        : (judgeEnding(career) ?? RETIREMENT_ENDING)
    return { kind: '엔딩', endingIndex }
  }
  if (viewed.some((id) => SALARY_RESULT_EVENT_IDS.includes(id)) || saw(SALARY_ACCEPT_EVENT_ID)) {
    return { kind: '새시즌' }
  }
  if (saw(SALARY_FIRM_EVENT_ID) || saw(SALARY_POLITE_EVENT_ID)) {
    const choice = saw(SALARY_FIRM_EVENT_ID) ? SALARY_FIRM_EVENT_ID : SALARY_POLITE_EVENT_ID
    return { kind: '이벤트', eventId: salaryResultEventId(choice, TITLE_RANK) }
  }
  if (viewed.some((id) => GOAL_RESULT_EVENT_IDS.includes(id))) {
    return { kind: '이벤트', eventId: yearEndEventId(career) }
  }
  if (saw(GOAL_INTRO_EVENT_ID)) {
    return { kind: '이벤트', eventId: goalResultEventId(achievedGoalCount(career, '연말')) }
  }
  return { kind: '관리' }
}
