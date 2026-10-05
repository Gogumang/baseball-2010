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
  return eventId === MVP_INTRO_EVENT_ID ? recordSeasonMvp(career) : career
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
