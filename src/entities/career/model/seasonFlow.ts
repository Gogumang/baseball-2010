import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { hasSkill, startNextSeason } from '@/entities/career/model/playerCareer'
import { TITLE_NAMES } from '@/entities/career/model/titles'
import { BATTER_YEAR_GOALS } from '@/shared/config/original/yearGoals'

/**
 * 나만의리그 한 해의 흐름 — 누락 탐색 에이전트가 binary.mod 에서 읽은 규칙.
 *   22경기 뒤 중간평가(0x11e84) → 45경기 뒤 목표 평가 392 → 393~396 → 연말(0x10c54)
 *   연말: 방출 501 · 13년차 은퇴식 504 · 7년차 이상 은퇴 선택 502 · 그 밖 연봉협상 380
 * **아직 없는 것**: 포스트시즌·한국시리즈, 개인 타이틀(370~374)·MVP(375~377), 국가대표(461~464),
 * 부상 누적 엔딩(500). 타이틀이 없으니 연봉 등급은 늘 0 이다.
 */
export const MID_SEASON_GAME = 22
export const GOAL_INTRO_EVENT_ID = 392
export const SALARY_EVENT_ID = 380
export const SALARY_FIRM_EVENT_ID = 381
export const SALARY_POLITE_EVENT_ID = 382
export const SALARY_ACCEPT_EVENT_ID = 383

const FINAL_YEAR = 13
const LEGEND_SKILL = 7
const FIRST_ENDING_YEAR = 7
const AVERAGE_SCALE = 1000
/** 소지금 판정 단위(100만원) — 웹판 소지금은 만원 단위다 */
const MONEY_UNIT = 100

export type GoalStage = '중간' | '연말'

/**
 * 올해의 목표 (0xd7f9e, B-9 확정) — 표는 **선수 타입 비트**(선수 +0xb 위 3비트)로 고른다.
 * 웹의 `battingTypeIndex` 가 그 타입(0 타격형 · 1 장타형)이라 그대로 쓴다.
 * 앞서 웹은 늘 첫 표를 써서 장타형 선수도 타격형 목표를 받고 있었다.
 */
export function yearGoalsOf(career: PlayerCareer): readonly number[] {
  const table = BATTER_YEAR_GOALS[Math.min(career.battingTypeIndex, BATTER_YEAR_GOALS.length - 1)]
  return table[Math.min(career.season, table.length) - 1]
}

/** 목표 달성 수. 중간평가는 타율을 뺀 네 목표를 절반 기준으로 본다 (0xa3de8 단계 1) */
export function achievedGoalCount(career: PlayerCareer, stage: GoalStage): number {
  const [average, hits, homeRuns, runsBattedIn, popularityGain] = yearGoalsOf(career)
  const ratio = stage === '중간' ? 0.5 : 1
  const target = (value: number) => Math.trunc(value * ratio)
  const { stats } = career
  const checks = [
    // 원본 타율 = min(1000, trunc(안타 × 1000 / 타수)) — 버림 (b8e3d)
    stats.atBats > 0 && Math.min(AVERAGE_SCALE, Math.trunc((stats.hits * AVERAGE_SCALE) / stats.atBats)) >= average,
    stats.hits >= target(hits),
    stats.homeRuns >= target(homeRuns),
    stats.runsBattedIn >= target(runsBattedIn),
    career.popularity - career.popularityAtSeasonStart >= target(popularityGain),
  ]
  return checks.filter(Boolean).length
}

const ALL_GOALS = 5
const FIRST_YEAR_TITLE = 1
const COMEBACK_TITLE = 9
const COMEBACK_PREVIOUS_MAXIMUM = 1

/**
 * 중간평가 칭호 (0x11e84) — 1년차에 다섯 개 모두 → 칭호 1, 2년차 이후 지난 중간평가 ≤ 1 개였다가 다섯 개 → 칭호 9.
 * 이번 값은 lastMidSeasonGoalCount(원본 +0x1cc)에 남긴다 — 호출하는 쪽이 저장한다.
 */
export function midSeasonTitlesOf(career: PlayerCareer, achieved: number): string[] {
  if (achieved < ALL_GOALS) return []
  if (career.season === 1) return [TITLE_NAMES[FIRST_YEAR_TITLE]]
  return career.lastMidSeasonGoalCount <= COMEBACK_PREVIOUS_MAXIMUM ? [TITLE_NAMES[COMEBACK_TITLE]] : []
}

export function midSeasonEventId(achieved: number): number {
  if (achieved >= 4) return 452
  if (achieved >= 2) return 453
  return 454
}

export function goalResultEventId(achieved: number): number {
  if (achieved >= 5) return 393
  if (achieved === 4) return 394
  if (achieved === 3) return 395
  return 396
}

/** StrENDING 번호. 7년차 전에는 null */
/** 부상 중 이만큼 경기를 치르면 부상 엔딩 (0xa3a84 의 `+0x1b6 > 19`) */
const INJURED_GAMES_FOR_ENDING = 20

export function judgeEnding(career: PlayerCareer): number | null {
  const year = career.season
  const popularity = career.popularity
  const reputation = career.reputation
  const money = Math.trunc(career.money / MONEY_UNIT)
  // 원본 0xa3a84 의 **첫 줄** — 연차보다 먼저 본다 (G-2·B-6). 웹에 빠져 있던 판정이다
  if (career.injuredGamesPlayed >= INJURED_GAMES_FOR_ENDING) return 0
  if (year < FIRST_ENDING_YEAR) return null
  if (year === FIRST_ENDING_YEAR && popularity <= 499) return 1
  if (year >= FINAL_YEAR) {
    // 전설 — 인기도 3500 초과 + 스킬 7 "전설" 보유 (0xa3a84 의 +0x1b8 비트7)
    if (popularity > 3500 && hasSkill(career, LEGEND_SKILL)) return 9
    if (popularity > 3000 && reputation > 699 && money > 399) return 8
    if (popularity > 2500 && reputation > 499) return 7
    if (popularity > 2000 && reputation > 299) return 6
  }
  if (popularity > 1500) return 5
  if (popularity > 1000 && money > 199) return 4
  if (popularity > 1000) return 3
  // 원본은 "999 이하" 만 은퇴식이라 정확히 1000 이면 판정이 없다 (−1)
  return popularity <= 999 ? 2 : null
}

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

export function isContinuableEnding(endingIndex: number): boolean {
  return endingIndex <= CONTINUABLE_ENDING_LIMIT
}

export function canContinueAfterEnding(career: PlayerCareer, endingIndex: number): boolean {
  return isContinuableEnding(endingIndex) && career.gamePoint >= CONTINUE_COST_GAME_POINT
}

const INJURY_ENDING = 0

/**
 * "현재 상태에서 이어하기" (0x1bd36, 점검 9차) — 5000 G포인트를 쓰고
 * 부상 엔딩은 부상만 풀고 같은 시즌 관리 화면으로, 방출 엔딩은 새 시즌 전환(0x1b768)으로 간다.
 */
export function continueAfterEnding(career: PlayerCareer): PlayerCareer {
  const paid: PlayerCareer = { ...career, gamePoint: career.gamePoint - CONTINUE_COST_GAME_POINT, endingIndex: null }
  if (career.endingIndex === INJURY_ENDING) return { ...paid, isInjured: false, injuredGamesPlayed: 0 }
  return startNextSeason(paid)
}

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

/** 연봉 결과 — 등급 k = 타이틀 1위 수 + (MVP 면 2) */
export function salaryResultEventId(choiceEventId: number, rank: number): number {
  const offset = rank >= 5 ? 0 : rank >= 3 ? 1 : rank >= 1 ? 2 : 3
  return (choiceEventId === SALARY_FIRM_EVENT_ID ? 384 : 388) + offset
}

/** 보상 20 의 값 → 연봉 변동률(%) */
const SALARY_RATE: readonly number[] = [30, 20, 10, -20, 20, 10, 5, -10, 0]

/** 연봉은 u16 (+0x1c8) */
const MAXIMUM_SALARY = 65_535

/**
 * 연봉 = base ± trunc(base × 변동률 / 100), base = max(1, trunc(인기도 상승/4)) + 이전 연봉 (0x8cac0).
 * 단위는 원본 그대로 100만원 한 칸이다 (관리 화면이 ×100 해서 만원으로 보여 준다).
 */
export function applySalaryChange(career: PlayerCareer, code: number): PlayerCareer {
  const base = Math.max(1, Math.trunc((career.popularity - career.popularityAtSeasonStart) / 4)) + career.salary
  const rate = SALARY_RATE[code] ?? 0
  const change = Math.sign(rate) * Math.trunc((base * Math.abs(rate)) / 100)
  return { ...career, salary: Math.min(MAXIMUM_SALARY, base + change) }
}
