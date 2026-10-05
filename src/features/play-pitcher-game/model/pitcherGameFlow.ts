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
import { describeOutcome, isFreePass, isHit } from '@/entities/at-bat/model/atBatOutcome'
import { playQuickAtBat } from '@/entities/game/model/quickAtBat'
import { batterAt, teamBatters, teamPitchers, quickPitcherOf } from '@/entities/team/model/teamRoster'
import { advanceRunners, runnerCountOf } from '@/entities/game/model/baseState'
import type { BaseState } from '@/entities/game/model/baseState'
import {
  completeGameRecordIdsOf,
  gameEndRecordIdsOf,
  strikeoutRecordIdsOf,
  threePitchInningRecordIdsOf,
} from '@/entities/game/model/gameRecords'
import { EMPTY_BATTER_GAME_LOG, recordBatterAtBat } from '@/entities/game/model/batterGameLog'
import type { BatterGameLog } from '@/entities/game/model/batterGameLog'
import { battedBallTrajectory } from '@/entities/batting/model/battedBallFlight'
import { defenseAbilitiesOf, isBattedBallInPlay, runDefensePlay } from '@/features/defense-play/model/runDefensePlay'
import type { DefensePlayInput, DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import { homeRunPlaybackOf } from '@/features/defense-play/model/homeRunPlayback'
import { PICKOFF_RESULT, runPickoffPlay } from '@/features/defense-play/model/pickoffPlay'
import { chargedRunsOfFates, runnerFatesWithoutPlay } from '@/features/defense-play/model/runnerFates'
import { pickoffPlayForKey, PICKOFF_PLAY_KIND } from '@/entities/defense-controls/model/pickoff'
import { representativePatternOf } from '@/features/defense-play/model/representativePattern'
import { pitchAgainstBatter } from '@/entities/pitching/model/simulateBatter'
import { BATTER_SLOT, gameAbilityOf } from '@/features/play-team-game/model/gameAbilities'
import { isMistakePitch } from '@/entities/pitching/model/mistakePitch'
import type { Pitch } from '@/entities/pitching/model/pitch'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import type { PitcherRole } from '@/entities/pitcher-career/model/pitcherRole'
import {
  PITCHER_EDITION_MODE,
  RELIEF_ENTRY_INNING_INDEX,
  START_ASSIGNMENT,
  isMyStartDay,
  reliefNeverEnteredOf,
  rotationSlotOf,
  startAssignmentOf,
} from '@/entities/pitcher-career/model/pitcherRotation'
import { EMPTY_MANAGER_HOOK_FLAGS, judgeManagerHook } from '@/entities/pitcher-career/model/managerHook'
import type { ManagerHookFlags } from '@/entities/pitcher-career/model/managerHook'
import {
  EMPTY_PITCHER_GAME_RECORD,
  recordBatterFaced,
  recordEntryLead,
  recordHitByPitch,
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
  benchClearingEffectOf,
  rollsIntoBenchClearing,
  staminaAfterBenchClearing,
} from '@/entities/game/model/benchClearing'
import {
  addInningRuns,
  applyOpponentAtBat,
  applyOpponentRunnerPlay,
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

/**
 * 기록달성 지급 0xa77f0 의 **첫 관문** — `ctx+0x24` 첫 바이트가 0 이어야 한 건이라도 들어온다.
 *
 * 그 바이트의 뜻은 R15 10절이 확정했다: **"사람 투수가 강판되어 남은 경기를 간이 엔진이
 * 끝까지 돌리는 중"** (0xc1b48 에서 1 — R8 1절의 "30G 자동진행" 해석은 틀렸고, 30G 자동진행은
 * `engine+0xa0` 을 쓴다). 웹판에서 그 표시가 곧 `simpleEngineRunning` 이다.
 *
 * → 감독 강판이든 스스로 강판이든 **강판된 뒤에는 경기 끝 기록(28~31·37~39)까지 포함해
 *   아무 기록도 들어오지 않는다.** 강판 전에 받아 둔 기록은 그대로 남는다.
 */
function recordsAllowed(progress: PitcherGameProgress): boolean {
  return !progress.simpleEngineRunning
}

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
  /**
   * 환경설정 "송구" 가 수동인가 (설정 +0xf4) — **원본 기본값은 수동(0)** 이다 (K 5-2).
   * 투수편은 사람이 언제나 수비라 이 값이 그대로 `0xae6c8` 의 답이 된다
   * (`DefensePlayInput.throwMode` 주석의 0x5269c 갈림). 안 넘기면 수동이다.
   */
  readonly throwModeManual?: boolean
  /** 투수 스킬 18 비겁자 (스태미나 두 배 소모) */
  readonly pitcherIsCoward?: boolean
  /** 투수 스킬 10 끈기 (소모 −1) */
  readonly pitcherEndures?: boolean
  /** 투수 비트 16 안정감 (스킬 32) — 주자 2명 이상이면 실투율 −5 (0x33d6c) */
  readonly pitcherIsSteady?: boolean
  /** 투수 비트 17 새가슴 (스킬 33) — 2루 주자가 있으면 실투율 +10 (0x33d9c) */
  readonly pitcherIsTimid?: boolean
  /** 투수 비트 22 냉정 (스킬 38) — 실투율 −10 (0x33dca) */
  readonly pitcherIsCool?: boolean
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
  /**
   * 내 투수에게 매겨진 실점 — 레코드 +0x22(방어율)이고 평가 칸 R+0x128 과 같은 값이다.
   * 둘 다 정산 0xa8024 의 같은 주자 루프(0xa8ea4~0xa8f60)가 **득점 주자를 내보낸 투수**(주자+0x30)에게
   * 매긴다 — 마운드에 있는 동안의 득점 + 강판 때 남겨 둔 주자(`inheritedRunners`)의 득점.
   */
  readonly runsAllowedByMe: number
  /**
   * 강판 때 루에 남겨 두고 내려온 **내 주자** 수 (주자+0x30 = 내 투수). 마운드에 있는 동안은 늘 0 이다.
   * 원본은 주자마다 내보낸 투수를 적어 두므로(0xa93ac 넷째 인자 → 주자+0x30) 강판 뒤 간이 엔진
   * 타석(0xc1054 등도 정산 0xa8024 를 부른다)에서 이 주자가 들어와도 내 실점이다.
   */
  readonly inheritedRunners: number
  /** state+0x88 볼넷 · +0x89 피안타 · +0x8a 실점 — 우리 팀 투수 **전체**가 내준 것 */
  readonly teamWalksAllowed: number
  readonly teamHitsAllowed: number
  readonly teamRunsAllowed: number
  /** 이 이닝에 아직 아무도 안 내보냈는가 — R+0x184(삼자범퇴 표시) 자리 */
  readonly perfectInningFlag: boolean
  /** 상대 타순 칸별 이번 경기 안타·홈런 — 돌발 b6/b7 조건이 읽는 기록 +0x12·+0x13 */
  readonly opponentBatterLogs: Readonly<Record<number, { hits: number; homeRuns: number }>>
  /**
   * 이 경기에서 달성한 기록 id (0xa77f0 이 한 번 받을 때마다 하나).
   * 투수편은 모드 3 이라 **공격·수비 게이트가 둘 다 열린다** (0x3a20a — 모드 3·4 는 내 팀 전체가 사람 팀).
   * 그래서 동료 타석의 타격 기록(0~15·34·35)과 우리 투수의 삼진 계열(16~23·25)이 모두 들어온다.
   */
  readonly recordIds: readonly number[]
  /** 우리 팀 타순(0~8)별 이 경기 기록 — 투수편 주인공은 타석에 안 서므로 아홉 칸 모두 동료다 */
  readonly teammateLogs: Readonly<Record<number, BatterGameLog>>
  /** ctx+0x161 — 이번 타석 투구 수. 삼구 삼진(16) 판정이 읽는다 */
  readonly atBatPitches: number
  /** ctx+0x16c — 이번 반 이닝 투구 수. 삼구 삼자범퇴(25) 판정이 읽는다 */
  readonly halfInningPitches: number
  /**
   * 0xb8cec 가 돌려주는 **지금 마운드에 선 우리 투수**의 경기 기록 R[0]·R[1].
   * 기록 18~23 은 "현재 투수" 기준이라 투수가 바뀌면 0 부터 다시 센다 (R8 4-2).
   * `record.strikeouts` 와 달리 동료 투수가 잡은 삼진도 여기 들어간다.
   */
  readonly moundStrikeouts: number
  readonly moundStrikeoutCombo: number
  /**
   * **재생만 하면 되는** 장면. 매 틱의 화면 스냅샷이 들어 있어 수비 화면은 이것만 받아 그리면 된다
   * (타자편 `gameFlow` 와 같다).
   *
   * 홈런 비행처럼 사람이 조작할 것이 없는 장면이 여기 들어온다. 사람이 송구를 잡는 인플레이 타구는
   * `pendingDefensePlay` 쪽으로 가고, 다 본 뒤에는 **여기 남기지 않는다** — 남기면 한 번 더 튼다.
   */
  readonly lastDefensePlay: DefensePlayResult | null
  /**
   * **지금 화면이 실시간으로 돌리고 있는 타구.** 차 있으면 이 경기는 "수비 진행 중" 이고,
   * 타석 결과(안타/아웃 코드)만 정해졌을 뿐 **진루·아웃·실점은 아직 하나도 안 먹였다**.
   *
   * 원본은 타구가 뜨면 경기 장면이 상태 0x17 로 넘어가 공이 멈출 때까지 같은 루프를 돌며
   * 매 갱신 눌린 키를 읽는다 (R10 · I 문서). 그 동안 다음 투구는 나가지 않는다 —
   * 웹도 이 칸이 차 있는 동안 `isPitchTurn` 이 거짓이 되는 것으로 그 자리를 붙든다.
   *
   * ⭐ 투수편은 **사람이 수비**다 (조작 객체 `[+0xc]` = 1, I 0절) — 타자편과 정반대로 송구 키를 읽는다.
   * 이 칸은 **내 투수가 마운드에 있는 수비 반 이닝에서만** 찬다 (`startPitch` 가 유일한 자리이고
   * 그 앞에 `isPitchTurn` 이 있다). 우리 팀 공격 이닝(`playTeammateAtBat`)과 내가 마운드에 없는
   * 수비 타석(`playDefensiveAtBat`)은 원본도 간이 엔진이라 수비 시뮬레이션 자체를 안 돌린다.
   *
   * 화면이 다 돌고 나면 `resolveDefensePlay` 가 그 결과를 먹이고 이 칸을 비운다.
   * 미리 다 계산해도 되는 자리(테스트)는 `throwPitch` 를 부르면 이 칸을 거쳐 가되
   * 한 번에 비워져 나온다 — 밖에서 보면 예전과 똑같다.
   */
  readonly pendingDefensePlay: DefensePlayInput | null
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
  return rotationSlotOf(options.dayCounter)
}

/** 상대 팀 선발 — 하루 한 칸씩 도는 4인 로테이션의 0번 (0xb8c80 → 0xb5ca8, S5 U-16) */
function opponentPitcherIndex(options: PitcherGameOptions): number {
  return rotationSlotOf(options.dayCounter)
}

function quickPitcherAt(teamId: number, index: number) {
  const roster = teamPitchers(teamId)
  return quickPitcherOf(roster[index % roster.length])
}

/**
 * 상대 타순 칸의 타자 능력치 (히트·파워·수비·주루 — 레코드 순서 그대로).
 *
 * **히트는 경기용 값**이다 — CPU 타자 결정 0x34334 가 `0xb570d(ctx, 0, 타자, 1, 90, 1)` 로 읽는다
 * (Q1 1b, ce462ce). 모드 3 에서 0xb570c 는:
 * ```
 * b5728  v = 0xb6415(타자, 0, 1)          ; 마선수 배율 → 장비 → 스킬
 * b574a  모드 3·4: 0xb6389(타자) 거짓(내 육성 선수가 아니다) → b58e6
 * b58e6  체력 인자 90 → 감소 없음
 * b593a  팀 능력치 — 모드 마스크 0x306 = {1,2,8,9} 라 모드 3 은 없다
 *        코치 — 모드 2 만 · 0..999 로 자른다
 * ```
 * 그래서 `gameAbilityOf(모드 3, 내 팀 아님)` = 날 값을 0..999 로 자른 값이다.
 * ⚠️ 0xb6414 의 스킬 보정(5 −100 · 7 +50)은 웹 로스터에 스킬 비트(+0x14)가 없어 못 붙인다 — 미해결.
 *    상대 로스터는 마선수도 장비도 없어 그 둘은 원래 0 이다.
 * 파워·수비·주루는 이 길이 아니라(0xab214·수비·주루가 저마다 부른다) 여기서 손대지 않는다.
 */
function opponentBatterAbility(teamId: number, orderIndex: number) {
  const roster = teamBatters(teamId)
  const player = roster[orderIndex % roster.length]
  return {
    hit: gameAbilityOf({
      mode: PITCHER_EDITION_MODE,
      base: player.ability[0],
      isPitcher: false,
      slot: BATTER_SLOT.히트,
      isMyTeam: false,
    }),
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
    inheritedRunners: 0,
    teamWalksAllowed: 0,
    teamHitsAllowed: 0,
    teamRunsAllowed: 0,
    perfectInningFlag: true,
    opponentBatterLogs: {},
    recordIds: [],
    teammateLogs: {},
    atBatPitches: 0,
    halfInningPitches: 0,
    moundStrikeouts: 0,
    moundStrikeoutCombo: 0,
    lastDefensePlay: null,
    pendingDefensePlay: null,
    // 경기 장면은 모드 2·3·4 일 때만 돌발 객체를 만든다 (0x48658)
    burst: createBurstSession(PITCHER_EDITION_MODE),
    lastBurstResolution: null,
    log: [],
    nextLogId: 1,
    endedInningIndex: 0,
  }
  return advance(initial, random)
}

/**
 * 지금 사람이 공을 던질 차례인가 (0xc1d38).
 *
 * 수비 화면이 도는 동안(`pendingDefensePlay` 가 차 있는 동안)은 거짓이다 — 원본도 상태 0x17 을
 * 도는 중에는 0xf(구질 고르기)로 돌아가지 않아 다음 공이 나가지 않는다.
 */
export function isPitchTurn(progress: PitcherGameProgress): boolean {
  return (
    !progress.game.isFinished &&
    progress.onMound &&
    progress.managerHookText === null &&
    progress.pendingDefensePlay === null &&
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
  /**
   * **투수 미션 조준점 흔들림 세기 0~3** — 미션 레코드 바이트 13 (`missions.ts` 의
   * `conditionCode`, 0xaa57c → 0x39c5c). 미션이 아니면 안 넘긴다.
   *
   * 안 넘기거나 0 이면 조준점을 안 흔든다 — 지금까지와 똑같이 논다.
   * ⚠️ 타자 미션은 이 값이 **전부 0** 이라 타자편에서는 아무 일도 없다 (표 확인).
   */
  readonly missionConditionCode?: number
}

/**
 * 공 하나를 던진다 (상태 0x10 확정 → 0x11 → 0x12/0x13).
 * 타석이 끝나면 그 자리에서 돌발을 판정하고(0x4e7ca·0x52a8e) 다음 사람 차례까지 민다.
 *
 * ⚠️ 사람이 송구를 조작하는 화면은 이것을 쓰지 않는다 — `startPitch` 로 타석 결과만 먼저 정하고,
 * 화면이 틱을 다 돌린 뒤 `resolveDefensePlay` 로 주자 처리를 먹인다.
 * 여기는 그 둘을 한 줄로 이어 붙인 **얇은 껍데기**다 (끼어들 사람이 없는 자리·테스트용).
 */
export function throwPitch(
  progress: PitcherGameProgress,
  input: PitchInput,
  random: RandomPort,
): PitcherGameProgress {
  const started = startPitch(progress, input, random)
  const pending = started.pendingDefensePlay
  if (pending === null) return started
  // 미리 다 돌려 버린다 — `runDefensePlay` 는 스테퍼를 끝까지 도는 얇은 껍데기다.
  // 이 갈래는 아직 아무것도 안 보여 줬으므로 돌린 결과를 그대로 재생거리로 넘긴다 (예전 그대로).
  const result = runDefensePlay(pending)
  return resolveDefensePlay(started, result, random, result)
}

/**
 * 공 하나를 던지고 **인플레이 타구면 거기서 멈춘다** — 주자 처리를 뒤로 미룬다.
 *
 * 인플레이 타구는 진행기에 넘길 `DefensePlayInput` 만 만들어 `pendingDefensePlay` 에 얹고
 * 경기 상태(루·아웃·점수·기록)는 **한 톨도 건드리지 않은 채** 돌려준다. 그 동안 다음 공이
 * 나가지 않는 것이 이 칸의 뜻이다 (원본 상태 0x17 이 도는 동안 0xf 로 안 가는 것과 같은 자리).
 * 주자 처리·기록·돌발 판정은 화면이 다 돌고 `resolveDefensePlay` 를 부를 때 한 번에 한다.
 *
 * 삼진·볼넷·홈런은 수비가 개입할 것이 없어 여기서 곧장 끝낸다 (타자편 `startPlayerOutcome` 과 같다).
 */
export function startPitch(
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
      // 투수 미션일 때만 조준 흔들림 세기가 실린다 (0x39c5c)
      ...(input.missionConditionCode === undefined
        ? {}
        : { missionConditionCode: input.missionConditionCode }),
    },
    random,
  )

  // 실투 판정 0x33cbc — 투구 순간 0x4dc78 이 궤적 준비 0x9e669 **뒤**(0x4dea0)에 부른다.
  // 등급 뽑기(0x4dbac)·제구 흩어짐 굴림이 다 끝난 뒤이고, CPU 타자 결정 0x34334 보다 앞이다.
  // 마구가 아니면 rand(0,100) 을 늘 한 번 굴린다.
  const isMistake = isMistakePitch(
    {
      isMagicPitch: isMagic,
      grade,
      // 0xb570d(ctx, 1, 투수, 1, 90, 1) — 칸 1 구속, 체력 인자 90 이라 피로 감소가 없다.
      // `options.stats` 가 곧 장비·스킬·컨디션을 먹인 실효값이다 (`fatiguedStatsOf` 주석)
      effectiveVelocity: options.stats.velocity,
      runnerCount: runnerCountOf(progress.game.bases),
      hasSecondBaseRunner: progress.game.bases.second,
      // 상대 타자의 스킬 22(0xb62b4)를 웹 로스터가 들고 있지 않아 늘 거짓이다 (drainStamina 와 같다)
      batterIntimidates: false,
      pitcherIsSteady: options.pitcherIsSteady === true,
      pitcherIsTimid: options.pitcherIsTimid === true,
      pitcherIsCool: options.pitcherIsCool === true,
    },
    random,
  )

  const batter = opponentBatterAbility(options.opponentTeamId, progress.opponentOrderIndex)
  const resolution = pitchAgainstBatter(
    pitch,
    batter,
    random,
    { control: fatigued.control, velocity: fatigued.velocity },
    // 원본 0x34334 가 보는 상황 — state 의 볼카운트·아웃과 주자 유무(0xa9599)
    {
      strikes: progress.atBat.strikes,
      balls: progress.atBat.balls,
      outs: progress.game.outs,
      hasRunner: runnerCountOf(progress.game.bases) > 0,
    },
    { isMistakePitch: isMistake },
  )

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
    // ctx+0x161 · ctx+0x16c — 투구 처리 0xa5e14 가 공 하나마다 둘 다 올린다
    atBatPitches: progress.atBatPitches + 1,
    halfInningPitches: progress.halfInningPitches + 1,
    // R+0x158 — t == 5 로 던진 공. 마구는 늘 5 라 함께 센다
    pitcherRecord: recordPitchGrade(progress.pitcherRecord, grade),
    lastPitch: pitch,
    lastResolution: resolution,
    atBat: applyPitchResolution(progress.atBat, resolution),
  }

  const outcome = afterPitch.atBat.outcome
  if (outcome === null) return afterPitch
  if (isBattedBallInPlay(outcome)) {
    // 여기서 멈춘다 — 화면이 이 타구를 실시간으로 돌리고 결과를 `resolveDefensePlay` 에 넘긴다.
    // `atBat` 은 아직 안 비웠으므로 끝난 타석의 결과 코드·볼 카운트가 그대로 남아 있다.
    return { ...afterPitch, pendingDefensePlay: defensePlayInputOf(afterPitch, outcome, random) }
  }
  // 사구면 상태 0x12 끝(0x4e74c)에서 벤치 클리어링을 굴린다 — 밀어내기 주루(0x17)·정산 0xa8024 보다 앞이다
  const settled = withPitcherBenchClearing(afterPitch, outcome, random)
  // 내가 던진 타석이면 홈런도 날아가는 그림을 보여 준다 — 득점·주자는 아래 길이 그대로 정한다
  const playback = homeRunPlaybackOf({ outcome, bases: settled.game.bases })
  return advance(
    applyDefensivePlay(settled, outcome, true, settled.atBat.balls, null, playback),
    random,
  )
}

/**
 * **사구 뒤 벤치 클리어링** (`entities/game/model/benchClearing`, R10 6절) — 내가 던진 공이라 수비는 사람(나)이다.
 * 들어가면 0x3ab7c `0xaeab0(수비 팀, 1000)` — 지금 마운드의 내 스태미나(+0x2c) −1000, [0, 10000] 로 자른다.
 * 시즌 평판 S[1](0xa755c(ctx, 1), 0x3ab92)도 부르지만 그 게이트는 **모드 2(시즌)** 만 적으므로 투수편(모드 3)에서는
 * 아무것도 안 남는다. 홈런더비가 아니라 사구면 늘 한 번 굴린다 — **사구 타석만 난수를 하나 더 쓴다.**
 * ⚠️ 연출 화면(양 팀이 마운드로 몰려나오는 100틱, 배경음 44)과 그 연출이 쓰는 난수는 없다.
 */
function withPitcherBenchClearing(
  progress: PitcherGameProgress,
  outcome: AtBatOutcome,
  random: RandomPort,
): PitcherGameProgress {
  const entered = rollsIntoBenchClearing(
    {
      isHitByPitch: outcome.kind === '사구',
      isHomeRunDerby: false,
      burstInProgress: progress.burst !== null && progress.burst.current !== null,
    },
    random,
  )
  if (!entered) return progress
  const effect = benchClearingEffectOf(true)
  return appendLog(
    { ...progress, stamina: staminaAfterBenchClearing(progress.stamina, effect.defenseStaminaLoss) },
    `${progress.game.inning}회${progress.game.half} 벤치 클리어링`,
    true,
  )
}

/**
 * 화면이 다 돌린 수비 플레이를 **그때** 경기 상태에 먹인다.
 *
 * `result.advance`(진루·아웃·실점)가 여기서 비로소 경기 상태가 된다. 이미 눈으로 다 본 플레이라
 * `playback` 을 안 주면 `lastDefensePlay` 에 넣지 않는다 — 넣으면 같은 장면을 한 번 더 재생한다.
 */
export function resolveDefensePlay(
  progress: PitcherGameProgress,
  result: DefensePlayResult,
  random: RandomPort,
  /** 화면에 재생시킬 틱 묶음. 미리 다 돌려 버린 갈래(`throwPitch`)만 준다 */
  playback: DefensePlayResult | null = null,
): PitcherGameProgress {
  if (progress.pendingDefensePlay === null) return progress
  const outcome = progress.atBat.outcome
  // 타석이 안 끝났는데 붙들려 있을 수는 없다 — 그래도 칸은 비워 경기가 멈추지 않게 한다
  if (outcome === null) return { ...progress, pendingDefensePlay: null }
  return advance(
    applyDefensivePlay(
      { ...progress, pendingDefensePlay: null },
      outcome,
      true,
      progress.atBat.balls,
      result,
      playback,
    ),
    random,
  )
}

/**
 * **견제** — 구질 고르기(상태 0xf)에서 '3'/'1'/'7' (0x53548 → 메시지 0x10 → 0x50f28 → 상태 0x17 종류 4).
 *
 * 그 루에 주자가 없거나 견제 키가 아니면 **아무 일도 없다**(원본도 키를 먹고 끝난다 — 같은 객체를 돌려준다).
 * 견제는 투구가 아니다: 투구 수·스태미나·볼카운트·마구 횟수를 건드리지 않고(0x10~0x12 를 안 지난다),
 * 정산 0xa8024 가 불려도 `state[0x26] = 4` 라 **타자 상대 수(R+0x138)·타석 수(+0x14)가 안 오른다**
 * (`recordBatterFaced` · `pinchHitAi.recordPlateAppearance`).
 *
 * 수비 화면은 `runPickoffPlay` 가 미리 끝까지 돌린 틱을 `lastDefensePlay` 로 재생한다 — 견제 중에는 사람이
 * 바꿀 것이 없어서다(`pickoffPlay` 머리 주석). 난수는 그 안의 **악송구 굴림(0xa1828) 1번 · 악송구면 +2번**뿐이다.
 *
 * ⚠️ 견제사·홈인은 이 모드에서 사실상 안 난다 — 사람 경기의 CPU 도루(0x520de)는 투구 모션 10프레임에만
 *    걸리고 견제는 상태 0xf 에서만 들어와 겹치지 않으며(Q1 3b), 웹 투수편에는 CPU 도루 자체가 아직 없다.
 *    그래도 진행기가 아웃·진루를 내면 경기 상태(루·아웃·점수·반 이닝 교대)에는 먹인다. 그때 0xa8024 의
 *    나머지 기록 칸(투수 아웃 수·돌발 판정 등)이 견제 판에서 어떻게 도는지는 **미해결**이라 손대지 않는다.
 */
export function pickoff(
  progress: PitcherGameProgress,
  webKey: string,
  random: RandomPort,
): PitcherGameProgress {
  if (!isPitchTurn(progress) || !progress.atBatPrepared) return progress
  const bases = progress.game.bases
  const play = pickoffPlayForKey(webKey, (base) =>
    base === 1 ? bases.first : base === 2 ? bases.second : bases.third,
  )
  if (play === null) return progress

  const result = runPickoffPlay({
    targetBase: play.targetBase,
    bases,
    outs: progress.game.outs,
    // 수비 아홉 칸은 우리 팀, 칸 0 은 나 — 타구 진행기와 같은 원본 버그(칸 0 은 변화)까지 그대로
    defenseAbilities: defenseAbilitiesOf(
      teamBatters(progress.options.ourTeamId).map((player) => ({
        position: player.position,
        defense: player.ability[2],
      })),
      progress.options.stats.breaking,
    ),
    runAbility: opponentBatterAbility(progress.options.opponentTeamId, progress.opponentOrderIndex).run,
    random,
    offenseIsCpu: true,
  })

  const advanceResult = result.advance
  const changed =
    advanceResult.outsAdded > 0 ||
    advanceResult.runsScored > 0 ||
    advanceResult.bases.first !== bases.first ||
    advanceResult.bases.second !== bases.second ||
    advanceResult.bases.third !== bases.third
  const before = progress.game
  let next: PitcherGameProgress = {
    ...progress,
    lastDefensePlay: result,
    // 0xa8d98 — 종류 4 는 R+0x138 을 안 올린다 (그대로 돌려받는다)
    pitcherRecord: recordBatterFaced(progress.pitcherRecord, PICKOFF_PLAY_KIND),
  }
  if (changed) {
    const applied = applyOpponentRunnerPlay(before, progress.opponentOrderIndex, advanceResult)
    let decision = progress.decision
    for (let run = 1; run <= applied.runsScored; run += 1) {
      decision = applyRunScoredFor(progress, decision, run, true)
    }
    const halfChanged = applied.game.half !== before.half || applied.game.inning !== before.inning
    const pickoffCharged = chargedRunsOfFates(result.runnerFates, before.outs + advanceResult.outsAdded)
    next = {
      ...next,
      game: applied.game,
      decision,
      inningRuns: addInningRuns(progress.inningRuns, before.inning, applied.runsScored),
      // 견제는 내가 마운드에 있을 때만이라 들어온 주자는 모두 내가 내보낸 주자다 (R+0x128 · +0x22).
      // 견제도 정산 0xa8024 를 지난다(I 4a-3) — 주자 운명으로 센다 (`chargedRunsOfFates`)
      runsAllowedByMe: progress.runsAllowedByMe + pickoffCharged,
      record: {
        ...progress.record,
        runsAllowedField: progress.record.runsAllowedField + pickoffCharged,
      },
      teamRunsAllowed: progress.teamRunsAllowed + applied.runsScored,
    }
    if (halfChanged) {
      next = {
        ...next,
        inningRuns: clearInningRuns(next.inningRuns, applied.game.inning),
        perfectInningFlag: true,
        halfInningPitches: 0,
        atBat: createAtBat(),
        atBatPitches: 0,
        atBatPrepared: false,
        endedInningIndex: applied.game.inning - 1,
      }
    }
  }
  const call = result.resultCode === PICKOFF_RESULT.OUT ? '견제사' : result.errantThrow ? '악송구' : '세이프'
  next = appendLog(
    next,
    `${before.inning}회${before.half} ${play.targetBase}루 견제 — ${call}${
      advanceResult.runsScored > 0 ? ` (${advanceResult.runsScored}실점)` : ''
    }`,
    true,
  )
  return changed ? advance(next, random) : next
}

/**
 * 내가 던진 인플레이 타구를 진행기에 넘길 꼴로 만든다 — 능력치·난수·모드·수비 주체까지 다 여기서 채운다.
 * 이 객체를 만드는 데는 난수를 **한 번도 쓰지 않는다** (굴림은 전부 진행기 안에서 돈다).
 */
function defensePlayInputOf(
  progress: PitcherGameProgress,
  outcome: AtBatOutcome,
  random: RandomPort,
): DefensePlayInput {
  return {
    outcome,
    trajectory: battedBallTrajectory(representativePatternOf(outcome)),
    bases: progress.game.bases,
    outs: progress.game.outs,
    // 내가 던진 타석이니 수비 아홉 칸은 **우리 팀**이고, 칸 0(투수)은 나다.
    // ⚠️ 원본 그대로: 칸 0 도 능력치 칸 2 를 읽어 투수 레코드에서는 **변화**가 들어간다
    // (0xb570c(팀, 2, 선수, 90, 1) — `defenseAbilitiesOf` 주석).
    defenseAbilities: defenseAbilitiesOf(
      teamBatters(progress.options.ourTeamId).map((player) => ({
        position: player.position,
        defense: player.ability[2],
      })),
      progress.options.stats.breaking,
    ),
    // 주자는 상대 타자다 — 지금 타순 칸의 주루
    runAbility: opponentBatterAbility(progress.options.opponentTeamId, progress.opponentOrderIndex).run,
    random,
    // 나만의리그 투수편 = 전역 모드 3
    gameMode: PITCHER_EDITION_MODE,
    // 수비는 사람(나)이다 → 협살은 원본에서도 안 일어난다 (S8 1-4)
    defenseIsCpu: false,
    // 공격이 CPU 라 `0xae690` 의 첫 항(`경기[0x31 + 공격측] == 1`)이 서서
    // **환경설정 주루와 무관하게 늘 자동 진루**다 — 투수편은 사람이 언제나 수비다
    offenseIsCpu: true,
    // 반대로 **송구는 여기서만 환경설정이 먹는다** — `0xae6c8` 의 첫 항(`경기[0x31 + 수비측] == 1`)이
    // 사람 수비라 거짓이므로 설정 +0xf4 혼자가 답을 정한다. 원본 기본값은 **수동**이다.
    throwMode: progress.options.throwModeManual === false ? '자동' : '수동',
  }
}

/* ── 수비 타석 하나 ───────────────────────────────────────────────────────────── */

/**
 * 상대 타석 하나를 경기에 반영한다.
 * `mine` 이 참이면 내가 던진 타석이라 투수 기록·돌발 판정까지 함께 한다.
 *
 * `balls` 는 타석이 끝났을 때의 볼 카운트 (풀카운트 삼진 17 판정).
 * `progress.atBatPitches`·`progress.halfInningPitches` 는 부르는 쪽이 이미 올려 두었다.
 *
 * ⚠️ 난수를 받지 않는다 — 수비 시뮬레이션 굴림은 부르는 쪽이 이미 다 돌린 뒤라 여기서는
 * 그 결과를 먹이기만 한다.
 */
function applyDefensivePlay(
  progress: PitcherGameProgress,
  outcome: AtBatOutcome,
  mine: boolean,
  balls: number,
  /**
   * **이미 돌린** 수비 시뮬레이션 결과 (`features/defense-play`).
   *
   * 내가 던진 타석의 인플레이 타구만 갖는다 — 투수편도 원본에서는 사람 경기(0xae24c·0xae3e8)라
   * 간이 엔진이 아니라 수비 AI 가 돈다. 그래서 `baseState` 의 두 근사("희생플라이 보장"·
   * "고정 진루표")가 여기서는 쓰이지 않고, 태그업(0xa9620) → 자동 추가 진루(0xaf918, 송구보다
   * 2틱 넘게 빠를 때만) → 2아웃 득점 보류 순서가 그대로 돈다 (P2 7절 · E-defense-rules).
   *
   * 내가 마운드에 없는 타석(구원 대기·강판 뒤)은 원본도 간이 엔진(0xc262c)이라 null 이다.
   */
  defensePlay: DefensePlayResult | null,
  /**
   * 화면에 재생시킬 틱 묶음. 홈런 비행이거나, 미리 다 돌려 버린 갈래의 그 결과다.
   * **실시간으로 이미 다 보여 준 플레이는 null** — 넣으면 같은 장면을 한 번 더 튼다.
   */
  playback: DefensePlayResult | null,
): PitcherGameProgress {
  const before = progress.game
  const advanceResult =
    defensePlay?.advance ??
    // 간이 엔진이 돌린 타석 — **원본 간이 엔진에는 희생플라이가 없다** (E-2 확정)
    advanceRunners(before.bases, outcome, before.outs, { quickEngine: true })
  const applied = applyOpponentAtBat(before, progress.opponentOrderIndex, outcome, advanceResult)
  const slot = progress.opponentOrderIndex
  const previousLog = progress.opponentBatterLogs[slot] ?? { hits: 0, homeRuns: 0 }
  const hit = isHit(outcome)
  const walk = outcome.kind === '볼넷'
  // 출루 허용 state[0x88]·투수 +0x2a·삼자범퇴 칸 ctx+0x184 는 볼넷·사구를 함께 본다
  // (0xa8caa — 사구 플레이는 아웃이 없어 마지막 주자가 늘 살아 있다 · 0xa8e12/0xa8e36)
  const freePass = isFreePass(outcome)
  const hitByPitch = outcome.kind === '사구'
  const inningEnded = before.outs + applied.outsAdded >= OUTS_PER_INNING

  let decision = progress.decision
  for (let run = 1; run <= applied.runsScored; run += 1) {
    decision = applyRunScoredFor(progress, decision, run, mine)
  }

  // R+0x184 — 안타·볼넷·사구가 나면 이 이닝은 더 이상 삼자범퇴가 아니다 (0xa80b4·0xa8e12)
  const perfectInningFlag = progress.perfectInningFlag && !hit && !freePass && applied.runsScored === 0

  /**
   * 이 플레이에서 **내 투수에게 매겨지는** 실점 — R+0x128 과 레코드 +0x22 (정산 0xa8024 주자 루프):
   * ```
   * a8ea4  for 주자 in 주자 목록:
   * a8eb2    주자+0x95(득점) == 0 → 건너뜀
   * a8ec0    아웃 == 3 이고 목록 0번 주자+0x96(아웃) != 0 → 건너뜀
   * a8ee4    P = 0xb8c44(수비 팀, 주자+0x30)          ; 그 주자를 내보낸 투수
   * a8ef4    0xa56dc(R, P, 0) 이면 P+0x22(실점)++
   * a8f3c    0xb6388(P)(+0xa 비트7 = 육성·명전) && 0xa56dc(R, P, 0) 이면
   * a8f56      R+0x128 += 1
   * ```
   * 모드 3 의 0xa56dc(R, P, 0) 갈래(0xa571c)는 "시즌 객체 S(0x1fa2d)+0x12c(국가대항전)·+0xb4(포스트시즌)가 둘 다 0
   * 이고 P 가 마선수(0xb633d, 비트6)가 아님" 이다. 투수편의 내 투수는 육성 선수라 비트7 이 서고 마선수가 아니므로
   * **내가 내보낸 주자가 들어올 때마다 1** 이다. 일반 선수인 동료 투수는 비트7 이 없어
   * R+0x128 에 안 든다(+0x22 에는 든다 — 웹은 동료 투수 레코드를 따로 두지 않는다).
   *
   * - 마운드에 있는 동안(`mine`)의 주자는 모두 내 주자다 — 선발은 경기 시작부터, 구원은 8회 0아웃(빈 루)에 올라오므로
   *   남의 주자를 물려받는 일이 없다 (`shouldEnterNow`).
   * - 강판 뒤에는 남겨 둔 내 주자(`inheritedRunners`)만 내 실점이다. 주자는 서로 앞지를 수 없어 내 주자가 늘 앞쪽에
   *   있으므로 **득점은 내 주자부터** 센다.
   *
   * 내가 던진 타석은 주자 운명(`runnerFates`, 90c7864)으로 센다 — 인플레이 타구는 진행기 결과, 삼진·볼넷·사구·홈런은
   *   `runnerFatesWithoutPlay`. 그래서 3아웃 갈래(0xa8ec0: 목록 0번 주자가 살았으면 보류됐다 날아간 득점까지 세고,
   *   죽었으면 하나도 안 센다)도 원본대로다. `outsAfterPlay` 는 3아웃 정리 전의 아웃 수.
   *
   * ⚠️ 미해결(근사): ① 강판 뒤 간이 엔진 타석은 주자 운명이 없어 점수판 득점(`runsScored`)을 쓰고, 내 주자가
   *   이 플레이에서 아웃되고 뒤 주자가 들어온 경우(드묾)는 뒤 주자 득점을 내 것으로 세며, 남은 내 주자 수는
   *   `min(남은 수, 루의 주자 수)` 로 줄인다. 간이 엔진의 3아웃 갈래도 점수판 득점으로 대신한다.
   *   ② 원본은 포스트시즌·국가대항전이면 0xa56dc 가 거짓이라 아예 안 센다(사건 함수 0xa57f8 의 다른 R 칸도
   *   같은 게이트다) — 웹은 이 게이트를 어느 R 칸에도 걸지 않았으므로 여기서도 걸지 않는다 (미해결, 따로 옮길 것).
   */
  const chargedToMe = mine
    ? chargedRunsOfMyPlay(before.bases, outcome, defensePlay, before.outs + applied.outsAdded, applied.runsScored)
    : Math.min(applied.runsScored, progress.inheritedRunners)
  const inheritedRunners =
    mine || inningEnded
      ? 0
      : Math.min(progress.inheritedRunners - chargedToMe, runnerCountOf(applied.game.bases))

  const playedRecord: PitcherEvaluationRecord = mine
    ? {
        ...progress.record,
        hitsAllowed: progress.record.hitsAllowed + (hit ? 1 : 0),
        strikeouts: progress.record.strikeouts + (outcome.kind === '삼진' ? 1 : 0),
        outsRecorded: progress.record.outsRecorded + applied.outsAdded,
        // R+0x144 은 볼넷만이다 — 코드 0x1c 는 state[5] > 3 일 때뿐(0xa8e04), 사구는 아래 R+0x148(0x1d)
        walksAllowed: progress.record.walksAllowed + (walk ? 1 : 0),
        // 연속 탈삼진 — 삼진이 아닌 타석이 끼면 끊긴다 (R+0x14c, 0xa619e)
        strikeoutCombo: outcome.kind === '삼진' ? progress.record.strikeoutCombo + 1 : 0,
        // R+0x154 — 삼자범퇴 이닝 (S5 정정 4: "무안타" 가 아니라 아무도 안 내보낸 이닝이다)
        perfectInnings: progress.record.perfectInnings + (inningEnded && perfectInningFlag ? 1 : 0),
      }
    : progress.record
  const record: PitcherEvaluationRecord =
    chargedToMe > 0
      ? { ...playedRecord, runsAllowedField: playedRecord.runsAllowedField + chargedToMe }
      : playedRecord

  // 0xb8cec — 지금 마운드에 선 우리 투수의 경기 기록 R[0](삼진)·R[1](연속 삼진).
  // 삼진 아닌 결과로 끝난 타석마다 콤보가 끊긴다 (R8 5-5).
  const strikeout = outcome.kind === '삼진'
  const moundStrikeouts = progress.moundStrikeouts + (strikeout ? 1 : 0)
  const moundStrikeoutCombo = strikeout ? progress.moundStrikeoutCombo + 1 : 0

  // 삼진 계열 16·17(0xa7c4c) 과 18~23(0xa7998). 게이트는 "수비 팀이 사람 팀인가" 만 보므로
  // 동료 투수가 잡은 삼진도 우리 팀 기록으로 들어온다 (R8 1절).
  const newRecordIds: number[] = strikeout
    ? [
        ...strikeoutRecordIdsOf({
          pitches: progress.atBatPitches,
          balls,
          comboCount: moundStrikeoutCombo,
          pitcherStrikeouts: moundStrikeouts,
        }),
      ]
    : []
  // 25 삼구 삼자범퇴 (0xa7d0c) — 반 이닝을 공 셋으로 3아웃
  if (inningEnded) {
    newRecordIds.push(
      ...threePitchInningRecordIdsOf(progress.halfInningPitches, before.outs + applied.outsAdded),
    )
  }

  const next: PitcherGameProgress = {
    ...progress,
    game: applied.game,
    opponentOrderIndex: applied.opponentOrderIndex,
    decision,
    moundStrikeouts,
    moundStrikeoutCombo,
    lastDefensePlay: playback ?? progress.lastDefensePlay,
    atBatPitches: 0,
    recordIds: recordsAllowed(progress)
      ? [...progress.recordIds, ...newRecordIds]
      : progress.recordIds,
    inningRuns: addInningRuns(progress.inningRuns, before.inning, applied.runsScored),
    record,
    pitcherRecord: mine ? pitcherRecordAfterPlay(progress.pitcherRecord, hitByPitch) : progress.pitcherRecord,
    runsAllowedByMe: progress.runsAllowedByMe + chargedToMe,
    inheritedRunners,
    teamHitsAllowed: progress.teamHitsAllowed + (hit ? 1 : 0),
    teamWalksAllowed: progress.teamWalksAllowed + (freePass ? 1 : 0),
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

  // 0x8f414 는 **타석이 끝나는 자리마다** 돈다 — 동료·상대 타석에서 뜬 돌발도 그 결과로 판정된다
  const resolved = resolveBurstFor(
    next,
    outcome,
    applied.runsScored,
    before.outs,
    applied.outsAdded,
    inningEnded,
  )
  const halfChanged = applied.game.half !== before.half || applied.game.inning !== before.inning
  const closed: PitcherGameProgress = halfChanged
    ? {
        ...resolved,
        // 이닝 칸을 비우고 삼자범퇴 표시를 다시 세운다
        inningRuns: clearInningRuns(resolved.inningRuns, applied.game.inning),
        perfectInningFlag: true,
        // ctx+0x16c 는 반 이닝이 시작할 때 0 이 된다 (0xa5b00)
        halfInningPitches: 0,
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

/**
 * 내가 던진 타석 하나가 R+0x128 · +0x22 에 더하는 수 (`chargedRunsOfFates`, 0xa8ea4~0xa8f6e).
 * 인플레이 타구는 진행기가 낸 운명, 그 밖(삼진·볼넷·사구·홈런)은 진행기 없이 정해지는 운명을 쓴다.
 * 진행기 결과가 없는 인플레이 타구(일어나지 않지만)는 점수판 득점으로 대신한다.
 */
function chargedRunsOfMyPlay(
  basesBefore: BaseState,
  outcome: AtBatOutcome,
  defensePlay: DefensePlayResult | null,
  outsAfterPlay: number,
  runsScored: number,
): number {
  if (defensePlay !== null) return chargedRunsOfFates(defensePlay.runnerFates, outsAfterPlay)
  if (outcome.kind === '안타' || outcome.kind === '아웃') return runsScored
  return chargedRunsOfFates(runnerFatesWithoutPlay(basesBefore, outcome), outsAfterPlay)
}

/**
 * 정산 0xa8024 가 내 투수 기록 R 에 남기는 것 — R+0x138 타자 수(0xa8db0) 뒤 사구면 R+0x148 (코드 0x1d, 0xa8e2a).
 * 두 코드 다 "수비팀 현재 투수가 본인" 필터(0x14~0x1f)를 지나므로 내가 던진 타석(`mine`)에서만 부른다.
 */
function pitcherRecordAfterPlay(record: PitcherGameRecord, hitByPitch: boolean): PitcherGameRecord {
  const faced = recordBatterFaced(record, 0)
  return hitByPitch ? recordHitByPitch(faced).record : faced
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
      // 사구도 B5(출루)·B11 을 켠다 (0xa882a "볼 4개 || 사구" · 0xa8bf4) — burstResultBitsOf 가 직접 받는다
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

  return { ...triggerBurstAtPrep(progress, false, random), hookFlags: hook.flags, atBatPrepared: true }
}

/**
 * 상태 0xf(타석 준비)의 **돌발 발동 판정** (0x8f158).
 *
 * 원본은 경기 장면이 지나는 **모든 타석** 준비에서 굴린다 (K 4절 1-6, 확정) — 내가 던지는 타석뿐
 * 아니라 동료 타석·내가 마운드에 없는 수비 타석도 같은 자리를 지난다. 예전에는 내가 던지는
 * 타석에서만 굴려 발동이 원본보다 드물었다.
 *
 * 다만 **강판 뒤(상태 0x21 = 간이 엔진 중계)에는 0xf 를 지나지 않는다** — 그래서 굴리지 않는다.
 */
function triggerBurstAtPrep(
  progress: PitcherGameProgress,
  isHumanTeamBatting: boolean,
  random: RandomPort,
): PitcherGameProgress {
  const session = progress.burst
  if (session === null || progress.simpleEngineRunning) return progress
  const log = progress.opponentBatterLogs[progress.opponentOrderIndex] ?? { hits: 0, homeRuns: 0 }
  const next = tryTriggerBurst(
    session,
    {
      // 투수편 XlsPITCHER_BURST 44행의 목표는 전부 아웃 계열이라 사람 팀 공격 갈래가 따로 없다
      // (표를 가르는 것은 시즌 모드뿐 — 0x8f000)
      isHumanTeamBatting,
      bases: progress.game.bases,
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
  return next === session ? progress : { ...progress, burst: next }
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
        // 루에 남겨 둔 주자는 주자+0x30 이 나라서 들어오면 내 실점이다 (0xa8ee4)
        inheritedRunners: runnerCountOf(progress.game.bases),
        // 새 투수의 기록이 되므로 0 부터. (어차피 강판 뒤에는 기록 게이트가 닫힌다)
        moundStrikeouts: 0,
        moundStrikeoutCombo: 0,
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
        // 루에 남겨 둔 주자는 주자+0x30 이 나라서 들어오면 내 실점이다 (0xa8ee4)
        inheritedRunners: runnerCountOf(progress.game.bases),
        moundStrikeouts: 0,
        moundStrikeoutCombo: 0,
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
      // 기록 18~23 은 **현재 투수**의 R[0]·R[1] 을 보므로 투수가 바뀌면 0 부터 다시 센다 (R8 4-2)
      moundStrikeouts: 0,
      moundStrikeoutCombo: 0,
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
  // 상태 0xf — 내가 마운드에 없어도 장면은 타석 준비를 지난다 (강판 뒤 0x21 은 제외)
  const prepared = triggerBurstAtPrep(progress, false, random)
  const play = playQuickAtBat(
    batterAt(options.opponentTeamId, prepared.opponentOrderIndex),
    quickPitcherAt(options.ourTeamId, ourOtherPitcherIndex(options)),
    { inning: prepared.game.inning },
    random,
  )
  return applyDefensivePlay(
    {
      ...prepared,
      atBatPitches: play.pitches,
      halfInningPitches: prepared.halfInningPitches + play.pitches,
    },
    play.outcome,
    false,
    play.balls,
    // 내가 마운드에 없는 타석은 간이 엔진이라 수비 시뮬레이션도 재생거리도 없다
    null,
    null,
  )
}

/** 동료 타석 — 투수편 주인공은 타석에 서지 않으므로 아홉 칸 모두 간이 엔진이 돈다 */
function playTeammateAtBat(
  progress: PitcherGameProgress,
  random: RandomPort,
): PitcherGameProgress {
  const { options } = progress
  // 상태 0xf — 동료 타석 준비에서도 굴린다 (K 4절 1-6)
  progress = triggerBurstAtPrep(progress, true, random)
  const before = progress.game
  const outcome = playQuickAtBat(
    batterAt(options.ourTeamId, before.battingOrderIndex),
    quickPitcherAt(options.opponentTeamId, opponentPitcherIndex(options)),
    { inning: before.inning },
    random,
  ).outcome
  // 동료 타석은 원본도 간이 엔진(0xc262c)이다 — 희생플라이가 없다 (E-2 확정)
  const game = applyAtBatOutcome(
    before,
    outcome,
    advanceRunners(before.bases, outcome, before.outs, { quickEngine: true }),
  )
  const runs = game.ourScore - before.ourScore
  let decision = progress.decision
  for (let run = 1; run <= runs; run += 1) {
    decision = applyRunScoredForOffense(progress, decision, run)
  }
  const slot = before.battingOrderIndex
  const halfChanged = game.half !== before.half || game.inning !== before.inning
  const outsAdded = advanceRunners(before.bases, outcome, before.outs, { quickEngine: true }).outsAdded
  // 타석이 끝나는 자리 — 동료 타석에서 뜬 돌발도 그 타석 결과로 판정된다 (0x8f414)
  const judged = resolveBurstFor(
    // 끝내기 비트(0xa89f0)는 **타석이 끝난 뒤의** 점수로 본다
    { ...progress, game },
    outcome,
    runs,
    before.outs,
    outsAdded,
    before.outs + outsAdded >= OUTS_PER_INNING,
  )
  // 모드 3 은 내 팀 전체가 사람 팀이라 **공격 게이트도 열린다** (0x3a20a) —
  // 간이 엔진이 돌린 동료 타석도 같은 0xa8024 를 지나 타격 기록(0~15·34·35)이 된다 (R8 1절·8절).
  const recorded = recordBatterAtBat(
    progress.teammateLogs[slot] ?? EMPTY_BATTER_GAME_LOG,
    outcome,
    runs,
  )
  return appendLog(
    {
      ...progress,
      burst: judged.burst,
      lastBurstResolution: judged.lastBurstResolution,
      game,
      decision,
      endedInningIndex: game.inning - 1,
      teammateLogs: { ...progress.teammateLogs, [slot]: recorded.log },
      recordIds: recordsAllowed(progress)
        ? [...progress.recordIds, ...recorded.recordIds]
        : progress.recordIds,
      perfectInningFlag: halfChanged ? true : progress.perfectInningFlag,
      inningRuns: halfChanged ? clearInningRuns(progress.inningRuns, game.inning) : progress.inningRuns,
      // 우리 공격이 끝나면 다음 수비 반 이닝의 투구 수를 0 부터 센다
      halfInningPitches: halfChanged ? 0 : progress.halfInningPitches,
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
  /**
   * 이 경기에서 달성한 기록 id — 경기 끝 G포인트 지급(0x4ea0c)의 입력.
   * 앱은 `recordGamePointsOf(summary.recordIds)` 로 G 를 구해 커리어에 얹으면 된다.
   */
  readonly recordIds: readonly number[]
  /**
   * 이 경기에 한 번이라도 마운드에 섰는가 (`progress.hasEntered`) — 등판 경기 수를 세는 입력.
   * 선발이면 경기 시작부터 참이고, 구원은 8회에 올라오는 순간 참이 된다.
   */
  readonly hasEntered: boolean
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
    recordIds: gameEndRecordIdsFor(progress),
    hasEntered: progress.hasEntered,
  }
}

/**
 * 경기 끝 0xa7de8 이 더 얹는 기록 — 37~39 점수차 승과 28~31 완투 계열.
 *
 * 투수편은 **모드 3** 이라 0xa7de8 의 `모드 == 4 → 끝` 가지에 걸리지 않는다 →
 * 타자편과 달리 완투 계열이 실제로 나올 수 있다. 나머지 세 조건은 원본 그대로 본다:
 *   ① 사람 팀 승리 ② 사람이 이 경기에서 투구 코스를 한 번이라도 확정함(state+0x8c = 내가 공을 던짐)
 *   ③ 사람 팀 **현재** 투수가 잡은 아웃 == 3 × 치른 이닝 (연장 포함)
 * 피안타·볼넷·실점은 우리 팀 투수 **전체**가 내준 state+0x88·0x89·0x8a 를 쓴다 —
 * 원본도 팀 단위 칸이라 구원으로 올라온 경우엔 ③ 에서 먼저 걸러진다.
 *
 * 강판 뒤에는 `recordsAllowed` 가 닫히므로 이 둘도 들어오지 않는다 (0xa77f0 첫 게이트).
 */
function gameEndRecordIdsFor(progress: PitcherGameProgress): readonly number[] {
  if (!recordsAllowed(progress)) return progress.recordIds
  return [
    ...progress.recordIds,
    ...gameEndRecordIdsOf(progress.game.ourScore - progress.game.opponentScore),
    ...completeGameRecordIdsOf({
      mode: PITCHER_EDITION_MODE,
      won: progress.game.ourScore > progress.game.opponentScore,
      // state+0x8c 는 코스 확정(0x50e9c)에서만 1 이 된다 — 웹에서는 공을 한 번이라도 던졌는가
      pitchCourseConfirmed: progress.pitchCount > 0,
      // state[0x6b]+1 = 치른 이닝 전부 (연장이면 그만큼 늘어난다)
      inningsPlayed: progress.endedInningIndex + 1,
      outsRecorded: progress.record.outsRecorded,
      hitsAllowed: progress.teamHitsAllowed,
      walksAllowed: progress.teamWalksAllowed,
      runsAllowed: progress.teamRunsAllowed,
    }),
  ]
}

/** 기본 측 — 나만의리그 화면은 지금까지 늘 후공으로 돌려 왔다 (타자편과 같은 기본값) */
export const DEFAULT_PLAYER_SIDE: PlayerSide = PLAYER_SIDE_LAST_BAT
