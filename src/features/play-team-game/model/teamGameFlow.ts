import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { describeOutcome, isHit } from '@/entities/at-bat/model/atBatOutcome'
import { applyPitchResolution, createAtBat } from '@/entities/at-bat/model/atBatState'
import type { AtBatState, PitchResolution } from '@/entities/at-bat/model/atBatState'
import {
  applyAtBatOutcome,
  createGame,
  ourHalfOf,
  PLAYER_SIDE_LAST_BAT,
  resultOf,
} from '@/entities/game/model/gameState'
import type { GameState, PlayerSide } from '@/entities/game/model/gameState'
import { advanceRunners } from '@/entities/game/model/baseState'
import { attemptSteal, canStealFrom } from '@/entities/game/model/steal'
import { playQuickAtBat } from '@/entities/game/model/quickAtBat'
import { rollStartingPitcherIndex } from '@/entities/team/model/teamRoster'
import { applyOpponentAtBat } from '@/features/play-pitcher-game/model/pitcherGameState'
import { battedBallTrajectory } from '@/entities/batting/model/battedBallFlight'
import { isBattedBallInPlay, runDefensePlay } from '@/features/defense-play/model/runDefensePlay'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import { homeRunPlaybackOf } from '@/features/defense-play/model/homeRunPlayback'
import { representativePatternOf } from '@/features/defense-play/model/representativePattern'
import type { BattedBallPattern } from '@/shared/config/original/battedBallPatterns'
import type { LeaguePlateAppearance } from '@/entities/league/model/leaguePlayerStats'
import {
  popularityCompleteGameOf,
  reputationCompleteGameOf,
} from '@/entities/season-mode/model/seasonEvaluation'
import type { CompleteGameFlags } from '@/entities/season-mode/model/seasonEvaluation'
import type { CompleteGameKind } from '@/entities/season-mode/model/seasonReputation'
import { createBurstSession, resolveBurst, tryTriggerBurst } from '@/entities/burst-mission/model/burstMissionSession'
import type { BurstResolution, BurstSession } from '@/entities/burst-mission/model/burstMissionSession'
import { burstResultBitsOf } from '@/entities/burst-mission/model/burstResultBits'
import { pitchAgainstBatter } from '@/entities/pitching/model/simulateBatter'
import type { Pitch } from '@/entities/pitching/model/pitch'
import { MAGIC_PITCH_TYPE_NUMBER } from '@/entities/pitcher-career/model/magicPitch'
import {
  consumeStamina,
  FULL_STAMINA,
  pitchStaminaCostOf,
  staminaCapacityOf,
  staminaPercentOf,
} from '@/entities/pitcher-career/model/pitcherStamina'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import {
  chooseReplacementPitcher,
  EMPTY_MOUND_COUNTERS,
  judgePitcherChange,
  rollsCloser,
} from '@/entities/pitching/model/pitcherChange'
import type { MoundPitcherCounters } from '@/entities/pitching/model/pitcherChange'
import { runnerCountOf } from '@/entities/game/model/baseState'
import { PITCHERS_PER_TEAM } from '@/entities/team/model/teamRoster'
import {
  buildHumanPitch,
  drainStamina,
  fatiguedStatsOf,
  pitchGradeOf,
  pitchSlotsOf,
} from '@/features/play-pitcher-game/model/pitcherPitch'
import type { PitchSlot, PitcherStats } from '@/features/play-pitcher-game/model/pitcherPitch'
import { TEAM_GAME_MODE } from '@/features/play-team-game/model/gameAbilities'
import type { FieldingAssignment, SeasonTeamCondition } from '@/features/play-team-game/model/gameAbilities'
import { FULL_PLAY_SETTINGS, isHumanControlled } from '@/features/play-team-game/model/matchSettings'
import type { MatchProgressSettings } from '@/features/play-team-game/model/matchSettings'
import {
  quickBatterFor,
  quickPitcherFor,
  pitcherGameAbilities,
  rosterRepertoireOf,
  stageBatterAbility,
  stagePitcherAbility,
} from '@/features/play-team-game/model/teamGameRoster'
import type { TeamGameAbilityContext } from '@/features/play-team-game/model/teamGameRoster'
import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import type { RandomPort } from '@/shared/api/random/randomPort'

/**
 * **사람이 팀을 조작하는 경기** — 원본 게임 모드 **1 일반 · 2 시즌 · 8·9 대전** 이 쓰는 경기다
 * (장면 0x104, H-1 모드표).
 *
 * 나만의리그 두 흐름과 뼈대는 같지만 **공수를 모두 사람이 맡는다**:
 *   - 우리 팀 공격 반 이닝 → 타순 아홉 칸을 사람이 **친다** (`applyBatterPitch`)
 *   - 우리 팀 수비 반 이닝 → 사람이 공을 하나씩 **던진다** (`throwPitch`)
 *   - 어느 타석을 사람이 잡고 어느 타석을 자동으로 넘길지는 **경기진행 설정**(J-3, `matchSettings`)이 정한다
 *
 * 자동으로 넘기는 타석은 원본과 같이 간이 엔진(0xc11f0·0xc262c)이 한 타석씩 돌린다.
 * 사람이 잡은 타석의 인플레이 타구만 수비 시뮬레이션(`features/defense-play`)을 거친다 —
 * 원본도 CPU 끼리의 타석에만 간이 엔진을 쓴다 (`play-game/gameFlow` 의 같은 주석).
 *
 * ⚠️ **아직 안 옮긴 것** (원본에는 있다):
 *   - 경기 중 **대타** `#`(R4 1a) — 타순은 끝까지 그대로다
 *   - 엔트리 편집(0x55864) — 타순은 로스터 순서 그대로다
 *   (경기 중 **투수 교체**는 들어왔다: 자동으로 넘긴 타석에서 CPU 교체 AI(0xac428)가 양 팀 투수를
 *    바꾸고, 사람이 잡은 타석은 원본대로 `#` 메뉴가 바꾼다 — `changePitcher`·`canOpenPitcherChange`)
 *   - 자동진행 **중계 화면**(경기 상태 0x21, R10 7절) — 비용·가드·자동 소화만 있다(`runAutoProgress`)
 *   - 감독 강판은 **투수편(모드 3) 전용**이라(P1 2절) 팀 경기에는 원본에도 없다
 *
 * ## 부르는 쪽에게 (시즌 세션 · 포스트시즌 · 국가대항전)
 * 지금 `app/model/useSeasonSession.playNextGame` 이 리그 시뮬레이터로 자동 진행하는 자리를
 * 이 진행기가 대신한다. 이어 붙이는 순서는 이렇다:
 * ```
 * 1. 화면을 띄운다:  pages/team-game/ui/TeamGameScreen  (또는 pages/team-game/model/useTeamGame)
 *      options = { mode: 2, ourTeamId, opponentTeamId, playerSide,
 *                  settings, season: { illness, morale, coach }, teamAbilities, lineup }
 * 2. onFinish(summary) 에서 지금 playNextGame 이 하던 일을 그대로 한다:
 *      recordLeagueResult(league, 이긴 팀, 진 팀)            ← summary.won
 *      playLeagueDay(...)                                   ← 같은 날 나머지 네 경기
 *      recordLeaguePlateAppearances(playerStats, summary.leaguePlateAppearances)
 *      evaluateSeasonGame(record, { myRuns: summary.ourScore, opponentRuns: summary.opponentScore,
 *                                   won: summary.won, opponentTeamId: summary.opponentTeamId,
 *                                   popularityCompleteGame: summary.popularityCompleteGame,
 *                                   reputationCompleteGame: summary.reputationCompleteGame })
 * 3. 돌발 보상은 경기 중에 난다 — `progress.lastBurstResolution.deltas` 를 시즌 레코드에 얹고
 *    `closeBurstWindow` 로 창을 닫는다 (종류 1 사기 · 2 인기도 · 3 평판 · 4 소지금).
 * ```
 * 포스트시즌·국가대항전도 같은 화면을 쓴다 — `mode` 는 그대로 2 이고 상대 팀만 바뀐다.
 */

/** 자동 진행이 끝나지 않는 상황을 막는 안전장치 (원본에는 없다) */
const MAXIMUM_AUTO_STEPS = 2_000
const MAXIMUM_LOG_LENGTH = 40
const OUTS_PER_INNING = 3
const BATTING_ORDER_SIZE = 9
/** 정규 마지막 이닝의 0-기준 번호 (상태 +0x69, 기본 8) */
const REGULATION_LAST_INNING_INDEX = 8

export interface TeamGameOptions {
  /** 원본 게임 모드 — 1 일반 · 2 시즌 · 8·9 대전 */
  readonly mode: number
  readonly ourTeamId: number
  readonly opponentTeamId: number
  /** 사람이 맡는 측 (0 선공 · 1 후공) — 원본 설정 레코드 +8 */
  readonly playerSide: PlayerSide
  /** 경기진행 설정 (J-3). 안 넘기면 "모든 이닝을 직접 플레이" */
  readonly settings?: MatchProgressSettings
  /** 시즌 팀 질병·사기·코치 (모드 2에서만 쓰인다) */
  readonly season?: SeasonTeamCondition
  /** 팀별 능력치 네 칸. 안 넘기면 XlsTEAM_DATA 값 */
  readonly teamAbilities?: readonly (readonly number[])[]
  /** 내 팀 타순 칸별 수비 자리·보직 — 보직 불일치 −20% 입력 (시즌모드 전용) */
  readonly lineup?: readonly FieldingAssignment[]
  /** 환경설정 "투구 게이지" (설정 +0x2d) — **원본 기본값은 꺼짐** (K 5-2) */
  readonly gaugeSettingOn?: boolean
  /** 이 경기에 쓸 수 있는 마구 횟수. 로스터 투수는 마구가 없어 기본 0 이다 */
  readonly magicCount?: number
  /** 화면 배치 side (투영 원점 표 0xcfb18 의 칸) */
  readonly stageSide?: number
}

export interface TeamGameLogEntry {
  readonly id: number
  readonly text: string
  /** 사람이 잡은 타석인지 — 화면에서 강조한다 */
  readonly isMine: boolean
}

/** 우리 팀 투수가 이 경기에 내준 것 — 완투·노히트·퍼펙트 판정이 보는 `state+0x88·0x89·0x8a` */
export interface TeamPitchingLine {
  readonly outsRecorded: number
  readonly hitsAllowed: number
  readonly walksAllowed: number
  readonly runsAllowed: number
  /**
   * `state+0x88` 출루 허용.
   * ⚠️ 원본은 이 칸을 **주자 목록의 마지막 원소만** 보고 세워서 야수선택이 퍼펙트를 안 깬다
   * (CORRECTIONS 2-1, S5 확정). 웹판에는 야수선택이 없어 차이가 드러나지 않으므로
   * 안타·볼넷이면 세우는 것으로 둔다 (**근사**).
   */
  readonly allowedBaserunner: boolean
}

const EMPTY_PITCHING_LINE: TeamPitchingLine = {
  outsRecorded: 0,
  hitsAllowed: 0,
  walksAllowed: 0,
  runsAllowed: 0,
  allowedBaserunner: false,
}

export interface TeamGameProgress {
  readonly options: TeamGameOptions
  readonly game: GameState
  /** 지금 타석의 볼 카운트 (사람이 잡은 타석에서만 찬다) */
  readonly atBat: AtBatState
  /** 상대 타순 커서 0~8 */
  readonly opponentOrderIndex: number
  /**
   * **지금 마운드에 선** 투수의 로스터 칸. 경기를 세울 때 선발을 뽑고(0x3107a·0x31090),
   * 그 뒤로는 CPU 교체 AI(0xac428)나 `#` 메뉴(R4 1b)가 이 칸을 바꾼다 (교체 실행 0xaf09c).
   */
  readonly ourPitcherIndex: number
  readonly opponentPitcherIndex: number
  /** 이미 마운드를 밟은 투수 칸 — 벤치에서 빠진다 (`team+0x33` 이 줄어드는 자리, 0xaec22) */
  readonly ourUsedPitchers: readonly number[]
  readonly opponentUsedPitchers: readonly number[]
  /** 지금 상대 투수의 스태미나 0~10000 (`+0x2c`). 우리 쪽은 `stamina` 가 들고 있다 */
  readonly opponentStamina: number
  /** 지금 우리·상대 투수의 실점 카운터 A·B 와 투구 수 (`team+0x27c` 묶음, P7 E1) */
  readonly ourPitcherCounters: MoundPitcherCounters
  readonly opponentPitcherCounters: MoundPitcherCounters
  /** `state[0xd]` — 교체 직후 한 투구 동안은 다시 안 바꾼다 (0xa5e72 가 투구마다 0 으로) */
  readonly pitcherJustChanged: boolean
  /** 이 타석의 준비(상태 0xe·0xf)를 이미 지났는가 */
  readonly atBatPrepared: boolean
  /** 우리 투수 스태미나 0~10000 (레코드 +0x2c) */
  readonly stamina: number
  readonly magicRemaining: number
  readonly pitchCount: number
  readonly lastPitch: Pitch | null
  readonly lastResolution: PitchResolution | null
  /** 사람이 친 마지막 인플레이 타구의 수비 시뮬레이션 (수비 화면이 이것만 받아 그리면 된다) */
  readonly lastDefensePlay: DefensePlayResult | null
  readonly pitching: TeamPitchingLine
  /** 우리 팀 타선이 친 안타 수 (간단 박스스코어) */
  readonly ourHits: number
  /** 리그 선수 기록표에 넘길 타석 결과 — **양 팀 전부** (원본 0xa8024 가 사람 경기도 같게 쌓는다) */
  readonly leaguePlateAppearances: readonly LeaguePlateAppearance[]
  /** 이번 경기의 돌발미션 (경기 장면이 모드 2·3·4 에서만 만든다 — 팀 경기에서는 **시즌만**) */
  readonly burst: BurstSession | null
  readonly lastBurstResolution: BurstResolution | null
  readonly log: readonly TeamGameLogEntry[]
  readonly nextLogId: number
}

/* ── 시작 ────────────────────────────────────────────────────────────────────── */

export function startTeamGame(options: TeamGameOptions, random: RandomPort): TeamGameProgress {
  const initial: TeamGameProgress = {
    options,
    // 타순 칸은 "사람이 서는 자리" 가 아니다 — 팀 경기는 아홉 칸을 모두 사람이 친다
    game: createGame(-1, options.playerSide),
    atBat: createAtBat(),
    opponentOrderIndex: 0,
    // 원본은 AI 팀 → 사람 팀 차례로 뽑는다 (0x31088 → 0x3109e)
    opponentPitcherIndex: rollStartingPitcherIndex(random),
    ourPitcherIndex: rollStartingPitcherIndex(random),
    ourUsedPitchers: [],
    opponentUsedPitchers: [],
    opponentStamina: FULL_STAMINA,
    ourPitcherCounters: EMPTY_MOUND_COUNTERS,
    opponentPitcherCounters: EMPTY_MOUND_COUNTERS,
    pitcherJustChanged: false,
    atBatPrepared: false,
    stamina: FULL_STAMINA,
    magicRemaining: options.magicCount ?? 0,
    pitchCount: 0,
    lastPitch: null,
    lastResolution: null,
    lastDefensePlay: null,
    pitching: EMPTY_PITCHING_LINE,
    ourHits: 0,
    leaguePlateAppearances: [],
    burst: createBurstSession(options.mode),
    lastBurstResolution: null,
    log: [],
    nextLogId: 1,
  }
  return advance(initial, random)
}

/** 기본 측 — 일반모드는 빠른실행이 반반으로 뽑지만(0x3123c) 화면이 없으면 후공으로 둔다 */
export const DEFAULT_PLAYER_SIDE: PlayerSide = PLAYER_SIDE_LAST_BAT

/* ── 지금 누구 차례인가 ───────────────────────────────────────────────────────── */

function settingsOf(progress: TeamGameProgress): MatchProgressSettings {
  return progress.options.settings ?? FULL_PLAY_SETTINGS
}

/** 우리 팀이 공격 중인가 (측이 정한다 — 측 0 선공 = 초 · 측 1 후공 = 말) */
export function isOurOffense(progress: TeamGameProgress): boolean {
  return progress.game.half === ourHalfOf(progress.game)
}

/**
 * 지금 타석을 사람이 조작하는가 (`0xc1e04`).
 * 팀 경기에서 사람이 조작하는 팀은 우리 팀 하나뿐이라, 공격 팀·수비 팀 판정이 곧 "우리 차례인가" 다.
 */
export function isHumanTurn(progress: TeamGameProgress): boolean {
  if (progress.game.isFinished) return false
  const ours = isOurOffense(progress)
  return isHumanControlled(settingsOf(progress), {
    mode: progress.options.mode,
    humanControlsOffense: ours,
    humanControlsDefense: !ours,
    bases: progress.game.bases,
    // 원본 이닝은 0-기준이다 (state+0x6b)
    inningIndex: progress.game.inning - 1,
    battingOrderIndex: ours ? progress.game.battingOrderIndex : progress.opponentOrderIndex,
  })
}

/** 사람이 **칠** 차례인가 */
export function isBatterTurn(progress: TeamGameProgress): boolean {
  return isHumanTurn(progress) && isOurOffense(progress)
}

/** 사람이 **던질** 차례인가 */
export function isPitchTurn(progress: TeamGameProgress): boolean {
  return isHumanTurn(progress) && !isOurOffense(progress)
}

/* ── 화면이 보는 능력치 ───────────────────────────────────────────────────────── */

function abilityContextOf(options: TeamGameOptions): TeamGameAbilityContext {
  return {
    mode: options.mode,
    // 내 팀 보정 셋(질병·보직·사기)은 시즌모드에서만 붙는다 (0xb581a)
    seasonTeamId: options.mode === TEAM_GAME_MODE.시즌 ? options.ourTeamId : -1,
    season: options.season,
    teamAbilities: options.teamAbilities,
    lineup: options.lineup,
  }
}

/** 지금 타석에 선 우리 타자의 경기용 능력치 */
export function currentBatterAbility(progress: TeamGameProgress) {
  return stageBatterAbility(
    abilityContextOf(progress.options),
    progress.options.ourTeamId,
    progress.game.battingOrderIndex,
  )
}

/** 지금 우리 타자를 상대하는 투수의 경기용 능력치 (0~100 눈금) */
export function currentPitcherAbility(progress: TeamGameProgress) {
  return stagePitcherAbility(
    abilityContextOf(progress.options),
    progress.options.opponentTeamId,
    progress.opponentPitcherIndex,
  )
}

/** 우리 선발 투수의 경기용 능력치 (제구·구속·변화·체력) */
export function ourPitcherStats(progress: TeamGameProgress): PitcherStats {
  const ability = pitcherGameAbilities(
    abilityContextOf(progress.options),
    progress.options.ourTeamId,
    progress.ourPitcherIndex,
  )
  return { control: ability[0], velocity: ability[1], breaking: ability[2], stamina: ability[3] }
}

/** 고를 수 있는 구질 칸 여섯 (0xb6d2c) */
export function pitchSlotsFor(progress: TeamGameProgress): readonly PitchSlot[] {
  const repertoire = rosterRepertoireOf(progress.options.ourTeamId, progress.ourPitcherIndex)
  return pitchSlotsOf({
    pitchMask: repertoire.pitchMask,
    form: repertoire.form,
    magicNumber: repertoire.magicId,
  })
}

/* ── 사람이 치는 타석 ─────────────────────────────────────────────────────────── */

/**
 * 사람 타석의 **공 하나**를 반영한다. 타석이 끝나면 그 자리에서 주자·점수까지 처리한다.
 * 화면은 `BattingStage` 가 준 `PitchOutcomeDetail` 을 그대로 넘기면 된다.
 */
export function applyBatterPitch(
  progress: TeamGameProgress,
  detail: PitchOutcomeDetail,
  random: RandomPort,
  options: { readonly pattern?: BattedBallPattern; readonly isUncatchable?: boolean } = {},
): TeamGameProgress {
  if (!isBatterTurn(progress)) return progress
  const atBat = applyPitchResolution(progress.atBat, detail.resolution)
  const outcome = atBat.outcome
  if (outcome === null) return { ...progress, atBat }
  return applyBatterOutcome({ ...progress, atBat }, outcome, random, options)
}

/**
 * 사람 타석 하나의 **결과**를 반영하고 다음 사람 차례까지 민다.
 * 인플레이 타구는 수비 시뮬레이션을 돌려 아웃·득점·루 상황을 그 결과로 갈아 끼운다.
 */
export function applyBatterOutcome(
  progress: TeamGameProgress,
  outcome: AtBatOutcome,
  random: RandomPort,
  options: { readonly pattern?: BattedBallPattern; readonly isUncatchable?: boolean } = {},
): TeamGameProgress {
  if (progress.game.isFinished) return progress
  const before = progress.game

  const defensePlay = isBattedBallInPlay(outcome)
    ? runDefensePlay({
        outcome,
        trajectory: battedBallTrajectory(options.pattern ?? representativePatternOf(outcome)),
        bases: before.bases,
        outs: before.outs,
        // 필살타법이 성공한 타구면 야수가 쥐지 않는다 (0x51800)
        isUncatchable: options.isUncatchable,
      })
    : null
  // 홈런도 공이 날아가는 그림은 나와야 한다 — 진루·득점은 그대로 두고 **보여 줄 틱만** 만든다
  const playback = defensePlay ?? homeRunPlaybackOf({ outcome, bases: before.bases, pattern: options.pattern })

  const game = applyAtBatOutcome(before, outcome, defensePlay?.advance)
  const runsBattedIn = game.ourScore - before.ourScore
  // 아웃 수는 반 이닝이 넘어가면 0 으로 되돌아가므로 진행 결과에서 직접 읽는다 (`gameFlow` 와 같은 길)
  const outsAdded =
    defensePlay?.advance.outsAdded ?? advanceRunners(before.bases, outcome, before.outs).outsAdded
  const slot = before.battingOrderIndex
  const inningEnded = before.outs + outsAdded >= OUTS_PER_INNING
  const isWalkOff = game.isFinished && runsBattedIn > 0 && game.ourScore > game.opponentScore

  const next: TeamGameProgress = {
    ...progress,
    game,
    lastDefensePlay: playback,
    atBat: createAtBat(),
    atBatPrepared: false,
    // 우리 타석의 득점은 **상대 투수**의 A·B 로 들어간다 (0xa5c34 는 수비 팀 칸을 올린다)
    opponentPitcherCounters: addRunsToCounters(
      progress.opponentPitcherCounters,
      runsBattedIn,
      0,
      game.inning !== before.inning || game.half !== before.half,
    ),
    ourHits: progress.ourHits + (isHit(outcome) ? 1 : 0),
    leaguePlateAppearances: [
      ...progress.leaguePlateAppearances,
      { teamId: progress.options.ourTeamId, battingOrderIndex: slot, outcome, runsBattedIn },
    ],
  }

  const resolved = resolveBurstFor(next, {
    outcome,
    runsBattedIn,
    outsBefore: before.outs,
    outsAdded,
    inningEnded,
    humanTeamWalkOff: isWalkOff,
  })

  return advance(
    appendLog(
      resolved,
      `${before.inning}회${before.half} ${(slot % BATTING_ORDER_SIZE) + 1}번 — ${describeOutcome(outcome)}${
        runsBattedIn > 0 ? ` (${runsBattedIn}타점)` : ''
      }`,
      true,
    ),
    random,
  )
}

/* ── 사람이 던지는 타석 ───────────────────────────────────────────────────────── */

export interface TeamPitchInput {
  /** 원본 구질 번호 1~21, 마구는 22 */
  readonly typeNumber: number
  /** 코스 칸 0~8 */
  readonly courseCell: number
  /** 게이지에서 누른 칸 0~9. 안 눌렀으면 0 */
  readonly gaugeCell: number
}

/**
 * 공 하나를 던진다 (상태 0x10 확정 → 0x11 → 0x12/0x13).
 * 투수편 `pitcherGameFlow.throwPitch` 와 같은 순서다 — 상대 타자는 CPU 가 반응한다.
 */
export function throwPitch(
  progress: TeamGameProgress,
  input: TeamPitchInput,
  random: RandomPort,
): TeamGameProgress {
  if (!isPitchTurn(progress)) return progress
  const { options } = progress
  const isMagic = input.typeNumber === MAGIC_PITCH_TYPE_NUMBER
  if (isMagic && progress.magicRemaining <= 0) return progress

  const stats = ourPitcherStats(progress)
  const fatigued = fatiguedStatsOf(stats, progress.stamina)
  const staminaPercent = staminaPercentOf(progress.stamina)
  const repertoire = rosterRepertoireOf(options.ourTeamId, progress.ourPitcherIndex)
  const grade = pitchGradeOf(
    {
      gaugeSettingOn: options.gaugeSettingOn === true,
      typeNumber: input.typeNumber,
      gaugeCell: input.gaugeCell,
      effectiveControl: fatigued.control,
      staminaPercent,
    },
    random,
  )
  const pitch = buildHumanPitch(
    {
      typeNumber: input.typeNumber,
      courseCell: input.courseCell,
      grade,
      gaugeCell: input.gaugeCell,
      stats: fatigued,
      repertoire: {
        pitchMask: repertoire.pitchMask,
        form: repertoire.form,
        magicNumber: repertoire.magicId,
      },
      side: options.stageSide ?? 1,
    },
    random,
  )

  const batter = stageBatterAbility(
    abilityContextOf(options),
    options.opponentTeamId,
    progress.opponentOrderIndex,
  )
  const resolution = pitchAgainstBatter(pitch, batter, random, {
    control: fatigued.control,
    velocity: fatigued.velocity,
  })

  // 스태미나는 게이지 결과와 무관하다 — 인자가 (game, 구질) 뿐이다 (P1 3-1 확정)
  const stamina = drainStamina({
    stamina: progress.stamina,
    typeNumber: input.typeNumber,
    staminaAbility: stats.stamina,
    teamMorale: options.season?.morale ?? 100,
    // 경기 중 교체를 아직 안 옮겨서 선발이 곧 "첫 투수" 다
    isFirstPitcher: true,
    // 상대 타자의 스킬 22(0xb62b4)를 웹 로스터가 들고 있지 않아 늘 거짓이다
    batterIntimidates: false,
    pitcherIsCoward: false,
    pitcherEndures: false,
  })

  const afterPitch: TeamGameProgress = {
    ...progress,
    stamina,
    // ⚠️ 마구 횟수는 **코스 확정(OK)** 때 줄어든다 — 구질을 고른 순간이 아니다 (0x50e9c)
    magicRemaining: isMagic ? progress.magicRemaining - 1 : progress.magicRemaining,
    pitchCount: progress.pitchCount + 1,
    // 투구마다 state[0xd] 가 내려간다 (0xa5e72) — 그 뒤라야 다시 교체를 볼 수 있다
    pitcherJustChanged: false,
    ourPitcherCounters: {
      ...progress.ourPitcherCounters,
      pitches: progress.ourPitcherCounters.pitches + 1,
    },
    lastPitch: pitch,
    lastResolution: resolution,
    atBat: applyPitchResolution(progress.atBat, resolution),
  }

  const outcome = afterPitch.atBat.outcome
  if (outcome === null) return afterPitch
  return advance(applyDefensiveAtBat(afterPitch, outcome, true), random)
}

/**
 * 상대 타석 하나를 반영한다. `mine` 이 참이면 사람이 던진 타석이라
 * 인플레이 타구에 수비 시뮬레이션을 돌리고 돌발 판정까지 한다.
 */
function applyDefensiveAtBat(
  progress: TeamGameProgress,
  outcome: AtBatOutcome,
  mine: boolean,
): TeamGameProgress {
  const before = progress.game
  const defensePlay =
    mine && isBattedBallInPlay(outcome)
      ? runDefensePlay({
          outcome,
          trajectory: battedBallTrajectory(representativePatternOf(outcome)),
          bases: before.bases,
          outs: before.outs,
        })
      : null
  // 내가 던진 타석이면 홈런도 날아가는 그림을 보여 준다 (자동으로 넘긴 타석은 재생 자체가 없다)
  const playback = defensePlay ?? (mine ? homeRunPlaybackOf({ outcome, bases: before.bases }) : null)
  const applied = applyOpponentAtBat(
    before,
    progress.opponentOrderIndex,
    outcome,
    // 자동으로 넘긴 타석은 원본도 간이 엔진이다 — **간이 엔진에는 희생플라이가 없다** (E-2 확정)
    defensePlay?.advance ?? advanceRunners(before.bases, outcome, before.outs, { quickEngine: true }),
  )
  const slot = progress.opponentOrderIndex
  const hit = isHit(outcome)
  const walk = outcome.kind === '볼넷'
  const inningEnded = before.outs + applied.outsAdded >= OUTS_PER_INNING

  const next: TeamGameProgress = {
    ...progress,
    game: applied.game,
    opponentOrderIndex: applied.opponentOrderIndex,
    lastDefensePlay: playback ?? progress.lastDefensePlay,
    atBat: createAtBat(),
    atBatPrepared: false,
    // 득점 처리 0xa5c34 가 1점마다 수비 팀 A·B 를 올린다 (P7 E1)
    ourPitcherCounters: addRunsToCounters(
      progress.ourPitcherCounters,
      applied.runsScored,
      0,
      applied.game.inning !== before.inning || applied.game.half !== before.half,
    ),
    pitching: {
      outsRecorded: progress.pitching.outsRecorded + applied.outsAdded,
      hitsAllowed: progress.pitching.hitsAllowed + (hit ? 1 : 0),
      walksAllowed: progress.pitching.walksAllowed + (walk ? 1 : 0),
      runsAllowed: progress.pitching.runsAllowed + applied.runsScored,
      allowedBaserunner: progress.pitching.allowedBaserunner || hit || walk,
    },
    leaguePlateAppearances: [
      ...progress.leaguePlateAppearances,
      {
        teamId: progress.options.opponentTeamId,
        battingOrderIndex: slot,
        outcome,
        runsBattedIn: applied.runsScored,
      },
    ],
  }

  const resolved = mine
    ? resolveBurstFor(next, {
        outcome,
        runsBattedIn: applied.runsScored,
        outsBefore: before.outs,
        outsAdded: applied.outsAdded,
        inningEnded,
        // ⚠️ 0xa89f0 — 사람 팀 승리로 경기가 끝나면 홈런·볼넷 비트를 함께 켠다 (P7 K1)
        humanTeamWalkOff:
          applied.game.isFinished && applied.game.ourScore > applied.game.opponentScore,
      })
    : next

  return appendLog(
    resolved,
    `${before.inning}회${before.half} 상대 ${slot + 1}번 — ${describeOutcome(outcome)}${
      applied.runsScored > 0 ? ` (${applied.runsScored}실점)` : ''
    }`,
    mine,
  )
}

/* ── 타석 준비 · 돌발 ─────────────────────────────────────────────────────────── */

/**
 * 타석 준비 (상태 0xe → 0xf 전이의 **돌발 발동 판정 0x8f158**).
 *
 * 돌발미션 표는 시즌(모드 2)에만 있다 — 경기 장면이 모드 2·3·4 에서만 객체를 만든다 (0x48658).
 * 시즌 표 56행은 **사람 팀이 공격이면 0~30(타자형), 수비면 31~55(투수형)** 로 갈린다 (0x8f000).
 *
 * **근사**: 원본은 경기 장면이 지나는 모든 타석에서 굴리지만, 자동 진행 구간은 상태 0x21
 * (간이 엔진 중계)로 빠져 0xf 를 지나지 않는다. 그래서 여기서도 **사람이 잡은 타석에서만** 굴린다.
 */
function prepareAtBat(progress: TeamGameProgress, random: RandomPort): TeamGameProgress {
  const session = progress.burst
  if (session === null) return { ...progress, atBatPrepared: true }
  const ours = isOurOffense(progress)
  const next = tryTriggerBurst(
    session,
    {
      isHumanTeamBatting: ours,
      bases: progress.game.bases,
      outs: progress.game.outs,
      // 원본 이닝은 0-기준이다 (game+0x6b)
      inning: progress.game.inning - 1,
      ourScore: progress.game.ourScore,
      opponentScore: progress.game.opponentScore,
      opponentBattingSlot: progress.opponentOrderIndex,
      // 정규 경기에 마선수가 무작위로 나오는 코드는 원본에 없다 — 이벤트 match 명령으로만
      opponentAceBatterId: null,
      opponentAcePitcherId: null,
      // 웹 로스터에 선수별 경기 기록 칸이 없어 팀 누계를 쓴다 (근사)
      hitsInGame: ours ? progress.ourHits : progress.pitching.hitsAllowed,
      homeRunsInGame: 0,
      strikeoutsInGame: 0,
    },
    random,
  )
  return { ...progress, burst: next, atBatPrepared: true }
}

/** 타석이 끝나는 자리에서 돌발을 판정한다 (0x8f414) */
function resolveBurstFor(
  progress: TeamGameProgress,
  play: {
    outcome: AtBatOutcome
    runsBattedIn: number
    outsBefore: number
    outsAdded: number
    inningEnded: boolean
    humanTeamWalkOff: boolean
  },
): TeamGameProgress {
  if (progress.burst === null) return progress
  const resolution = resolveBurst(progress.burst, burstResultBitsOf(play))
  return {
    ...progress,
    burst: resolution.session,
    lastBurstResolution: resolution.judgement !== null ? resolution : null,
  }
}

/** 돌발 결과 창을 닫는다 (보상은 앱이 시즌 레코드에 얹는다 — 판정에 변화량이 들어 있다) */
export function closeBurstWindow(progress: TeamGameProgress): TeamGameProgress {
  return progress.lastBurstResolution === null ? progress : { ...progress, lastBurstResolution: null }
}

/* ── 경기 중 투수 교체 (0xc1ba4 → 0xac428 · 0xabfcc · 0xaf09c) ───────────────── */

/**
 * 간이 타석 하나를 돌리기 **전에** 수비 팀 투수 교체를 판정한다 (0xc262c 가 타석마다 0xc1ba4 를 부른다).
 *
 * `defendingIsOurs` 가 참이면 우리 팀이 수비(= 우리 투수), 거짓이면 상대 투수를 본다.
 * 사람이 직접 던지는 타석은 이 길을 지나지 않는다 — 그때는 `#` 메뉴(`changePitcher`)뿐이다.
 *
 * ⚠️ 원본 `0xc1ba4` 의 첫 갈래(모드 3 에서 8회에 벤치 마선수로 교체)는 **투수편 전용**이라 여기 없다.
 */
function judgeAutoPitcherChange(
  progress: TeamGameProgress,
  defendingIsOurs: boolean,
  random: RandomPort,
): TeamGameProgress {
  const game = progress.game
  const used = defendingIsOurs ? progress.ourUsedPitchers : progress.opponentUsedPitchers
  const current = defendingIsOurs ? progress.ourPitcherIndex : progress.opponentPitcherIndex
  const stamina = defendingIsOurs ? progress.stamina : progress.opponentStamina
  const counters = defendingIsOurs ? progress.ourPitcherCounters : progress.opponentPitcherCounters
  const bench = benchIndexesOf(current, used)
  const defenseScore = defendingIsOurs ? game.ourScore : game.opponentScore
  const offenseScore = defendingIsOurs ? game.opponentScore : game.ourScore

  const decision = judgePitcherChange({
    ...counters,
    // ⚠️ 웹 로스터에 보직(`+0xb`)이 없다 — 선발로 본다 (역할 0·1 은 같은 갈래라 결과가 같다).
    //    로스터 JSON 에 `+0xb` 가 들어오면 그 값을 쓰면 된다.
    role: PITCHER_ROLE.starter,
    stamina,
    benchCount: bench.length,
    justChanged: progress.pitcherJustChanged,
    lead: defenseScore - offenseScore,
    // 원본 이닝은 0-기준이다 (state+0x6b)
    inningIndex: game.inning - 1,
    runnerCount: runnerCountOf(game.bases),
  })
  if (!decision.replace) return progress

  // 마무리 상황이면 0xac360 을 굴려 참이면 벤치 **마지막**, 아니면 0xabfcc 로 고른다
  const closerFirst =
    decision.saveSituation &&
    rollsCloser(
      {
        inningIndex: game.inning - 1,
        lead: defenseScore - offenseScore,
        runnerCount: runnerCountOf(game.bases),
        // 팀 경기는 한 팀을 사람이 잡으므로 "두 팀 다 CPU" 가 아니다 (0xb6c20)
        bothTeamsAreCpu: false,
      },
      random,
    )
  const next = closerFirst
    ? bench[bench.length - 1]
    : chooseReplacementPitcher(
        bench.map((index) => ({ index })),
        { inningIndex: game.inning - 1, lateInningFlag: decision.saveSituation, currentStamina: stamina },
      )
  if (next < 0) return progress

  return appendLog(
    applyPitcherChange(progress, defendingIsOurs, next),
    `${game.inning}회${game.half} ${defendingIsOurs ? '우리' : '상대'} 투수 교체 — ${current + 1}번 → ${next + 1}번`,
    false,
  )
}

/** 벤치에 남은 투수 칸 (`team+0x33`) — 이미 던진 투수와 지금 투수는 빠진다 */
function benchIndexesOf(current: number, used: readonly number[]): readonly number[] {
  const out: number[] = []
  for (let index = 0; index < PITCHERS_PER_TEAM; index += 1) {
    if (index === current || used.includes(index)) continue
    out.push(index)
  }
  return out
}

/**
 * 교체 실행 `0xaf09c` → `0xaebe4`. 새 투수는 스태미나가 가득이고 카운터가 0 이며,
 * `state[0xd]` 가 서서 **다음 한 투구 동안**은 다시 바뀌지 않는다 (0xaec64 memset · 0xa5e72).
 */
function applyPitcherChange(
  progress: TeamGameProgress,
  ours: boolean,
  nextIndex: number,
): TeamGameProgress {
  const base = { ...progress, pitcherJustChanged: true }
  if (ours) {
    return {
      ...base,
      ourUsedPitchers: [...progress.ourUsedPitchers, progress.ourPitcherIndex],
      ourPitcherIndex: nextIndex,
      // 웹 로스터에는 투수별 누적 스태미나가 없다 — 새 투수는 가득 찬 채로 올라온다 (근사)
      stamina: FULL_STAMINA,
      ourPitcherCounters: EMPTY_MOUND_COUNTERS,
      pitchCount: 0,
    }
  }
  return {
    ...base,
    opponentUsedPitchers: [...progress.opponentUsedPitchers, progress.opponentPitcherIndex],
    opponentPitcherIndex: nextIndex,
    opponentStamina: FULL_STAMINA,
    opponentPitcherCounters: EMPTY_MOUND_COUNTERS,
  }
}

/**
 * 사람이 `#` 메뉴로 투수를 바꾼다 (R4 1b — 원본도 **사람 손으로만** 우리 투수를 바꾼다).
 * `benchIndex` 는 아직 안 쓴 우리 팀 투수 칸이어야 한다.
 */
export function changePitcher(progress: TeamGameProgress, benchIndex: number): TeamGameProgress {
  if (progress.game.isFinished) return progress
  if (!benchIndexesOf(progress.ourPitcherIndex, progress.ourUsedPitchers).includes(benchIndex)) {
    return progress
  }
  return appendLog(
    applyPitcherChange(progress, true, benchIndex),
    `${progress.game.inning}회${progress.game.half} 투수 교체 — ${progress.ourPitcherIndex + 1}번 → ${benchIndex + 1}번`,
    true,
  )
}

/** 지금 바꿔 넣을 수 있는 우리 팀 투수 칸 — 화면의 투수 교체 목록이 쓴다 */
export function availablePitchers(progress: TeamGameProgress): readonly number[] {
  return benchIndexesOf(progress.ourPitcherIndex, progress.ourUsedPitchers)
}

/**
 * `#` 로 교체 화면(경기 상태 0xb)을 열 수 있는가 — 진입 조건 `0x498d4` 의 '#' 가지 (I-controls 4b · R4 1a).
 *
 * 원본 조건 셋: ① `0x38984` 참(모드 4·7 은 막는다 — 팀 경기 모드 1·2·8·9 는 통과),
 * ② 경기 상태가 **0xe 또는 0xf**(투구 전·구질 고르기) — 웹에서는 *사람이 던질 차례이고 아직 안 던진 상태*,
 * ③ 사람 팀 벤치 투수 수 `팀+0x33` > 0.
 *
 * ⚠️ 팀 경기에서 사람이 **공격** 중일 때 원본은 같은 키로 **대타**(`0xaf06c`)를 연다.
 * 대타는 아직 안 옮겼으므로(로스터 교환·재출장 금지가 통째로 없다) 여기서는 수비 중에만 참이다.
 */
export function canOpenPitcherChange(progress: TeamGameProgress): boolean {
  if (progress.game.isFinished) return false
  if (!isPitchTurn(progress)) return false
  return availablePitchers(progress).length > 0
}

/* ── 자동진행 (경기 중 메뉴 동작 4 = 0x3c60c → 하위 2 = 0x3c7d8) ─────────────── */

/** 대전모드(8·9) 자동진행 비용 (`3c67e: movs r2,#0x64`) */
export const AUTO_PROGRESS_COST_VERSUS = 100
/** 그 밖 모드의 자동진행 비용 (`3c694: movs r2,#0x1e`) */
export const AUTO_PROGRESS_COST = 30
/** 대전모드는 0-기준 이닝이 5 를 넘으면 거절한다 (`경기+0x6b > 5` → StrGAME[2]) */
const AUTO_PROGRESS_LAST_INNING_INDEX = 5

/** 이 모드의 자동진행 G포인트 비용 */
export function autoProgressCostOf(mode: number): number {
  return mode === TEAM_GAME_MODE.대전 || mode === TEAM_GAME_MODE.대전이벤트
    ? AUTO_PROGRESS_COST_VERSUS
    : AUTO_PROGRESS_COST
}

/** 대전모드인가 — 6회 제한과 100G 가 붙는 두 모드 */
function isVersusMode(mode: number): boolean {
  return mode === TEAM_GAME_MODE.대전 || mode === TEAM_GAME_MODE.대전이벤트
}

/**
 * 지금 자동진행을 물어볼 수 있는가 — **대전모드는 6회까지만**이다 (`0x3c60c`).
 * 거짓이면 원본은 StrGAME[2]("6회까지만") 알림만 띄우고 끝낸다.
 */
export function canAutoProgress(progress: TeamGameProgress): boolean {
  if (progress.game.isFinished) return false
  if (!isVersusMode(progress.options.mode)) return true
  // 원본 이닝은 0-기준이다 (state+0x6b)
  return progress.game.inning - 1 <= AUTO_PROGRESS_LAST_INNING_INDEX
}

/**
 * 자동진행을 한 번 굴린다 — 사람 차례를 건너뛰고 간이 엔진이 타석을 이어 돌린다
 * (`0x3c8da` 가 간이 시뮬레이터 `this+0x1780` 으로 넘기고, 갱신 `0x48480` 이 `0xc262c` 를 반복한다).
 *
 * ⚠️ **중계 화면(경기 상태 0x21)은 옮기지 않았다** — 속도 칸 3단계·주자 그림·"공격팀(PLAYER/COM)" 띠·
 * CLR 중단 질문(StrGAME[6])은 R10 7절에 있지만 연출이라 건너뛰었다. 여기서는 결과만 계산한다.
 *
 * ⚠️ **끝나는 지점은 근사**다. 원본은 `0xc2198(sim,1)` 이 거짓이 될 때까지 도는데 그 조건을 못 읽었다
 * (I-controls 4d 는 "7회 직접 플레이 전환 지점으로 보임 — 유력" 이라고만 적는다).
 * 여기서는 **경기 끝까지** 돌리되, 대전모드는 "6회까지만" 이라는 StrGAME[2] 에 맞춰 **6회를 마치면 멈춘다**.
 */
export function runAutoProgress(progress: TeamGameProgress, random: RandomPort): TeamGameProgress {
  let current = progress
  for (let step = 0; step < MAXIMUM_AUTO_STEPS; step += 1) {
    if (current.game.isFinished) return current
    if (isVersusMode(current.options.mode) && current.game.inning - 1 > AUTO_PROGRESS_LAST_INNING_INDEX) {
      break
    }
    current = isOurOffense(current)
      ? playAutoOffenseAtBat(current, random)
      : playAutoDefenseAtBat(current, random)
  }
  // 자동진행이 멈춘 자리부터는 평소대로 — 다음 사람 차례에서 선다
  return advance(current, random)
}

/* ── 도루 (상태 0x11 공격, 0x53610 → 메시지 0x583) ───────────────────────────── */

/**
 * 도루를 걸 수 있는 루 — 원본 키는 '3' → 1루 주자 · '2' → 2루 주자 · '1' → 3루 주자다
 * (`0x53610`, 인자 = 대상 주자 1·2·3). 공격 중(상태 0x11)일 때만 받는다.
 *
 * 3루 주자는 빠진다 — `entities/game/model/steal` 의 `canStealFrom` 이 적은 대로
 * 원본 도루 판정(0xc1818)이 홈 도루를 걸지 않기 때문이다.
 */
export function stealableBases(progress: TeamGameProgress): readonly StealBase[] {
  if (!isBatterTurn(progress)) return []
  const bases = progress.game.bases
  const out: StealBase[] = []
  if (bases.first && !bases.second) out.push(1)
  if (bases.second && !bases.third) out.push(2)
  return out.filter((base) => canStealFrom(base))
}

/** 도루 대상 주자가 선 루 */
export type StealBase = 1 | 2 | 3

/**
 * 도루 한 번 (메시지 0x583). 성공하면 주자가 한 루 가고, 실패하면 그 주자가 죽는다.
 *
 * 판정은 `entities/game/model/steal` 의 원본 표(0xd9064, 주력만 본다)를 그대로 쓴다.
 *
 * ⚠️ **주자가 누구인지가 근사**다 — 웹 `GameState` 는 루에 선 주자의 신원을 들고 있지 않다.
 * 1루 주자는 직전 타자, 2루 주자는 그 앞 타자로 보고 타순에서 거꾸로 세어 능력치를 꺼낸다.
 */
export function stealBase(
  progress: TeamGameProgress,
  base: StealBase,
  random: RandomPort,
): TeamGameProgress {
  if (!stealableBases(progress).includes(base)) return progress
  const before = progress.game
  const runnerSlot =
    (before.battingOrderIndex - base + BATTING_ORDER_SIZE * 2) % BATTING_ORDER_SIZE
  const runner = stageBatterAbility(
    abilityContextOf(progress.options),
    progress.options.ourTeamId,
    runnerSlot,
  )
  const succeeded = attemptSteal(runner, random) === '성공'

  if (succeeded) {
    const bases =
      base === 1
        ? { ...before.bases, first: false, second: true }
        : { ...before.bases, second: false, third: true }
    return appendLog(
      { ...progress, game: { ...before, bases } },
      `${before.inning}회${before.half} ${base}루 주자 도루 성공`,
      true,
    )
  }

  // 도루 실패 = 주자 한 명 아웃. 타석은 그대로 이어지므로 타순 커서는 되돌린다.
  const bases = base === 1 ? { ...before.bases, first: false } : { ...before.bases, second: false }
  const caught = applyAtBatOutcome(before, { kind: '아웃', detail: '땅볼아웃' }, {
    bases,
    runsScored: 0,
    outsAdded: 1,
  })
  const next: TeamGameProgress = {
    ...progress,
    game: { ...caught, battingOrderIndex: before.battingOrderIndex },
    // 반 이닝이 넘어갔으면 볼카운트도 새로 시작한다
    atBat: caught.half === before.half ? progress.atBat : createAtBat(),
    atBatPrepared: caught.half === before.half ? progress.atBatPrepared : false,
  }
  return advance(
    appendLog(next, `${before.inning}회${before.half} ${base}루 주자 도루 실패 (주루사)`, true),
    random,
  )
}

/**
 * 간이 타석의 투구 한 개마다 수비 팀 투수의 스태미나가 깎이고 투구 수가 는다 (0xa5e14).
 *
 * **근사**: 간이 엔진은 구질을 고르지 않아 `pitchStaminaCostOf` 의 기본 소모(9)를 쓴다.
 * 용량 X 는 그 투수의 체력 능력치(칸 3)와 팀 사기로 구한다 (0x66e44).
 */
function drainQuickPitcher(
  stamina: number,
  staminaAbility: number,
  teamMorale: number,
  isFirstPitcher: boolean,
  pitches: number,
): number {
  const capacity = staminaCapacityOf(staminaAbility, teamMorale, isFirstPitcher)
  const cost = pitchStaminaCostOf({
    pitchTypeNumber: 1,
    batterIntimidates: false,
    pitcherIsCoward: false,
    pitcherEndures: false,
  })
  let next = stamina
  for (let pitch = 0; pitch < pitches; pitch += 1) next = consumeStamina(next, cost, capacity)
  return next
}

/* ── 자동 진행 ───────────────────────────────────────────────────────────────── */

function advance(progress: TeamGameProgress, random: RandomPort): TeamGameProgress {
  let current = progress
  for (let step = 0; step < MAXIMUM_AUTO_STEPS; step += 1) {
    if (current.game.isFinished) return current
    if (isHumanTurn(current)) {
      return current.atBatPrepared ? current : prepareAtBat(current, random)
    }
    current = isOurOffense(current)
      ? playAutoOffenseAtBat(current, random)
      : playAutoDefenseAtBat(current, random)
  }
  throw new Error('팀 경기 자동 진행이 끝나지 않았습니다 — 진행 규칙을 확인하세요')
}

/** 자동으로 넘기는 우리 타석 — 원본도 같은 간이 엔진을 쓴다 (0xc11f0) */
function playAutoOffenseAtBat(progress: TeamGameProgress, random: RandomPort): TeamGameProgress {
  // 0xc262c 는 타석마다 먼저 0xc1ba4 를 부른다 — 우리가 공격 중이면 **상대 투수**를 본다
  progress = judgeAutoPitcherChange(progress, false, random)
  const { options } = progress
  const context = abilityContextOf(options)
  const before = progress.game
  const play = playQuickAtBat(
    quickBatterFor(context, options.ourTeamId, before.battingOrderIndex),
    quickPitcherFor(context, options.opponentTeamId, progress.opponentPitcherIndex),
    { inning: before.inning },
    random,
  )
  const outcome = play.outcome
  // 간이 엔진 타석 — 희생플라이가 없다 (E-2 확정)
  const game = applyAtBatOutcome(
    before,
    outcome,
    advanceRunners(before.bases, outcome, before.outs, { quickEngine: true }),
  )
  const runsBattedIn = game.ourScore - before.ourScore
  const slot = before.battingOrderIndex

  return appendLog(
    {
      ...progress,
      game,
      atBat: createAtBat(),
      atBatPrepared: false,
      // 투구마다 state[0xd] 가 내려간다 (0xa5e72)
      pitcherJustChanged: false,
      opponentStamina: drainQuickPitcher(
        progress.opponentStamina,
        opponentPitcherStaminaAbility(progress),
        100,
        progress.opponentUsedPitchers.length === 0,
        play.pitches,
      ),
      opponentPitcherCounters: addRunsToCounters(
        progress.opponentPitcherCounters,
        runsBattedIn,
        play.pitches,
        game.inning !== before.inning || game.half !== before.half,
      ),
      ourHits: progress.ourHits + (isHit(outcome) ? 1 : 0),
      leaguePlateAppearances: [
        ...progress.leaguePlateAppearances,
        { teamId: options.ourTeamId, battingOrderIndex: slot, outcome, runsBattedIn },
      ],
    },
    `${before.inning}회${before.half} ${(slot % BATTING_ORDER_SIZE) + 1}번 — ${describeOutcome(outcome)}${
      runsBattedIn > 0 ? ` (${runsBattedIn}점)` : ''
    }`,
    false,
  )
}

/** 자동으로 넘기는 상대 타석 */
function playAutoDefenseAtBat(progress: TeamGameProgress, random: RandomPort): TeamGameProgress {
  // 우리가 수비 중인 자동 타석 — 0xc1ba4 가 **우리 투수**를 본다
  progress = judgeAutoPitcherChange(progress, true, random)
  const { options } = progress
  const context = abilityContextOf(options)
  const play = playQuickAtBat(
    quickBatterFor(context, options.opponentTeamId, progress.opponentOrderIndex),
    quickPitcherFor(context, options.ourTeamId, progress.ourPitcherIndex),
    { inning: progress.game.inning },
    random,
  )
  return applyDefensiveAtBat(
    {
      ...progress,
      pitcherJustChanged: false,
      stamina: drainQuickPitcher(
        progress.stamina,
        ourPitcherStats(progress).stamina,
        progress.options.season?.morale ?? 100,
        progress.ourUsedPitchers.length === 0,
        play.pitches,
      ),
    },
    play.outcome,
    false,
  )
}

/** 상대 투수의 체력 능력치 (칸 3) — 스태미나 용량 X 의 바탕 */
function opponentPitcherStaminaAbility(progress: TeamGameProgress): number {
  return pitcherGameAbilities(
    abilityContextOf(progress.options),
    progress.options.opponentTeamId,
    progress.opponentPitcherIndex,
  )[3]
}

/**
 * 실점 카운터 A·B 와 투구 수를 올린다 (P7 E1).
 * A(`+0x284`)는 **이닝 교대(0xa5b00)에서 0** 이 되고, B(`+0x280`)는 투수 교체 때만 0 이 된다.
 */
function addRunsToCounters(
  counters: MoundPitcherCounters,
  runs: number,
  pitches: number,
  halfChanged: boolean,
): MoundPitcherCounters {
  return {
    runsAllowed: Math.min(99, counters.runsAllowed + runs),
    inningRunsAllowed: halfChanged ? 0 : Math.min(99, counters.inningRunsAllowed + runs),
    pitches: counters.pitches + pitches,
  }
}

function appendLog(progress: TeamGameProgress, text: string, isMine: boolean): TeamGameProgress {
  const entry: TeamGameLogEntry = { id: progress.nextLogId, text, isMine }
  return {
    ...progress,
    log: [entry, ...progress.log].slice(0, MAXIMUM_LOG_LENGTH),
    nextLogId: progress.nextLogId + 1,
  }
}

/* ── 경기 뒤 ─────────────────────────────────────────────────────────────────── */

export interface TeamGameSummary {
  readonly result: ReturnType<typeof resultOf>
  readonly won: boolean
  readonly ourScore: number
  readonly opponentScore: number
  readonly ourTeamId: number
  readonly opponentTeamId: number
  /** 치른 이닝 (1-기준) */
  readonly inningsPlayed: number
  readonly pitching: TeamPitchingLine
  /** 리그 선수 기록표에 그대로 넣는다 (`recordLeaguePlateAppearances`) */
  readonly leaguePlateAppearances: readonly LeaguePlateAppearance[]
  /** 시즌 평가 `evaluateSeasonGame` 에 그대로 넘기는 두 칸 (인기도·평판이 서로 다른 이닝 칸을 본다) */
  readonly popularityCompleteGame: CompleteGameKind
  readonly reputationCompleteGame: CompleteGameKind
}

export function summaryOf(progress: TeamGameProgress): TeamGameSummary {
  const game = progress.game
  const flags: CompleteGameFlags = {
    allowedBaserunner: progress.pitching.allowedBaserunner,
    allowedHit: progress.pitching.hitsAllowed > 0,
    allowedRun: progress.pitching.runsAllowed > 0,
  }
  const outs = progress.pitching.outsRecorded
  return {
    result: resultOf(game),
    won: game.ourScore > game.opponentScore,
    ourScore: game.ourScore,
    opponentScore: game.opponentScore,
    ourTeamId: progress.options.ourTeamId,
    opponentTeamId: progress.options.opponentTeamId,
    inningsPlayed: game.inning,
    pitching: progress.pitching,
    leaguePlateAppearances: progress.leaguePlateAppearances,
    // ⚠️ 원본 그대로 — 인기도는 `st+0x6b`(현재 이닝), 평판은 `st+0x69`(정규 마지막 이닝)를 본다.
    //    그래서 **연장 완투는 인기도만 보너스를 받는다** (P4 "원본 버그·이상" 3번)
    popularityCompleteGame: popularityCompleteGameOf(outs, game.inning - 1, flags),
    reputationCompleteGame: reputationCompleteGameOf(outs, REGULATION_LAST_INNING_INDEX, flags),
  }
}
