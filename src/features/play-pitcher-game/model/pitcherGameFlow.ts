import {
  applyAtBatOutcome,
  createGame,
  opponentHalfOf,
  ourHalfOf,
  PLAYER_SIDE_LAST_BAT,
  resultOf,
} from '@/entities/game/model/gameState'
import type { GameState, PlayerSide } from '@/entities/game/model/gameState'
import { applyPitchResolution, createAtBat } from '@/entities/at-bat/model/atBatState'
import type { AtBatState, PitchResolution } from '@/entities/at-bat/model/atBatState'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { describeOutcome, isHit } from '@/entities/at-bat/model/atBatOutcome'
import { simulateQuickAtBat } from '@/entities/game/model/quickAtBat'
import { batterAt, teamBatters, teamPitchers, quickPitcherOf } from '@/entities/team/model/teamRoster'
import { advanceRunners } from '@/entities/game/model/baseState'
import { pitchAgainstBatter } from '@/entities/pitching/model/simulateBatter'
import type { Pitch } from '@/entities/pitching/model/pitch'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import type { PitcherRole } from '@/entities/pitcher-career/model/pitcherRole'
import {
  PITCHER_EDITION_MODE,
  RELIEF_ENTRY_INNING_INDEX,
  ROTATION_SIZE,
  START_ASSIGNMENT,
  isMyStartDay,
  reliefNeverEnteredOf,
  startAssignmentOf,
} from '@/entities/pitcher-career/model/pitcherRotation'
import { EMPTY_MANAGER_HOOK_FLAGS, judgeManagerHook } from '@/entities/pitcher-career/model/managerHook'
import type { ManagerHookFlags } from '@/entities/pitcher-career/model/managerHook'
import {
  EMPTY_PITCHER_GAME_RECORD,
  recordBatterFaced,
  recordEntryLead,
  recordPitchGrade,
  saveSituationOf,
} from '@/entities/pitcher-career/model/pitcherGameRecord'
import type { PitcherGameRecord } from '@/entities/pitcher-career/model/pitcherGameRecord'
import { MAGIC_PITCH_TYPE_NUMBER } from '@/entities/pitcher-career/model/magicPitch'
import { staminaPercentOf } from '@/entities/pitcher-career/model/pitcherStamina'
import { createBurstSession, resolveBurst, tryTriggerBurst } from '@/entities/burst-mission/model/burstMissionSession'
import type { BurstResolution, BurstSession } from '@/entities/burst-mission/model/burstMissionSession'
import { burstResultBitsOf } from '@/entities/burst-mission/model/burstResultBits'
import {
  addInningRuns,
  applyOpponentAtBat,
  clearInningRuns,
  inningRunsOf,
} from '@/features/play-pitcher-game/model/pitcherGameState'
import {
  EMPTY_DECISION_STATE,
  REGULATION_LAST_INNING_INDEX,
  applyPitcherChange,
  applyRunScored,
  decisionCodeForMine,
  gameEndDecisionOf,
} from '@/features/play-pitcher-game/model/winLossSave'
import type { DecisionState, GameEndDecision } from '@/features/play-pitcher-game/model/winLossSave'
import {
  buildHumanPitch,
  drainStamina,
  fatiguedStatsOf,
  pitchGradeOf,
  pitchSlotsOf,
} from '@/features/play-pitcher-game/model/pitcherPitch'
import type { PitchSlot, PitcherRepertoire, PitcherStats } from '@/features/play-pitcher-game/model/pitcherPitch'
import {
  EMPTY_PITCHER_EVALUATION_RECORD,
  evaluatePitcherGame,
} from '@/features/play-pitcher-game/model/pitcherGameEvaluation'
import type {
  PitcherEvaluationRecord,
  PitcherGameEvaluation,
} from '@/features/play-pitcher-game/model/pitcherGameEvaluation'

/**
 * 나만의리그 **투수편**(원본 모드 3) 경기 진행기.
 *
 * 타자편 `features/play-game/model/gameFlow.ts` 와 뼈대는 같지만 **공수가 뒤집혀 있다**:
 * 사람은 수비 반 이닝에 공을 하나씩 던지고, 우리 팀 공격은 동료 아홉 타순을 간이 엔진이 돌린다.
 * 원본도 같다 — "지금 사람 차례인가" 0xc1d38 은 모드 3 에서 **수비측 현재 투수가 내 선수인가**만 본다.
 *
 * 원본 경기 장면 상태와의 대응 (R10 2절·8절, R14 3절):
 * ```
 * 0x9  준비 2        모드 3 이면 감독 강판 플래그 두 개를 0 으로 (S5 U-17)
 * 0xd  타석 시작
 * 0xe  등판·확인     ← 진입에서 **감독 강판 판정 0x504cc**. 참이면 0x23(감독 대사 창)
 * 0xf  구질 고르기   ← 0xe → 0xf 전이에서 **돌발 발동 판정 0x8f158**. 참이면 0x1b(돌발 창)
 * 0x10 코스 고르기   ← 확정(OK)에서 마구 횟수가 줄어든다 (0x50e9c)
 * 0x11 게이지 + 투구
 * 0x12 / 0x13       못 맞힌 공 / 맞은 공 — 타석이 끝나면 **돌발 결과 판정 0x8f414**
 * 0x17 인플레이
 * 0x18 공수 교대 · 경기 끝
 * 0x21 강판 뒤 자동진행 (간이 엔진이 남은 경기를 끝까지)
 * 0x23 감독 대사 창 → 닫으면 0x21
 * ```
 */

/** 자동 진행이 끝나지 않는 상황을 막는 안전장치 (원본에는 없다) */
const MAXIMUM_AUTO_STEPS = 2_000
const MAXIMUM_LOG_LENGTH = 40
const OUTS_PER_INNING = 3
const BATTING_ORDER_SIZE = 9

/**
 * 웹판에는 상대·동료 투수의 등번호가 없다. 승·패·세이브 판정은 "누구인지" 만 가리면 되므로
 * **내 투수만 번호를 갖고** 나머지는 이 두 값으로 구분한다 (0xa5d5e 가 읽는 `레코드 +0` 자리).
 */
export const MY_PITCHER_NUMBER = 0
const TEAMMATE_PITCHER_NUMBER = -1
const OPPONENT_PITCHER_NUMBER = -2

export interface PitcherGameOptions {
  readonly ourTeamId: number
  readonly opponentTeamId: number
  /** 사람이 맡는 측 (0 선공 · 1 후공). 우리 팀이 이 측으로 공격한다 */
  readonly playerSide: PlayerSide
  /** 보직 `rec[+0xb] & 3` */
  readonly role: PitcherRole
  /** 포지션 코드 `rec[+0xa] & 0x1f` — 경기 뒤 평가가 ≤3 이면 선발형으로 가른다 */
  readonly positionCode: number
  /** 리그 날짜 카운터 g (`시즌+0xb2`) */
  readonly dayCounter: number
  readonly isPostseason: boolean
  /** 투수 능력치 0~999 (제구·구속·변화·체력) */
  readonly stats: PitcherStats
  /** 체력 실효 능력치 — 스태미나 용량 X 의 바탕 (`0xb6415(P, 3, 1)`) */
  readonly staminaAbility: number
  /** 경기 시작 때의 스태미나 0~10000 (레코드 +0x2c) */
  readonly stamina: number
  readonly repertoire: PitcherRepertoire
  /** 이 경기에 남은 마구 횟수 (`magicPitchCountOf` 결과) */
  readonly magicCount: number
  /** 팀 사기 (스태미나 용량 보정) */
  readonly teamMorale: number
  /** 평판 `career+0x62` (감독 강판 표·경기 뒤 평가) */
  readonly reputation: number
  /** 환경설정 "투구 게이지" (설정 +0x2d) — **원본 기본값은 꺼짐** (K 5-2) */
  readonly gaugeSettingOn: boolean
  /** 투수 스킬 18 비겁자 (스태미나 두 배 소모) */
  readonly pitcherIsCoward?: boolean
  /** 투수 스킬 10 끈기 (소모 −1) */
  readonly pitcherEndures?: boolean
  /** 라이벌전인가 (경기 뒤 사기 ×2) */
  readonly isRivalGame?: boolean
  /** 행운 스킬 (경기 뒤 사기 +1) */
  readonly hasLuckSkill?: boolean
  /** 화면 배치 side (투영 원점 표 0xcfb18 의 칸) */
  readonly stageSide?: number
}

export interface PitcherGameLogEntry {
  readonly id: number
  readonly text: string
  /** 사람이 던진 타석인지 — 화면에서 강조한다 */
  readonly isMine: boolean
}

export interface PitcherGameProgress {
  readonly options: PitcherGameOptions
  readonly game: GameState
  /** 내 투수가 지금 마운드에 서 있는가 */
  readonly onMound: boolean
  /** 이 경기에 한 번이라도 등판했는가 */
  readonly hasEntered: boolean
  /** 강판 뒤 남은 경기를 간이 엔진이 도는가 (`engine[0] = 1`, 상태 0x21) */
  readonly simpleEngineRunning: boolean
  /** 감독 대사 창(상태 0x23)이 떠 있으면 그 StrUSER_EVT 번호 */
  readonly managerHookText: number | null
  readonly hookFlags: ManagerHookFlags
  readonly stamina: number
  readonly magicRemaining: number
  /** 상대 타순 커서 (0~8) */
  readonly opponentOrderIndex: number
  readonly atBat: AtBatState
  /** 이 타석의 준비(0xe·0xf)를 이미 지났는가 */
  readonly atBatPrepared: boolean
  readonly lastPitch: Pitch | null
  readonly lastResolution: PitchResolution | null
  /** 이닝별 실점 표 (`0xb6988`) — 감독 강판 3번 사유가 읽는다 */
  readonly inningRuns: readonly number[]
  readonly decision: DecisionState
  /** 평가 객체 R 의 투수 칸 (entities/pitcher-career) */
  readonly pitcherRecord: PitcherGameRecord
  /** 경기 뒤 평가가 읽는 칸 (내가 던진 것만 쌓인다) */
  readonly record: PitcherEvaluationRecord
  /** 투구 수 (레코드 +0x28 · R+0x140) */
  readonly pitchCount: number
  /** 내가 마운드에 있는 동안 내준 실점 — 방어율(레코드 +0x22)에 해당한다 */
  readonly runsAllowedByMe: number
  /** state+0x88 볼넷 · +0x89 피안타 · +0x8a 실점 — 우리 팀 투수 **전체**가 내준 것 */
  readonly teamWalksAllowed: number
  readonly teamHitsAllowed: number
  readonly teamRunsAllowed: number
  /** 이 이닝에 아직 아무도 안 내보냈는가 — R+0x184(삼자범퇴 표시) 자리 */
  readonly perfectInningFlag: boolean
  /** 상대 타순 칸별 이번 경기 안타·홈런 — 돌발 b6/b7 조건이 읽는 기록 +0x12·+0x13 */
  readonly opponentBatterLogs: Readonly<Record<number, { hits: number; homeRuns: number }>>
  readonly burst: BurstSession | null
  readonly lastBurstResolution: BurstResolution | null
  readonly log: readonly PitcherGameLogEntry[]
  readonly nextLogId: number
  /** 경기가 끝난(또는 지금 치르는) 이닝 인덱스 (0-기준) */
  readonly endedInningIndex: number
}

/* ── 로테이션 ─────────────────────────────────────────────────────────────────── */

/** 오늘 내 투수가 선발인가 — 보직 선발이고 날짜 카운터가 짝수인 날 (0xa4f60 표, P1 1-2) */
export function startsToday(options: PitcherGameOptions): boolean {
  if (options.role !== PITCHER_ROLE.starter) return false
  const assignment = startAssignmentOf({
    mode: PITCHER_EDITION_MODE,
    dayCounter: options.dayCounter,
    role: options.role,
    isPostseason: options.isPostseason,
  })
  // keep(−2) = 시즌 첫 경기·포스트시즌이라 맞바꿈이 없다 → 로스터 0번이 곧 내 투수다
  if (assignment === START_ASSIGNMENT.keep) return true
  return isMyStartDay(options.dayCounter)
}

/**
 * 내가 안 던지는 동안 우리 팀 마운드에 서는 투수의 로스터 칸.
 * 맞바꿈 칸 k 가 있으면 그 칸이고(0xa4f60), 없으면 날짜만큼 돈 4인 로테이션의 0번이다 (0xb5ca8).
 */
function ourOtherPitcherIndex(options: PitcherGameOptions): number {
  const assignment = startAssignmentOf({
    mode: PITCHER_EDITION_MODE,
    dayCounter: options.dayCounter,
    role: options.role,
    isPostseason: options.isPostseason,
  })
  if (assignment >= 1) return assignment
  return ((options.dayCounter % ROTATION_SIZE) + ROTATION_SIZE) % ROTATION_SIZE
}

/** 상대 팀 선발 — 하루 한 칸씩 도는 4인 로테이션의 0번 (0xb8c80 → 0xb5ca8, S5 U-16) */
function opponentPitcherIndex(options: PitcherGameOptions): number {
  return ((options.dayCounter % ROTATION_SIZE) + ROTATION_SIZE) % ROTATION_SIZE
}

function quickPitcherAt(teamId: number, index: number) {
  const roster = teamPitchers(teamId)
  return quickPitcherOf(roster[index % roster.length])
}

/** 상대 타순 칸의 타자 능력치 (히트·파워·수비·주루 — 레코드 순서 그대로) */
function opponentBatterAbility(teamId: number, orderIndex: number) {
  const roster = teamBatters(teamId)
  const player = roster[orderIndex % roster.length]
  return {
    hit: player.ability[0],
    power: player.ability[1],
    defense: player.ability[2],
    run: player.ability[3],
  }
}

/* ── 시작 ────────────────────────────────────────────────────────────────────── */

export function startPitcherGame(
  options: PitcherGameOptions,
  random: RandomPort,
): PitcherGameProgress {
  const onMound = startsToday(options)
  const initial: PitcherGameProgress = {
    options,
    // 투수편 주인공은 타석에 서지 않는다 — 타순 칸을 절대 맞히지 못하는 값으로 둔다
    game: createGame(-1, options.playerSide),
    onMound,
    hasEntered: onMound,
    simpleEngineRunning: false,
    managerHookText: null,
    // 상태 9 가 모드 3 일 때 경기마다 두 플래그를 0 으로 되돌린다 (S5 U-17 확정)
    hookFlags: EMPTY_MANAGER_HOOK_FLAGS,
    stamina: options.stamina,
    magicRemaining: options.magicCount,
    opponentOrderIndex: 0,
    atBat: createAtBat(),
    atBatPrepared: false,
    lastPitch: null,
    lastResolution: null,
    inningRuns: [],
    decision: EMPTY_DECISION_STATE,
    pitcherRecord: EMPTY_PITCHER_GAME_RECORD,
    record: EMPTY_PITCHER_EVALUATION_RECORD,
    pitchCount: 0,
    runsAllowedByMe: 0,
    teamWalksAllowed: 0,
    teamHitsAllowed: 0,
    teamRunsAllowed: 0,
    perfectInningFlag: true,
    opponentBatterLogs: {},
    // 경기 장면은 모드 2·3·4 일 때만 돌발 객체를 만든다 (0x48658)
    burst: createBurstSession(PITCHER_EDITION_MODE),
    lastBurstResolution: null,
    log: [],
    nextLogId: 1,
    endedInningIndex: 0,
  }
  return advance(initial, random)
}

/** 지금 사람이 공을 던질 차례인가 (0xc1d38) */
export function isPitchTurn(progress: PitcherGameProgress): boolean {
  return (
    !progress.game.isFinished &&
    progress.onMound &&
    progress.managerHookText === null &&
    progress.game.half === opponentHalfOf(progress.game)
  )
}

/** 고를 수 있는 구질 칸 여섯 (0xb6d2c) */
export function pitchSlotsFor(progress: PitcherGameProgress): readonly PitchSlot[] {
  return pitchSlotsOf(progress.options.repertoire)
}

/* ── 투구 ────────────────────────────────────────────────────────────────────── */

export interface PitchInput {
  /** 원본 구질 번호 1~21, 마구는 22 */
  readonly typeNumber: number
  /** 코스 칸 0~8 */
  readonly courseCell: number
  /** 게이지에서 누른 칸 0~9. 안 눌렀으면 0 */
  readonly gaugeCell: number
}

/**
 * 공 하나를 던진다 (상태 0x10 확정 → 0x11 → 0x12/0x13).
 * 타석이 끝나면 그 자리에서 돌발을 판정하고(0x4e7ca·0x52a8e) 다음 사람 차례까지 민다.
 */
export function throwPitch(
  progress: PitcherGameProgress,
  input: PitchInput,
  random: RandomPort,
): PitcherGameProgress {
  if (!isPitchTurn(progress)) return progress
  const { options } = progress
  const isMagic = input.typeNumber === MAGIC_PITCH_TYPE_NUMBER
  if (isMagic && progress.magicRemaining <= 0) return progress

  const staminaPercent = staminaPercentOf(progress.stamina)
  const fatigued = fatiguedStatsOf(options.stats, progress.stamina)
  const grade = pitchGradeOf(
    {
      gaugeSettingOn: options.gaugeSettingOn,
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
      repertoire: options.repertoire,
      side: options.stageSide ?? 1,
    },
    random,
  )

  const batter = opponentBatterAbility(options.opponentTeamId, progress.opponentOrderIndex)
  const resolution = pitchAgainstBatter(pitch, batter, random, {
    control: fatigued.control,
    velocity: fatigued.velocity,
  })

  // 스태미나는 게이지 결과와 무관하다 — 인자가 (game, 구질) 뿐이다 (P1 3-1 확정)
  const stamina = drainStamina({
    stamina: progress.stamina,
    typeNumber: input.typeNumber,
    staminaAbility: options.staminaAbility,
    teamMorale: options.teamMorale,
    // 선발로 나왔으면 아직 교체가 없는 "첫 투수" 다. 구원으로 올라오면 +200 이 없다
    isFirstPitcher: startsToday(options),
    // 상대 타자의 스킬 22(0xb62b4)를 웹 로스터가 들고 있지 않아 늘 거짓이다 — 채우려면 타자 스킬 표가 필요하다
    batterIntimidates: false,
    pitcherIsCoward: options.pitcherIsCoward === true,
    pitcherEndures: options.pitcherEndures === true,
  })

  const afterPitch: PitcherGameProgress = {
    ...progress,
    stamina,
    // ⚠️ 마구 횟수는 **코스 확정(OK)** 때 줄어든다 — 구질을 고른 순간이 아니다 (0x50e9c)
    magicRemaining: isMagic ? progress.magicRemaining - 1 : progress.magicRemaining,
    pitchCount: progress.pitchCount + 1,
    // R+0x158 — t == 5 로 던진 공. 마구는 늘 5 라 함께 센다
    pitcherRecord: recordPitchGrade(progress.pitcherRecord, grade),
    lastPitch: pitch,
    lastResolution: resolution,
    atBat: applyPitchResolution(progress.atBat, resolution),
  }

  const outcome = afterPitch.atBat.outcome
  if (outcome === null) return afterPitch
  return advance(applyDefensivePlay(afterPitch, outcome, true), random)
}

/* ── 수비 타석 하나 ───────────────────────────────────────────────────────────── */

/**
 * 상대 타석 하나를 경기에 반영한다.
 * `mine` 이 참이면 내가 던진 타석이라 투수 기록·돌발 판정까지 함께 한다.
 */
function applyDefensivePlay(
  progress: PitcherGameProgress,
  outcome: AtBatOutcome,
  mine: boolean,
): PitcherGameProgress {
  const before = progress.game
  const advanceResult = advanceRunners(before.bases, outcome, before.outs)
  const applied = applyOpponentAtBat(before, progress.opponentOrderIndex, outcome, advanceResult)
  const slot = progress.opponentOrderIndex
  const previousLog = progress.opponentBatterLogs[slot] ?? { hits: 0, homeRuns: 0 }
  const hit = isHit(outcome)
  const walk = outcome.kind === '볼넷'
  const inningEnded = before.outs + applied.outsAdded >= OUTS_PER_INNING

  let decision = progress.decision
  for (let run = 1; run <= applied.runsScored; run += 1) {
    decision = applyRunScoredFor(progress, decision, run, mine)
  }

  // R+0x184 — 안타·볼넷·사구가 나면 이 이닝은 더 이상 삼자범퇴가 아니다 (0xa80b4·0xa8e12)
  const perfectInningFlag = progress.perfectInningFlag && !hit && !walk && applied.runsScored === 0

  const record: PitcherEvaluationRecord = mine
    ? {
        ...progress.record,
        hitsAllowed: progress.record.hitsAllowed + (hit ? 1 : 0),
        strikeouts: progress.record.strikeouts + (outcome.kind === '삼진' ? 1 : 0),
        outsRecorded: progress.record.outsRecorded + applied.outsAdded,
        walksAllowed: progress.record.walksAllowed + (walk ? 1 : 0),
        // 연속 탈삼진 — 삼진이 아닌 타석이 끼면 끊긴다 (R+0x14c, 0xa619e)
        strikeoutCombo: outcome.kind === '삼진' ? progress.record.strikeoutCombo + 1 : 0,
        // R+0x154 — 삼자범퇴 이닝 (S5 정정 4: "무안타" 가 아니라 아무도 안 내보낸 이닝이다)
        perfectInnings: progress.record.perfectInnings + (inningEnded && perfectInningFlag ? 1 : 0),
      }
    : progress.record

  const next: PitcherGameProgress = {
    ...progress,
    game: applied.game,
    opponentOrderIndex: applied.opponentOrderIndex,
    decision,
    inningRuns: addInningRuns(progress.inningRuns, before.inning, applied.runsScored),
    record,
    pitcherRecord: mine ? recordBatterFaced(progress.pitcherRecord, 0) : progress.pitcherRecord,
    runsAllowedByMe: progress.runsAllowedByMe + (mine ? applied.runsScored : 0),
    teamHitsAllowed: progress.teamHitsAllowed + (hit ? 1 : 0),
    teamWalksAllowed: progress.teamWalksAllowed + (walk ? 1 : 0),
    teamRunsAllowed: progress.teamRunsAllowed + applied.runsScored,
    perfectInningFlag,
    opponentBatterLogs: {
      ...progress.opponentBatterLogs,
      [slot]: {
        hits: previousLog.hits + (hit ? 1 : 0),
        homeRuns: previousLog.homeRuns + (outcome.kind === '홈런' ? 1 : 0),
      },
    },
    atBat: createAtBat(),
    atBatPrepared: false,
    endedInningIndex: applied.game.inning - 1,
  }

  const resolved = mine
    ? resolveBurstFor(next, outcome, applied.runsScored, before.outs, applied.outsAdded, inningEnded)
    : next
  const halfChanged = applied.game.half !== before.half || applied.game.inning !== before.inning
  const closed: PitcherGameProgress = halfChanged
    ? {
        ...resolved,
        // 이닝 칸을 비우고 삼자범퇴 표시를 다시 세운다
        inningRuns: clearInningRuns(resolved.inningRuns, applied.game.inning),
        perfectInningFlag: true,
      }
    : resolved

  return appendLog(
    closed,
    `${before.inning}회${before.half} 상대 ${slot + 1}번 — ${describeOutcome(outcome)}${
      applied.runsScored > 0 ? ` (${applied.runsScored}실점)` : ''
    }`,
    mine,
  )
}

/** 한 점이 들어올 때마다 승·패·세이브 칸을 다시 잡는다 (0xa5c34) */
function applyRunScoredFor(
  progress: PitcherGameProgress,
  decision: DecisionState,
  runIndex: number,
  mine: boolean,
): DecisionState {
  const game = progress.game
  const ourSide = game.playerSide
  const opponentSide = 1 - ourSide
  const opponentScore = game.opponentScore + runIndex
  return applyRunScored(decision, {
    inningIndex: game.inning - 1,
    lastInningIndex: REGULATION_LAST_INNING_INDEX,
    offenseSide: opponentSide,
    defenseSide: ourSide,
    scoreOf: (side) => (side === ourSide ? game.ourScore : opponentScore),
    moundPitcherOf: (side) =>
      side === ourSide
        ? mine
          ? MY_PITCHER_NUMBER
          : TEAMMATE_PITCHER_NUMBER
        : OPPONENT_PITCHER_NUMBER,
  })
}

/** 우리 팀 공격에서 점수가 날 때도 같은 함수가 돈다 (공격·수비가 뒤바뀐 인자) */
function applyRunScoredForOffense(
  progress: PitcherGameProgress,
  decision: DecisionState,
  runIndex: number,
): DecisionState {
  const game = progress.game
  const ourSide = game.playerSide
  const opponentSide = 1 - ourSide
  const ourScore = game.ourScore + runIndex
  return applyRunScored(decision, {
    inningIndex: game.inning - 1,
    lastInningIndex: REGULATION_LAST_INNING_INDEX,
    offenseSide: ourSide,
    defenseSide: opponentSide,
    scoreOf: (side) => (side === ourSide ? ourScore : game.opponentScore),
    moundPitcherOf: (side) =>
      side === ourSide ? TEAMMATE_PITCHER_NUMBER : OPPONENT_PITCHER_NUMBER,
  })
}

/** 타석이 끝나는 자리에서 돌발을 판정한다 (0x8f414) */
function resolveBurstFor(
  progress: PitcherGameProgress,
  outcome: AtBatOutcome,
  runsScored: number,
  outsBefore: number,
  outsAdded: number,
  inningEnded: boolean,
): PitcherGameProgress {
  if (progress.burst === null) return progress
  const resolution = resolveBurst(
    progress.burst,
    burstResultBitsOf({
      outcome,
      runsBattedIn: runsScored,
      outsBefore,
      outsAdded,
      inningEnded,
      // ⚠️ 0xa89f0 — 사람 팀 승리로 경기가 끝나면 홈런·볼넷 비트를 함께 켠다 (P7 K1)
      humanTeamWalkOff:
        progress.game.isFinished && progress.game.ourScore > progress.game.opponentScore,
    }),
  )
  return {
    ...progress,
    burst: resolution.session,
    lastBurstResolution: resolution.judgement !== null ? resolution : null,
  }
}

/* ── 타석 준비 ───────────────────────────────────────────────────────────────── */

/**
 * 타석 준비 — 상태 0xe 진입의 **감독 강판 판정**과 0xe → 0xf 전이의 **돌발 발동 판정**.
 * 순서도 원본 그대로다: 강판이 먼저고, 강판되면 0x23 으로 빠져 0xf(돌발)에 가지 않는다.
 */
function prepareAtBat(progress: PitcherGameProgress, random: RandomPort): PitcherGameProgress {
  const { options } = progress
  const bases = progress.game.bases
  const hook = judgeManagerHook(
    {
      mode: PITCHER_EDITION_MODE,
      role: options.role,
      staminaPercent: staminaPercentOf(progress.stamina),
      reputation: options.reputation,
      runsAllowedThisInning: inningRunsOf(progress.inningRuns, progress.game.inning),
      basesLoaded: bases.first && bases.second && bases.third,
    },
    progress.hookFlags,
    random,
  )
  if (hook.hooked) {
    return {
      ...progress,
      hookFlags: hook.flags,
      managerHookText: hook.userEventIndex,
      atBatPrepared: true,
    }
  }

  const session = progress.burst
  if (session === null) return { ...progress, hookFlags: hook.flags, atBatPrepared: true }
  const log = progress.opponentBatterLogs[progress.opponentOrderIndex] ?? { hits: 0, homeRuns: 0 }
  const next = tryTriggerBurst(
    session,
    {
      // 투수편에서 사람 팀은 늘 수비다 — 그래서 XlsPITCHER_BURST 44행의 목표가 전부 아웃 계열이다
      isHumanTeamBatting: false,
      bases,
      outs: progress.game.outs,
      // 원본 이닝은 0-기준이다 (game+0x6b)
      inning: progress.game.inning - 1,
      ourScore: progress.game.ourScore,
      opponentScore: progress.game.opponentScore,
      opponentBattingSlot: progress.opponentOrderIndex,
      // 정규 경기에 마선수가 무작위로 나오는 코드는 원본에 없다 — 이벤트 match 명령으로만 (타자편과 같다)
      opponentAceBatterId: null,
      opponentAcePitcherId: null,
      hitsInGame: log.hits,
      homeRunsInGame: log.homeRuns,
      strikeoutsInGame: progress.record.strikeouts,
    },
    random,
  )
  return { ...progress, hookFlags: hook.flags, burst: next, atBatPrepared: true }
}

/* ── 강판 ────────────────────────────────────────────────────────────────────── */

/** 스스로 강판 — `#` → StrGAME[104] "그만 던지시겠습니까?" 에 "예" (0x498d4 → 0xc1b48, 상태 0x21) */
export function giveUpPitching(
  progress: PitcherGameProgress,
  random: RandomPort,
): PitcherGameProgress {
  if (!progress.onMound || progress.game.isFinished) return progress
  return advance(
    appendLog(
      {
        ...progress,
        onMound: false,
        simpleEngineRunning: true,
        atBatPrepared: false,
        atBat: createAtBat(),
      },
      '스스로 강판 — 남은 경기는 자동으로 진행한다',
      true,
    ),
    random,
  )
}

/**
 * 감독 대사 창(0x23)을 닫는다 — 원본도 확인 키 하나뿐이라 강판을 무를 수 없다 (0x50794).
 * 닫으면 간이 엔진을 켜고 상태 0x21 로 간다.
 */
export function closeManagerHookWindow(
  progress: PitcherGameProgress,
  random: RandomPort,
): PitcherGameProgress {
  if (progress.managerHookText === null) return progress
  return advance(
    appendLog(
      {
        ...progress,
        managerHookText: null,
        onMound: false,
        simpleEngineRunning: true,
        atBatPrepared: false,
        atBat: createAtBat(),
      },
      '감독 강판 — 남은 경기는 자동으로 진행한다',
      true,
    ),
    random,
  )
}

/** 돌발 결과 창을 닫는다 (보상은 앱이 커리어에 얹는다 — `burstRewardDeltasOf` 가 판정에 들어 있다) */
export function closeBurstWindow(progress: PitcherGameProgress): PitcherGameProgress {
  return progress.lastBurstResolution === null ? progress : { ...progress, lastBurstResolution: null }
}

/* ── 자동 진행 ───────────────────────────────────────────────────────────────── */

function advance(progress: PitcherGameProgress, random: RandomPort): PitcherGameProgress {
  let current = progress
  for (let step = 0; step < MAXIMUM_AUTO_STEPS; step += 1) {
    if (current.game.isFinished) return current
    if (current.managerHookText !== null) return current

    if (current.game.half === ourHalfOf(current.game)) {
      current = playTeammateAtBat(current, random)
      continue
    }

    // 구원 등판 — 8회(0-기준 7) 우리 팀 수비 첫 타석에 벤치의 내 투수로 교체한다 (0xc1ba4)
    if (!current.onMound && !current.simpleEngineRunning && shouldEnterNow(current)) {
      current = enterAsRelief(current)
    }

    if (current.onMound) {
      if (!current.atBatPrepared) current = prepareAtBat(current, random)
      return current
    }
    current = playDefensiveAtBat(current, random)
  }
  throw new Error('투수편 경기 자동 진행이 끝나지 않았습니다 — 진행 규칙을 확인하세요')
}

function shouldEnterNow(progress: PitcherGameProgress): boolean {
  return (
    progress.options.role === PITCHER_ROLE.relief &&
    !progress.hasEntered &&
    progress.game.inning - 1 === RELIEF_ENTRY_INNING_INDEX &&
    progress.game.outs === 0
  )
}

/** 구원 등판 — 올라오는 그 순간 세이브 후보와 R+0x150 을 잡는다 (0xa60c0 · 0xa6194) */
function enterAsRelief(progress: PitcherGameProgress): PitcherGameProgress {
  const game = progress.game
  const ourSide = game.playerSide
  const opponentSide = 1 - ourSide
  const runnerCount =
    Number(game.bases.first) + Number(game.bases.second) + Number(game.bases.third)
  const situation = saveSituationOf({
    lastInningIndex: REGULATION_LAST_INNING_INDEX,
    currentInningIndex: game.inning - 1,
    outs: game.outs,
    defenseScore: game.ourScore,
    offenseScore: game.opponentScore,
    runnerCount,
  })
  const decision = applyPitcherChange(progress.decision, {
    lastInningIndex: REGULATION_LAST_INNING_INDEX,
    inningIndex: game.inning - 1,
    outs: game.outs,
    defenseSide: ourSide,
    offenseSide: opponentSide,
    scoreOf: (side) => (side === ourSide ? game.ourScore : game.opponentScore),
    moundPitcherOf: () => MY_PITCHER_NUMBER,
    runnerCount,
  })
  return appendLog(
    {
      ...progress,
      onMound: true,
      hasEntered: true,
      decision,
      pitcherRecord: recordEntryLead(progress.pitcherRecord, situation),
      record: { ...progress.record, leadingAtEntry: situation.leading },
      atBatPrepared: false,
      atBat: createAtBat(),
    },
    `${game.inning}회 구원 등판`,
    true,
  )
}

/**
 * 내가 마운드에 없는 수비 타석은 간이 엔진이 돈다 (0xc262c → 0xc11f0).
 * 원본도 타석 하나씩 돌리므로 반 이닝을 뭉뚱그리지 않는다.
 */
function playDefensiveAtBat(
  progress: PitcherGameProgress,
  random: RandomPort,
): PitcherGameProgress {
  const { options } = progress
  const outcome = simulateQuickAtBat(
    batterAt(options.opponentTeamId, progress.opponentOrderIndex),
    quickPitcherAt(options.ourTeamId, ourOtherPitcherIndex(options)),
    { inning: progress.game.inning },
    random,
  )
  return applyDefensivePlay(progress, outcome, false)
}

/** 동료 타석 — 투수편 주인공은 타석에 서지 않으므로 아홉 칸 모두 간이 엔진이 돈다 */
function playTeammateAtBat(
  progress: PitcherGameProgress,
  random: RandomPort,
): PitcherGameProgress {
  const { options } = progress
  const before = progress.game
  const outcome = simulateQuickAtBat(
    batterAt(options.ourTeamId, before.battingOrderIndex),
    quickPitcherAt(options.opponentTeamId, opponentPitcherIndex(options)),
    { inning: before.inning },
    random,
  )
  const game = applyAtBatOutcome(before, outcome)
  const runs = game.ourScore - before.ourScore
  let decision = progress.decision
  for (let run = 1; run <= runs; run += 1) {
    decision = applyRunScoredForOffense(progress, decision, run)
  }
  const slot = before.battingOrderIndex
  const halfChanged = game.half !== before.half || game.inning !== before.inning
  return appendLog(
    {
      ...progress,
      game,
      decision,
      endedInningIndex: game.inning - 1,
      perfectInningFlag: halfChanged ? true : progress.perfectInningFlag,
      inningRuns: halfChanged ? clearInningRuns(progress.inningRuns, game.inning) : progress.inningRuns,
    },
    `${before.inning}회${before.half} ${(slot % BATTING_ORDER_SIZE) + 1}번 — ${describeOutcome(outcome)}${
      runs > 0 ? ` (${runs}점)` : ''
    }`,
    false,
  )
}

function appendLog(
  progress: PitcherGameProgress,
  text: string,
  isMine: boolean,
): PitcherGameProgress {
  const entry: PitcherGameLogEntry = { id: progress.nextLogId, text, isMine }
  return {
    ...progress,
    log: [entry, ...progress.log].slice(0, MAXIMUM_LOG_LENGTH),
    nextLogId: progress.nextLogId + 1,
  }
}

/* ── 경기 뒤 ─────────────────────────────────────────────────────────────────── */

export interface PitcherGameSummary {
  readonly result: ReturnType<typeof resultOf>
  readonly ourScore: number
  readonly opponentScore: number
  readonly record: PitcherEvaluationRecord
  readonly pitcherRecord: PitcherGameRecord
  readonly pitchCount: number
  readonly evaluation: PitcherGameEvaluation
  /** 승·패·세이브 투수. ⚠️ 세이브는 원본 버그(state+0x64 를 지우지 않음)로 거의 늘 없다 */
  readonly decision: GameEndDecision
  /** 내 투수가 무엇으로 적히는가 — R+0x124 (1 승 · 2 패 · 3 세이브 · 0 없음) */
  readonly decisionCode: number
  /** 방어율 × 100 (0xb6ce8) */
  readonly earnedRunAverage: number
  /** 시즌 레코드에 더할 값 — +0x20 아웃 · +0x22 실점 · +0x26 탈삼진 · +0x28 투구 수 · +0x2e 승 · +0x2f 패 · +0x24 세이브 */
  readonly seasonDelta: {
    readonly outs: number
    readonly runsAllowed: number
    readonly strikeouts: number
    readonly pitches: number
    readonly wins: number
    readonly losses: number
    readonly saves: number
  }
  /** 경기 뒤 남은 스태미나 (레코드 +0x2c). 경기 사이 회복은 `recoverStaminaAfterGameDay` 가 한다 */
  readonly stamina: number
}

/** 방어율 `0xb6ce8` = 아웃>0 ? min(9999, trunc(실점 × 2700 / 아웃)) : (실점>0 ? 9999 : 0) */
export function earnedRunAverageOf(runsAllowed: number, outsRecorded: number): number {
  if (outsRecorded > 0) return Math.min(9999, Math.trunc((runsAllowed * 2700) / outsRecorded))
  return runsAllowed > 0 ? 9999 : 0
}

export function summaryOf(progress: PitcherGameProgress): PitcherGameSummary {
  const { options } = progress
  const decision = gameEndDecisionOf(progress.decision)
  const decisionCode = decisionCodeForMine(decision, {
    side: progress.game.playerSide,
    number: MY_PITCHER_NUMBER,
  })
  const record: PitcherEvaluationRecord = {
    ...progress.record,
    hitByPitch: progress.pitcherRecord.hitByPitch,
    decisionCode,
  }
  const evaluation = evaluatePitcherGame(record, {
    positionCode: options.positionCode,
    role: options.role,
    won: progress.game.ourScore > progress.game.opponentScore,
    endedInningIndex: progress.endedInningIndex,
    teamWalksAllowed: progress.teamWalksAllowed,
    teamHitsAllowed: progress.teamHitsAllowed,
    teamRunsAllowed: progress.teamRunsAllowed,
    // ⚠️ **원본 빈틈 그대로** — 원본은 `state[0x6a] == state[0x6b]` 한 줄뿐이라 **7회 콜드게임만**
    // "등판 없음" 으로 잡는다. 8회에 콜드게임이 나서 정말로 등판을 못 했어도 이 조건이 서지 않아
    // 구원형 인기도 −2·평판 −2 와 보통 감독 글이 그대로 걸린다 (S5 U-14 4절).
    // 실제로 등판했는지(`hasEntered`)를 함께 보면 그 빈틈이 메워지므로 **일부러 보지 않는다.**
    neverEntered: reliefNeverEnteredOf(progress.endedInningIndex),
    reputation: options.reputation,
    isRivalGame: options.isRivalGame,
    hasLuckSkill: options.hasLuckSkill,
  })
  return {
    result: resultOf(progress.game),
    ourScore: progress.game.ourScore,
    opponentScore: progress.game.opponentScore,
    record,
    pitcherRecord: progress.pitcherRecord,
    pitchCount: progress.pitchCount,
    evaluation,
    decision,
    decisionCode,
    earnedRunAverage: earnedRunAverageOf(progress.runsAllowedByMe, record.outsRecorded),
    seasonDelta: {
      outs: record.outsRecorded,
      runsAllowed: progress.runsAllowedByMe,
      strikeouts: record.strikeouts,
      pitches: progress.pitchCount,
      wins: decisionCode === 1 ? 1 : 0,
      losses: decisionCode === 2 ? 1 : 0,
      saves: decisionCode === 3 ? 1 : 0,
    },
    stamina: progress.stamina,
  }
}

/** 기본 측 — 나만의리그 화면은 지금까지 늘 후공으로 돌려 왔다 (타자편과 같은 기본값) */
export const DEFAULT_PLAYER_SIDE: PlayerSide = PLAYER_SIDE_LAST_BAT
