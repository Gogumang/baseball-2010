import type { RandomPort } from '@/shared/api/random/randomPort'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { startNextSeason } from '@/entities/career/model/playerCareer'
import { FINAL_YEAR, FIRST_ENDING_YEAR, judgeEnding } from '@/entities/career/model/seasonFlow/ending'
import { SALARY_EVENT_ID } from '@/entities/career/model/seasonFlow/salary'

/** 엔딩 보너스 표 0xcc40c (단위 1000 G포인트) */
const ENDING_BONUS_THOUSANDS: readonly number[] = [0, 0, 4, 8, 10, 12, 14, 16, 18, 20]
const GAME_POINT_THOUSAND = 1000
/** 부상(0)·방출(1) 엔딩은 보너스 대신 이어하기를 묻는다 — StrMODE[221] */
const CONTINUABLE_ENDING_LIMIT = 1
export const CONTINUE_COST_GAME_POINT = 5000
const MAXIMUM_GAME_POINT = 99_999

export function endingBonusOf(endingIndex: number): number {
  return (ENDING_BONUS_THOUSANDS[endingIndex] ?? 0) * GAME_POINT_THOUSAND
}

export function applyEndingBonus(career: PlayerCareer, endingIndex: number): PlayerCareer {
  return { ...career, gamePoint: Math.min(MAXIMUM_GAME_POINT, career.gamePoint + endingBonusOf(endingIndex)) }
}

/**
 * 이어하기를 묻는 엔딩인가 — 141 키 0x1220c 는 `cmp e, #1 ; bhi`(12222~12224) **부호 없는** 비교라 0 · 1 만 묻는다.
 * 판정 없음(−1 = 0xffffffff)은 이어하기 팝업 갈래로 가지 않는다(`NO_ENDING_JUDGEMENT`).
 */
export function isContinuableEnding(endingIndex: number): boolean {
  return endingIndex >= 0 && endingIndex <= CONTINUABLE_ENDING_LIMIT
}

export function canContinueAfterEnding(career: PlayerCareer, endingIndex: number): boolean {
  return isContinuableEnding(endingIndex) && career.gamePoint >= CONTINUE_COST_GAME_POINT
}

/** 부상 엔딩 — 141 팝업 0x32 예(1bdd2)의 판정 0xa3a85(S) == 0 갈래 */
export const INJURY_ENDING_INDEX = 0

/** 이어하기 값 5000 G포인트를 치르고 엔딩 칸을 비운 선수 (팝업 0x32 예 → 0x1bdc6) — 새 시즌 처리는 부르는 쪽 몫 */
export function continueAfterEndingPayment(career: PlayerCareer): PlayerCareer {
  return { ...career, gamePoint: career.gamePoint - CONTINUE_COST_GAME_POINT, endingIndex: null }
}

/**
 * "현재 상태에서 이어하기" (0x1bd36, 점검 9차) — 5000 G포인트를 쓰고
 * 부상 엔딩은 부상만 풀고 같은 시즌 관리 화면으로, 방출 엔딩은 새 시즌 전환(0x1b768)으로 간다.
 */
export function continueAfterEnding(career: PlayerCareer, random: RandomPort): PlayerCareer {
  const paid = continueAfterEndingPayment(career)
  // 0x1bddc~0x1bdfa: 부상 기간 +0x1b5 · +0x1ce · 부상 경기 수 +0x1b6 을 0 으로 (원본 부상 판정은 +0x1b5 > 0)
  if (career.endingIndex === INJURY_ENDING_INDEX) return { ...paid, isInjured: false, injuryRemaining: 0, injuredGamesPlayed: 0 }
  // 방출은 그 해 132 꼬리(10d08~10d28)를 안 지난 새 시즌이다 — +0x6b 사본 · +0x1c2 는 B-128 (`seasonStartCountersOf`)
  return startNextSeason(paid, random, true)
}

/** 부상 엔딩 이벤트 — 105 진입 0x11b32 의 판정 0 → 0x113e8 이 번호로 튼다(대상 0) */
export const INJURY_ENDING_EVENT_ID = 500
export const RELEASE_EVENT_ID = 501
export const FINAL_RETIREMENT_EVENT_ID = 504
export const RETIREMENT_CHOICE_EVENT_ID = 502
/** 엔딩으로 끝나는 이벤트 (보상 21) */
export const ENDING_EVENT_IDS: ReadonlySet<number> = new Set([500, 501, 503, 504])

export function yearEndEventId(career: PlayerCareer): number {
  if (judgeEnding(career) === 1) return RELEASE_EVENT_ID
  if (career.season >= FINAL_YEAR) return FINAL_RETIREMENT_EVENT_ID
  if (career.season >= FIRST_ENDING_YEAR) return RETIREMENT_CHOICE_EVENT_ID
  return SALARY_EVENT_ID
}
