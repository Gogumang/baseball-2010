import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import type { NationalCup } from '@/entities/pitcher-career/model/pitcherYearEnd/otherSlices'
import { careerNationalTeamEventId, isCareerNationalCupYear } from '@/entities/pitcher-career/model/pitcherYearEnd/otherSlices'
import { leagueDayCounterOf } from '@/entities/pitcher-career/model/pitcherYearEnd/otherSlices'
import { judgePitcherEnding } from '@/entities/pitcher-career/model/pitcherSeasonFlow'
import { achievedPitcherGoalCount } from '@/entities/pitcher-career/model/pitcherYearGoals'
import { FINAL_RETIREMENT_EVENT_ID, GOAL_INTRO_EVENT_ID, RELEASE_EVENT_ID } from '@/entities/pitcher-career/model/pitcherYearEnd/otherSlices'
import { MVP_INTRO_EVENT_ID, TITLE_INTRO_EVENT_ID } from '@/entities/pitcher-career/model/pitcherYearEnd/otherSlices'
import { entersYearEndChainInPostseason } from '@/entities/pitcher-career/model/pitcherYearEnd/otherSlices'
import { pitcherYearEndEventIdOf } from '@/entities/pitcher-career/model/pitcherYearEnd/chain'

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
  /** 그 밖 갈래의 S+0xb2 짝수 · S+0x50 ∈ {1,3} → 105 관리 화면 */
  | { readonly kind: '관리' }
  /**
   * S+0x50 == 6|7(1c24e~1c25c) → 141 엔딩 — 보너스 팝업 0x2b 를 닫으며 저장한 커리어(`savedCareerOf`)다. 141 진입 0x12300 을
   * 다시 밟는다. 7 은 쓰는 곳이 없어 닿지 않는 갈래다(타자편 `resumePointOf` 머리 주석)
   */
  | { readonly kind: '엔딩' }
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
 * 사슬 상태가 아니면 116 의 끝처럼 g 로 가른다. 엔딩 141 은 보너스를 받은 저장만 엔딩 칸을 들어 141 로 간다. 국가대항전(S+0x12c)은 저장의 대회로 134.
 * 대진이 없으면 맨 끝 갈래(1c38e~1c3b6): S+0x50 == 4(109 진입 0x10db0)면 109, null(1 · 2 · 3)이면 g 짝수 105 · 홀수 109 —
 * 2 는 116 의 끝(0x12b98)이 같은 g 짝홀로 가른다 (타자편 `resumePointOf` 머리 주석에 S+0x50 쓰는 곳 표).
 */
export function pitcherResumePointOf(career: PitcherCareer): PitcherResumePoint {
  // 1c24e — S+0x50 == 6|7 → 141. 보너스 팝업 0x2b 를 닫은(1bc6e 저장) 엔딩만 저장에 엔딩 칸이 든다(`savedCareerOf`) — 그 전에
  // 끊겼으면(판정 없음 · 부상 · 방출 · 보너스 전) 114 끝 저장의 S+0x50 으로 간다
  if (career.endingIndex !== null) return { kind: '엔딩' }
  // 1c25e — 0x11 은 6|7 바로 다음, 2(116)보다 앞에 본다 (464 거절 보상 뒤 끊겼으면 새 시즌 처리부터)
  if (career.seasonEndState === 137) return { kind: '새시즌' }
  if (career.seasonEndState === 116 && career.lastGame !== undefined) return { kind: '경기결과' }
  return chainResumePointOf(career) ?? outsideChainResumePointOf(career)
}

/** S+0x50 == 0xb · 0xd · 0xe · 9 · 0xa — 그 상태가 진입에서 트는 이벤트로 (없으면 null) */
function chainResumePointOf(career: PitcherCareer): PitcherResumePoint | null {
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
      return null
  }
}

/** 그 밖 갈래 1c348~1c358 — S+0x12c(국가대항전 중)면 134. 463 끝 0x8cca2 가 S+0x50 = 3 으로 두므로 대회 중엔 늘 이 갈래다 */
function outsideChainResumePointOf(career: PitcherCareer): PitcherResumePoint {
  if (career.nationalCup !== undefined) return { kind: '국가대항전', cup: career.nationalCup }
  if (career.postseason === null) return regularSeasonResumePointOf(career)
  if (career.seasonEndState === 128) return { kind: '포스트시즌' }
  // 116 끝(12b74~12b94): g == 0 → [114 → 136] — 136 진입 0x10bb0 이 392 를 튼다(사이에 시즌 요약 화면 없음)
  // B-05 고침이면 대진이 막 열린 때만 사슬로 (`entersYearEndChainInPostseason`)
  return leagueDayCounterOf(career) === 0 && entersYearEndChainInPostseason(career.postseason)
    ? { kind: '이벤트', eventId: GOAL_INTRO_EVENT_ID }
    : { kind: '포스트시즌' }
}

/** 대진이 없으면 맨 끝 갈래(1c38e~1c3b6) — S+0x50 == 4 면 109, 아니면 g 짝수 105 · 홀수 109 */
function regularSeasonResumePointOf(career: PitcherCareer): PitcherResumePoint {
  if (career.seasonEndState === 109) return { kind: '다음경기순위' }
  return leagueDayCounterOf(career) % 2 === 0 ? { kind: '관리' } : { kind: '다음경기순위' }
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
