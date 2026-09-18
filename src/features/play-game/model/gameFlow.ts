import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { describeOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { atBatRecordCodeOf } from '@/entities/batting/model/swingSkills'
import {
  applyAtBatOutcome,
  applyOpponentInning,
  createGame,
  PLAYER_BATTING_ORDER_INDEX,
  isPlayerTurn,
  resultOf,
} from '@/entities/game/model/gameState'
import type { GameState } from '@/entities/game/model/gameState'
import { simulateQuickAtBat } from '@/entities/game/model/quickAtBat'
import { simulateHalfInning } from '@/entities/game/model/simulateHalfInning'
import { batterAt, startingPitcherOf } from '@/entities/team/model/teamRoster'
import type { GameSummary } from '@/entities/game/model/gameSummary'
import { EMPTY_SEASON_STATS, recordAtBat } from '@/entities/career/model/seasonStats'
import type { SeasonStats } from '@/entities/career/model/seasonStats'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { advanceRunners } from '@/entities/game/model/baseState'
import { atBatPenaltyCounts, atBatPopularityPoints } from '@/entities/career/model/gameEvaluation'
import { atBatRecordIdsOf, gameEndRecordIdsOf } from '@/entities/game/model/gameRecords'
import type { AcePlayer } from '@/shared/config/original/acePlayers'

export interface GameLogEntry {
  readonly id: number
  readonly text: string
  /** 플레이어 본인의 타석인지. 화면에서 강조 표시하는 데 쓴다. */
  readonly isMine: boolean
}

export interface GameProgress {
  readonly game: GameState
  readonly ourTeamId: number
  /** 상대 팀 (원본 TEAMS 인덱스) */
  readonly opponentTeamId: number
  /** 이번 경기에 등판한 마선수. 없으면 평범한 투수다. */
  readonly aceOpponent: AcePlayer | null
  readonly myStats: SeasonStats
  /** 사용자 타석 인기도 점수 합 */
  readonly popularityPoints: number
  /** 사용자가 친 병살 수 · 득점권 주자를 두고 아웃된 타석 수 — 경기 후 평판 입력 */
  readonly doublePlays: number
  readonly scoringPositionOuts: number
  /** 사용자 최근 두 타석의 기록 코드 — 스킬 16·17 조건 (0x53100) */
  readonly recentAtBatCodes: readonly number[]
  /** 이 경기에서 달성한 기록 id (한 번 달성할 때마다 하나씩, 0xa77f0) */
  readonly recordIds: readonly number[]
  /** 이어진 연타석 안타 수 */
  readonly consecutiveHits: number
  readonly log: readonly GameLogEntry[]
  readonly nextLogId: number
}

/**
 * 자동 진행이 끝나지 않는 상황을 막는 안전장치.
 * 한 경기에 나올 수 있는 이벤트 수를 크게 웃도는 값이면 충분하다.
 */
const MAXIMUM_AUTO_STEPS = 500

const MAXIMUM_LOG_LENGTH = 40
const RECENT_AT_BAT_COUNT = 2

/**
 * 리그 팀 수. StrHOWTO[7] "기본 10개 팀과 히든 5팀" — 히든 5팀(국가대표 4팀·외인구단, 원본 10~14)은
 * 리그 상대가 아니다. 상대는 자기 팀을 뺀 기본 팀에서 고른다.
 */
const LEAGUE_TEAM_COUNT = 10

export function startGame(
  random: RandomPort,
  ourTeamId = 0,
  battingOrder = PLAYER_BATTING_ORDER_INDEX + 1,
): GameProgress {
  const candidates = Array.from({ length: LEAGUE_TEAM_COUNT }, (_unused, index) => index).filter(
    (index) => index !== ourTeamId,
  )
  const initial: GameProgress = {
    game: createGame(battingOrder - 1),
    ourTeamId,
    opponentTeamId: random.pick(candidates),
    // 정규 경기에 마선수가 무작위로 나오는 코드는 원본에 없다 — 마선수 대결은 이벤트 match 명령으로만 (누락 탐색 8차)
    aceOpponent: null,
    myStats: EMPTY_SEASON_STATS,
    popularityPoints: 0,
    doublePlays: 0,
    scoringPositionOuts: 0,
    recentAtBatCodes: [],
    recordIds: [],
    consecutiveHits: 0,
    log: [],
    nextLogId: 1,
  }
  return advanceUntilPlayerTurn(initial, random)
}

/** 플레이어 타석의 결과를 반영하고, 다시 플레이어 차례가 올 때까지 자동 진행한다. */
export function applyPlayerOutcome(
  progress: GameProgress,
  outcome: AtBatOutcome,
  random: RandomPort,
): GameProgress {
  if (progress.game.isFinished) return progress

  const nextGame = applyAtBatOutcome(progress.game, outcome)
  const runsBattedIn = nextGame.ourScore - progress.game.ourScore
  const outsInPlay = advanceRunners(progress.game.bases, outcome, progress.game.outs).outsAdded
  const isWalkOff = nextGame.isFinished && runsBattedIn > 0 && nextGame.ourScore > nextGame.opponentScore
  const points = atBatPopularityPoints({ outcome, runsBattedIn, outsInPlay, isWalkOff })
  const penalties = atBatPenaltyCounts({
    outsInPlay,
    runsBattedIn,
    isWalkOff,
    hadSecondBaseRunner: progress.game.bases.second,
  })

  const myStats = recordAtBat(progress.myStats, outcome, runsBattedIn)
  const isHit = outcome.kind === '안타' || outcome.kind === '홈런'
  // 연타석 = 최근 타석이 모두 안타 (0xa76f0) — 볼넷(기록 코드 8)도 연속을 끊는다
  const consecutiveHits = isHit ? progress.consecutiveHits + 1 : 0
  const recordIds = atBatRecordIdsOf({
    outcome,
    runsScored: runsBattedIn,
    consecutiveHits,
    homeRunsInGame: myStats.homeRuns,
    walksInGame: myStats.walks,
    completesCycle: !isCycleOf(progress.myStats) && isCycleOf(myStats),
  })

  const afterMyAtBat: GameProgress = appendLog(
    {
      ...progress,
      game: nextGame,
      myStats,
      consecutiveHits,
      recordIds: [...progress.recordIds, ...recordIds],
      popularityPoints: progress.popularityPoints + points,
      recentAtBatCodes: [...progress.recentAtBatCodes, atBatRecordCodeOf(outcome)].slice(-RECENT_AT_BAT_COUNT),
      doublePlays: progress.doublePlays + penalties.doublePlays,
      scoringPositionOuts: progress.scoringPositionOuts + penalties.scoringPositionOuts,
    },
    `${progress.game.inning}회말 나 — ${describeOutcome(outcome)}${
      runsBattedIn > 0 ? ` (${runsBattedIn}타점)` : ''
    }`,
    true,
  )

  return advanceUntilPlayerTurn(afterMyAtBat, random)
}

/** 상대 공격과 동료 타석을 플레이어 차례가 돌아올 때까지 자동으로 소화한다. */
function advanceUntilPlayerTurn(
  progress: GameProgress,
  random: RandomPort,
): GameProgress {
  let current = progress

  for (let step = 0; step < MAXIMUM_AUTO_STEPS; step += 1) {
    if (current.game.isFinished || isPlayerTurn(current.game)) return current
    current = current.game.half === '초'
      ? playOpponentInning(current, random)
      : playTeammateAtBat(current, random)
  }
  throw new Error('경기 자동 진행이 끝나지 않았습니다 — 진행 규칙을 확인하세요')
}

/**
 * 상대 공격은 이닝 득점 확률표가 아니라 원본처럼 타석을 3아웃까지 돌려 점수를 읽는다 (0xc11f0).
 * 상대 타순은 웹판이 아직 따로 들고 있지 않아 이닝마다 1번부터 시작한다 (추정).
 */
function playOpponentInning(progress: GameProgress, random: RandomPort): GameProgress {
  const { runs } = simulateHalfInning(
    0,
    (order) => batterAt(progress.opponentTeamId, order),
    startingPitcherOf(progress.ourTeamId),
    progress.game.inning,
    random,
  )
  const game = applyOpponentInning(progress.game, runs)

  return appendLog(
    { ...progress, game },
    `${progress.game.inning}회초 상대 공격 — ${runs}점`,
    false,
  )
}

/** 동료 타석도 원본은 같은 간이 타석 엔진을 쓴다 — 우리 팀 명단의 실제 능력치가 들어간다 */
function playTeammateAtBat(progress: GameProgress, random: RandomPort): GameProgress {
  const outcome = simulateQuickAtBat(
    batterAt(progress.ourTeamId, progress.game.battingOrderIndex),
    startingPitcherOf(progress.opponentTeamId),
    { inning: progress.game.inning },
    random,
  )
  const game = applyAtBatOutcome(progress.game, outcome)
  const runsBattedIn = game.ourScore - progress.game.ourScore

  return appendLog(
    { ...progress, game },
    `${progress.game.inning}회말 ${progress.game.battingOrderIndex + 1}번 — ${describeOutcome(outcome)}${
      runsBattedIn > 0 ? ` (${runsBattedIn}점)` : ''
    }`,
    false,
  )
}

function appendLog(progress: GameProgress, text: string, isMine: boolean): GameProgress {
  const entry: GameLogEntry = { id: progress.nextLogId, text, isMine }

  return {
    ...progress,
    log: [entry, ...progress.log].slice(0, MAXIMUM_LOG_LENGTH),
    nextLogId: progress.nextLogId + 1,
  }
}

export function summaryOf(progress: GameProgress): GameSummary {
  return {
    result: resultOf(progress.game),
    ourScore: progress.game.ourScore,
    opponentScore: progress.game.opponentScore,
    stats: progress.myStats,
    popularityPoints: progress.popularityPoints,
    recordIds: [
      ...progress.recordIds,
      ...gameEndRecordIdsOf(progress.game.ourScore - progress.game.opponentScore),
    ],
    doublePlays: progress.doublePlays,
    scoringPositionOuts: progress.scoringPositionOuts,
    ourTeamId: progress.ourTeamId,
    opponentTeamId: progress.opponentTeamId,
  }
}

function isCycleOf(stats: SeasonStats): boolean {
  const singles = stats.hits - stats.doubles - stats.triples - stats.homeRuns
  return singles > 0 && stats.doubles > 0 && stats.triples > 0 && stats.homeRuns > 0
}
