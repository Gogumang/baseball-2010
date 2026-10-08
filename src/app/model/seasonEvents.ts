import type { PlayerCareer, SeasonEndState } from '@/entities/career/model/playerCareer'
import { leagueDayCounterOf } from '@/entities/career/model/leagueGameSetup'
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
import {
  careerLeagueRecordsOf,
  hasMvpInSeason,
  judgeSeasonAwards,
  judgeTitles,
  MVP_INTRO_EVENT_ID,
  MVP_SALARY_BONUS,
  mvpResultEventId,
  recordSeasonMvp,
  TITLE_INTRO_EVENT_ID,
  titleResultEventId,
} from '@/entities/awards/model/seasonAwards'

/** 시즌 이벤트 하나를 마친 뒤 할 일 */
export type SeasonStep =
  | { readonly kind: '이벤트'; readonly eventId: number }
  | { readonly kind: '새시즌' }
  | { readonly kind: '엔딩'; readonly endingIndex: number }
  | { readonly kind: '관리' }
  /**
   * 포스트시즌 대진 128 — 원본 시즌 끝 사슬은 136(392) → 130(370) → 131(375) → **128** → 132(연말) 다
   * (B "시즌 끝 상태 순서" · R9 8절). MVP 결과(376/377) 뒤에 온다 (131 의 줄 [다음 114, 뒤 128]).
   * 연말 이벤트(380/502/504/501)는 128 이 끝나고(`useCareerSession.closePostseasonPopup`) 튼다.
   */
  | { readonly kind: '포스트시즌' }

const GOAL_RESULT_EVENT_IDS = [393, 394, 395, 396]
/** 371~374 — 타이틀 결과 (0x8b04c: 371 + 수상 수) */
const TITLE_RESULT_EVENT_IDS = [371, 372, 373, 374]
/** 376·377 — MVP 결과 (0x8b370) */
const MVP_RESULT_EVENT_IDS = [376, 377]
const SALARY_RESULT_EVENT_IDS = [384, 385, 386, 387, 388, 389, 390, 391]
const INJURY_ENDING_EVENT_ID = 500
const INJURY_ENDING = 0
const RELEASE_ENDING = 1
const RETIREMENT_ENDING = 2
/**
 * 연봉협상 등급 k (0xa4d78, B-5 확정) — 타자편(모드 4) 갈래.
 *
 * 타이틀 1위 수(홈런 9 · 타점 11 · 타율 12 순위표 1위가 내 선수)는 **이 자리에서 다시** 순위표를 훑어 센다.
 * MVP 몫(+2)은 재판정이 아니라 **그 해 MVP 비트**(career+0x1ca, 0xa4d40)를 읽는다 — 비트는 상태 131 이
 * 이벤트 375 를 틀기 전에 세운다(`enterSeasonEvent`). 순위표 재료는 커리어가 들고 있는 리그 선수 기록표다.
 */
export function batterSalaryNegotiationRankOf(career: PlayerCareer): number {
  const wonCount = judgeTitles(careerLeagueRecordsOf(career), '타자').filter((title) => title.isMine).length
  return wonCount + (hasMvpInSeason(career.mvpSeasonBits, career.season) ? MVP_SALARY_BONUS : 0)
}

/**
 * 시즌 끝 사슬의 이벤트에 **들어가기 전** 상태 함수가 하는 일.
 * 상태 131(0x19774)은 S+0x50 = 0xe · 저장 뒤 0x8dd60 으로 MVP 를 판정해 비트를 남기고(0x8ded2 → 0xa4d2c)
 * **그 다음에** 375 를 튼다. 비트는 새 시즌으로 넘어가도 지우지 않는다(통산 MVP 칭호가 읽는다).
 * 130(0x19824)의 타이틀 계산 0x8dad4(evt, 0xc 타자)는 이벤트 객체에만 남고 커리어를 안 바꾼다 — 370 결과
 * 번호는 `nextSeasonStep` 이 같은 순위표로 다시 센다(사이에 성적이 바뀌는 일이 없다).
 */
export function enterSeasonEvent(career: PlayerCareer, eventId: number): PlayerCareer {
  const state = SEASON_END_STATE_OF_EVENT[eventId]
  // 상태 진입이 S+0x50 을 쓰고 저장한다 — 이어하기가 이 값으로 돌아온다 (`seasonEndState`)
  const entered = state === undefined || career.seasonEndState === state ? career : { ...career, seasonEndState: state }
  return eventId === MVP_INTRO_EVENT_ID ? recordSeasonMvp(entered) : entered
}

/** 이벤트를 트는 시즌 끝 상태 — 136 이 392, 130 이 370, 131 이 375 를 진입에서 튼다 */
const SEASON_END_STATE_OF_EVENT: Readonly<Partial<Record<number, SeasonEndState>>> = {
  [GOAL_INTRO_EVENT_ID]: 136,
  [TITLE_INTRO_EVENT_ID]: 130,
  [MVP_INTRO_EVENT_ID]: 131,
}

/** 이어하기(상태 100 진입 0x1c154)가 돌아갈 곳 */
export type ResumePoint =
  /** S+0x50 == 0xb · 0xc · 0xe · 9 → 136 · 130 · 131 · 132 — 그 상태가 진입에서 트는 이벤트로 */
  | { readonly kind: '이벤트'; readonly eventId: number }
  /** S+0xb4(포스트시즌 중) ≠ 0 이고 S+0x50 이 위 값이 아님 → 128 대진 */
  | { readonly kind: '포스트시즌' }
  /** S+0x50 == 2(경기 뒤) → 116 → g == 0 이면 [114 → 136] — 45번째 경기 뒤 · 내 시리즈가 끝난 경기 뒤 */
  | { readonly kind: '시즌종료' }
  /** 그 밖 갈래의 S+0xb2 짝수 · S+0x50 ∈ {1,3} → 105 관리 화면 (엔딩 141 도 웹은 아직 여기다) */
  | { readonly kind: '관리' }
  /** 그 밖 갈래의 나머지 → 109 다음경기 앞 순위표. 이전 상태가 1(자원 적재)이라 취소가 안 먹는다 */
  | { readonly kind: '다음경기순위' }
  /** S+0x50 == 0x11(464 거절 보상 0x8ccba — `seasonEndState` 137) → 1c25e 새 시즌 0x1b768 */
  | { readonly kind: '새시즌' }

/**
 * 이어하기 분기 0x1c154 (R9 2b, 직접 떴다 — 1c24c~1c3b8):
 * ```
 * S+0x50 == 6|7 → 141 · 0x11 → 새 시즌 0x1b768 · 2 → 116 · 0xb → 136 · 9 → 132 · 0xc|0xd → 130 · 0xe → 131
 *        == 0xa → 연말 판정 (501/504 · 133 · 새 시즌)
 * 그 밖: S+0x12c → 134 · S+0xb4 ≠ 0 → (0xc|0xd → 130 · 0xe → 131 · 그 밖 128)
 *        S+0xb2(g) 짝수 && S+0x50 ∈ {1,3} → 105, 아니면 109          (1c38e~1c3b6)
 * ```
 * S+0x50 을 쓰는 곳 (장면 0x106, 모드 3·4 공용 — 0xf000~0x1e000 의 `str #0x50` 을 모두 훑었다):
 * ```
 * 1  104 진입 0x10fb4(0x11290, 저장) · 새 시즌 0x1b768(0x1b7ba)
 * 2  116 진입 0x1278c(0x1279a, 저장)
 * 3  105 진입 0x11910(0x11990, 저장) · 114 진입 0x11d00 이 2 를 3 으로(0x11d88 — 포스트시즌 g == 0 이면 0xb, 저장 없음)
 *    · 141 의 5000 G 이어하기(0x1be02)
 * 4  109 진입 0x10d8c(0x10db0, 저장 — 이전 142 면 저장 생략)
 * 6  141 진입(0x1230e) · 9 132 · 0xb 136 · 0xc|0xd 130 · 0xe 131 · 0xf 128
 * ```
 * 7 · 0xa · 0x11 을 쓰는 곳은 이 장면 안에 없다. 0x11 은 이벤트 관리자의 보상 명령 끝 0x8ccba(464 거절)가 쓰고, 같은 자리
 * 8cc2e 가 결과 이벤트 보상 뒤 0xc|0xd · 0xe · 0xf · 3 도 쓴다(`rewardResumePatchOf`). 7 · 0xa 는 미해결.
 * 정규시즌 웹 null 은 1 · 2 · 3 이다. 2 는 116 을 다시 띄워 그 끝(0x12b98~0x12bb0)이 g 짝수 → 105 · 홀수 → 109 로 가고,
 * 1 · 3 은 위 맨 끝 갈래가 같은 g 짝홀로 가른다 — 셋 모두 **g 짝수면 105, 홀수면 109** 다. 4 는 g 와 상관없이 109.
 * 웹은 국가대항전(S+0x12c)을 저장하지 않는다. S+0x50 == 2(116 경기 뒤 평가 — 웹은 경기 뒤 `seasonEndState` null)는
 * 116 의 끝(0x12b74)으로 옮긴다: 대진이 있으면 g(= L+0x32) == 0 → 136, 아니면 128 · 대진이 없으면 g 짝수 105 · 홀수 109.
 * 웹의 116 대응은 결과 화면이라 다시 못 띄우므로 그 다음 화면으로 돌아간다(⚠️ 116 · 114 를 다시 보이지 않는 것은 근사).
 * ⚠️ 132 뒤 국가대표 133·국가대항전 134 는 S+0x50 을 안 바꾼다(0x1a090·0x19f30 머리 확인) — 원본도 132 로 돌아가
 *    연말 이벤트를 다시 튼다. 엔딩 141(S+0x50 = 6, 0x1230e)·그 밖 0xa 갈래는 웹이 아직 따로 돌아가지 않는다.
 */
export function resumePointOf(career: PlayerCareer): ResumePoint {
  // 엔딩 141 은 S+0x50 = 6(0x1230e) 갈래다 — 웹 이어하기는 엔딩으로 돌아가지 않는다(예전 그대로 관리 화면)
  if (career.endingIndex !== null) return { kind: '관리' }
  // 1c25e — 0x11 은 6|7 바로 다음에 본다 (464 거절 보상 뒤 끊겼으면 새 시즌 처리부터)
  if (career.seasonEndState === 137) return { kind: '새시즌' }
  switch (career.seasonEndState) {
    case 136:
      return { kind: '이벤트', eventId: GOAL_INTRO_EVENT_ID }
    case 130:
      return { kind: '이벤트', eventId: TITLE_INTRO_EVENT_ID }
    case 131:
      return { kind: '이벤트', eventId: MVP_INTRO_EVENT_ID }
    case 132:
      return { kind: '이벤트', eventId: yearEndEventId(career) }
    default:
      break
  }
  if (career.postseason === null) {
    // 맨 끝 갈래 1c38e~1c3b6 — S+0x50 == 4(109) 는 {1,3} 이 아니라 늘 109
    if (career.seasonEndState === 109) return { kind: '다음경기순위' }
    return leagueDayCounterOf(career) % 2 === 0 ? { kind: '관리' } : { kind: '다음경기순위' }
  }
  if (career.seasonEndState === 128) return { kind: '포스트시즌' }
  // 경기 뒤(S+0x50 == 2 → 116) — 116 의 끝처럼 g == 0 이면 136(시즌 끝 화면), 아니면 128
  return leagueDayCounterOf(career) === 0 ? { kind: '시즌종료' } : { kind: '포스트시즌' }
}

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
    return { kind: '이벤트', eventId: salaryResultEventId(choice, batterSalaryNegotiationRankOf(career)) }
  }
  // 131 의 뒤 = 128 (0x197ec `0xbcb49(0x80)` · 0x197f4 `0xbcb49(0x72)`)
  if (viewed.some((id) => MVP_RESULT_EVENT_IDS.includes(id))) return { kind: '포스트시즌' }
  if (saw(MVP_INTRO_EVENT_ID)) {
    // 0x8b370 — 상태 131 이 남긴 evt+0x388 을 읽는다. 웹은 375 진입 때 세운 그 해 MVP 비트가 같은 값이다
    return { kind: '이벤트', eventId: mvpResultEventId(hasMvpInSeason(career.mvpSeasonBits, career.season)) }
  }
  // 130 의 뒤 = 131 (0x198c8 `0xbcb49(0x83)`) — 131 진입이 375 를 튼다
  if (viewed.some((id) => TITLE_RESULT_EVENT_IDS.includes(id))) return { kind: '이벤트', eventId: MVP_INTRO_EVENT_ID }
  if (saw(TITLE_INTRO_EVENT_ID)) {
    // 0x8b04c — 371 + (evt+0x36c..0x36e 중 0 이 아닌 수). 칸은 130 이 0x8dad4(evt, 0xc 타자)로 채운다
    const { wonCount } = judgeSeasonAwards(career, careerLeagueRecordsOf(career), '타자')
    return { kind: '이벤트', eventId: titleResultEventId(wonCount) }
  }
  // 136 의 뒤 = 130 (0x10bec `0xbcb49(0x82)`) — 130 진입이 370 을 튼다
  if (viewed.some((id) => GOAL_RESULT_EVENT_IDS.includes(id))) return { kind: '이벤트', eventId: TITLE_INTRO_EVENT_ID }
  if (saw(GOAL_INTRO_EVENT_ID)) {
    return { kind: '이벤트', eventId: goalResultEventId(achievedGoalCount(career, '연말')) }
  }
  return { kind: '관리' }
}
