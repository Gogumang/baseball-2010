/**
 * 시즌모드 "올해의 목표" 5개 — 표 `0xd7cf6`, 판정 `0xa37bc` (P4 2b 확정).
 * 정규시즌이 끝나면 이벤트 392 가 목표를 확인하고, 달성 수로 393~396 이 갈린다 (`0x8d0e0`).
 *
 * ⚠️ 나리(마이플레이어)의 올해의 목표(`0xa3de8`, 표 `0xd7f9e`)와는 **다른 표·다른 함수**다.
 * `entities/career` 쪽 `yearGoalsOf` 를 재사용하면 안 된다.
 */

/** 표 한 줄 = [순위(0부터, 이하) · 승률%(이상) · 팀 타율×1000(이상) · 팀 방어율×100(이하) · 인기도 상승(이상)] */
export const SEASON_YEAR_GOALS: readonly (readonly number[])[] = [
  [4, 55, 250, 390, 50], // 1년차
  [4, 58, 260, 380, 60],
  [4, 61, 270, 370, 70],
  [3, 64, 280, 360, 80],
  [3, 67, 290, 350, 90],
  [3, 70, 300, 340, 100],
  [2, 73, 310, 330, 110],
  [2, 76, 320, 320, 120],
  [1, 79, 330, 310, 130],
  [1, 82, 340, 300, 140], // 10년차
]

/** 연차 idx(0부터)의 목표. 표 밖이면 마지막 줄을 쓴다 (원본은 10년차가 마지막이라 닿지 않는다) */
export function seasonGoalsOf(yearIndex: number): readonly number[] {
  return SEASON_YEAR_GOALS[Math.min(Math.max(yearIndex, 0), SEASON_YEAR_GOALS.length - 1)]
}

export interface SeasonGoalInput {
  /** `0xb7aa0(리그, 팀, 0)` — 내 팀 정규시즌 순위 (0부터) */
  readonly rank: number
  readonly wins: number
  readonly losses: number
  /** `0xa3700(SR,1)` — 타순 1~9번의 타율 평균 (×1000) */
  readonly teamBattingAverage: number
  /** `0xa3764(SR)` — 팀 투수 전원의 방어율 평균 (×100, 유력) */
  readonly teamEarnedRunAverage: number
  /** 인기도 − `SR+0x78`(시즌 시작 인기도) */
  readonly popularityGain: number
}

/** 승률 % — 경기가 없으면 0 (원본도 나눗셈 전에 막는다). 정수 나눗셈이라 버림이다 */
export function winRatePercentOf(wins: number, losses: number): number {
  const played = wins + losses
  if (played === 0) return 0
  return Math.trunc((wins * 100) / played)
}

/** 달성한 목표 수 (0~5) */
export function achievedSeasonGoalCount(yearIndex: number, input: SeasonGoalInput): number {
  const [rank, winRate, battingAverage, earnedRunAverage, popularityGain] = seasonGoalsOf(yearIndex)
  const checks = [
    input.rank <= rank,
    winRatePercentOf(input.wins, input.losses) >= winRate,
    input.teamBattingAverage >= battingAverage,
    input.teamEarnedRunAverage <= earnedRunAverage,
    input.popularityGain >= popularityGain,
  ]
  return checks.filter(Boolean).length
}

/** 목표 확인 이벤트 (정규시즌 종료) */
export const SEASON_GOAL_INTRO_EVENT_ID = 392

/** 달성 수 → 결과 이벤트 (`0x8d0e0`: 5 → 393 · 4 → 394 · 3 → 395 · 그 밖 → 396) */
export function seasonGoalResultEventId(achieved: number): number {
  if (achieved >= 5) return 393
  if (achieved === 4) return 394
  if (achieved === 3) return 395
  return 396
}

export interface SeasonGoalReward {
  readonly popularity: number
  readonly reputation: number
  /** 100만 원 단위 */
  readonly money: number
}

/**
 * 목표 결과 보상 (s_event 393~396 의 보상 명령, P4 2a).
 * 연차 보정(A-6 의 시즌값)은 **보상을 주는 쪽**에서 따로 더한다 — 아래 `SEASON_GOAL_YEAR_BONUS` 참고.
 */
export const SEASON_GOAL_REWARDS: Readonly<Record<number, SeasonGoalReward>> = {
  393: { popularity: 25, reputation: 30, money: 35 },
  394: { popularity: 20, reputation: 0, money: 20 },
  395: { popularity: 0, reputation: 0, money: 0 },
  396: { popularity: -10, reputation: -5, money: 0 },
}

/**
 * 연차 보정 (A-6 시즌값, `y` = 연차 idx).
 * 393·394 는 보상 종류 0(인기도)·1(평판)·3(소지금)에 **+5y**,
 * 396 은 인기도 **−10y** · 평판 **−2y** 를 더한다.
 */
export function seasonGoalYearBonusOf(eventId: number, yearIndex: number): SeasonGoalReward {
  if (eventId === 393) return { popularity: 5 * yearIndex, reputation: 5 * yearIndex, money: 5 * yearIndex }
  if (eventId === 394) return { popularity: 5 * yearIndex, reputation: 0, money: 5 * yearIndex }
  if (eventId === 396) return { popularity: -10 * yearIndex, reputation: -2 * yearIndex, money: 0 }
  return { popularity: 0, reputation: 0, money: 0 }
}
