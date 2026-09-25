import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { describeOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { atBatRecordCodeOf } from '@/entities/batting/model/swingSkills'
import {
  applyAtBatOutcome,
  applyOpponentInning,
  createGame,
  PLAYER_BATTING_ORDER_INDEX,
  PLAYER_SIDE_LAST_BAT,
  isPlayerTurn,
  ourHalfOf,
  resultOf,
} from '@/entities/game/model/gameState'
import type { GameState, PlayerSide } from '@/entities/game/model/gameState'
import { simulateQuickAtBat } from '@/entities/game/model/quickAtBat'
import { simulateHalfInning } from '@/entities/game/model/simulateHalfInning'
import { batterAt, startingPitcherOf, teamBatters, teamPitchers } from '@/entities/team/model/teamRoster'
import { rotationSlotOf } from '@/entities/pitcher-career/model/pitcherRotation'
import { opponentOf } from '@/entities/league/model/league'
import type { GameSummary } from '@/entities/game/model/gameSummary'
import { EMPTY_SEASON_STATS } from '@/entities/career/model/seasonStats'
import type { SeasonStats } from '@/entities/career/model/seasonStats'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { advanceRunners } from '@/entities/game/model/baseState'
import { attemptSteal, canStealFrom } from '@/entities/game/model/steal'
import type { BaseState } from '@/entities/game/model/baseState'
import { atBatPenaltyCounts, atBatPopularityPoints, EMPTY_REPUTATION_COUNTS } from '@/entities/career/model/gameEvaluation'
import type { ReputationCounts } from '@/entities/career/model/gameEvaluation'
import { completeGameRecordIdsOf, gameEndRecordIdsOf } from '@/entities/game/model/gameRecords'
import { EMPTY_BATTER_GAME_LOG, recordBatterAtBat } from '@/entities/game/model/batterGameLog'
import type { BatterGameLog } from '@/entities/game/model/batterGameLog'
import type { LeaguePlateAppearance } from '@/entities/league/model/leaguePlayerStats'
import type { AcePlayer } from '@/shared/config/original/acePlayers'
import type { BattedBallPattern } from '@/shared/config/original/battedBallPatterns'
import { battedBallTrajectory } from '@/entities/batting/model/battedBallFlight'
import { defenseAbilitiesOf, isBattedBallInPlay, runDefensePlay } from '@/features/defense-play/model/runDefensePlay'
import type { DefensePlayInput, DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import { homeRunPlaybackOf } from '@/features/defense-play/model/homeRunPlayback'
import { representativePatternOf } from '@/features/defense-play/model/representativePattern'
import type { BurstResolution, BurstSession } from '@/entities/burst-mission/model/burstMissionSession'
import { createBurstSession, resolveBurst, tryTriggerBurst } from '@/entities/burst-mission/model/burstMissionSession'
import { burstResultBitsOf } from '@/entities/burst-mission/model/burstResultBits'

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
  /**
   * 양 팀 선발 투수의 로스터 칸 — 경기를 세울 때 한 번만 정한다.
   * 이 화면은 나만의리그 **타자편(모드 4)** 이라 원본 경기 준비 `0x1c46c` 가 두 팀 모두
   * `0xb8c80`(→ `0xb5ca8`) 로 4인 로테이션을 한 칸 돌린다 (P1 1-1) — 무작위가 아니다.
   * 원본은 투수 0번과 이 칸을 **레코드째 섞어** 0번이 선발이 되지만, 웹판 로스터는 붙박이
   * 표라 바꿀 수 없어 칸 번호를 경기 내내 들고 다닌다 (`rotationSlotOf` 주석 — **근사다**).
   */
  readonly ourStartingPitcherIndex: number
  readonly opponentStartingPitcherIndex: number
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
  /**
   * 리그 선수 기록표에 넘길 타석 결과 — **동료 여덟 타순과 상대 팀 타자** 것이다.
   * 원본은 사람 경기(0xae24c·0xae3e8)도 CPU 끼리 경기와 **같은 0xa8024** 를 불러 양 팀 선수
   * 레코드에 성적을 쌓는다 (B-2 확정). 내 타석은 `myStats` 가 이미 세므로 여기 넣지 않는다.
   */
  readonly leaguePlateAppearances: readonly LeaguePlateAppearance[]
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
  /**
   * **재생만 하면 되는** 장면. 매 틱의 `DefenseViewState` 가 들어 있어 화면은 이것만 받아 그리면 된다
   * (라우팅은 앱 쪽 몫이라 여기서 연결하지 않는다).
   *
   * 홈런 비행처럼 사람이 조작할 것이 없는 장면이 여기 들어온다. 사람이 주루를 잡는 인플레이 타구는
   * `pendingDefensePlay` 쪽으로 가고, 다 본 뒤에는 **여기 남기지 않는다** — 남기면 한 번 더 튼다.
   */
  readonly lastDefensePlay: DefensePlayResult | null
  /**
   * **지금 화면이 실시간으로 돌리고 있는 타구.** 차 있으면 이 경기는 "수비 진행 중" 이고,
   * 타석 결과(안타/아웃 코드)만 정해졌을 뿐 **진루·아웃·득점은 아직 하나도 안 먹였다**.
   *
   * 원본은 타구가 뜨면 경기 장면이 상태 0x17 로 넘어가 공이 멈출 때까지 같은 루프를 돌며
   * 매 갱신 눌린 키를 읽는다 (R10 · I 문서). 그 동안 다음 투구는 나가지 않는다 —
   * 웹도 이 칸이 차 있는 동안 다음 타석을 시작하지 않는 것으로 그 자리를 붙든다.
   *
   * 화면이 다 돌고 나면 `resolveDefensePlay` 가 그 결과를 먹이고 이 칸을 비운다.
   * 미리 다 계산해도 되는 자리(미션·테스트)는 `applyPlayerOutcome` 을 부르면 이 칸을 거쳐
   * 가되 한 번에 비워져 나온다 — 밖에서 보면 예전과 똑같다.
   */
  readonly pendingDefensePlay: DefensePlayInput | null
  /**
   * 이번 경기의 돌발미션 상태 (경기 장면이 모드 2·3·4 에서만 만드는 객체, 0x48658).
   * `burst.current` 가 차 있으면 진행 중인 돌발이 있다 — 화면은 이것만 보고 창을 띄우면 된다.
   */
  readonly burst: BurstSession | null
  /**
   * 마지막 타석이 끝나며 난 돌발 판정. 보상 변화량이 들어 있고, 화면이 결과 창을 닫은 뒤
   * 커리어에 얹는다 (`applyBurstRewards`). 판정이 안 났으면 null 이다.
   */
  readonly lastBurstResolution: BurstResolution | null
  /**
   * 환경설정 "주루" 가 **수동**인가 (설정 레코드 +0xbd, 원본 기본은 자동).
   *
   * 갈림길은 `0xae690` — 매 틱 도는 경기 장면 슬롯 2(`0x524c0`) 안 `0x5262e` 가 설정 +0xbd 를
   * 넣어 부른다: `반환 = (경기[0x31 + 공격측] == 1) || (설정+0xbd != 0)`. 그 값이 0 이면
   * `0x52660` 의 자동 진루 제어기(`0xaf8c0` = vt8 = `0xaf918`)를 **통째로 안 돌린다**.
   * 곧 **사람이 공격 중이고 설정이 수동일 때만** 자동 진루가 멎는다.
   *
   * ⚠️ 이 화면은 나만의리그 **타자편** 이라 사람이 늘 공격이다 — 설정이 그대로 먹는다.
   * ⚠️ 수동이라고 주자가 굳는 것이 아니다. 밀려 뛰는 포스 진루는 자동 제어기와 무관하게 간다.
   */
  readonly runningModeManual: boolean
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
  // 사람이 맡는 측 — 원본 설정 레코드 +8 (0x30f44). 일반모드는 반반이지만 나만의리그 화면은
  // 늘 후공으로 돌려 왔으므로 기본값만 측 1 로 두고 박아 두지는 않는다.
  playerSide: PlayerSide = PLAYER_SIDE_LAST_BAT,
  /**
   * 리그 날짜 카운터 g (`리그+0x32` = `시즌+0xb2`, 커리어의 `gamesPlayed`) — 4인 로테이션이 본다.
   * 안 넘기면 0 = 시즌 첫 경기라 두 팀 모두 로스터 0번이 선발이다 (원본 `g == 0` 이면 안 돌린다).
   */
  dayCounter = 0,
  /**
   * 환경설정 "주루" 가 수동인가 (설정 +0xbd). 안 넘기면 자동 — 지금까지와 한 톨도 다르지 않다.
   *
   * ⚠️ **근사**: 원본은 이 칸을 매 틱 다시 읽지만(`0x5261c`), 웹은 경기를 세울 때 한 번 받아
   *    들고 다닌다. 경기 중에 설정을 바꾸는 길은 `useCareerSession` 이 이 칸을 갈아 끼워 잇는다.
   */
  runningModeManual = false,
): GameProgress {
  const initial: GameProgress = {
    game: createGame(battingOrder - 1, playerSide),
    ourTeamId,
    opponentTeamId,
    // 정규 경기에 마선수가 무작위로 나오는 코드는 원본에 없다 — 마선수 대결은 이벤트 match 명령으로만 (누락 탐색 8차)
    aceOpponent: null,
    // 모드 4 는 경기 준비 0x1c46c 에서 **두 팀 모두** 0xb8c80 로 4인 로테이션을 한 칸 돌린다
    // (P1 1-1 의 `else (모드 4): if g != 0: 0xb8c80(내 팀)` + 그 앞줄의 상대 팀). 무작위가 아니다.
    opponentStartingPitcherIndex: rotationSlotOf(dayCounter),
    ourStartingPitcherIndex: rotationSlotOf(dayCounter),
    myStats: EMPTY_SEASON_STATS,
    popularityPoints: 0,
    doublePlays: 0,
    scoringPositionOuts: 0,
    reputationCounts: EMPTY_REPUTATION_COUNTS,
    recentAtBatCodes: [],
    recordIds: [],
    consecutiveHits: 0,
    teammateLogs: {},
    leaguePlateAppearances: [],
    pitching: { hitsAllowed: 0, walksAllowed: 0, outsRecorded: 0, strikeouts: 0, strikeoutCombo: 0 },
    log: [],
    nextLogId: 1,
    lastDefensePlay: null,
    pendingDefensePlay: null,
    burst: createBurstSession(MY_LEAGUE_BATTER_MODE),
    lastBurstResolution: null,
    runningModeManual,
  }
  return advanceUntilPlayerTurn(initial, random)
}

/**
 * 플레이어 타석의 결과를 반영하고, 다시 플레이어 차례가 올 때까지 자동 진행한다.
 *
 * **원본은 CPU 끼리의 경기에만 간이 엔진(0xc11f0)을 쓰고 사람 경기는 수비 시뮬레이션을 돌린다.**
 * 그래서 여기서는 타구가 인플레이면 `features/defense-play` 진행기를 돌려 아웃·득점·루 상황을
 * 그 결과로 갈아 끼운다 — `baseState` 의 희생플라이 보장·고정 진루표 근사는 이 길에서 안 쓰인다.
 * 삼진·볼넷·홈런은 수비가 개입할 것이 없어 지금까지의 길(0xc11f0 과 같은 규칙)을 그대로 쓴다.
 *
 * `pattern` 을 주면 그 원본 패턴으로 궤적을 만든다. 안 주면 같은 결과를 내는 대표 패턴을
 * 원본 표에서 골라 쓴다 (`representativePatternOf`).
 * `isUncatchable` 은 필살타법 성공 타구 — 야수가 포구를 건너뛴다 (0x51800, S13 6절).
 *
 * ⚠️ 사람이 주루를 조작하는 화면은 이것을 쓰지 않는다 — `startPlayerOutcome` 으로 타석 결과만
 * 먼저 정하고, 화면이 틱을 다 돌린 뒤 `resolveDefensePlay` 로 주자 처리를 먹인다.
 * 여기는 그 둘을 한 줄로 이어 붙인 **얇은 껍데기**다 (미션·테스트처럼 끼어들 사람이 없는 자리용).
 */
export function applyPlayerOutcome(
  progress: GameProgress,
  outcome: AtBatOutcome,
  random: RandomPort,
  options: PlayerOutcomeOptions = {},
): GameProgress {
  const started = startPlayerOutcome(progress, outcome, random, options)
  const pending = started.pendingDefensePlay
  if (pending === null) return started
  // 미리 다 돌려 버린다 — `runDefensePlay` 는 스테퍼를 끝까지 도는 얇은 껍데기다.
  // 이 갈래는 아직 아무것도 안 보여 줬으므로 돌린 결과를 그대로 재생거리로 넘긴다 (예전 그대로).
  const result = runDefensePlay(pending)
  return finishPlayerOutcome({ ...started, pendingDefensePlay: null }, outcome, random, result, result)
}

export interface PlayerOutcomeOptions {
  readonly pattern?: BattedBallPattern
  readonly isUncatchable?: boolean
}

/**
 * 타석 결과만 먼저 정한다 — **인플레이 타구면 주자 처리를 뒤로 미룬다.**
 *
 * 인플레이 타구는 진행기에 넘길 `DefensePlayInput` 만 만들어 `pendingDefensePlay` 에 얹고
 * 경기 상태는 **한 톨도 건드리지 않은 채** 돌려준다. 그 동안 다음 타석이 시작되지 않는 것이
 * 이 칸의 뜻이다 (원본 상태 0x17 이 도는 동안 투구가 안 나가는 것과 같은 자리).
 * 주자 처리·기록·돌발 판정은 화면이 다 돌고 `resolveDefensePlay` 를 부를 때 한 번에 한다.
 *
 * 삼진·볼넷·홈런은 수비가 개입할 것이 없어 여기서 곧장 끝낸다 (0xc11f0 과 같은 규칙).
 */
export function startPlayerOutcome(
  progress: GameProgress,
  outcome: AtBatOutcome,
  random: RandomPort,
  options: PlayerOutcomeOptions = {},
): GameProgress {
  if (progress.game.isFinished) return progress
  if (!isBattedBallInPlay(outcome)) {
    // 홈런은 날아가는 그림만 따로 만들어 재생시킨다 — 점수는 타석 쪽이 이미 맞게 한다
    const playback = homeRunPlaybackOf({ outcome, bases: progress.game.bases, pattern: options.pattern })
    return finishPlayerOutcome(progress, outcome, random, null, playback)
  }
  return { ...progress, pendingDefensePlay: defensePlayInputOf(progress, outcome, random, options) }
}

/**
 * 화면이 다 돌린 수비 플레이를 **그때** 경기 상태에 먹인다.
 *
 * `result.advance`(진루·아웃·득점)와 `result.voidedRuns`(3아웃으로 날아간 보류 득점)가 여기서
 * 비로소 경기 상태가 된다. 이미 눈으로 다 본 플레이라 `lastDefensePlay` 에는 넣지 않는다 —
 * 넣으면 화면이 같은 장면을 한 번 더 재생한다.
 */
export function resolveDefensePlay(
  progress: GameProgress,
  result: DefensePlayResult,
  random: RandomPort,
): GameProgress {
  const pending = progress.pendingDefensePlay
  if (pending === null) return progress
  return finishPlayerOutcome({ ...progress, pendingDefensePlay: null }, pending.outcome, random, result, null)
}

/**
 * 진행기에 넘길 한 타구 — 능력치·난수·모드·수비 주체까지 다 여기서 채운다.
 * 이 객체를 만드는 데는 난수를 **한 번도 쓰지 않는다** (굴림은 전부 진행기 안에서 돈다).
 */
function defensePlayInputOf(
  progress: GameProgress,
  outcome: AtBatOutcome,
  random: RandomPort,
  options: PlayerOutcomeOptions,
): DefensePlayInput {
  return {
    outcome,
    trajectory: battedBallTrajectory(options.pattern ?? representativePatternOf(outcome)),
    bases: progress.game.bases,
    outs: progress.game.outs,
    // 수비는 상대 팀이다 — 로스터의 수비 자리 코드로 아홉 칸을 채운다
    defenseAbilities: opponentDefenseAbilitiesOf(progress),
    runAbility: runnerRunAbilityOf(progress),
    // 난수를 넘겨야 펌블(0xb41d0)·악송구(0xa1828)·필살수비(0x66b30/0x66be4) 굴림이 돈다
    random,
    // 나만의리그 타자편 = 전역 모드 4 (0x1552d10) — 필살수비 기준이 절반이다
    gameMode: MY_LEAGUE_BATTER_MODE,
    // 내 타석이므로 수비는 언제나 CPU 다 → 협살(AI 상태 8)이 돈다
    defenseIsCpu: true,
    // 타자편은 사람이 늘 공격이다 — `0xae690` 의 앞 항이 늘 거짓이라 설정 +0xbd 혼자가 답을 정한다
    offenseIsCpu: false,
    runningMode: progress.runningModeManual ? '수동' : '자동',
    // 필살타법이 성공한 타구면 야수가 쥐지 않는다 (0x51800) — 타석 쪽이 확률 굴림을 하면 넘겨 준다
    isUncatchable: options.isUncatchable,
  }
}

/**
 * 타석 하나를 경기 상태에 먹이고 다음 내 차례까지 자동 진행한다 — 예전 `applyPlayerOutcome` 의 몸통이다.
 *
 * `defensePlay` 가 있으면 그 결과로 진루·아웃·득점을 갈아 끼운다. `playback` 은 화면에 재생시킬 것 —
 * 실시간으로 이미 다 보여 준 플레이는 null 이고, 홈런은 여기서 비행 틱을 따로 만든다.
 */
function finishPlayerOutcome(
  progress: GameProgress,
  outcome: AtBatOutcome,
  random: RandomPort,
  defensePlay: DefensePlayResult | null,
  /**
   * 화면에 재생시킬 틱 묶음. 홈런 비행이거나, 미리 다 돌려 버린 갈래의 그 결과다.
   * **실시간으로 이미 다 보여 준 플레이는 null** — 넣으면 같은 장면을 한 번 더 튼다.
   */
  playback: DefensePlayResult | null,
): GameProgress {
  const nextGame = applyAtBatOutcome(progress.game, outcome, defensePlay?.advance)
  const runsBattedIn = nextGame.ourScore - progress.game.ourScore
  const outsInPlay =
    defensePlay?.advance.outsAdded ??
    advanceRunners(progress.game.bases, outcome, progress.game.outs).outsAdded
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

  // 돌발 판정은 타석이 끝나는 자리에서 한다 (0x4e6d4 → 0x8f414). 결과비트가 0 이거나
  // 목표 5번이면 판정이 나지 않고 돌발이 그대로 살아 다음 타석으로 넘어간다.
  const resolution =
    progress.burst === null
      ? null
      : resolveBurst(
          progress.burst,
          burstResultBitsOf({
            outcome,
            runsBattedIn,
            outsBefore: progress.game.outs,
            outsAdded: outsInPlay,
            inningEnded: progress.game.outs + outsInPlay >= OUTS_PER_INNING,
            humanTeamWalkOff: isWalkOff,
            // 웹 타석에는 번트가 없어 B6·B7 은 늘 꺼져 있다
          }),
        )

  const afterMyAtBat: GameProgress = appendLog(
    {
      ...progress,
      game: nextGame,
      lastDefensePlay: playback,
      burst: resolution === null ? progress.burst : resolution.session,
      // ⚠️ 아직 안 보여 준 판정을 지우지 않는다 — 돌발은 이제 동료·상대 타석에서도 나므로
      //    여기서 null 로 덮으면 그 보상이 화면에 안 뜬 채 사라진다. 지우는 것은 창을 닫을 때뿐이다
      lastBurstResolution:
        resolution !== null && resolution.judgement !== null ? resolution : progress.lastBurstResolution,
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
    `${progress.game.inning}회${progress.game.half} 나 — ${describeOutcome(outcome)}${
      runsBattedIn > 0 ? ` (${runsBattedIn}타점)` : ''
    }${
      // 3아웃으로 날아간 보류 득점(state[0])은 점수판에 안 올라가므로 기록으로만 남긴다
      defensePlay !== null && defensePlay.voidedRuns > 0 ? ` (${defensePlay.voidedRuns}점 무효)` : ''
    }`,
    true,
  )

  return advanceUntilPlayerTurn(afterMyAtBat, random)
}

/**
 * 수비 아홉 칸의 능력치 — **상대 팀** 로스터에서 만든다.
 *
 * 나만의리그 타자편은 전역 모드 4 라 팀 능력치 보정(비트마스크 0x306 = 모드 1·2·8·9)이
 * 붙지 않는다 → 로스터에 적힌 밑값을 그대로 쓴다.
 * 칸 0(투수)은 오늘 상대 선발의 능력치 칸 2 다 (`defenseAbilitiesOf` 주석 — ⚠️ 원본 그대로).
 */
function opponentDefenseAbilitiesOf(progress: GameProgress): readonly number[] {
  const pitcher = teamPitchers(progress.opponentTeamId)[progress.opponentStartingPitcherIndex]
  return defenseAbilitiesOf(
    teamBatters(progress.opponentTeamId).map((player) => ({
      position: player.position,
      defense: player.ability[2],
    })),
    pitcher?.ability[2],
  )
}

/**
 * 주자들의 주루 능력치.
 *
 * ⚠️ **근사**: 원본은 주자마다 제 레코드로 `0xb570c(팀, 3, 선수, 90)` 을 불러 속도를 따로 잡지만
 * (I-controls 3a), 이 진행기는 주자 전원에 한 값만 받는다. 지금 타석에 선 칸의 주루를 넘긴다 —
 * 누상 주자가 누구인지 `GameState` 가 들고 있지 않은 것도 `stealBase` 와 같은 한계다.
 */
function runnerRunAbilityOf(progress: GameProgress): number {
  return batterAt(progress.ourTeamId, progress.game.battingOrderIndex).run
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

/** 한 이닝 아웃 수 — 돌발 결과비트 B5 가 "이닝이 안 끝났는가" 를 볼 때 쓴다 */
const OUTS_PER_INNING = 3

/** 타순 칸 수 — 상대 타순 슬롯(team+0x32)은 0~8 로 돈다 */
const BATTING_ORDER_SIZE = 9

/**
 * 타석 준비에서 돌발미션 발동을 굴린다 (장면 상태 0xf → 0x8f158).
 *
 * 원본은 경기 장면이 지나는 **모든 타석** 준비에서 굴린다 (K 4절 1-6, 확정) — 내 타석뿐 아니라
 * 동료 타석·상대 타석도 같은 상태 0xf 를 지난다. 웹도 이제 세 자리에서 모두 굴린다:
 *   내 타석(`advanceUntilPlayerTurn`) · 동료 타석(`playTeammateAtBat`) ·
 *   상대 타석(`simulateHalfInning` 의 `onAtBatStart` 갈고리).
 * 예전에는 내 타석에서만 굴려 **발동이 원본보다 드물었다.**
 *
 * 판정도 같은 자리를 따라간다 — 동료·상대 타석에서 뜬 돌발은 **그 타석 결과로** 판정된다
 * (0x8f414 는 타석이 끝나는 자리마다 돈다).
 *
 * 상대 마선수(b0=10~22)는 웹판 로스터가 아직 들고 있지 않아 그 조건 행은 걸리지 않는다.
 */
function burstContextOf(
  progress: GameProgress,
  situation: {
    readonly isHumanTeamBatting: boolean
    readonly bases: BaseState
    readonly outs: number
    readonly opponentBattingSlot: number
    readonly hitsInGame: number
    readonly homeRunsInGame: number
    readonly strikeoutsInGame: number
  },
) {
  const ace = progress.aceOpponent
  return {
    ...situation,
    // 원본 이닝은 0-기준이다 (game+0x6b) — 웹 `inning` 은 1-기준이라 하나 뺀다
    inning: progress.game.inning - 1,
    ourScore: progress.game.ourScore,
    opponentScore: progress.game.opponentScore,
    opponentAceBatterId: ace !== null && ace.role === '타자' ? ace.id : null,
    opponentAcePitcherId: ace !== null && ace.role === '투수' ? ace.id : null,
  }
}

function triggerBurstForMyAtBat(progress: GameProgress, random: RandomPort): GameProgress {
  const session = progress.burst
  if (session === null) return progress

  const next = tryTriggerBurst(
    session,
    burstContextOf(progress, {
      isHumanTeamBatting: true,
      bases: progress.game.bases,
      outs: progress.game.outs,
      // 상대 타순 슬롯(team+0x32)은 우리 공격 중에도 상대 팀 칸을 가리킨다 —
      // 웹판은 이닝마다 1번부터 시작하는 근사라(playOpponentInning) 여기서는 0 이다
      opponentBattingSlot: 0,
      hitsInGame: progress.myStats.hits,
      homeRunsInGame: progress.myStats.homeRuns,
      strikeoutsInGame: progress.pitching.strikeouts,
    }),
    random,
  )
  return next === session ? progress : { ...progress, burst: next }
}

/** 상대 공격과 동료 타석을 플레이어 차례가 돌아올 때까지 자동으로 소화한다. */
function advanceUntilPlayerTurn(
  progress: GameProgress,
  random: RandomPort,
): GameProgress {
  let current = progress

  for (let step = 0; step < MAXIMUM_AUTO_STEPS; step += 1) {
    if (current.game.isFinished) return current
    // 내 타석이 오면 그 자리가 곧 타석 준비(0xf)다 — 돌발을 굴리고 넘긴다
    if (isPlayerTurn(current.game)) return triggerBurstForMyAtBat(current, random)
    // 우리가 공격하는 반 이닝은 측이 정한다 — '초' 고정이 아니다 (측 0 선공 · 측 1 후공)
    current = current.game.half === ourHalfOf(current.game)
      ? playTeammateAtBat(current, random)
      : playOpponentInning(current, random)
  }
  throw new Error('경기 자동 진행이 끝나지 않았습니다 — 진행 규칙을 확인하세요')
}

/**
 * 상대 공격은 이닝 득점 확률표가 아니라 원본처럼 타석을 3아웃까지 돌려 점수를 읽는다 (0xc11f0).
 * 상대 타순은 웹판이 아직 따로 들고 있지 않아 이닝마다 1번부터 시작한다 (추정).
 */
function playOpponentInning(progress: GameProgress, random: RandomPort): GameProgress {
  // 상대 타석도 장면 상태 0xf 를 지나므로 타석마다 돌발을 굴리고, 그 타석 결과로 판정한다
  let burst = progress.burst
  let resolution: BurstResolution | null = null
  const half = simulateHalfInning(
    0,
    (order) => batterAt(progress.opponentTeamId, order),
    startingPitcherOf(progress.ourTeamId, progress.ourStartingPitcherIndex),
    progress.game.inning,
    random,
    { strikeoutCombo: progress.pitching.strikeoutCombo, strikeouts: progress.pitching.strikeouts },
    {
      onAtBatStart: (state) => {
        if (burst === null) return
        burst = tryTriggerBurst(
          burst,
          burstContextOf(progress, {
            isHumanTeamBatting: false,
            bases: state.bases,
            outs: state.outs,
            opponentBattingSlot: state.battingOrderIndex % BATTING_ORDER_SIZE,
            // 상대 타자의 이번 경기 안타·홈런 칸을 웹판이 아직 안 들고 있다 (기록 +0x12·+0x13)
            hitsInGame: 0,
            homeRunsInGame: 0,
            strikeoutsInGame: state.strikeoutsSoFar,
          }),
          random,
        )
      },
      onAtBatEnd: (state) => {
        if (burst === null) return
        const judged = resolveBurst(burst, burstResultBitsOf(state))
        burst = judged.session
        if (judged.judgement !== null) resolution = judged
      },
    },
  )
  const runs = half.runs
  const game = applyOpponentInning(progress.game, runs)

  return appendLog(
    {
      ...progress,
      game,
      burst,
      lastBurstResolution: resolution ?? progress.lastBurstResolution,
      pitching: {
        hitsAllowed: progress.pitching.hitsAllowed + half.hits,
        walksAllowed: progress.pitching.walksAllowed + half.walks,
        outsRecorded: progress.pitching.outsRecorded + half.outs,
        strikeouts: progress.pitching.strikeouts + half.strikeouts,
        strikeoutCombo: half.strikeoutCombo,
      },
      // 삼진 계열 기록도 우리 팀 것이다 (0xa77f0 은 수비 팀이 사람 팀인지 본다)
      recordIds: [...progress.recordIds, ...half.recordIds],
      // 상대 팀 타석도 원본은 같은 0xa8024 로 상대 선수 레코드에 쌓는다 (B-2)
      leaguePlateAppearances: [
        ...progress.leaguePlateAppearances,
        ...half.plateAppearances.map((appearance) => ({
          teamId: progress.opponentTeamId,
          ...appearance,
        })),
      ],
    },
    `${progress.game.inning}회${progress.game.half} 상대 공격 — ${runs}점`,
    false,
  )
}

/** 동료 타석도 원본은 같은 간이 타석 엔진을 쓴다 — 우리 팀 명단의 실제 능력치가 들어간다 */
function playTeammateAtBat(progress: GameProgress, random: RandomPort): GameProgress {
  // 상태 0xf — 동료 타석 준비에서도 돌발을 굴린다 (K 4절 1-6)
  const slotBefore = progress.game.battingOrderIndex
  const logBefore = progress.teammateLogs[slotBefore] ?? EMPTY_BATTER_GAME_LOG
  const triggered =
    progress.burst === null
      ? null
      : tryTriggerBurst(
          progress.burst,
          burstContextOf(progress, {
            isHumanTeamBatting: true,
            bases: progress.game.bases,
            outs: progress.game.outs,
            opponentBattingSlot: 0,
            hitsInGame: logBefore.stats.hits,
            homeRunsInGame: logBefore.stats.homeRuns,
            strikeoutsInGame: progress.pitching.strikeouts,
          }),
          random,
        )
  const outcome = simulateQuickAtBat(
    batterAt(progress.ourTeamId, progress.game.battingOrderIndex),
    startingPitcherOf(progress.opponentTeamId, progress.opponentStartingPitcherIndex),
    { inning: progress.game.inning },
    random,
  )
  // 동료 타석은 원본도 간이 엔진(0xc262c)이 돌린다 — **간이 엔진에는 희생플라이가 없다** (E-2 확정).
  // 사람 타석과 달리 수비 시뮬레이션이 돌지 않으므로 `quickEngine` 갈래를 쓴다.
  const game = applyAtBatOutcome(
    progress.game,
    outcome,
    advanceRunners(progress.game.bases, outcome, progress.game.outs, { quickEngine: true }),
  )
  const runsBattedIn = game.ourScore - progress.game.ourScore
  const slot = progress.game.battingOrderIndex
  const recorded = recordBatterAtBat(
    progress.teammateLogs[slot] ?? EMPTY_BATTER_GAME_LOG,
    outcome,
    runsBattedIn,
  )
  // 타석이 끝나는 자리 — 동료 타석에서 뜬 돌발도 **그 타석 결과로** 판정된다 (0x8f414)
  const outsAdded = advanceRunners(progress.game.bases, outcome, progress.game.outs, {
    quickEngine: true,
  }).outsAdded
  const resolved =
    triggered === null
      ? null
      : resolveBurst(
          triggered,
          burstResultBitsOf({
            outcome,
            runsBattedIn,
            outsBefore: progress.game.outs,
            outsAdded,
            inningEnded: progress.game.outs + outsAdded >= OUTS_PER_INNING,
            humanTeamWalkOff:
              game.isFinished && runsBattedIn > 0 && game.ourScore > game.opponentScore,
          }),
        )

  return appendLog(
    {
      ...progress,
      game,
      burst: resolved === null ? triggered ?? progress.burst : resolved.session,
      lastBurstResolution:
        resolved !== null && resolved.judgement !== null ? resolved : progress.lastBurstResolution,
      teammateLogs: { ...progress.teammateLogs, [slot]: recorded.log },
      recordIds: [...progress.recordIds, ...recorded.recordIds],
      // 동료 타석도 우리 팀 선수 레코드에 쌓인다 — 타순 칸이 곧 로스터 칸이다 (`batterAt` 과 같은 자리)
      leaguePlateAppearances: [
        ...progress.leaguePlateAppearances,
        { teamId: progress.ourTeamId, battingOrderIndex: slot, outcome, runsBattedIn },
      ],
    },
    `${progress.game.inning}회${progress.game.half} ${progress.game.battingOrderIndex + 1}번 — ${describeOutcome(outcome)}${
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

/**
 * 도루 한 번 (원본 키 처리 `0x53610` → 메시지 `0x583`, 판정 표 `0xd9064`).
 *
 * `base` 는 **대상 주자가 선 루**다 — 키 '3' 이 1루 주자, '2' 가 2루 주자이고
 * 3루 주자(키 '1')는 원본이 홈 도루를 걸지 않는다 (`canStealFrom`).
 *
 * ⚠️ **근사**: 웹 `GameState` 는 루에 선 주자가 누구인지 모른다. 원본은 주자 객체가 제 능력치를
 * 들고 있지만, 여기서는 **1루 주자 = 직전 타자 · 2루 주자 = 그 앞 타자**로 타순을 거꾸로 세어
 * 주력을 꺼낸다. 성공하면 한 루 나가고, 실패하면 아웃 하나가 는다.
 */
export function stealBase(progress: GameProgress, base: 1 | 2, random: RandomPort): GameProgress {
  const { game } = progress
  if (game.isFinished || game.half !== ourHalfOf(game)) return progress
  if (!canStealFrom(base)) return progress
  const occupied = base === 1 ? game.bases.first : game.bases.second
  const nextBaseTaken = base === 1 ? game.bases.second : game.bases.third
  if (!occupied || nextBaseTaken) return progress

  const slotsBack = base === 1 ? 1 : 2
  const slot = (game.battingOrderIndex - slotsBack + BATTING_ORDER_SIZE) % BATTING_ORDER_SIZE
  const runner = batterAt(progress.ourTeamId, slot)
  // 도루 판정은 주력(`run`)만 본다 (표 0xd9064) — 나머지 칸은 안 쓴다
  const result = attemptSteal({ hit: runner.hit, power: runner.power, defense: 0, run: runner.run }, random)

  if (result === '실패') {
    const outs = game.outs + 1
    const bases = base === 1 ? { ...game.bases, first: false } : { ...game.bases, second: false }
    return appendLog(
      { ...progress, game: { ...game, outs, bases } },
      `${game.inning}회${game.half} 도루 실패 — 아웃`,
      true,
    )
  }
  const bases = base === 1
    ? { ...game.bases, first: false, second: true }
    : { ...game.bases, second: false, third: true }
  return appendLog({ ...progress, game: { ...game, bases } }, `${game.inning}회${game.half} 도루 성공`, true)
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
    leaguePlateAppearances: progress.leaguePlateAppearances,
  }
}

