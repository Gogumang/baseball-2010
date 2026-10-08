import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { hasSkill, startNextSeason } from '@/entities/career/model/playerCareer'
import { ROMANCE_EVENT_IDS, TITLE_NAMES } from '@/entities/career/model/titles'
import { BATTER_YEAR_GOALS } from '@/shared/config/original/yearGoals'

/**
 * 나만의리그 한 해의 흐름 — 누락 탐색 에이전트가 binary.mod 에서 읽은 규칙.
 *   22경기 뒤 중간평가(0x11e84) → 45경기 뒤 목표 평가 392 → 393~396 → 타이틀 370 → 371~374
 *   → MVP 375 → 376/377 → 포스트시즌 대진 128 → 연말(0x10c54)
 *   연말: 방출 501 · 13년차 은퇴식 504 · 7년차 이상 은퇴 선택 502 · 그 밖 연봉협상 380
 * 사슬 잇기는 `app/model/seasonEvents.nextSeasonStep`, 타이틀·MVP 판정은 `entities/awards/model/seasonAwards`.
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

/**
 * **올해의 목표 창(SYS sub 1)의 줄 묶음** — 그리기 0x8656c 가 고르는 이름 그림 다섯 장의 차례 (표 0xd41d6[묶음·5 + i]).
 * 0 타자(모드 4) · 1 투수 선발(보직 0xb6705 == 0) · 2 투수 그 밖(보직 ≠ 0 — 셋째 줄이 "세이브P", 값은 세이브 + 승)
 */
export type YearGoalWindowLabelSet = 0 | 1 | 2

/**
 * 올해의 목표 창이 그리는 값 — 0x8656c 가 줄마다 읽는 것 그대로.
 * `current`·`goals` 의 첫 칸은 타자면 타율 ×1000(0xb8e3d · 0x8633c 로 "0.xxx"), 투수면 방어율 ×100(0xb6ce9 · 0x86248 로 "x.xx").
 */
export interface YearGoalWindowValues {
  readonly labelSet: YearGoalWindowLabelSet
  readonly current: readonly number[]
  readonly goals: readonly number[]
}

/**
 * 타자편(모드 4) 올해의 목표 창 값 (0x8656c 의 0x86842~0x868e2 · 0x86a12 · 0x86b9e~0x86c04):
 * ```
 *   현재  타율 0xb8e3d(내 타자) · 안타 s16 +0x22 · 홈런 s16 +0x28 · 타점 s16 +0x2a ·
 *         인기도 상승 max(0, 0xb6e79(S) − u16 S+0x78)
 *   목표  0x8645c(…, 4, S+0xb3) = u16 0xd4302[(+0xb >> 5)·65 + 연차idx·5 + i] — 판정 표 0xd7f9e 와 같은 값의 사본(U-23 닫음)
 * ```
 * 목표 값은 단계 보정이 없는 표 그대로다(연초 115 · 연말 392 가 같은 창).
 */
export function yearGoalWindowValuesOf(career: PlayerCareer): YearGoalWindowValues {
  const { stats } = career
  const average = stats.atBats > 0 ? Math.min(AVERAGE_SCALE, Math.trunc((stats.hits * AVERAGE_SCALE) / stats.atBats)) : 0
  return {
    labelSet: 0,
    current: [
      average,
      stats.hits,
      stats.homeRuns,
      stats.runsBattedIn,
      Math.max(0, career.popularity - career.popularityAtSeasonStart),
    ],
    goals: yearGoalsOf(career),
  }
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
export function midSeasonTitlesOf(
  career: Pick<PlayerCareer, 'season' | 'lastMidSeasonGoalCount'>,
  achieved: number,
): string[] {
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

/**
 * 판정 0xa3a84 의 −1(판정 없음 — 7~13년차 인기도가 정확히 1000 이거나 7년차 전) 을 141 이 그대로 받은 값.
 * 141 진입 0x12300 은 `e = 0xa3a85(S)` 를 고치지 않고 엔딩 판 0x87c7c 에 넘긴다 — 그 화면은 `EndingScreen` 머리말(141 의 e = −1).
 */
export const NO_ENDING_JUDGEMENT = -1

/**
 * **저장에 드는 커리어** — 엔딩 141 은 보너스 팝업을 닫기 전까지 커리어를 저장하지 않는다.
 * - 141 진입 0x12300 은 S+0x50 = 6 을 메모리에만 쓰고(1230e — 0x22755 를 부르지 않는다), 엔딩 판 0x87c7c 는 전역기록만
 *   저장한다(0x1f1b9).
 * - 141 틀 0x1bbc4 에서 커리어를 저장하는 자리는 보너스 팝업 0x2b 를 닫는 1bc64~1bc70(그 앞 1bc5e 가 S+0x7b = 1) 하나다.
 *   판정 없음(e = −1)은 팝업이 안 뜨고(키 0x1220c `ble`), 부상 · 방출(e = 0 · 1)은 이어하기 팝업 0x32 라 "예"(1bd52~)가 G 를 빼고
 *   전역기록만 저장한 뒤 105(진입이 S+0x50 = 3 · 저장) · 새 시즌 0x1b768(저장)로 가고 "아니오"(1be46)는 메인 메뉴다.
 *   은퇴(e ≥ 2)도 보너스가 0 이거나 S+0x7b 가 서 있으면 0x2b 없이 0x2d 다.
 * 곧 보너스를 받기(`endingBonusReceived`) 전 엔딩은 저장이 114 끝 0x8b0e4(1c02e)가 쓴 것 그대로라 다시 켜면 그때의 S+0x50 으로
 * 돌아간다(132 의 503 이면 9 → 502 다시). 받은 뒤 저장은 S+0x50 = 6 이라 이어하기가 141 로 간다(0x1c154 1c24e — `resumePointOf`).
 * 웹은 엔딩 번호를 커리어 칸에 두므로 보너스 전에는 그 칸만 비워 저장한다 — 메모리의 커리어(화면 · 기록연감 +0xa7)는 그대로다.
 */
export function savedCareerOf<C extends { readonly endingIndex: number | null; readonly endingBonusReceived?: boolean }>(
  career: C,
): C {
  return career.endingIndex !== null && career.endingBonusReceived !== true ? { ...career, endingIndex: null } : career
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

/** 연애 엔딩은 StrENDING[9 + c] — c = 1(짝 없음) … 5(넷 모두) 라 10~14 다 */
const ROMANCE_ENDING_BASE = 9
/** 연애 엔딩이 붙는 본 엔딩 — 0 부상 · 1 방출 에는 없다 (0x87fba `cmp [this+0x2e4], #1 ; ble`) */
const LAST_ENDING_WITHOUT_ROMANCE = 1

/**
 * 본 연애 이벤트 — **이벤트 번호 순서**(300 메디카 · 301 레오니 · 302 로제 · 303 발렌타인).
 * 엔딩 적재 0x87c7c 가 이 순서로 `0xb6e81`(본 이벤트인가)을 물어 c 를 세고(0x87f4c~0x87fb0),
 * 제작진 화면의 인물도 같은 순서로 만든다(0x88080~0x88162).
 */
export function romanceEventsSeenOf(seenEventIds: readonly string[]): readonly number[] {
  return Object.values(ROMANCE_EVENT_IDS)
    .filter((eventId) => seenEventIds.includes(String(eventId)))
    .sort((left, right) => left - right)
}

/**
 * 연애 엔딩 번호 (엔딩 적재 0x87c7c — 0x87f4c~0x87fd6, 두 편 공용 장면 0x106):
 * ```
 * c = 1 + 본(300) + 본(301) + 본(302) + 본(303)
 * if [this+0x2e4](본 엔딩) > 1:  전역기록 +0xb1 + c = 1 ; 저장      ; 기록연감 엔딩 칸 9 + c
 * [this+0x340] = 10, c 가 2·3·4·5 면 11·12·13·14                   ; 제작진 앞에 붙는 글 StrENDING[9 + c]
 * ```
 * 본 엔딩 칸은 같은 함수 0x87f30 이 `+0xa8 + e` 에 쓰므로 +0xb1 + c = +0xa8 + (9 + c) — 기록연감 엔딩 10~14 와 맞는다.
 * 부상·방출(0·1)이면 null.
 */
export function romanceEndingIndexOf(endingIndex: number, seenEventIds: readonly string[]): number | null {
  if (endingIndex <= LAST_ENDING_WITHOUT_ROMANCE) return null
  return ROMANCE_ENDING_BASE + 1 + romanceEventsSeenOf(seenEventIds).length
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

const INJURY_ENDING = 0

/**
 * "현재 상태에서 이어하기" (0x1bd36, 점검 9차) — 5000 G포인트를 쓰고
 * 부상 엔딩은 부상만 풀고 같은 시즌 관리 화면으로, 방출 엔딩은 새 시즌 전환(0x1b768)으로 간다.
 */
export function continueAfterEnding(career: PlayerCareer): PlayerCareer {
  const paid: PlayerCareer = { ...career, gamePoint: career.gamePoint - CONTINUE_COST_GAME_POINT, endingIndex: null }
  // 0x1bddc~0x1bdfa: 부상 기간 +0x1b5 · +0x1ce · 부상 경기 수 +0x1b6 을 0 으로 (원본 부상 판정은 +0x1b5 > 0)
  if (career.endingIndex === INJURY_ENDING) return { ...paid, isInjured: false, injuryRemaining: 0, injuredGamesPlayed: 0 }
  return startNextSeason(paid)
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

/** 연봉 결과 — 등급 k = 타이틀 1위 수 + (MVP 면 2) */
export function salaryResultEventId(choiceEventId: number, rank: number): number {
  const offset = rank >= 5 ? 0 : rank >= 3 ? 1 : rank >= 1 ? 2 : 3
  return (choiceEventId === SALARY_FIRM_EVENT_ID ? 384 : 388) + offset
}

/** 보상 20 의 값 → 연봉 변동률(%) */
const SALARY_RATE: readonly number[] = [30, 20, 10, -20, 20, 10, 5, -10, 0]

/** 연봉 칸 +0x1c8 은 u16 — 쓰기 0xa4fd8 이 자르지 않고 `strh` 로 넣어 65536 을 넘으면 아래 16비트만 남는다(감긴다) */
const SALARY_MASK = 0xffff

/**
 * 연봉협상에 필요한 칸 — 타자편 `PlayerCareer` 와 투수편 `PitcherCareer` 가 같은 커리어 칸
 * (인기도 0xb6e79 · 시즌 시작 인기도 career+0x78 · 연봉 career+0x1c8)을 쓴다.
 * 원본도 한 벌의 함수(0xa39fc · 0x8cac0)가 모드 3·4 를 같이 돈다.
 */
export interface SalaryHolder {
  readonly popularity: number
  readonly popularityAtSeasonStart: number
  readonly salary: number
}

/**
 * 380 제시액 (0x8bc4c → 0xa39fc). 상승분 = max(1, trunc((인기도 − 시즌 시작 인기도) / 4)),
 * 새 연봉 = 상승분 + 현재 연봉. 단위는 100만원 한 칸 — 대사 "%s만 상승해서 %s만" 은 둘 다 ×100 해서
 * 금액 서식 0x55cf4 로 찍는다.
 */
export function salaryOfferOf(career: SalaryHolder): { readonly raise: number; readonly salary: number } {
  const raise = Math.max(1, Math.trunc((career.popularity - career.popularityAtSeasonStart) / 4))
  return { raise, salary: raise + career.salary }
}

/**
 * 연봉 = base ± trunc(base × 변동률 / 100), base = max(1, trunc(인기도 상승/4)) + 이전 연봉 (0x8cac0).
 * 단위는 원본 그대로 100만원 한 칸이다 (관리 화면이 ×100 해서 만원으로 보여 준다).
 * 새 값은 0xa4fd8 `strh` 로 쓰여 u16 으로 감긴다(상한에 붙지 않는다 — 원본 그대로).
 */
export function applySalaryChange<C extends SalaryHolder>(career: C, code: number): C {
  const base = salaryOfferOf(career).salary
  const rate = SALARY_RATE[code] ?? 0
  const change = Math.sign(rate) * Math.trunc((base * Math.abs(rate)) / 100)
  return { ...career, salary: (base + change) & SALARY_MASK }
}
