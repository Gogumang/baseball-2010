/**
 * 시즌모드 "올해의 목표" 5개 — 표 `0xd7cf6`, 판정 `0xa37bc` (P4 2b 확정).
 * 정규시즌이 끝나면 이벤트 392 가 목표를 확인하고, 달성 수로 393~396 이 갈린다 (`0x8d0e0`).
 *
 * **판정과 창의 표 (직접 대조)**: 목표 창(SYS sub 1, 0x8656c 모드 2)은 판정 표가 아니라 사본 `0xd4406`(0x8645c 모드 2)을
 * 읽는다 — 50칸(10년 × 5) u16 이 `0xd7cf6` 과 모두 같아 웹은 이 표 하나로 둘 다 낸다. 둘 다 `S+0xb3` 를 자르지 않고 쓴다.
 * 판정 0xa37bc (a37bc~a3894) 를 다시 떠 웹 `achievedSeasonGoalCount` 와 줄마다 맞췄다:
 * ```
 * ① 목표 ≥ 0xb7aa0(L, 팀, 0)         ; 포스트시즌 중이면 대진 순위 — goalRankOf
 * ② 목표 ≤ w×100/(w+l), w·l = 0xb7908·0xb7968(L, 팀, 1) = 정규시즌 L[팀]   ; w+l == 0 이면 w×100 = 0
 * ③ 목표 ≤ 0xa3700(S, 1) · ④ 목표 ≥ 0xa3764(S) · ⑤ 목표 ≤ 0xb6e79(S) − u16 S+0x78 (자르지 않는다)
 * ```
 * 창과 다른 것은 ① 의 셋째 인자(창 1 · 판정 0)와 ⑤ 의 자르기(창만 max 0) 둘뿐이다 — `seasonGoalWindowNumbersOf`.
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

/**
 * **올해의 목표 창(SYS sub 1) 시즌모드 갈래의 숫자** — 0x8656c 의 모드 2 갈래 (직접 떴다, 배치는 `pages/story/lib/yearGoalWindow`).
 * ```
 * 현재  ① 순위 `windowRank`(아래) · ② 0xb7908·0xb7968(셋째 인자 1) 승률 · ③ 0xa3700(S,1) · ④ 0xa3764(S) ·
 *       ⑤ max(0, 0xb6e79(S) − u16 S+0x78)       ; ⑤ 만 0 아래를 자른다 — 판정 0xa37bc 는 자르지 않는다
 * 목표  0x8645c(…, 2, S+0xb3) = u16 0xd4406[연차idx·5 + i] — 판정 표 0xd7cf6 과 50칸 모두 같은 값이라 `seasonGoalsOf` 를 쓴다
 * ```
 * ②③④ 는 판정과 같은 함수·같은 인자다. ① 만 다르다 — `seasonGoalWindowRankOf`.
 */
export interface SeasonGoalWindowNumbers {
  readonly current: readonly number[]
  readonly goals: readonly number[]
}

export function seasonGoalWindowNumbersOf(
  yearIndex: number,
  input: SeasonGoalInput,
  windowRank: number,
): SeasonGoalWindowNumbers {
  return {
    current: [
      windowRank,
      winRatePercentOf(input.wins, input.losses),
      input.teamBattingAverage,
      input.teamEarnedRunAverage,
      Math.max(0, input.popularityGain),
    ],
    goals: [...seasonGoalsOf(yearIndex)],
  }
}

/**
 * 창의 현재 순위 ① (0x866e2~0x86742):
 * `S+0xb2`(경기 수) == 0 && `S+0xb4`(포스트시즌) == 0 → **0**, 그 밖 `0xb7aa0(L, 팀, 1) + 1` — 셋째 인자 1 이라 늘
 * **정규시즌 순위**(1부터)다. 판정(셋째 인자 0)은 포스트시즌 중이면 대진 순위를 보므로 392 에서 둘이 다를 수 있다 — 원본 그대로.
 */
export function seasonGoalWindowRankOf(regularSeasonRank: number, games: number, inPostseason: boolean): number {
  if (games === 0 && !inPostseason) return 0
  return regularSeasonRank + 1
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

/* ── 목표 ①③④ 의 재료 — 0xa37bc 가 부르는 셈 (직접 떴다) ───────────────────────── */

/** 타자 한 명의 시즌 줄 중 타율 셈이 읽는 두 칸 — 선수 레코드 +0x20 타수 · +0x22 안타 */
export interface GoalBatterLine {
  readonly atBats: number
  readonly hits: number
}

/** 투수 한 명의 시즌 줄 중 방어율 셈이 읽는 두 칸 — +0x20 잡은 아웃 · +0x22 실점 */
export interface GoalPitcherLine {
  readonly outs: number
  readonly runsAllowed: number
}

/** `0xb8e3c` 타율 ×1000 — 타수 ≤ 0 이면 0, `안타×1000 / 타수`(버림), 1000 상한 */
export function battingAverageOf(line: GoalBatterLine): number {
  if (line.atBats <= 0) return 0
  return Math.min(Math.trunc((line.hits * 1000) / line.atBats), 1000)
}

/**
 * `0xb6ce8` 방어율 ×100 — 아웃 > 0 이면 `실점 × 2700 / 아웃`(버림), 9999 상한.
 * 아웃이 0 이면 실점이 있으면 9999, 없으면 0 (한 번도 안 던진 투수는 0 이라 평균을 **낮춘다** — 원본 그대로).
 */
export function earnedRunAverageOf(line: GoalPitcherLine): number {
  if (line.outs > 0) return Math.min(Math.trunc((line.runsAllowed * 2700) / line.outs), 9999)
  return line.runsAllowed > 0 ? 9999 : 0
}

/** 목표 ③ 이 평균 내는 타자 수 — `0xa3700(SR, 1)` 은 둘째 인자가 0 이 아니면 9 (a3718~a3720) */
export const GOAL_BATTER_COUNT = 9

/**
 * 목표 ③ `0xa3700(SR, 1)` — 내 팀 레코드(`0x1f570(저장, SR[1])`)의 타자 **0~8번** 타율(`0xb8e3c`) 합 ÷ 9 (버림).
 * 차례는 저장된 팀 레코드의 선수 배열(엔트리 편집이 고친 차례) 그대로다. 부르는 쪽이 그 차례로 줄을 넘긴다.
 */
export function teamBattingAverageOf(lines: readonly GoalBatterLine[]): number {
  let sum = 0
  for (let index = 0; index < GOAL_BATTER_COUNT; index += 1) {
    sum += battingAverageOf(lines[index] ?? { atBats: 0, hits: 0 })
  }
  return Math.trunc(sum / GOAL_BATTER_COUNT)
}

/**
 * 목표 ④ `0xa3764(SR)` — 내 팀 레코드의 투수 **전원**(수 = 팀 +0xc) 방어율(`0xb6ce8`) 합 ÷ 투수 수 (버림).
 * 투수가 없으면 원본은 0 으로 나눈다(0xca7b4) — 시즌 팀은 늘 투수가 있어 닿지 않는다. 웹은 0 으로 둔다.
 */
export function teamEarnedRunAverageOf(lines: readonly GoalPitcherLine[]): number {
  if (lines.length === 0) return 0
  const sum = lines.reduce((total, line) => total + earnedRunAverageOf(line), 0)
  return Math.trunc(sum / lines.length)
}

/** 포스트시즌 대진 칸 — `L+0x38 + 2i` 의 두 팀 (i 0 한국시리즈 · 1 플레이오프 · 2 준플레이오프) */
export interface GoalPostseasonBracket {
  /** 우승팀 L+0x37 (없으면 null) */
  readonly champion: number | null
  readonly pairs: readonly (readonly (number | null)[])[]
}

/**
 * 목표 ① 의 순위 `0xb7aa0(L, 팀, 0)` (b7aa0~b7afa):
 * ```
 * (L+0x34 ≠ 0 || L+0x36 ≠ 0) && 셋째 인자 == 0:
 *     L+0x37 == 팀 → 0
 *     i = 0..2: L[0x38+2i+1] == 팀 || L[0x38+2i] == 팀 → i + 1
 *     → 10
 * 그 밖: 정규시즌 순위표(0부터)
 * ```
 * 그래서 **포스트시즌이 시작된 뒤 판정하는 392 에서는** 대진에 든 팀이 1~3, 못 든 팀이 10 이 된다
 * (정규시즌 1위 → 1 · 2위 → 2 · 3·4위 → 3). 원본 그대로다.
 */
export function goalRankOf(
  team: number,
  regularSeasonRank: number,
  bracket: GoalPostseasonBracket | null,
): number {
  if (bracket === null) return regularSeasonRank
  if (bracket.champion === team) return 0
  for (let index = 0; index < bracket.pairs.length; index += 1) {
    const pair = bracket.pairs[index] ?? []
    if (pair[1] === team || pair[0] === team) return index + 1
  }
  return POSTSEASON_OUTSIDE_RANK
}

/** 대진에 없는 팀의 `0xb7aa0` 값 */
export const POSTSEASON_OUTSIDE_RANK = 10
