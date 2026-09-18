import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { GameResult } from '@/entities/game/model/gameState'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { applySkillReward, hasSkill } from '@/entities/career/model/playerCareer'
import type { SeasonStats } from '@/entities/career/model/seasonStats'

/**
 * 경기 후 평가 (누락 탐색 3차 — binary.mod 0xa719c · 0xa59c0 · 0xa690c · 0xa6218 · 0xa73c4 · 0x1278c · 0x8a6fc).
 * 매 경기 뒤 인기도 → 평판 → 사기 순으로 바뀌고, 인기도 변화(−2~6)가 곧 평가 등급이다.
 * **덜 읽은 것**: 평판 변화 뒷부분의 의미 미확인 항목, 인기도 카운터 +0x108, 진루 보너스(r6).
 */
export interface AtBatContext {
  readonly outcome: AtBatOutcome
  readonly runsBattedIn: number
  /** 이 플레이 하나로 늘어난 아웃 수 — 2 이상이면 병살 */
  readonly outsInPlay: number
  readonly isWalkOff: boolean
}

const HIT_POINTS_WITH_RBI = [3, 4, 5, 6]
const WALK_OFF_WITH_RBI = 5
const WALK_OFF_WITHOUT_RBI = 4
export const DOUBLE_PLAY_OUTS = 2

/**
 * 사용자 타석 하나의 인기도 점수 (0xa59c0, 점검 7차 재확인).
 * 타점이 있으면 표 값만 주고 타점 수는 더하지 않는다.
 * 원본은 타점 없는 안타에 진루 보너스(r6 가 1~3 이면 +1~3)를 더하지만 r6 의 뜻을 몰라 넣지 않았다 — 미해독.
 */
export function atBatPopularityPoints({ outcome, runsBattedIn, outsInPlay, isWalkOff }: AtBatContext): number {
  if (outcome.kind === '안타' || outcome.kind === '홈런') {
    const bases = outcome.kind === '홈런' ? 4 : outcome.bases
    if (runsBattedIn > 0) return isWalkOff ? WALK_OFF_WITH_RBI : HIT_POINTS_WITH_RBI[bases - 1]
    return isWalkOff ? WALK_OFF_WITHOUT_RBI : bases === 1 ? 1 : 2
  }
  return outsInPlay >= DOUBLE_PLAY_OUTS ? -1 : 0
}

export interface AtBatPenaltyInput {
  readonly outsInPlay: number
  readonly runsBattedIn: number
  readonly isWalkOff: boolean
  /** 플레이 전에 2루 주자가 있었는가 — 원본이 플레이 전·후 중 어느 주자를 보는지는 미확정 (추정: 전) */
  readonly hadSecondBaseRunner: boolean
}

/** 평판 감점용 카운터 증가분. 원본은 타점도 끝내기도 없는 경로에서만 센다 (점검 9차) */
export function atBatPenaltyCounts(input: AtBatPenaltyInput): { doublePlays: number; scoringPositionOuts: number } {
  if (input.runsBattedIn > 0 || input.isWalkOff) return { doublePlays: 0, scoringPositionOuts: 0 }
  return {
    doublePlays: input.outsInPlay >= DOUBLE_PLAY_OUTS ? 1 : 0,
    scoringPositionOuts: input.outsInPlay > 0 && input.hadSecondBaseRunner ? 1 : 0,
  }
}

const CYCLE_BONUS = 7

function isCycle(stats: SeasonStats): boolean {
  const singles = stats.hits - stats.doubles - stats.triples - stats.homeRuns
  return singles > 0 && stats.doubles > 0 && stats.triples > 0 && stats.homeRuns > 0
}

/** 경기 점수 → 인기도 변화 −2~6 (0xa690c) */
export function popularityChangeOf(points: number, stats: SeasonStats): number {
  const total = points + (isCycle(stats) ? CYCLE_BONUS : 0)
  if (total > 10) return 6
  if (total >= 8) return 5
  if (total >= 6) return 4
  if (total >= 4) return 3
  if (total === 3) return 2
  if (total >= 1) return 1
  if (total === 0) return 0
  if (total >= -2) return -1
  return -2
}

const HITLESS_REPUTATION = -5
const DOUBLE_PLAY_REPUTATION = -2
const SCORING_POSITION_OUT_REPUTATION = -1

/**
 * 평판 변화 (0xa6218) — 인기도 변화 3~6, 안타 합계, 홈런 합계, 사이클, 무안타 −5,
 * 병살 2개 이상 −2, 득점권 아웃 −1. 뜻을 모르는 나머지 항목은 빠져 있다.
 */
function reputationChangeOf(popularityChange: number, game: GameEvaluationInput): number {
  const { stats } = game
  const fromPopularity = popularityChange >= 3 ? popularityChange - 2 : 0
  const fromHits = stats.hits === 0 ? HITLESS_REPUTATION : Math.min(stats.hits, 4)
  const fromHomeRuns = stats.homeRuns === 0 ? 0 : stats.homeRuns === 1 ? 2 : stats.homeRuns <= 3 ? 3 : 4
  const fromDoublePlays = game.doublePlays >= DOUBLE_PLAY_OUTS ? DOUBLE_PLAY_REPUTATION : 0
  const fromScoringPosition = game.scoringPositionOuts > 0 ? SCORING_POSITION_OUT_REPUTATION : 0
  return fromPopularity + fromHits + fromHomeRuns + (isCycle(stats) ? 3 : 0) + fromDoublePlays + fromScoringPosition
}

const WIN_MORALE = 5
const NOT_WIN_MORALE = -7
const LUCK_SKILL = 6
/** 라이벌 팀 쌍 (0xb8f68) — 이 두 팀이 붙으면 사기 변화가 2배다 */
const RIVAL_PAIRS: readonly (readonly [number, number])[] = [[0, 1], [2, 7], [3, 6], [4, 5], [8, 9]]

export function isRivalGame(ourTeamId: number, opponentTeamId: number): boolean {
  return RIVAL_PAIRS.some(
    ([first, second]) =>
      (first === ourTeamId && second === opponentTeamId) || (second === ourTeamId && first === opponentTeamId),
  )
}

/**
 * 사기 변화 (0xa73c4) — 승리 +5, 무승부 포함 그 밖은 −7.
 * 순서 (점검 9차 확정): 라이벌전 ×2 → 음수이고 인기도 변화가 2 이상이면 +절반 → 행운 스킬 +1.
 */
function moraleChangeOf(career: PlayerCareer, game: GameEvaluationInput, popularityChange: number): number {
  let change = game.result === '승' ? WIN_MORALE : NOT_WIN_MORALE
  if (isRivalGame(game.ourTeamId, game.opponentTeamId)) change *= 2
  if (change < 0 && popularityChange > 1) change += Math.trunc(popularityChange / 2)
  return change + (hasSkill(career, LUCK_SKILL) ? 1 : 0)
}

/** 인기도 변화 −2~6 → 칸 0~8. 타순 2배 칸(0x1283c)은 투수편 전용이라 타자는 쓰지 않는다 (점검 7차) */
const COMMENT_GRADES = [-2, -1, 0, 1, 2, 3, 4, 5, 6]
const COMMENT_BASE_BY_REPUTATION: readonly (readonly [number, number])[] = [
  [150, 39],
  [450, 48],
  [750, 57],
]
const COMMENT_BASE_TOP = 66

/** 감독 평가 글 번호 (StrUSER_EVT) */
export function managerCommentIndexOf(career: PlayerCareer, popularityChange: number): number {
  const base = COMMENT_BASE_BY_REPUTATION.find(([limit]) => career.reputation < limit)?.[1] ?? COMMENT_BASE_TOP
  const grade = COMMENT_GRADES.indexOf(popularityChange)
  return base + Math.max(0, grade)
}

export interface GameEvaluationInput {
  readonly result: GameResult
  readonly stats: SeasonStats
  readonly popularityPoints: number
  /** 이 경기에서 사용자가 친 병살 수 */
  readonly doublePlays: number
  /** 2루 주자를 두고 아웃된 타석 수 (atBatPenaltyCounts) */
  readonly scoringPositionOuts: number
  readonly ourTeamId: number
  readonly opponentTeamId: number
}

export interface GameEvaluation {
  readonly popularityChange: number
  readonly reputationChange: number
  readonly moraleChange: number
  readonly commentIndex: number
}

export function evaluateGame(career: PlayerCareer, game: GameEvaluationInput): GameEvaluation {
  const popularityChange = popularityChangeOf(game.popularityPoints, game.stats)
  return {
    popularityChange,
    reputationChange: reputationChangeOf(popularityChange, game),
    moraleChange: moraleChangeOf(career, game, popularityChange),
    commentIndex: managerCommentIndexOf(career, popularityChange),
  }
}

/** 연속 기록 알림 — 라벨(USER_EVT[100~102]) · 코멘트(108, 110~112) · 평판 변화 */
export interface StreakNotice {
  readonly labelIndex: number
  /** 연속 경기 수 — 화면에 "3경기 연속" 처럼 앞에 붙인다 */
  readonly count: number
  readonly commentIndex: number
  readonly reputationChange: number
}

const MULTI_HIT_STREAKS = [3, 5, 10, 15, 20]
const HOME_RUN_STREAKS = [5, 10, 20, 30, 40]
const HITLESS_STREAKS = [3, 4, 5]
const STREAK_REWARDS = [10, 15, 20, 25, 30]
const HITLESS_PENALTIES = [-5, -10, -20]
const GOOD_STREAK_COMMENT = 108
const HITLESS_COMMENT_BASE = 110
const SLUMP_SKILL = 17
const SLUMP_SKILL_YEAR = 3
const SLUMP_GAIN_STREAK = 4
const SLUMP_CLEAR_STREAK = 10

/** 경기 뒤 연속 기록을 잇고, 기준값과 정확히 같으면 알림·평판·스킬을 준다 (0x8a6fc) */
export function updateStreaks(career: PlayerCareer, stats: SeasonStats) {
  const streaks = {
    multiHit: stats.hits >= 2 ? career.streaks.multiHit + 1 : 0,
    homeRun: stats.homeRuns >= 1 ? career.streaks.homeRun + 1 : 0,
    hitless: stats.hits === 0 ? career.streaks.hitless + 1 : 0,
  }
  const notices: StreakNotice[] = []
  const good = (value: number, table: readonly number[], labelIndex: number) => {
    const index = table.indexOf(value)
    if (index >= 0) notices.push({ labelIndex, count: value, commentIndex: GOOD_STREAK_COMMENT, reputationChange: STREAK_REWARDS[index] })
  }
  good(streaks.multiHit, MULTI_HIT_STREAKS, 100)
  good(streaks.homeRun, HOME_RUN_STREAKS, 101)
  const hitlessIndex = HITLESS_STREAKS.indexOf(streaks.hitless)
  if (hitlessIndex >= 0) {
    notices.push({
      labelIndex: 102,
      count: streaks.hitless,
      commentIndex: HITLESS_COMMENT_BASE + hitlessIndex,
      reputationChange: HITLESS_PENALTIES[hitlessIndex],
    })
  }

  let next: PlayerCareer = { ...career, streaks }
  if (career.season >= SLUMP_SKILL_YEAR && streaks.hitless === SLUMP_GAIN_STREAK && !hasSkill(next, SLUMP_SKILL)) {
    next = applySkillReward(next, SLUMP_SKILL + 1)
  }
  if (streaks.multiHit === SLUMP_CLEAR_STREAK && hasSkill(next, SLUMP_SKILL)) {
    next = applySkillReward(next, -(SLUMP_SKILL + 1))
  }
  return { career: next, notices }
}
