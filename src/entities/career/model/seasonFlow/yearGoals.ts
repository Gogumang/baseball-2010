import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { TITLE_NAMES } from '@/entities/career/model/titles'
import { BATTER_YEAR_GOALS } from '@/shared/config/original/yearGoals'

export const MID_SEASON_GAME = 22
export const GOAL_INTRO_EVENT_ID = 392
const AVERAGE_SCALE = 1000

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
    current: [average, stats.hits, stats.homeRuns, stats.runsBattedIn, Math.max(0, career.popularity - career.popularityAtSeasonStart)],
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
export function midSeasonTitlesOf(career: Pick<PlayerCareer, 'season' | 'lastMidSeasonGoalCount'>, achieved: number): string[] {
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
