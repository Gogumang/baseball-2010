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
import { simulateQuickAtBat } from '@/entities/game/model/quickAtBat'
import { rollStartingPitcherIndex } from '@/entities/team/model/teamRoster'
import { applyOpponentAtBat } from '@/features/play-pitcher-game/model/pitcherGameState'
import { battedBallTrajectory } from '@/entities/batting/model/battedBallFlight'
import { isBattedBallInPlay, runDefensePlay } from '@/features/defense-play/model/runDefensePlay'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
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
import { FULL_STAMINA, staminaPercentOf } from '@/entities/pitcher-career/model/pitcherStamina'
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
 *   - 경기 중 사람 교체 `#`(대타·투수 교체, R4 1a~1c) — 그래서 선발이 9이닝을 던진다
 *   - 엔트리 편집(0x55864) — 타순은 로스터 순서 그대로다
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
  /** 양 팀 선발 투수의 로스터 칸 — 경기를 세울 때 한 번만 뽑는다 (0x3107a·0x31090) */
  readonly ourStartingPitcherIndex: number
  readonly opponentStartingPitcherIndex: number
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
    opponentStartingPitcherIndex: rollStartingPitcherIndex(random),
    ourStartingPitcherIndex: rollStartingPitcherIndex(random),
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
    progress.opponentStartingPitcherIndex,
  )
}

/** 우리 선발 투수의 경기용 능력치 (제구·구속·변화·체력) */
export function ourPitcherStats(progress: TeamGameProgress): PitcherStats {
  const ability = pitcherGameAbilities(
    abilityContextOf(progress.options),
    progress.options.ourTeamId,
    progress.ourStartingPitcherIndex,
  )
  return { control: ability[0], velocity: ability[1], breaking: ability[2], stamina: ability[3] }
}

/** 고를 수 있는 구질 칸 여섯 (0xb6d2c) */
export function pitchSlotsFor(progress: TeamGameProgress): readonly PitchSlot[] {
  const repertoire = rosterRepertoireOf(progress.options.ourTeamId, progress.ourStartingPitcherIndex)
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
    lastDefensePlay: defensePlay,
    atBat: createAtBat(),
    atBatPrepared: false,
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
  const repertoire = rosterRepertoireOf(options.ourTeamId, progress.ourStartingPitcherIndex)
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
  const applied = applyOpponentAtBat(
    before,
    progress.opponentOrderIndex,
    outcome,
    defensePlay?.advance,
  )
  const slot = progress.opponentOrderIndex
  const hit = isHit(outcome)
  const walk = outcome.kind === '볼넷'
  const inningEnded = before.outs + applied.outsAdded >= OUTS_PER_INNING

  const next: TeamGameProgress = {
    ...progress,
    game: applied.game,
    opponentOrderIndex: applied.opponentOrderIndex,
    lastDefensePlay: defensePlay ?? progress.lastDefensePlay,
    atBat: createAtBat(),
    atBatPrepared: false,
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
  const { options } = progress
  const context = abilityContextOf(options)
  const before = progress.game
  const outcome = simulateQuickAtBat(
    quickBatterFor(context, options.ourTeamId, before.battingOrderIndex),
    quickPitcherFor(context, options.opponentTeamId, progress.opponentStartingPitcherIndex),
    { inning: before.inning },
    random,
  )
  const game = applyAtBatOutcome(before, outcome)
  const runsBattedIn = game.ourScore - before.ourScore
  const slot = before.battingOrderIndex

  return appendLog(
    {
      ...progress,
      game,
      atBat: createAtBat(),
      atBatPrepared: false,
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
  const { options } = progress
  const context = abilityContextOf(options)
  const outcome = simulateQuickAtBat(
    quickBatterFor(context, options.opponentTeamId, progress.opponentOrderIndex),
    quickPitcherFor(context, options.ourTeamId, progress.ourStartingPitcherIndex),
    { inning: progress.game.inning },
    random,
  )
  return applyDefensiveAtBat(progress, outcome, false)
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
