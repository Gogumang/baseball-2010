import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import type { SeasonEndState } from '@/entities/career/model/playerCareer'
import type { NationalCup } from '@/entities/national-cup/model/nationalCup'
import { careerNationalTeamEventId, isCareerNationalCupYear } from '@/entities/national-cup/model/nationalCupFlow'
import { leagueDayCounterOf } from '@/entities/career/model/leagueGameSetup'
import { applyPitcherEventRewards } from '@/entities/pitcher-career/model/pitcherEventReward'
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
} from '@/entities/career/model/seasonFlow'
import {
  MVP_INTRO_EVENT_ID,
  mvpResultEventId,
  TITLE_INTRO_EVENT_ID,
  titleResultEventId,
} from '@/entities/awards/model/seasonAwards'
import { rewardsIn } from '@/entities/story/model/eventReward'
import type { EventReward } from '@/entities/story/model/eventReward'
import type { OriginalEvent } from '@/shared/config/original/eventTypes'

/**
 * 나만의리그 **투수편**(모드 3) 연말 이벤트 사슬 — 시즌 끝 상태 기계 0x1cdec 의 136 → 130 → 131 → 132.
 *
 * ```
 *   136 (0x10bb0)  392 올해의 목표 → 0x8d0e0: k = 0xa3de8(career, 0) → 393(5) · 394(4) · 395(3) · 396(그 밖)
 *   130 (0x19824)  0x8dad4 타이틀 → 370 → 0x8b04c: 371 + 수상 수 (372 +3 · 373 +6 · 374 +10 소지금)
 *   131 (0x19774)  0x8dd60 MVP 판정(비트 career+0x1ca) → 375 → 0x8b370: 377(MVP) / 376
 *   132 (0x10c54)  연말 — 판정 == 1 → 501 · 연차idx == 12 → 504 · idx > 5 → 502 · 그 밖 380
 *   380 → 381 강경 / 382 정중 → 0x8d058: k = 0xa4d78 → 384~387 / 388~391 · 383 수락
 *   502 → 380 / 496 → 380 / 503
 * ```
 * (B-season-awards.md B-1 · "시즌 끝 상태 순서" · 5a. 상태 함수는 모드 3·4 공용이고, 0x8b04c·0x8b370 의
 * 나만의리그 갈래도 모드 3·4 를 가르지 않는다.)
 *
 * 이 파일은 **순수 함수**만 둔다 — 이벤트 재생·화면은 세션 몫이다. 쓰는 법:
 *   1. 정규시즌·포스트시즌이 끝나면 `nextPitcherYearEndStep(career, [])` → 392 부터.
 *   2. 이벤트에 **들어갈 때** `enterPitcherYearEndEvent` (375 는 그 앞에서 MVP 비트를 남긴다 — 상태 131).
 *   3. 이벤트가 **끝날 때** `finishPitcherYearEndEvent` (그 이벤트의 보상 명령 7 을 원본대로).
 *      선택지(380·502·496)는 이벤트 데이터의 `gotoEvent` 가 잇는다 — 본 번호를 `viewed` 에 쌓는다.
 *   4. 사슬이 끊기면(선택지 없이 끝난 이벤트) 본 번호 전부로 `nextPitcherYearEndStep` 을 다시 부른다.
 *
 * 사이 상태 (R9 확정):
 *   - **114** = 이벤트 재생(진입 0x11d00 · 키 0x13b88 · 틀 0x1c014). 각 상태가 `[다음 114, 뒤 X]` 로 이벤트를 틀고,
 *     끝나면 뒤 상태 X 로 간다. 뒤가 132 면 새 시즌 0x1b768 → 137 → 105. 웹 투수편은 `StoryScreen` 이 이 자리다.
 *   - **128** = 포스트시즌 대진(진입 0x120a4 · 키 0x13da0 · 틀 0x15984) — 131 과 132 사이. 사슬은 `'포스트시즌'` 걸음을
 *     내고, 세션이 공용 모델 `postseasonFlow` 로 128 을 돌린 뒤 본 번호에 `PITCHER_POSTSEASON_STEP_ID` 를 얹어
 *     다시 부르면 132 로 간다. 대진이 없으면(정규시즌이 안 닫힘) 곧장 132.
 *   - **133** = 국가대표 선발(0x1a090) — 132 가 연차idx 짝수면 뒤 상태로 넣는다. 사슬 밖이라 세션이 잇는다
 *     (`achievedPitcherGoalCount(career, '국가대표')` → 461/462).
 */

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
  const saw = (id: number) => viewed.includes(id)
  const sawAny = (ids: readonly number[]) => viewed.some((id) => ids.includes(id))

  if (endingRequested) return { kind: '엔딩', endingIndex: judgePitcherEnding(career) ?? NO_ENDING_JUDGEMENT }
  if (sawAny(SALARY_RESULT_EVENT_IDS) || saw(SALARY_ACCEPT_EVENT_ID)) return { kind: '새시즌' }
  if (saw(SALARY_FIRM_EVENT_ID) || saw(SALARY_POLITE_EVENT_ID)) {
    const choice = saw(SALARY_FIRM_EVENT_ID) ? SALARY_FIRM_EVENT_ID : SALARY_POLITE_EVENT_ID
    return { kind: '이벤트', eventId: salaryResultEventId(choice, pitcherSalaryNegotiationRankOf(career)) }
  }
  // 상태 132 — 502·496 의 선택지는 데이터의 gotoEvent 로 380·503 에 이어진다.
  // 128 이 끝나면(팝업 7·8 닫힘, 틀 0x15984) 늘 132 다 — 이어하기로 128 에 돌아온 때는 앞 사슬의 본 번호가 없다
  if (saw(PITCHER_POSTSEASON_STEP_ID)) return { kind: '이벤트', eventId: pitcherYearEndEventIdOf(career) }
  if (sawAny(MVP_RESULT_EVENT_IDS)) {
    // 131 → 128 → 132. 128 은 대진(L+0x34)이 있을 때만이다 — 정규시즌이 닫히면 0xb818c 가 늘 연다
    if (career.postseason !== null) return { kind: '포스트시즌' }
    return { kind: '이벤트', eventId: pitcherYearEndEventIdOf(career) }
  }
  if (saw(MVP_INTRO_EVENT_ID)) {
    // 0x8b370 — 상태 131 이 남긴 플래그(evt+0x388)를 읽는다. 웹은 그 해 MVP 비트가 같은 값이다
    return { kind: '이벤트', eventId: mvpResultEventId(judgePitcherSeasonAwards(career).isMostValuablePlayer) }
  }
  if (sawAny(TITLE_RESULT_EVENT_IDS)) return { kind: '이벤트', eventId: MVP_INTRO_EVENT_ID }
  if (saw(TITLE_INTRO_EVENT_ID)) {
    return { kind: '이벤트', eventId: titleResultEventId(judgePitcherSeasonAwards(career).wonCount) }
  }
  if (sawAny(GOAL_RESULT_EVENT_IDS)) return { kind: '이벤트', eventId: TITLE_INTRO_EVENT_ID }
  if (saw(GOAL_INTRO_EVENT_ID)) {
    return { kind: '이벤트', eventId: goalResultEventId(achievedPitcherGoalCount(career, '연말')) }
  }
  return { kind: '이벤트', eventId: GOAL_INTRO_EVENT_ID }
}

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
 * 380 은 502 의 선택지(gotoEvent)·'연말' 화면에서도 열리지만 그때도 상태는 132 다. 384~391 · 461~464 는 상태를 바꾸지 않는다
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

/** 이어하기(상태 100 진입 0x1c154)가 돌아갈 곳 — 타자편 `app/model/seasonEvents.ResumePoint` 와 같은 꼴 */
export type PitcherResumePoint =
  /**
   * S+0x50 == 0xb · 0xd · 0xe · 9 → 136 · 130 · 131 · 132 — 그 상태가 진입에서 트는 이벤트로.
   * 0xa(연봉 보상 뒤 — 웹 133)의 501 · 504 · 461 · 462 도 이 꼴이다
   */
  | { readonly kind: '이벤트'; readonly eventId: number }
  /** S+0x50 == 2 — 116 경기 뒤 평가를 다시 띄운다(진입 0x1278c 다시 — 카운터가 겹쳐 쌓인다). 재료가 없는 옛 저장은 아래 갈래 */
  | { readonly kind: '경기결과' }
  /** 128 대진 — S+0x50 == 0xf, 또는 경기 뒤(2) 116 이 g ≠ 0 이라 128 로 */
  | { readonly kind: '포스트시즌' }
  /** 경기 뒤(2) 116 이 포스트시즌 중 g == 0 이라 136 으로 — 웹은 시즌 끝 화면(136 자리) */
  | { readonly kind: '시즌종료' }
  /** 그 밖 갈래의 S+0xb2 짝수 · S+0x50 ∈ {1,3} → 105 관리 화면 (엔딩 141 도 웹은 아직 여기다) */
  | { readonly kind: '관리' }
  /** 그 밖 갈래의 나머지 → 109 다음경기 앞 순위표 (S+0x50 == 4 이거나 g 홀수). 이전 상태가 1 이라 취소가 안 먹는다 */
  | { readonly kind: '다음경기순위' }
  /** S+0x50 == 0x11(464 거절 보상 0x8ccba — `seasonEndState` 137) → 1c25e 새 시즌 0x1b768 */
  | { readonly kind: '새시즌' }
  /** 그 밖 갈래의 첫 줄 S+0x12c(국가대항전 중) → 134 대진판 (1c348~1c358) — 저장의 대회 그대로 */
  | { readonly kind: '국가대항전'; readonly cup: NationalCup }

/**
 * 이어하기 분기 0x1c154 (R9 2b — 장면 0x106 이라 모드 3·4 공용):
 * ```
 * 1c24e: S+0x50 == 6|7 → 141 · 0x11 → 새 시즌 · 2 → 116 · 0xb → 136 · 9 → 132 · 0xc|0xd → 130 · 0xe → 131
 *        0xa(연봉 보상 뒤 — 웹 133) → 판정 1 → 501 · 연차idx 12 → 504 · 짝수 → 133 · 홀수 → 새 시즌 (타자편 `resumePointOf`)
 * 그 밖: S+0x12c → 134 · S+0xb4 ≠ 0 → 128
 * 116 끝 0x12b74: S+0xb4 ≠ 0 이면 S+0xb2(= L+0x32) == 0 → [114 → 136], 아니면 [114 → 128]
 * ```
 * S+0x50 == 2(116 진입 0x1278c)이고 재료(`lastGame`)가 있으면 116 을 다시 띄운다. 재료가 없는 옛 저장은 예전처럼 대진이 있는데
 * 사슬 상태가 아니면 116 의 끝처럼 g 로 가른다. 엔딩 141 은 웹 투수편이 따로 돌아가지 않는다. 국가대항전(S+0x12c)은 저장의 대회로 134.
 * 대진이 없으면 맨 끝 갈래(1c38e~1c3b6): S+0x50 == 4(109 진입 0x10db0)면 109, null(1 · 2 · 3)이면 g 짝수 105 · 홀수 109 —
 * 2 는 116 의 끝(0x12b98)이 같은 g 짝홀로 가른다 (타자편 `resumePointOf` 머리 주석에 S+0x50 쓰는 곳 표).
 */
export function pitcherResumePointOf(career: PitcherCareer): PitcherResumePoint {
  if (career.endingIndex !== null) return { kind: '관리' }
  // 1c25e — 0x11 은 6|7 바로 다음, 2(116)보다 앞에 본다 (464 거절 보상 뒤 끊겼으면 새 시즌 처리부터)
  if (career.seasonEndState === 137) return { kind: '새시즌' }
  if (career.seasonEndState === 116 && career.lastGame !== undefined) return { kind: '경기결과' }
  switch (career.seasonEndState) {
    case 136:
      return { kind: '이벤트', eventId: GOAL_INTRO_EVENT_ID }
    case 130:
      return { kind: '이벤트', eventId: TITLE_INTRO_EVENT_ID }
    case 131:
      return { kind: '이벤트', eventId: MVP_INTRO_EVENT_ID }
    case 132:
      return { kind: '이벤트', eventId: pitcherYearEndEventIdOf(career) }
    case 133:
      return pitcherSalaryResumePointOf(career)
    default:
      break
  }
  // 그 밖 갈래 1c348~1c358 — S+0x12c(국가대항전 중)면 134. 463 끝 0x8cca2 가 S+0x50 = 3 으로 두므로 대회 중엔 늘 이 갈래다
  if (career.nationalCup !== undefined) return { kind: '국가대항전', cup: career.nationalCup }
  if (career.postseason === null) {
    if (career.seasonEndState === 109) return { kind: '다음경기순위' }
    return leagueDayCounterOf(career) % 2 === 0 ? { kind: '관리' } : { kind: '다음경기순위' }
  }
  if (career.seasonEndState === 128) return { kind: '포스트시즌' }
  return leagueDayCounterOf(career) === 0 ? { kind: '시즌종료' } : { kind: '포스트시즌' }
}

/** 13년차의 연차idx — 0x1c2c2 `cmp r5, #0xc` */
const FINAL_YEAR_INDEX = 12

/**
 * 0x1c154 의 S+0x50 == 0xa 갈래(1c2a2~1c344, 모드 3 · 4 공용) — 연봉 결과의 보상 20(0x8cb90)이 쓴 값이다. 132 의 380 을 다시
 * 틀지 않는다. 연차idx(S+0xb3)는 끝난 해의 것(`season − 1`)이고, 판정은 0xa3a85(S) — 투수편은 `judgePitcherEnding`.
 */
function pitcherSalaryResumePointOf(career: PitcherCareer): PitcherResumePoint {
  const yearIndex = career.season - 1
  if (judgePitcherEnding(career) === 1) return { kind: '이벤트', eventId: RELEASE_EVENT_ID }
  if (yearIndex === FINAL_YEAR_INDEX) return { kind: '이벤트', eventId: FINAL_RETIREMENT_EVENT_ID }
  if (isCareerNationalCupYear(yearIndex)) {
    return { kind: '이벤트', eventId: careerNationalTeamEventId(achievedPitcherGoalCount(career, '국가대표')) }
  }
  return { kind: '새시즌' }
}

/** 이벤트 데이터의 보상 명령 7 (r_event) — 데이터(535KB)는 부르는 쪽이 넘긴다 (첫 화면 묶음에 넣지 않으려고) */
export function pitcherYearEndRewardsOf(eventId: number, events: readonly OriginalEvent[]): readonly EventReward[] {
  const event = events.find((candidate) => candidate.id === eventId)
  return event === undefined ? [] : rewardsIn(event.commands)
}

/**
 * 이벤트가 **끝날 때** 그 이벤트의 보상을 준다 (393~396 은 연차 보정 0x8d508 을 얹어서).
 * `rewards` 는 재생기가 지나온 보상 명령이다 — 선택지로 이어 본 이벤트(461 → 463 따위)의 것까지 들어 있다.
 * 보상 실행은 `applyPitcherEventRewards`(0x8c460 모드 3 갈래)에 맡긴다. 연말 사슬에 나오는 종류는
 * 0 인기도 · 1 평판 · 3 소지금 · 20 연봉 · 21 엔딩 진입(무시 — 세션이 엔딩으로 넘긴다) 뿐이라 무작위가 들지 않는다.
 */
export function finishPitcherYearEndEvent(
  career: PitcherCareer,
  eventId: number,
  rewards: readonly EventReward[],
): PitcherCareer {
  return applyPitcherEventRewards(career, rewards, undefined, eventId)
}
