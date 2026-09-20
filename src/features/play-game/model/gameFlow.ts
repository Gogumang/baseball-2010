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
import { opponentOf } from '@/entities/league/model/league'
import type { GameSummary } from '@/entities/game/model/gameSummary'
import { EMPTY_SEASON_STATS } from '@/entities/career/model/seasonStats'
import type { SeasonStats } from '@/entities/career/model/seasonStats'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { advanceRunners } from '@/entities/game/model/baseState'
import { atBatPenaltyCounts, atBatPopularityPoints, EMPTY_REPUTATION_COUNTS } from '@/entities/career/model/gameEvaluation'
import type { ReputationCounts } from '@/entities/career/model/gameEvaluation'
import { completeGameRecordIdsOf, gameEndRecordIdsOf } from '@/entities/game/model/gameRecords'
import { EMPTY_BATTER_GAME_LOG, recordBatterAtBat } from '@/entities/game/model/batterGameLog'
import type { BatterGameLog } from '@/entities/game/model/batterGameLog'
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
  /** 평판 가산 칸 누계 (0xa57f8) */
  readonly reputationCounts: ReputationCounts
  /** 사용자 최근 두 타석의 기록 코드 — 스킬 16·17 조건 (0x53100) */
  readonly recentAtBatCodes: readonly number[]
  /** 이 경기에서 달성한 기록 id (한 번 달성할 때마다 하나씩, 0xa77f0) */
  readonly recordIds: readonly number[]
  /** 이어진 연타석 안타 수 */
  readonly consecutiveHits: number
  /**
   * 동료 타순(0~8)별 이 경기 기록. 원본은 기록을 팀 단위로 세므로 동료 타석도 G포인트가 된다
   * (0xa77f0 게이트는 공격 팀만 보고, 0xa8024 의 "본인인가" 필터는 개인 통산 성적에만 걸린다).
   */
  readonly teammateLogs: Readonly<Record<number, BatterGameLog>>
  /** 우리 투수가 내준 것 — 완투 계열 기록(0xa7de8)이 보는 state+0x88·0x89·0x8a */
  readonly pitching: {
    readonly hitsAllowed: number
    readonly walksAllowed: number
    readonly outsRecorded: number
    /** 우리 투수가 잡은 삼진 수와 이어지는 연속 삼진 — 삼진 계열 기록(16~23) 판정에 쓴다 */
    readonly strikeouts: number
    readonly strikeoutCombo: number
  }
  readonly log: readonly GameLogEntry[]
  readonly nextLogId: number
}

/**
 * 이 화면이 돌리는 경기는 나만의리그 **타자편** = 원본 게임 모드 4 다 (0x327b8 모드표, H-1).
 * 기록달성 판정이 모드를 보므로 상수로 둔다.
 */
const MY_LEAGUE_BATTER_MODE = 4

/**
 * 자동 진행이 끝나지 않는 상황을 막는 안전장치.
 * 한 경기에 나올 수 있는 이벤트 수를 크게 웃도는 값이면 충분하다.
 */
const MAXIMUM_AUTO_STEPS = 500

const MAXIMUM_LOG_LENGTH = 40
/** 타석 기록 링버퍼 용량 (0xa908c) — 스킬 16·17 은 이 버퍼의 **가장 오래된** 두 칸을 본다 */
const RECENT_AT_BAT_COUNT = 10

/**
 * 리그 팀 수. StrHOWTO[7] "기본 10개 팀과 히든 5팀" — 히든 5팀(국가대표 4팀·외인구단, 원본 10~14)은
 * 리그 상대가 아니다. 상대는 자기 팀을 뺀 기본 팀에서 고른다.
 */

/**
 * 상대는 원본 일정표(0xd89cb)가 정한다 — 무작위로 고르지 않는다.
 * 부르는 쪽이 `nextOpponentOf` 로 구해서 넘긴다. 안 넘기면 일정표 첫날 상대를 쓴다.
 */
export function startGame(
  random: RandomPort,
  ourTeamId = 0,
  battingOrder = PLAYER_BATTING_ORDER_INDEX + 1,
  opponentTeamId = opponentOf(0, ourTeamId),
): GameProgress {
  const initial: GameProgress = {
    game: createGame(battingOrder - 1),
    ourTeamId,
    opponentTeamId,
    // 정규 경기에 마선수가 무작위로 나오는 코드는 원본에 없다 — 마선수 대결은 이벤트 match 명령으로만 (누락 탐색 8차)
    aceOpponent: null,
    myStats: EMPTY_SEASON_STATS,
    popularityPoints: 0,
    doublePlays: 0,
    scoringPositionOuts: 0,
    reputationCounts: EMPTY_REPUTATION_COUNTS,
    recentAtBatCodes: [],
    recordIds: [],
    consecutiveHits: 0,
    teammateLogs: {},
    pitching: { hitsAllowed: 0, walksAllowed: 0, outsRecorded: 0, strikeouts: 0, strikeoutCombo: 0 },
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
    outcome,
    outsInPlay,
    runsBattedIn,
    isWalkOff,
    hadSecondBaseRunner: progress.game.bases.second,
  })

  // 기록 판정은 동료 타석과 같은 함수를 쓴다 — 원본은 기록을 팀 단위로 센다 (0xa77f0)
  const recorded = recordBatterAtBat(
    { stats: progress.myStats, consecutiveHits: progress.consecutiveHits },
    outcome,
    runsBattedIn,
  )
  const myStats = recorded.log.stats
  const consecutiveHits = recorded.log.consecutiveHits
  const recordIds = recorded.recordIds

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
      reputationCounts: addReputationCounts(progress.reputationCounts, {
        outcome,
        runsBattedIn,
        isWalkOff,
        ourScoreBefore: progress.game.ourScore,
        opponentScore: progress.game.opponentScore,
      }),
    },
    `${progress.game.inning}회말 나 — ${describeOutcome(outcome)}${
      runsBattedIn > 0 ? ` (${runsBattedIn}타점)` : ''
    }`,
    true,
  )

  return advanceUntilPlayerTurn(afterMyAtBat, random)
}

/**
 * 평판 가산 칸 누계 (0xa57f8 의 사건 코드, P7 B1·B2 확정).
 *
 * 역전·동점 득점은 원본이 **득점 처리 0xa5c34 에서 1점마다** 판정한다. 그 함수는 점수를 올리기 직전에
 * `L[측] = 올리기 전 내 점수` 를 적어 두고(0xb6a9c), 올린 뒤 아래를 본다:
 *   - 동점 득점 (G+0x110): `상대 점수 == 내 점수`
 *   - 역전 득점 (G+0x114): `L(상대) >= L(나) && 상대 점수 < 내 점수` → 정수라 `상대 점수 == 올리기 전 내 점수`
 * 타석 하나로 r 점이 들어오면 내 점수가 `before+1 … before+r` 로 차례로 오르므로, 그 구간에
 * 상대 점수가 걸리는지만 보면 같은 결과가 된다.
 *
 * 번트 안타(G+0xf4)는 웹에 번트가 없어 늘 0 이다.
 */
function addReputationCounts(
  counts: ReputationCounts,
  play: {
    outcome: AtBatOutcome
    runsBattedIn: number
    isWalkOff: boolean
    ourScoreBefore: number
    opponentScore: number
  },
): ReputationCounts {
  const { outcome, runsBattedIn, isWalkOff, ourScoreBefore, opponentScore } = play
  const isHit = outcome.kind === '안타' || outcome.kind === '홈런'
  const after = ourScoreBefore + runsBattedIn
  return {
    grandSlams: counts.grandSlams + (outcome.kind === '홈런' && runsBattedIn === GRAND_SLAM_RUNS ? 1 : 0),
    walkOffs: counts.walkOffs + (isWalkOff && isHit ? 1 : 0),
    buntHits: counts.buntHits,
    walks: counts.walks + (outcome.kind === '볼넷' ? 1 : 0),
    goAheadRuns:
      counts.goAheadRuns + (opponentScore >= ourScoreBefore && opponentScore <= after - 1 ? 1 : 0),
    tyingRuns:
      counts.tyingRuns + (opponentScore > ourScoreBefore && opponentScore <= after ? 1 : 0),
  }
}

/** 만루 홈런 — 그 플레이 득점이 4 점 (0xa8696) */
const GRAND_SLAM_RUNS = 4

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
  const half = simulateHalfInning(
    0,
    (order) => batterAt(progress.opponentTeamId, order),
    startingPitcherOf(progress.ourTeamId),
    progress.game.inning,
    random,
    { strikeoutCombo: progress.pitching.strikeoutCombo, strikeouts: progress.pitching.strikeouts },
  )
  const runs = half.runs
  const game = applyOpponentInning(progress.game, runs)

  return appendLog(
    {
      ...progress,
      game,
      pitching: {
        hitsAllowed: progress.pitching.hitsAllowed + half.hits,
        walksAllowed: progress.pitching.walksAllowed + half.walks,
        outsRecorded: progress.pitching.outsRecorded + half.outs,
        strikeouts: progress.pitching.strikeouts + half.strikeouts,
        strikeoutCombo: half.strikeoutCombo,
      },
      // 삼진 계열 기록도 우리 팀 것이다 (0xa77f0 은 수비 팀이 사람 팀인지 본다)
      recordIds: [...progress.recordIds, ...half.recordIds],
    },
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
  const slot = progress.game.battingOrderIndex
  const recorded = recordBatterAtBat(
    progress.teammateLogs[slot] ?? EMPTY_BATTER_GAME_LOG,
    outcome,
    runsBattedIn,
  )

  return appendLog(
    {
      ...progress,
      game,
      teammateLogs: { ...progress.teammateLogs, [slot]: recorded.log },
      recordIds: [...progress.recordIds, ...recorded.recordIds],
    },
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
      ...completeGameRecordIdsOf({
        // 나만의리그 타자편 = 원본 모드 4 → 0xa7de8 이 완투 계열을 아예 주지 않는다 (R8 6절)
        mode: MY_LEAGUE_BATTER_MODE,
        won: progress.game.ourScore > progress.game.opponentScore,
        // 타자편에는 사용자가 투구 코스를 찍는 순간이 없다 → state+0x8c 는 늘 0
        pitchCourseConfirmed: false,
        inningsPlayed: progress.game.inning,
        outsRecorded: progress.pitching.outsRecorded,
        hitsAllowed: progress.pitching.hitsAllowed,
        walksAllowed: progress.pitching.walksAllowed,
        runsAllowed: progress.game.opponentScore,
      }),
    ],
    doublePlays: progress.doublePlays,
    scoringPositionOuts: progress.scoringPositionOuts,
    reputationCounts: progress.reputationCounts,
    ourTeamId: progress.ourTeamId,
    opponentTeamId: progress.opponentTeamId,
  }
}

