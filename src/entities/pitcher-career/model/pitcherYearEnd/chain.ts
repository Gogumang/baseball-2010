import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import type { SeasonEndState } from '@/entities/pitcher-career/model/pitcherYearEnd/otherSlices'
import {
  judgePitcherEnding,
  judgePitcherSeasonAwards,
  pitcherSalaryNegotiationRankOf,
  pitcherYearEndStepOf,
  PITCHER_RELEASE_ENDING,
  recordPitcherSeasonMvp,
} from '@/entities/pitcher-career/model/pitcherSeasonFlow'
import { achievedPitcherGoalCount } from '@/entities/pitcher-career/model/pitcherYearGoals'
import {
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
} from '@/entities/pitcher-career/model/pitcherYearEnd/otherSlices'
import {
  MVP_INTRO_EVENT_ID,
  mvpResultEventId,
  TITLE_INTRO_EVENT_ID,
  titleResultEventId,
} from '@/entities/pitcher-career/model/pitcherYearEnd/otherSlices'

/** 연말 사슬 — 본 번호로 다음 걸음 고르기(0x1cdec 136 → 130 → 131 → 132) · 이벤트 진입 상태. 머리말은 `../pitcherYearEnd.ts` */

/** 393~396 — 목표 결과 */
const GOAL_RESULT_EVENT_IDS: readonly number[] = [393, 394, 395, 396]
/** 371~374 — 타이틀 결과 */
const TITLE_RESULT_EVENT_IDS: readonly number[] = [371, 372, 373, 374]
/** 376·377 — MVP 결과 */
const MVP_RESULT_EVENT_IDS: readonly number[] = [376, 377]
/** 384~391 — 연봉 결과 */
const SALARY_RESULT_EVENT_IDS: readonly number[] = [384, 385, 386, 387, 388, 389, 390, 391]

/** 연말 사슬의 다음 걸음 */
export type PitcherYearEndEventStep =
  | { readonly kind: '이벤트'; readonly eventId: number }
  /** 383 수락 · 384~391 연봉 결과 뒤 — 새 시즌 처리 0x1b768 (`startNextPitcherSeason`) */
  | { readonly kind: '새시즌' }
  /** 500·501·503·504 뒤 — 엔딩 화면 141 */
  | { readonly kind: '엔딩'; readonly endingIndex: number }
  /** 131(376/377) 뒤 — 포스트시즌 대진 128 */
  | { readonly kind: '포스트시즌' }

/** 128 을 마쳤다는 표시 — 이벤트 번호가 아니라 사슬의 `viewed` 에 얹는 웹 표식이다 */
export const PITCHER_POSTSEASON_STEP_ID = -128

/** 연말 분기 0x10c54 의 이벤트 번호 — `pitcherYearEndStepOf` 와 같은 판정을 번호로 낸다 */
export function pitcherYearEndEventIdOf(career: PitcherCareer): number {
  const step = pitcherYearEndStepOf(career)
  if (step.kind === '엔딩') {
    return step.endingIndex === PITCHER_RELEASE_ENDING ? RELEASE_EVENT_ID : FINAL_RETIREMENT_EVENT_ID
  }
  return step.kind === '은퇴선택' ? RETIREMENT_CHOICE_EVENT_ID : SALARY_EVENT_ID
}

/**
 * 본 이벤트 번호들(`viewed`, 이번 연말에 본 것 전부)로 다음 걸음을 고른다.
 * 타자편 `app/model/seasonEvents.nextSeasonStep` 과 같은 꼴이고, 그 사이에 130·131(370~377)이 든다.
 * 늦은 단계부터 본다 — 앞 단계 번호가 `viewed` 에 남아 있어도 뒤 단계가 이긴다.
 */
export function nextPitcherYearEndStep(
  career: PitcherCareer,
  viewed: readonly number[],
  /**
   * [0x1552adc] — 재생이 첫 종류 21 로 끝났는가(0x8d4ce). 엔딩은 본 번호가 아니라 이 칸으로 간다(114 끝 0x1c014 1c088 → 141).
   * 엔딩 번호는 141 진입 0x12300 이 `e = 0xa3a85(S)` 하나로 **새로 판정한다** — 12300~12312 는 S+0x50 = 6 뒤 곧장
   * `0xa3a85([this+0xb0])` 이고 모드 갈림이 없으며, 판정 0xa3a84 안(a3a84~a3b7a)에도 모드를 보는 줄이 없다(직접 떴다).
   * 곧 투수편도 타자편 `judgeEnding` 과 같은 `judgePitcherEnding` 하나다. 500(부상 누적 > 19 → 0) · 501(7년차 인기도 ≤ 499 → 1) ·
   * 504(13년차)는 같은 판정이 고른 이벤트이고 그 사이 값을 바꾸는 보상이 없어(500 · 501 · 503 · 504 의 보상은 종류 21 하나)
   * 예전 번호와 같다. 판정 없음(−1)은 그대로 넘긴다(`NO_ENDING_JUDGEMENT` — 0x12300 은 고치지 않는다).
   */
  endingRequested = false,
): PitcherYearEndEventStep {
  if (endingRequested) return { kind: '엔딩', endingIndex: judgePitcherEnding(career) ?? NO_ENDING_JUDGEMENT }
  const stage = YEAR_END_STAGES.find((candidate) => candidate.after.some((id) => viewed.includes(id)))
  return stage === undefined ? eventStep(GOAL_INTRO_EVENT_ID) : stage.next(career, viewed)
}

const eventStep = (eventId: number): PitcherYearEndEventStep => ({ kind: '이벤트', eventId })

/** 사슬 한 단계 — `after` 가운데 하나라도 봤으면 `next` 로 간다 */
interface YearEndStage {
  readonly after: readonly number[]
  readonly next: (career: PitcherCareer, viewed: readonly number[]) => PitcherYearEndEventStep
}

/** 늦은 단계부터 — 앞 단계 번호가 `viewed` 에 남아 있어도 뒤 단계가 이긴다 */
const YEAR_END_STAGES: readonly YearEndStage[] = [
  { after: [...SALARY_RESULT_EVENT_IDS, SALARY_ACCEPT_EVENT_ID], next: () => ({ kind: '새시즌' }) },
  {
    after: [SALARY_FIRM_EVENT_ID, SALARY_POLITE_EVENT_ID],
    next: (career, viewed) => {
      const choice = viewed.includes(SALARY_FIRM_EVENT_ID) ? SALARY_FIRM_EVENT_ID : SALARY_POLITE_EVENT_ID
      return eventStep(salaryResultEventId(choice, pitcherSalaryNegotiationRankOf(career)))
    },
  },
  // 상태 132 — 502·496 의 선택지는 데이터의 gotoEvent 로 380·503 에 이어진다.
  // 128 이 끝나면(팝업 7·8 닫힘, 틀 0x15984) 늘 132 다 — 이어하기로 128 에 돌아온 때는 앞 사슬의 본 번호가 없다
  { after: [PITCHER_POSTSEASON_STEP_ID], next: (career) => eventStep(pitcherYearEndEventIdOf(career)) },
  // 131 → 128 → 132. 128 은 대진(L+0x34)이 있을 때만이다 — 정규시즌이 닫히면 0xb818c 가 늘 연다
  {
    after: MVP_RESULT_EVENT_IDS,
    next: (career) => (career.postseason !== null ? { kind: '포스트시즌' } : eventStep(pitcherYearEndEventIdOf(career))),
  },
  // 0x8b370 — 상태 131 이 남긴 플래그(evt+0x388)를 읽는다. 웹은 그 해 MVP 비트가 같은 값이다
  { after: [MVP_INTRO_EVENT_ID], next: (career) => eventStep(mvpResultEventId(judgePitcherSeasonAwards(career).isMostValuablePlayer)) },
  { after: TITLE_RESULT_EVENT_IDS, next: () => eventStep(MVP_INTRO_EVENT_ID) },
  { after: [TITLE_INTRO_EVENT_ID], next: (career) => eventStep(titleResultEventId(judgePitcherSeasonAwards(career).wonCount)) },
  { after: GOAL_RESULT_EVENT_IDS, next: () => eventStep(TITLE_INTRO_EVENT_ID) },
  { after: [GOAL_INTRO_EVENT_ID], next: (career) => eventStep(goalResultEventId(achievedPitcherGoalCount(career, '연말'))) },
]

/**
 * 이벤트에 **들어가기 전** 상태 함수가 하는 일.
 * 375 는 상태 131 이 0x8dd60 으로 MVP 를 판정하고 비트를 남긴 **뒤에** 튼다 (0x8ded2 → 0xa4d2c).
 * 연봉 등급 k(0xa4d78)가 이 비트를 읽는다.
 */
export function enterPitcherYearEndEvent(career: PitcherCareer, eventId: number): PitcherCareer {
  // 0x1c154 의 0xa 갈래(연봉 보상 뒤 — 웹 133)가 501 · 504 를 틀 때는 132 를 거치지 않아 S+0x50 이 0xa 그대로다(1c2b2~1c2ee)
  const state = career.seasonEndState === 133 ? undefined : SEASON_END_STATE_OF_EVENT[eventId]
  // 상태 진입이 S+0x50 을 쓰고 저장한다 — 이어하기가 이 값으로 돌아온다 (`seasonEndState`)
  const entered = state === undefined || career.seasonEndState === state ? career : { ...career, seasonEndState: state }
  return eventId === MVP_INTRO_EVENT_ID ? recordPitcherSeasonMvp(entered) : entered
}

/**
 * 이벤트를 진입에서 트는 시즌 끝 상태 — 136 이 392, 130 이 370, 131 이 375, 132(0x10c54)가 501/504/502/380.
 * 380 은 502 의 선택지(gotoEvent)로도 열리지만 그때도 상태는 132 다. 384~391 · 461~464 는 상태를 바꾸지 않는다
 * (133 0x1a090 · 134 0x19f30 은 S+0x50 을 안 쓴다 — 타자편 794c8d9).
 */
const SEASON_END_STATE_OF_EVENT: Readonly<Partial<Record<number, SeasonEndState>>> = {
  [GOAL_INTRO_EVENT_ID]: 136,
  [TITLE_INTRO_EVENT_ID]: 130,
  [MVP_INTRO_EVENT_ID]: 131,
  [RELEASE_EVENT_ID]: 132,
  [FINAL_RETIREMENT_EVENT_ID]: 132,
  [RETIREMENT_CHOICE_EVENT_ID]: 132,
  [SALARY_EVENT_ID]: 132,
}
