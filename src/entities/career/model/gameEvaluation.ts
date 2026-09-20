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

/** 홈런의 인기도 점수 — 칸은 루타가 아니라 **득점 수**다: 솔로 3 · 투런 4 · 스리런 5 · 만루 6 */
const HOME_RUN_POINTS_BY_RUNS = [3, 4, 5, 6]
/** 끝내기 홈런 */
const WALK_OFF_HOME_RUN = 5
/** 홈런이 아닌 끝내기 — 원본은 "끝내기 **그리고** 득점 > 0" 일 때만 이 가지로 간다 */
const WALK_OFF_HIT = 4
export const DOUBLE_PLAY_OUTS = 2

/**
 * 사용자 타석 하나의 인기도 점수 (0xa59c0, R7 1a 확정).
 *
 * ```
 * 홈런 > 0:
 *    끝내기 → +5
 *    아니면 득점 1 → +3 · 2 → +4 · 3 → +5 · 4 → +6      ; 표 칸은 루타가 아니라 득점 수다
 * 홈런 아님:
 *    끝내기 && 득점 > 0 → +4, 끝
 *    득점 1 → +1 · 득점 2~3 → +2                        ; 안타가 아니어도 (밀어내기·희생플라이·땅볼 타점)
 *    안타면 루타 1 → +1 · 2 → +2 · 3 → +3               ; 위 득점 점수에 **더한다**
 *    안타 아니면 아웃 > 1 → −1
 * ```
 * 앞서 웹은 ① 홈런·안타를 한 표로 묶고 ② 칸을 루타로 보고 ③ 득점 가산을 통째로 빼먹었다.
 * 주석에 "뜻을 모르겠다" 고 적혀 있던 `r6` 은 실은 **루타 점수**였다.
 */
export function atBatPopularityPoints({ outcome, runsBattedIn, outsInPlay, isWalkOff }: AtBatContext): number {
  if (outcome.kind === '홈런') {
    if (isWalkOff) return WALK_OFF_HOME_RUN
    return HOME_RUN_POINTS_BY_RUNS[Math.min(runsBattedIn, HOME_RUN_POINTS_BY_RUNS.length) - 1] ?? 0
  }
  if (isWalkOff && runsBattedIn > 0) return WALK_OFF_HIT

  // 득점 점수 — 안타가 아니어도 붙는다
  let points = runsBattedIn === 1 ? 1 : runsBattedIn === 2 || runsBattedIn === 3 ? 2 : 0
  if (outcome.kind === '안타') points += outcome.bases
  else if (outsInPlay >= DOUBLE_PLAY_OUTS) points -= 1
  return points
}

export interface AtBatPenaltyInput {
  readonly outcome: AtBatOutcome
  readonly outsInPlay: number
  readonly runsBattedIn: number
  readonly isWalkOff: boolean
  /** 플레이 전에 2루 주자가 있었는가 — 원본이 플레이 전·후 중 어느 주자를 보는지는 미확정 (추정: 전) */
  readonly hadSecondBaseRunner: boolean
}

/**
 * 평판 감점용 카운터 증가분 (0xa5ab2~0xa5aea, R7 1a 확정).
 * 홈런이거나 "끝내기 + 득점" 이면 그 앞에서 함수가 끝나므로 둘 다 세지 않는다. 그 밖에는:
 *   - 병살 G+0x118: **안타가 아닐 때** 아웃 > 1 이면 센다 (득점이 있어도 센다)
 *   - 득점권 아웃 G+0x11c: **안타여도** 아웃 > 0 이고 2루에 주자가 있었으면 센다
 * 앞서 웹은 "타점도 끝내기도 없을 때만" 으로 조건을 좁게 잡고 있었다.
 */
export function atBatPenaltyCounts(input: AtBatPenaltyInput): { doublePlays: number; scoringPositionOuts: number } {
  if (input.outcome.kind === '홈런') return { doublePlays: 0, scoringPositionOuts: 0 }
  if (input.isWalkOff && input.runsBattedIn > 0) return { doublePlays: 0, scoringPositionOuts: 0 }
  const isHit = input.outcome.kind === '안타'
  return {
    doublePlays: !isHit && input.outsInPlay >= DOUBLE_PLAY_OUTS ? 1 : 0,
    scoringPositionOuts: input.outsInPlay > 0 && input.hadSecondBaseRunner ? 1 : 0,
  }
}

const CYCLE_BONUS = 7

function isCycle(stats: SeasonStats): boolean {
  const singles = stats.hits - stats.doubles - stats.triples - stats.homeRuns
  return singles > 0 && stats.doubles > 0 && stats.triples > 0 && stats.homeRuns > 0
}

/** 그 경기 삼진이 이만큼을 넘으면 −1 (0xa6934: `G+0x108 > 1`) */
const STRIKEOUT_PENALTY_LIMIT = 1

/**
 * 경기 점수 → 인기도 변화 −2~6 (0xa690c).
 * 사이클 +7 **앞에** 삼진 2개 이상이면 −1 이 먼저 붙는다 (0xa6934) — 웹에 빠져 있던 줄이다.
 */
export function popularityChangeOf(points: number, stats: SeasonStats): number {
  const strikeoutPenalty = stats.strikeouts > STRIKEOUT_PENALTY_LIMIT ? -1 : 0
  const total = points + strikeoutPenalty + (isCycle(stats) ? CYCLE_BONUS : 0)
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
const STRIKEOUT_REPUTATION = -2

/**
 * 평판 가산 칸 (0xa57f8 의 사건 코드 → G+오프셋, P7 B1·B2 확정).
 * 웹이 아직 만들지 않은 사건(번트 안타)은 늘 0 이다.
 */
export interface ReputationCounts {
  /** G+0xc8 — 만루 홈런 (+2) */
  readonly grandSlams: number
  /** G+0xc4 — 끝내기 안타·홈런 (+3) */
  readonly walkOffs: number
  /** G+0xf4 — 번트 안타 (+1). 웹에는 번트가 없어 늘 0 이다 */
  readonly buntHits: number
  /** G+0xfc — 볼넷 (2개 이상이면 +1) */
  readonly walks: number
  /** G+0x114 — 앞서가는(역전) 득점 (+2) */
  readonly goAheadRuns: number
  /** G+0x110 — 동점 득점 (+2) */
  readonly tyingRuns: number
}

export const EMPTY_REPUTATION_COUNTS: ReputationCounts = {
  grandSlams: 0, walkOffs: 0, buntHits: 0, walks: 0, goAheadRuns: 0, tyingRuns: 0,
}

/** 평판 구간 보정 — 가산 쪽 0xd82a0 (%) */
const REPUTATION_GAIN_TIERS = [90, 70, 50, 20, 10, 0, -5, -10, -15, -20]
/** 평판 구간 보정 — 감산 쪽 0xd82c8 (%) */
const REPUTATION_LOSS_TIERS = [-90, -70, -50, -30, -10, 0, 5, 10, 20, 30]

/**
 * 평판 변화 (0xa6218, B-10 확정).
 *
 * ```
 * 가산 r7 = 인기도변화 3→1,4→2,5→3,6→4
 *         + 안타수 1→1,2→2,3→3,>3→4
 *         + 홈런수 1→2,2~3→3,>3→4
 *         + (만루홈런 ? 2) + (사이클 ? 3) + (볼넷>1 ? 1) + (동점득점 ? 2)
 *         + (역전득점 ? 2) + (끝내기 ? 3) + (번트안타 ? 1)
 * 감산 m  = (무안타 ? −5) + (병살>1 ? −2) + (삼진>1 ? −2) + (득점권아웃 ? −1)
 * i  = (평판 − 1) / 100                                  ; 0 쪽 버림
 * 변화 = (r7 + trunc(r7·T1[i]/100)) + (m − trunc(|m|·T2[i]/100))
 * ```
 *
 * 앞서 웹은 **구간 보정 T1/T2 가 통째로 빠져 있었고** 칸 7개(만루홈런·끝내기·번트안타·
 * 볼넷·역전·동점·삼진)도 없었다. 평판이 낮을수록 가산이 크게 부풀고(최대 +90%),
 * 높을수록 깎이는(−20%) 구조라 없으면 성장 곡선이 통째로 달라진다.
 */
function reputationChangeOf(
  popularityChange: number,
  game: GameEvaluationInput,
  reputation: number,
): number {
  const { stats } = game
  const counts = game.reputationCounts ?? EMPTY_REPUTATION_COUNTS

  const fromPopularity = popularityChange >= 3 ? popularityChange - 2 : 0
  const fromHits = stats.hits === 0 ? 0 : Math.min(stats.hits, 4)
  const fromHomeRuns = stats.homeRuns === 0 ? 0 : stats.homeRuns === 1 ? 2 : stats.homeRuns <= 3 ? 3 : 4
  const gain =
    fromPopularity + fromHits + fromHomeRuns +
    (counts.grandSlams > 0 ? 2 : 0) +
    (isCycle(stats) ? 3 : 0) +
    (counts.walks > 1 ? 1 : 0) +
    (counts.tyingRuns > 0 ? 2 : 0) +
    (counts.goAheadRuns > 0 ? 2 : 0) +
    (counts.walkOffs > 0 ? 3 : 0) +
    (counts.buntHits > 0 ? 1 : 0)

  const loss =
    (stats.hits === 0 ? HITLESS_REPUTATION : 0) +
    (game.doublePlays > 1 ? DOUBLE_PLAY_REPUTATION : 0) +
    (stats.strikeouts > 1 ? STRIKEOUT_REPUTATION : 0) +
    (game.scoringPositionOuts > 0 ? SCORING_POSITION_OUT_REPUTATION : 0)

  const tier = Math.min(
    REPUTATION_GAIN_TIERS.length - 1,
    Math.max(0, Math.trunc((reputation - 1) / 100)),
  )
  const adjustedGain = gain + Math.trunc((gain * REPUTATION_GAIN_TIERS[tier]) / 100)
  const adjustedLoss = loss - Math.trunc((Math.abs(loss) * REPUTATION_LOSS_TIERS[tier]) / 100)
  return adjustedGain + adjustedLoss
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
  /** 평판 가산 칸 (0xa57f8). 없으면 전부 0 으로 본다 */
  readonly reputationCounts?: ReputationCounts
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
    // 평판 구간 보정은 **경기 전 평판**으로 칸을 고른다 (0xa6218 이 먼저 읽는다)
    reputationChange: reputationChangeOf(popularityChange, game, career.reputation),
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
