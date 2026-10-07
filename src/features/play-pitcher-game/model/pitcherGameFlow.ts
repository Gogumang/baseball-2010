import { rollSimulatorInit } from '@/entities/game/model/simulatorInit'
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
import type { QuickAtBatBatter, QuickAtBatPitcher } from '@/entities/game/model/quickAtBat'
import {
  ACE_BATTER_ROSTER_SLOT,
  ACE_PITCHER_SLOT,
  aceBatterPlayerOf,
  gameAceBatterOf,
  gameAcePitcherOf,
  NO_GAME_ACES,
  withAceBatterLineup,
} from '@/features/play-game/model/gameAces'
import type { GameAcePitcher, GameAceSetup, GameTeamAces } from '@/features/play-game/model/gameAces'
import { aceAbilityAtLevel, aceLevelOf, aceLevelSlotOf } from '@/entities/mission/model/aceLevel'
import {
  PITCHERS_PER_TEAM,
  batterAt,
  teamBatters,
  teamPitchers,
  quickPitcherOf,
} from '@/entities/team/model/teamRoster'
import {
  changePitcherIfNeeded,
  drainQuickPitcher,
  startingMoundOf,
} from '@/entities/game/model/simulateHalfInning'
import type { HalfInningDefense, HalfInningMound } from '@/entities/game/model/simulateHalfInning'
import { pitcherAbilitySumOf, rosterPitcherRoleOf } from '@/entities/pitching/model/pitcherChange'
import { advanceRunners, runnerCountOf } from '@/entities/game/model/baseState'
import {
  recordLineupPlay,
  rosterLineupOf,
  rosterSlotAt,
  tryQuickCpuPinchHit,
} from '@/entities/game/model/quickLineup'
import type { QuickLineup } from '@/entities/game/model/quickLineup'
import type { BaseState } from '@/entities/game/model/baseState'
import {
  completeGameRecordIdsOf,
  gameEndRecordIdsOf,
  passesRecordTeamGate,
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
import type { StealBase } from '@/entities/fielding/model/stealStart'
import {
  arrivalApplicationOf,
  arrivesUnhit,
  pitchJudgementOf,
  rollCpuStealStart,
  runPitchArrivalPlay,
  type PitchArrivalPlay,
} from '@/features/defense-play/model/pitchArrivalPlay'
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
  ROTATION_SIZE,
  rotationSlotOf,
  startAssignmentOf,
  swapWithStarter,
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
import { FULL_STAMINA, staminaPercentOf } from '@/entities/pitcher-career/model/pitcherStamina'
import {
  cancelBurst,
  createBurstSession,
  resolveBurst,
  tryTriggerBurst,
} from '@/entities/burst-mission/model/burstMissionSession'
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
} from '@/entities/game/model/winLossSave'
import type { DecisionState, GameEndDecision, PitcherOfRecord } from '@/entities/game/model/winLossSave'
import { chargePitcherLine, outsAddedBetween } from '@/entities/game/model/gamePitcherLines'
import type { GameLeaguePitchers, GamePitcherLine } from '@/entities/game/model/gamePitcherLines'
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
import { rollHalfInningFielders } from '@/features/play-game/model/halfInningBoard'
import { rollBenchClearingEntry, rollBenchClearingTargets } from '@/features/play-game/model/benchClearingScene'
import { pitcherOfRecordNamesOf } from '@/features/play-game/model/gameDecisions'
import type { PitcherOfRecordNames } from '@/features/play-game/model/gameDecisions'
import { enterSceneConfirm } from '@/features/play-game/model/sceneConfirm'
import type { SceneConfirmWait } from '@/features/play-game/model/sceneConfirm'

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
 * 0x12 / 0x13       못 맞힌 공 / 맞은 공 — 타석이 끝나면 **돌발 결과 판정 0x8f414** (0x12 끝 · 0x17 끝)
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
/** 동료 투수 표지 = 이 값 − 로스터 칸 (교체가 생겨 우리 쪽 CPU 투수도 여럿이다) */
const TEAMMATE_PITCHER_NUMBER_BASE = -100
/** 상대 투수 표지 = 이 값 − 로스터 칸 */
const OPPONENT_PITCHER_NUMBER_BASE = -200

/**
 * **내 투수 줄의 웹 칸 번호.** 웹 로스터(`teamPitchers`, 팀마다 8명)에는 내 육성 투수가 없어 그 뒤 번호(8)를 붙인다 — 칸 번호일
 * 뿐 배열 자리가 아니다. 원본 배열 자리는 등록 0x10fb4 가 정한다(선발 0번 `[나, 1…7, 0]` · 구원 7번 `[0…6, 나, 7]` — 옛 그 칸
 * 선수는 맨 끝, 팀 투수 9명). 그 배열은 나리 팀 레코드가 들고(`ourPitcherOrder`), 날마다 0x1c46c 가 0↔k 맞바꿈·0~3 돌리기를
 * 영구로 한다 (`entities/pitcher-career/model/myPitcherRecord`). 벤치 차례로 드러난다: 교체 AI 의 "벤치 마지막"(0xac360)·
 * `0xabfcc` 동률·구원 갈래 최소 벤치 `r7`(0xc1c46).
 */
export const MY_PITCHER_SLOT = PITCHERS_PER_TEAM

/**
 * **우리 팀 마투수의 웹 칸 번호** — 원본은 `0xb521c` 가 목록 **8번 칸**에 넣고 옛 8번을 맨 끝으로 옮긴다. 웹은 번호 8 을 내 투수
 * (`MY_PITCHER_SLOT`)가 쓰고 있어 다른 번호(9)를 붙인다 — 목록 차례로는 원본대로 8번 자리에 앉는다(`ourPitcherOrderOf`). 상대 팀 마투수는 `ACE_PITCHER_SLOT`(8) 그대로다.
 */
export const OUR_ACE_PITCHER_SLOT = MY_PITCHER_SLOT + 1

/** 투수 목록에서 마투수가 끼는 자리 — `0xb521c` 의 8번 칸 */
const ACE_PITCHER_LIST_INDEX = 8

function teammatePitcherNumberOf(slot: number): number {
  return slot === MY_PITCHER_SLOT ? MY_PITCHER_NUMBER : TEAMMATE_PITCHER_NUMBER_BASE - slot
}

function opponentPitcherNumberOf(slot: number): number {
  return OPPONENT_PITCHER_NUMBER_BASE - slot
}

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

/**
 * `0xa56dc(R, 내 투수, …)` — 내 투수의 기록을 **셀 대상인가**. 모드 3 갈래(점프표 0xd8204[1] → 0xa571c)는
 * 시즌 객체 S(0x1fa2d)의 **+0xb4(포스트시즌)·+0x12c(국가대항전)가 둘 다 0** 일 때만 참이다
 * (그 다음 마선수 0xb633d 검사는 투수편 내 투수에게 늘 통과).
 *
 * 이 게이트가 거짓이면 원본은 아무것도 세지 않는다:
 *   - 사건 함수 0xa57f8 의 코드 0x14~0x1f (0xa5844~0xa585a) — R+0x124~+0x150: 피안타 0x12c · 탈삼진 0x134(+연속 0x14c) ·
 *     타자 수 0x138 · 아웃 0x13c · 볼넷 0x144 · 사구 0x148 · 등판 때 앞섬 0x150 ·
 *     (코드 0x20 R+0x154 삼자범퇴 이닝 · 0x21 R+0x158 은 이 게이트 밖이라 그대로 센다)
 *   - 정산 0xa8024 의 R+0x128 (0xa8f3c) · 레코드 +0x22 실점 (0xa8ef4) · +0x20 아웃 · +0x26 탈삼진 ([sp+0x38], 0xa8cb0·0xa8d00)
 * 웹 `seasonDelta` 의 아웃·탈삼진·실점은 이 R 칸에서 나오므로 함께 0 이 된다 (원본 +0x20·+0x26·+0x22 와 같다).
 *
 * ⚠️ 투수편 웹엔 국가대항전이 없어 포스트시즌만 본다. 또 웹은 45경기가 끝나면 곧장 시즌종료로 가서
 *    사람이 포스트시즌 경기를 던지지 않는다 — 지금은 닿지 않는 길이지만 원본대로 걸어 둔다.
 */
function countsMyPitcherRecord(progress: PitcherGameProgress): boolean {
  return !progress.options.isPostseason
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
  /**
   * 나리 연차 idx — 저장 레코드 `+0xb3` (0 = 1년차). 0xab214 의 내 투수 보너스 `aP = D[0x1dc] − D[0x1de] × idx`
   * (ab41c) 가 본다. 모드 3 의 레코드는 `0x1f8d4(저장, 3)` = `[저장+0xb8]+0x11c` 다.
   * ⚠️ 안 넘기면 0(1년차, 보너스 최대) — 옵션을 짜는 쪽(`pitcherGameOptions`)이 아직 안 넘긴다.
   */
  readonly careerYearIndex?: number
  /**
   * 상대 팀 **투수 레코드 차례** (`League.pitcherOrders`) — 0번이 선발, 나머지가 벤치 차례. 경기 준비 0x1c46c 가 g ≠ 0 이면
   * 상대 팀 레코드를 0xb8c80 → 0xb5ca8 로 한 칸 돌린 뒤의 차례를 넘긴다(포스트시즌은 `postseasonPitcherOrderOf`).
   * 안 넘기면 날짜 g 로 돈 4인 로테이션 — 첫 시즌 정규시즌에서만 원본과 같다.
   */
  readonly opponentPitcherOrder?: readonly number[]
  /**
   * **우리 팀 투수 배열** — 저장의 나리 팀 레코드(내 팀)가 든 차례, 142 진입이 오늘 준비(0x1b684 · 0xa4f60 맞바꿈 · 0xb8c80
   * 돌리기)를 넣은 뒤다 (`entities/pitcher-career/model/myPitcherRecord`). 내 투수 줄은 `MY_PITCHER_SLOT`. 마투수는 넣기 전.
   * 안 넘기면 보직·날짜 g 로 세운 예전 셈(`rosterOurPitcherOrderOf`).
   */
  readonly ourPitcherOrder?: readonly number[]
  /**
   * 양 팀 투수 칸(붙박이 표 칸 0~7)별 **레코드 스태미나** `+0x2c` — 리그 표에서 이어 온 값. 벤치 투수는 이 값으로 올라온다.
   * 우리 팀 표의 내 자리(`MY_PITCHER_SLOT`)는 `stamina` 가 든다. 안 넘기면 모두 10000.
   */
  readonly ourPitcherStaminas?: readonly number[]
  readonly opponentPitcherStaminas?: readonly number[]
  /**
   * 142 경기 준비 `0x1c46c`(1c62e~1c660)가 두 팀 명부에 넣은 마선수 — 마투수는 투수 목록 8번 칸(옛 8번은 맨 끝),
   * 마타자는 명단 9번(첫 벤치, 옛 9번은 맨 끝) (`features/play-game/model/gameAces`). 안 넘기면 아무도 안 싣는다.
   */
  readonly aces?: GameAceSetup
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
  /**
   * **상태 0xe 의 OK 대기** — 내가 던지는 타석의 0xe 진입마다 새 객체다 (`features/play-game/model/sceneConfirm`).
   * 진입에서 감독 강판(0x504cc)이 참이면 0x23 으로 빠져 기다리지 않는다(이 칸을 안 바꾼다). 화면이 OK 를 받을 때까지
   * 구질 고르기를 안 띄운다.
   */
  readonly sceneConfirm?: SceneConfirmWait | null
  /**
   * 0xe 에 서서 **OK 를 아직 안 받았다** — OK 뒤 굴림(메시지 1 의 돌발 0x8f158 · 0xf 진입 0x3d954 의 CPU 대타 0xac228)을
   * 아직 안 돌렸다. 화면이 OK 를 받으면 `confirmScene` 이 그때 돌린다. 그래서 0xe 에서 '#' 강판 물음(0x4994a)에 "예" 하면
   * 그 굴림은 아예 돌지 않는다(원본 차례). 없으면 거짓.
   */
  readonly sceneConfirmPending?: boolean
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
   * **이번 투구에 출발한 주자들의 루** — state[0x14 + 루]. 투수편은 늘 CPU 공격이라 투구마다 CPU 타자 결정(0x34334)
   * 바로 앞에서 `0x520de` 를 굴려 넣는다(`rollCpuStealStart`). 공이 도착하면(0x3dfac) 도루 판(종류 5)을 열거나
   * 지워지고, 인플레이 타구면 타구 판의 리드(0x3d7b8)가 이 칸을 본다.
   */
  readonly stealingFrom: readonly StealBase[]
  /**
   * **마지막으로 열린 공 도착 판** (0x3dfac — 종류 9 폭투·포일 · 종류 5 도루). 판정 콜을 고르는 데만 쓴다 —
   * 걸음 앞뒤가 다른 객체면 이번 걸음에 새로 열린 판이다. 재생은 `lastDefensePlay` 가 맡는다.
   */
  readonly lastArrivalPlay: PitchArrivalPlay | null
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
  /**
   * **벤치 클리어링 연출 중**(상태 0x1e). 내가 던진 공이 사구이고 20/99 굴림에 걸리면 진입(0x3a5f0)의 굴림 45 번까지
   * 쓰고 여기 사구 결과를 붙든 채 멈춘다 — 밀어내기 주루·정산·다음 타석은 화면이 연출을 끝내고
   * `resolveBenchClearing` 을 부를 때 비로소 돈다 (원본도 출구 0xae24c 뒤에야 0x17 로 간다).
   */
  readonly pendingBenchClearing: { readonly outcome: AtBatOutcome } | null
  /**
   * 마지막으로 **OK 를 기다리며 선** 공수 교대 판(상태 0x18 교대 가지) — 화면은 `serial` 이 바뀌면 판을 띄운다.
   * 모드 3 에서는 1회초 판(인트로 0xc 끝 → 0x18)만 설 수 있다 — `withHalfInningBoard` 머리말.
   */
  readonly halfInningBoard: { readonly serial: number; readonly inning: number; readonly half: GameState['half'] } | null
  /** 마지막으로 사람이 던진 타석의 반 이닝 — 반 이닝이 바뀐 뒤 첫 사람 타석인지 가린다 */
  readonly lastHumanHalf: { readonly inning: number; readonly half: GameState['half'] } | null
  /** 그 뒤로 자동(간이 엔진, 상태 0x21) 타석이 지났는가 — 지났으면 0x18 이 판 없이 넘어간다 (4fab6) */
  readonly autoSinceHuman: boolean
  readonly burst: BurstSession | null
  readonly lastBurstResolution: BurstResolution | null
  /**
   * **공 객체 +0x10** (경기+0xf98) — 공에 실린 마구 번호. 0x34d6c 투수 쪽 보정(구속·제구 +150~220 · B/C %)이 본다.
   * 상태 0x11 진입 `0x3de10` 만 쓴다 (H2 3-4): `구질 == 22 && 0xaea10(수비 팀) > 0` 이면 `+0x10 = 투수+0x18`.
   * 마구 횟수는 그보다 앞(코스 확정 0x50e9c)에서 줄어 **마지막 한 번(1 → 0)은 새로 안 싣는다**.
   * 되돌리는 곳이 없어 한 번 실린 번호는 경기 내내 직구·변화구에도 남는다 — 원본 그대로 옮긴다.
   */
  readonly ballMagicNumber: number
  /**
   * 상대 팀 명단(`team+0xe`)과 타순 칸별 이 경기 기록(`team+0x34 + 타순×0x18`) — **CPU 대타** `0xac228` 이 보고 바꾼다.
   * 기록은 내가 던진 타석이든 간이 엔진 타석이든 정산 `0xa8024` 가 똑같이 쌓는다.
   */
  readonly opponentLineup: QuickLineup
  /**
   * `state[0xe]` — 다음 공이 나가기 전까지 CPU 대타를 다시 묻지 않게 막는 칸. `0xac228`(ac33e)이 1 로 세우고
   * 공마다 투구 처리 `0xa5e14`(a5e7c — 사람 공 0x3dec6 · 간이 엔진 c26ca)와 새 타석 0xd 진입 `0x48d50`(48eb6,
   * 이전 상태가 0x16 이면 건너뜀)이 내린다 (a114d95).
   */
  readonly pinchHitUsed: boolean
  /**
   * 우리 팀 명단(`team+0xe`)과 타순 칸 기록 — 동료 타석은 모두 간이 엔진이라 `0xc1ba4` 의 CPU 대타(0xc1c50)가 **우리 팀**도 바꾼다
   * (모드 3 은 투수편 주인공이 타석에 안 서므로 아홉 칸 다 CPU 처럼 돈다).
   */
  readonly ourLineup: QuickLineup
  /**
   * 양 팀 마운드 — 지금 던지는 투수 칸과 그 스태미나(`+0x2c`)·투구 수(`+0x27c`)·실점 B(`+0x280`)·이미 내려간 투수·
   * `state[0xd]`(교체 직후). 자동 타석(0x21)마다 `0xc1ba4` 의 교체 AI `0xac428`(0xc1ce2)이 **수비 팀** 것을 바꾸고,
   * 투구마다 `0xa5e14` 가 깎는다 (c26ca). 칸 번호는 `ourPitcherOrderOf`·`opponentPitcherOrderOf` 의 로스터 칸이다.
   *
   * 우리 쪽은 내 투수가 마운드에 있으면 `MY_PITCHER_SLOT` 이다 — 그동안 내 스태미나·투구 수는 `stamina`·`pitchCount` 가 든다
   * (사람 장면은 이 칸을 안 본다). ⚠️ 투수 스태미나는 경기마다 가득에서 시작한다(원본은 시즌 레코드 +0x2c — 타자편 `gameFlow`
   * 와 같은 근사).
   */
  readonly ourMound: HalfInningMound
  readonly opponentMound: HalfInningMound
  /**
   * 양 팀 투수 칸(붙박이 표 칸 0~7)별 **레코드 스태미나** `+0x2c` — 벤치 투수는 이 값으로 올라오고 내려간 투수는 그 순간
   * 값을 남긴다. 지금 마운드 값은 `…Mound.stamina`, 내 값은 `stamina` 가 든다. 경기 끝 표는 `summaryOf` 가 낸다.
   */
  readonly ourPitcherStaminas: readonly number[]
  readonly opponentPitcherStaminas: readonly number[]
  /**
   * 이 경기를 던진 **CPU 투수** 줄 (`entities/game/model/gamePitcherLines`) — 내 투수(육성 선수)는 빼고 동료·상대 투수만.
   * 간이 타석마다 아웃·실점·삼진을 그 순간 마운드 투수에게 쌓고, 투구 수는 교체·경기 끝에 그 마운드의 `pitches` 를 얹는다.
   */
  readonly pitcherLines: readonly GamePitcherLine[]
  /** 우리·상대 지금 투수의 **이번 이닝 실점 A**(`+0x284`) — 반 이닝 교대 `0xa5b00`·교체 `0xaec64` 가 0 으로 */
  readonly ourInningRunsAllowed: number
  readonly opponentInningRunsAllowed: number
  /**
   * 사람 장면(0xf 진입 `0x3d954`)에서 지난 **CPU 대타** 한 번 — 화면이 "Time!" 22 와 들어온 타자 등판음(14/15/26)을
   * 내는 신호다 (`pages/team-game` 의 `pinchHitSoundIdsOf` 와 같은 모양). 간이 엔진 대타는 연출이 없어 안 바꾼다.
   */
  readonly scenePinchHit: { readonly serial: number; readonly by: 'CPU'; readonly incomingIsAce: boolean } | null
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

/** 날짜만큼 돈 4인 로테이션 (0xb8c80 → 0xb5ca8) — 0~3 칸은 `(g + i) % 4`, 4번 뒤는 그대로 */
function rotatedPitcherSlots(dayCounter: number): number[] {
  const first = rotationSlotOf(dayCounter)
  return Array.from({ length: PITCHERS_PER_TEAM }, (_unused, slot) =>
    slot < ROTATION_SIZE ? (first + slot) % ROTATION_SIZE : slot,
  )
}

/**
 * 오늘 **우리 팀 투수 목록**의 차례 — 0번이 선발이고 나머지가 그 차례대로 벤치다 (`0xb891c` 의 `team[i] = i`,
 * `0xb8b08(team, i)` = 벤치 i 번).
 *
 * 리그 경기는 레코드 차례(`options.ourPitcherOrder`)를 받는다. 안 넘긴 길의 예전 셈:
 * - 선발 보직: 등록 꼴 `[나, 1, …, 7, 0]` 위에서 `0xa4f60` 의 k 로 0↔k 를 맞바꾼다. 내 선발 날(g 짝수)은 맞바꿈이 되돌아와
 *   내가 0번이다 (레코드 차례와 같다).
 * - 그 밖(구원): 0~3 이 날마다 돌고(0xb8c80) 나는 끝 — 원본 등록 꼴(나 7번)과 다르다.
 */
export function ourPitcherOrderOf(options: PitcherGameOptions): number[] {
  const order = options.ourPitcherOrder === undefined ? rosterOurPitcherOrderOf(options) : [...options.ourPitcherOrder]
  // 142 가 명부 8번 칸에 마투수를 넣었으면 옛 8번(웹 목록 끝)은 맨 끝으로 밀린다 (0xb521c b527e~b528e)
  if (gameAcePitcherOf(teamAcesOf(options, true).pitcher, undefined) === undefined) return order
  return [...order.slice(0, ACE_PITCHER_LIST_INDEX), OUR_ACE_PITCHER_SLOT, ...order.slice(ACE_PITCHER_LIST_INDEX)]
}

/** 한 팀에 실린 마선수 번호 */
function teamAcesOf(options: PitcherGameOptions, isOurs: boolean): GameTeamAces {
  return (isOurs ? options.aces?.ours : options.aces?.opponent) ?? NO_GAME_ACES
}

/** 그 팀 명부의 마투수 — 레벨 배율 먹은 값. 없으면 undefined */
function teamAcePitcherOf(options: PitcherGameOptions, isOurs: boolean): GameAcePitcher | undefined {
  return gameAcePitcherOf(teamAcesOf(options, isOurs).pitcher, options.aces?.levels)
}

/** 그 팀 마투수의 웹 칸 번호 */
function acePitcherSlotOf(isOurs: boolean): number {
  return isOurs ? OUR_ACE_PITCHER_SLOT : ACE_PITCHER_SLOT
}

/** 로스터만으로 짠 우리 팀 투수 목록 (마투수 넣기 앞) */
function rosterOurPitcherOrderOf(options: PitcherGameOptions): number[] {
  const assignment = startAssignmentOf({
    mode: PITCHER_EDITION_MODE,
    dayCounter: options.dayCounter,
    role: options.role,
    isPostseason: options.isPostseason,
  })
  if (options.role !== PITCHER_ROLE.starter) return [...rotatedPitcherSlots(options.dayCounter), MY_PITCHER_SLOT]
  const seasonStart = [
    MY_PITCHER_SLOT,
    ...Array.from({ length: PITCHERS_PER_TEAM - 1 }, (_unused, slot) => slot + 1),
    0,
  ]
  return startsToday(options) || assignment < 1 ? seasonStart : swapWithStarter(seasonStart, assignment)
}

/**
 * 상대 팀 투수 목록 — 하루 한 칸씩 도는 4인 로테이션 (0xb8c80 → 0xb5ca8, S5 U-16). 0번이 오늘 선발이다.
 * 리그가 들고 다니는 차례(`options.opponentPitcherOrder`)가 있으면 그것이다.
 */
export function opponentPitcherOrderOf(options: PitcherGameOptions): readonly number[] {
  const order = options.opponentPitcherOrder ?? rotatedPitcherSlots(options.dayCounter)
  // 142 가 상대 명부 8번 칸(로스터 여덟 뒤 = 벤치 맨 끝)에 넣은 마투수 (0xb88c8)
  return teamAcePitcherOf(options, false) === undefined ? order : [...order, ACE_PITCHER_SLOT]
}

/** 칸별 레코드 스태미나 표 (붙박이 표 칸 0~7) — 빠진 칸은 10000 */
function staminaTableOf(given: readonly number[] | undefined): readonly number[] {
  return Array.from({ length: PITCHERS_PER_TEAM }, (_unused, slot) => given?.[slot] ?? FULL_STAMINA)
}

/** CPU 투수 줄 하나에 더한다 — 내 자리(표 밖, `MY_PITCHER_SLOT`)는 커리어가 따로 세므로 건너뛴다 */
function chargeCpuPitcherLine(
  lines: readonly GamePitcherLine[],
  teamId: number,
  pitcherSlot: number,
  delta: Parameters<typeof chargePitcherLine>[3],
): readonly GamePitcherLine[] {
  if (pitcherSlot < 0 || pitcherSlot >= PITCHERS_PER_TEAM) return lines
  return chargePitcherLine(lines, teamId, pitcherSlot, delta)
}

/** 내려간 투수의 +0x2c 를 표에 남긴다 — 내 자리(표 밖)는 `stamina` 가 들므로 건너뛴다 */
function withOutgoingStamina(table: readonly number[], outgoing: HalfInningMound): readonly number[] {
  if (outgoing.pitcherSlot < 0 || outgoing.pitcherSlot >= PITCHERS_PER_TEAM) return table
  return table.map((value, slot) => (slot === outgoing.pitcherSlot ? outgoing.stamina : value))
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
function opponentBatterAbility(options: PitcherGameOptions, rosterSlot: number) {
  // 142 가 상대 명단 9번에 넣은 마타자가 CPU 대타로 서면 그 레코드 — 0xb6415 첫 단계가 레벨 배율을 먹인다
  const ace = rosterSlot === ACE_BATTER_ROSTER_SLOT ? aceBatterAbilityOf(options) : undefined
  if (ace !== undefined) {
    return {
      hit: gameAbilityOf({ mode: PITCHER_EDITION_MODE, base: ace.hit, isPitcher: false, slot: BATTER_SLOT.히트, isMyTeam: false }),
      power: ace.power,
      defense: ace.defense,
      run: ace.run,
    }
  }
  const roster = teamBatters(options.opponentTeamId)
  const player = roster[rosterSlot % roster.length]
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

/**
 * **지금 상대 타자의 소개 판 재료** (상태 0xe 의 0x44944 — 타자 `0xae89c(공격 팀)`): 붙박이 표 칸이면 그 행의 이름·수비
 * `+0x1c & 0xf`·폼(`+0xb`, 손 0xb63c0 의 재료), 142 가 9번에 넣은 마타자면 이름과 마타자 순번. `rosterSlot` 은 리그 기록표 칸
 * (마타자면 null — 표에 칸이 없다).
 */
export function opponentBatterOf(progress: PitcherGameProgress): {
  readonly name?: string
  readonly position?: number
  readonly profile?: number
  readonly aceIndex?: number
  readonly rosterSlot: number | null
} {
  const rosterSlot = rosterSlotAt(progress.opponentLineup, progress.opponentOrderIndex)
  if (rosterSlot === ACE_BATTER_ROSTER_SLOT) {
    const index = teamAcesOf(progress.options, false).batter
    const player = aceBatterPlayerOf(index)
    return { ...(player === undefined ? {} : { name: player.name, aceIndex: index }), rosterSlot: null }
  }
  const roster = teamBatters(progress.options.opponentTeamId)
  const player = roster[rosterSlot % roster.length]
  if (player === undefined) return { rosterSlot }
  return {
    name: player.name,
    ...(player.position === undefined ? {} : { position: player.position }),
    profile: player.profile,
    rosterSlot: rosterSlot % roster.length,
  }
}

/** 내 마운드 스태미나 재료 — 공마다 깎는 셈(`drainStamina`)과 같은 칸 (소개 판 체력 막대 0x44ea0~) */
export function myMoundStaminaOf(progress: PitcherGameProgress): {
  readonly staminaAbility: number
  readonly teamMorale: number
  readonly isFirstPitcher: boolean
  readonly stamina: number
} {
  return {
    staminaAbility: progress.options.staminaAbility,
    teamMorale: progress.options.teamMorale,
    isFirstPitcher: startsToday(progress.options),
    stamina: progress.stamina,
  }
}

/** 상대 마타자의 레벨 배율 먹은 네 칸 (히트·파워·수비·주루) */
function aceBatterAbilityOf(options: PitcherGameOptions) {
  const index = teamAcesOf(options, false).batter
  const player = aceBatterPlayerOf(index)
  if (player === undefined) return undefined
  return aceAbilityAtLevel(player.ability, aceLevelOf(options.aces?.levels, aceLevelSlotOf('타자', index + 1)))
}

/** 간이 타석의 타자 — 명단 칸이 마타자 칸이면 142 가 넣은 마타자 */
function quickBatterOfTeam(options: PitcherGameOptions, isOurs: boolean, rosterSlot: number): QuickAtBatBatter {
  if (rosterSlot === ACE_BATTER_ROSTER_SLOT) {
    const ace = gameAceBatterOf(teamAcesOf(options, isOurs).batter, options.aces?.levels)
    if (ace !== undefined) return ace
  }
  return batterAt(isOurs ? options.ourTeamId : options.opponentTeamId, rosterSlot)
}

/* ── 시작 ────────────────────────────────────────────────────────────────────── */

export function startPitcherGame(
  options: PitcherGameOptions,
  random: RandomPort,
): PitcherGameProgress {
  const onMound = startsToday(options)
  const ourStarter = ourPitcherOrderOf(options)[0]
  const opponentStarter = opponentPitcherOrderOf(options)[0] ?? 0
  const ourStaminas = staminaTableOf(options.ourPitcherStaminas)
  const opponentStaminas = staminaTableOf(options.opponentPitcherStaminas)
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
    stealingFrom: [],
    lastArrivalPlay: null,
    pendingDefensePlay: null,
    pendingBenchClearing: null,
    halfInningBoard: null,
    lastHumanHalf: null,
    autoSinceHuman: false,
    // 경기 장면은 모드 2·3·4 일 때만 돌발 객체를 만든다 (0x48658)
    burst: createBurstSession(PITCHER_EDITION_MODE),
    lastBurstResolution: null,
    ballMagicNumber: 0,
    // 경기 시작 명단은 로스터 차례 그대로 — 앞 아홉이 타순, 나머지가 벤치 (team+0x28c)
    // 142 가 넣은 마타자는 첫 벤치 칸(9번)에 앉는다 — 타석에 서는 길은 CPU 대타(0xac228)뿐이다 (0xb8870)
    opponentLineup: withAceBatterLineup(
      rosterLineupOf(teamBatters(options.opponentTeamId).length),
      teamAcesOf(options, false).batter,
    ),
    pinchHitUsed: false,
    ourLineup: withAceBatterLineup(rosterLineupOf(teamBatters(options.ourTeamId).length), teamAcesOf(options, true).batter),
    // 오늘 0번이 마운드에 선다 — 선발 날이면 나다 (`ourPitcherOrderOf` 가 `startsToday` 와 같은 자리를 낸다)
    ourMound: startingMoundOf(
      ourStarter,
      ourStarter === MY_PITCHER_SLOT ? options.stamina : ourStaminas[ourStarter] ?? FULL_STAMINA,
    ),
    opponentMound: startingMoundOf(opponentStarter, opponentStaminas[opponentStarter] ?? FULL_STAMINA),
    ourPitcherStaminas: ourStaminas,
    opponentPitcherStaminas: opponentStaminas,
    pitcherLines: [],
    ourInningRunsAllowed: 0,
    opponentInningRunsAllowed: 0,
    scenePinchHit: null,
    log: [],
    nextLogId: 1,
    endedInningIndex: 0,
  }
  // 상태 9 갱신 0x3f584 의 공통 꼬리 0x3fa0e — 시뮬 초기화 0xc0dac 의 rand(0, 2) 한 번 (모든 모드, 1회초 판 0x18 보다 앞)
  rollSimulatorInit(random)
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
    // 벤치 클리어링 연출(0x1e)이 도는 동안도 0xf 로 안 돌아간다
    progress.pendingBenchClearing === null &&
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
  // 벤치 클리어링도 끼어들 사람이 없으면 100틱을 다 본 것으로 친다 — 틱 10 의 굴림 8 번까지 나간다
  if (started.pendingBenchClearing !== null) {
    return resolveBenchClearing(started, { reachedTargetTick: true }, random)
  }
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
  // 0x50e9c(코스 확정) 마구 소모 → 0x3de10(0x11 진입) 공+0x10 싣기 차례 — 소모 뒤 남은 > 0 일 때만 싣는다
  const magicRemaining = isMagic ? progress.magicRemaining - 1 : progress.magicRemaining
  const ballMagicNumber =
    isMagic && magicRemaining > 0 ? options.repertoire.magicNumber : progress.ballMagicNumber
  const builtPitch = buildHumanPitch(
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
  const pitch: Pitch = {
    ...builtPitch,
    // P+0x10 — 0x34d6c 투수 쪽 번호. 내 투수는 육성(비트7)이라 1~4 면 표 칸 n = 번호 − 1 (pitcherBoostSideOf)
    magicNumber: ballMagicNumber,
    // 던진 투수 레코드 +0x18
    pitcherMagicNumber: options.repertoire.magicNumber,
  }

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

  const batter = opponentBatterAbility(options, opponentRosterSlotOf(progress))
  // CPU 도루 0x520de — 상태 0x11 의 10번째 틱(0x537dc → 메시지 0x583)이라 실투 판정(0x4dea0) 뒤, CPU 타자 결정
  // (11번째 틱 0x34334) **바로 앞**이다. 후보가 있을 때만 rand(0,1000) 한 번 → 0xa9bd4 출발 (`rollCpuStealStart`)
  const stealingFrom = rollCpuStealStart(
    {
      bases: progress.game.bases,
      offenseIsCpu: true,
      runAbilityOf: (base) => runAbilitiesOnBaseOf(progress)[base] ?? 0,
    },
    random,
  )
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
    {
      isMistakePitch: isMistake,
      // 모드 3 — 0xab214 의 팀 조작 보정(−10)은 모드 3·4 밖에서만이라 안 붙는다
      swingMode: '나만의리그',
      // ab3d0 sp40 = (모드 == 3 || 4) · ab41c 0xb6389(투수) = 내 육성 투수 rec[0xa] 비트7
      isPitcherOwnPlayer: true,
      careerYearIndex: options.careerYearIndex ?? 0,
    },
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
    magicRemaining,
    ballMagicNumber,
    // 투구 처리 0xa5e14 가 공마다 state[0xe](CPU 대타 막음)를 내린다 (a5e7c)
    pinchHitUsed: false,
    // 같은 0xa5e14 의 a5e72 가 state[0xd](교체 직후)도 내린다 — 두 팀 공용 한 칸이다
    ...withMoundsPitched(progress),
    pitchCount: progress.pitchCount + 1,
    // ctx+0x161 · ctx+0x16c — 투구 처리 0xa5e14 가 공 하나마다 둘 다 올린다
    atBatPitches: progress.atBatPitches + 1,
    halfInningPitches: progress.halfInningPitches + 1,
    // R+0x158 — t == 5 로 던진 공. 마구는 늘 5 라 함께 센다
    pitcherRecord: recordPitchGrade(progress.pitcherRecord, grade),
    lastPitch: pitch,
    lastResolution: resolution,
    atBat: applyPitchResolution(progress.atBat, resolution),
    stealingFrom,
  }

  // 공 도착 0x3dfac — 못 맞힌 공이면 0.1% 폭투·포일(종류 9)이나 CPU 가 건 도루(종류 5) 판을 연다
  const arrival = arrivePitcherPitch(afterPitch, { resolution, outcomeAfter: afterPitch.atBat.outcome }, random)
  // 판에서 반 이닝·경기가 끝났다 — 이 타석은 끊긴다 (판정 B 0xae3e8: 아웃 > 2 → 0x18)
  if (arrival.interrupted) return advance(arrival.progress, random)
  const arrived = arrival.progress
  const outcome = arrived.atBat.outcome
  // 볼·스트라이크·파울 — 판정 A 0xae24c 의 "그 밖 → 0xf" 라 다음 공을 고르기 전에 0xf 진입 0x3d954 를 다시 지난다
  if (outcome === null) return enterPitchSelection(arrived, random)
  if (isBattedBallInPlay(outcome)) {
    // 여기서 멈춘다 — 화면이 이 타구를 실시간으로 돌리고 결과를 `resolveDefensePlay` 에 넘긴다.
    // `atBat` 은 아직 안 비웠으므로 끝난 타석의 결과 코드·볼 카운트가 그대로 남아 있다.
    // 출발 칸은 타구 판 입력(리드 0x3d7b8)이 읽고 나면 비운다
    return { ...withoutSteal(arrived), pendingDefensePlay: defensePlayInputOf(arrived, outcome, random) }
  }
  // 낫아웃 — 폭투·포일 판의 진루(타자주자 포함)를 이 삼진 타석의 진루로 먹인다 (0x3e0d0 state[0x1a]).
  // 삼진 기록(0xa7c4c)은 그대로 남는다 — `applyDefensivePlay` 의 보통 삼진 길을 판의 결과로 지난다
  const play = arrival.play
  if (play !== null && arrivalApplicationOf(play) === 'batterRuns') {
    return advance(applyDefensivePlay(arrived, outcome, true, arrived.atBat.balls, play.result, play.result), random)
  }
  // 사구면 상태 0x12 끝(0x4e74c)에서 벤치 클리어링을 굴린다 — 밀어내기 주루(0x17)·정산 0xa8024 보다 앞이다
  const settled = withPitcherBenchClearing(arrived, outcome, random)
  if (settled !== arrived) {
    // 들어갔다 — 진입 0x3a5f0 이 공격 9명을 흩뿌리며 45 번 굴리고, 연출이 끝날 때까지 붙든다
    rollBenchClearingEntry(random)
    return { ...settled, pendingBenchClearing: { outcome } }
  }
  return finishNonPlayOutcome(settled, outcome, random)
}

/** 공 도착 한 걸음의 결과 */
interface PitcherPitchArrival {
  readonly progress: PitcherGameProgress
  /** 열린 주자 판 (종류 9 폭투·포일 · 종류 5 도루). 없으면 null */
  readonly play: PitchArrivalPlay | null
  /** 판에서 반 이닝·경기가 끝나 이 타석이 끊겼다 — 타석 결과를 먹이지 말고 `advance` 로 다음 타석을 세운다 */
  readonly interrupted: boolean
}

/**
 * **공 도착** — 상태 0x12 진입 `0x3dfac` (`features/defense-play/model/pitchArrivalPlay`). 타자편 `gameFlow.arrivePitch`
 * · 팀 경기 `arriveTeamPitch` 와 같은 길이다. 투수편은 늘 내가 수비다.
 *
 * - 맞힌 공(파울·타구)은 0x3dfac 를 안 지난다. 파울이면 출발이 풀리고, 타구면 출발 칸을 타구 판 입력이 읽는다.
 * - 못 맞힌 공: `rollPassedBall` 1번 → 종류 9 / 종류 5 / 없음. 판이 열리면 그 advance 를 견제와 같은 주자 판
 *   (`withMyRunnerPlay`, 타순 그대로)으로 먹이고 재생 칸에 넣는다. 낫아웃(종류 9 + 삼진 + 타자주자)은 여기서 안 먹이고
 *   `startPitch` 가 `applyDefensivePlay(…, result, result)` 로 삼진 타석의 진루로 먹인다.
 * - 정산: 도루(5)는 늘, 폭투·포일(9)은 삼진이 그대로 선 판만 0xa8024 를 지난다(`withMyRunnerPlay` 의 `settles`).
 * - 기록: 도루 판의 24(도루 저지)만 0xa77f0 게이트를 지난다(사람 수비) — 8(도루)은 버려진다.
 * - 판은 **송구 키 없이 미리 다 돌린다**(견제 `pickoff` 와 같은 근사).
 *   ⚠️ 원본은 상태 0x17 동안 사람이 송구 키(0x533c8)를 누를 수 있다 — 키 송구 루(+0x160)는 안 받는다(미해결).
 *
 * ⚠️ 근사: 루에 선 주자 = 상대 타순 1·2·3칸 앞 타자(`runAbilitiesOnBaseOf`).
 * ⚠️ 미해결: 삼진 + 도루(종류 5)면 원본 판정 B 는 정산 0xa8024 를 **종류 5 로 한 번** 부른다 — R+0x138(타자 수)이
 *   안 오르는 갈래다(0xa8d98). 웹은 주자 판 뒤 보통 삼진 길(`applyDefensivePlay`)로 타자 수를 센다.
 * ⚠️ 미해결: CPU 타자의 번트 종류(scene+0xfdc)는 `simulateBatter` 가 밖으로 안 내 판에 못 싣는다.
 *
 * 난수: `rollPassedBall` 1번(매 못 맞힌 공) → 판이 열리면 그 안의 굴림 (`runPitchArrivalPlay`).
 */
function arrivePitcherPitch(
  progress: PitcherGameProgress,
  pitch: { readonly resolution: PitchResolution; readonly outcomeAfter: AtBatOutcome | null },
  random: RandomPort,
): PitcherPitchArrival {
  if (!arrivesUnhit(pitch.resolution)) {
    const next = pitch.resolution.kind === '타구' ? progress : withoutSteal(progress)
    return { progress: next, play: null, interrupted: false }
  }
  const before = progress.game
  const play = runPitchArrivalPlay(
    {
      gameMode: PITCHER_EDITION_MODE,
      pitchJudgement: pitchJudgementOf(pitch.resolution, pitch.outcomeAfter),
      stealingFrom: progress.stealingFrom,
      bases: before.bases,
      outs: before.outs,
      // 수비 아홉 칸은 우리 팀, 칸 0 은 나 — 타구 진행기(`defensePlayInputOf`)와 같은 원본 버그(칸 0 은 변화)까지 그대로
      defenseAbilities: myDefenseAbilitiesOf(progress),
      runAbilities: runAbilitiesOnBaseOf(progress),
      defenseIsCpu: false,
      // 공격이 CPU 라 늘 자동 진루, 송구만 환경설정이 먹는다 (0xae6c8 의 첫 항이 거짓) — 원본 기본값은 수동
      offenseIsCpu: true,
      throwMode: progress.options.throwModeManual === false ? '자동' : '수동',
    },
    random,
  )
  const cleared = withoutSteal(progress)
  if (play === null) return { progress: cleared, play: null, interrupted: false }
  const opened: PitcherGameProgress = { ...cleared, lastArrivalPlay: play }
  if (arrivalApplicationOf(play) === 'batterRuns') return { progress: opened, play, interrupted: false }

  const settles = play.kind === 5 || play.strikeout === 'strikeoutStands'
  let next = withMyRunnerPlay(opened, play.result, settles).progress
  // 0xa77f0 — 24(도루 저지)는 수비 계열이라 사람 수비에서 지난다. 8(도루)은 공격 계열이라 버려진다
  const recordIds = play.recordIds.filter((id) => passesRecordTeamGate(id, { offenseIsHuman: false, defenseIsHuman: true }))
  if (recordIds.length > 0 && recordsAllowed(next)) next = { ...next, recordIds: [...next.recordIds, ...recordIds] }
  next = appendLog(next, `${before.inning}회${before.half} ${describeArrivalPlay(play)}`, true)
  const interrupted =
    next.game.isFinished || next.game.inning !== before.inning || next.game.half !== before.half
  return { progress: next, play, interrupted }
}

function describeArrivalPlay(play: PitchArrivalPlay): string {
  const runs = play.result.advance.runsScored
  const tail = runs > 0 ? ` (${runs}실점)` : ''
  if (play.kind === 9) return `폭투·포일${tail}`
  if (play.result.caughtFrom.length > 0) return `상대 도루 실패 — 아웃${tail}`
  if (play.result.stolenFrom.length > 0) return `상대 도루 성공${tail}`
  return `상대 도루${tail}`
}

function withoutSteal(progress: PitcherGameProgress): PitcherGameProgress {
  return progress.stealingFrom.length === 0 ? progress : { ...progress, stealingFrom: [] }
}

/** 수비 아홉 칸 — 우리 팀, 칸 0 은 나(⚠️ 원본 그대로 능력치 칸 2 를 읽어 투수 레코드에서는 **변화**) */
function myDefenseAbilitiesOf(progress: PitcherGameProgress): readonly number[] {
  return defenseAbilitiesOf(
    teamBatters(progress.options.ourTeamId).map((player) => ({
      position: player.position,
      defense: player.ability[2],
    })),
    progress.options.stats.breaking,
  )
}

/**
 * 루별 주자 주루 — 0 은 지금 타자(낫아웃 타자주자).
 * ⚠️ **근사**: 웹 `GameState` 는 루에 선 주자가 누구인지 모른다 — 1루 = 직전 타자 · 2루 = 그 앞 · 3루 = 그 앞으로
 * 상대 타순을 거꾸로 센다 (타자편 `gameFlow`·팀 경기와 같은 근사). 대타가 들어온 칸은 지금 그 칸의 로스터 선수다.
 */
function runAbilitiesOnBaseOf(progress: PitcherGameProgress): Partial<Record<0 | 1 | 2 | 3, number>> {
  const runOf = (slotsBack: number) => {
    const slot = (((progress.opponentOrderIndex - slotsBack) % BATTING_ORDER_SIZE) + BATTING_ORDER_SIZE) % BATTING_ORDER_SIZE
    return opponentBatterAbility(progress.options, rosterSlotAt(progress.opponentLineup, slot)).run
  }
  return { 0: runOf(0), 1: runOf(1), 2: runOf(2), 3: runOf(3) }
}

/** 인플레이가 아닌 타석 끝(삼진·볼넷·사구·홈런) — 0xae24c 의 보통 길 뒤 0x17(밀어내기)·정산 0xa8024 */
function finishNonPlayOutcome(
  progress: PitcherGameProgress,
  outcome: AtBatOutcome,
  random: RandomPort,
): PitcherGameProgress {
  // 내가 던진 타석이면 홈런도 날아가는 그림을 보여 준다 — 득점·주자는 아래 길이 그대로 정한다
  const playback = homeRunPlaybackOf({ outcome, bases: progress.game.bases })
  return advance(
    applyDefensivePlay(progress, outcome, true, progress.atBat.balls, null, playback),
    random,
  )
}

/**
 * **벤치 클리어링 연출이 끝났다** — 출구 0xae24c (100틱 뒤 화면 전환이 끝났거나 OK·'5' 로 건너뜀).
 *
 * `reachedTargetTick` = 틱 10 의 갱신(0x401d4)이 돌았는가. 돌았으면 그때 수비 8명 목표를 굴린 8 번이 나갔다
 * (`features/play-game/model/benchClearingScene` 머리말) — 화면은 굴림을 직접 하지 않고 여기로 알린다.
 * 그 뒤 사구는 보통 길 그대로다(밀어내기 주루·R+0x148 사구 칸·다음 타석).
 */
export function resolveBenchClearing(
  progress: PitcherGameProgress,
  scene: { readonly reachedTargetTick: boolean },
  random: RandomPort,
): PitcherGameProgress {
  const pending = progress.pendingBenchClearing
  if (pending === null) return progress
  if (scene.reachedTargetTick) rollBenchClearingTargets(random)
  return finishNonPlayOutcome({ ...progress, pendingBenchClearing: null }, pending.outcome, random)
}

/**
 * **사구 뒤 벤치 클리어링** (`entities/game/model/benchClearing`, R10 6절) — 내가 던진 공이라 수비는 사람(나)이다.
 * 들어가면 0x3ab7c `0xaeab0(수비 팀, 1000)` — 지금 마운드의 내 스태미나(+0x2c) −1000, [0, 10000] 로 자른다.
 * 시즌 평판 S[1](0xa755c(ctx, 1), 0x3ab92)도 부르지만 그 게이트는 **모드 2(시즌)** 만 적으므로 투수편(모드 3)에서는
 * 아무것도 안 남는다. 홈런더비가 아니라 사구면 늘 한 번 굴린다 — **사구 타석만 난수를 하나 더 쓴다.**
 * 들어가면 부르는 쪽이 연출(상태 0x1e)을 붙든다 — `startPitch` · `resolveBenchClearing`.
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
 * - 사람 경기의 CPU 도루(0x520de)는 공이 나는 동안(상태 0x11)에만 걸리고 견제는 상태 0xf 에서만 들어와 겹치지
 *   않는다(Q1 3b). 견제사·진루는 판 시작 리드(0x3d7b8, 3370bf0)로 루를 떠난 주자에게서 난다.
 * - 진루·아웃·실점은 `withMyRunnerPlay`(도루·폭투 판과 같은 먹이기)로 먹인다. 0xa8024 의 나머지 기록 칸
 *   (투수 아웃 수·돌발 판정 등)이 견제 판에서 어떻게 도는지는 **미해결**이라 손대지 않는다.
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
    runAbility: opponentBatterAbility(progress.options, opponentRosterSlotOf(progress)).run,
    random,
    offenseIsCpu: true,
    // 사람이 수비한다 — 0xae6c8 은 환경설정 "송구"(+0xf4) 혼자가 받은 야수의 0xafa60 을 켠다 (타구 진행기와 같은 배선)
    defenseIsCpu: false,
    throwMode: progress.options.throwModeManual === false ? '자동' : '수동',
  })

  // 0xa8d98 — 종류 4 는 R+0x138 을 안 올린다 (그대로 돌려받는다)
  const faced: PitcherGameProgress = {
    ...progress,
    pitcherRecord: countsMyPitcherRecord(progress)
      ? recordBatterFaced(progress.pitcherRecord, PICKOFF_PLAY_KIND)
      : progress.pitcherRecord,
  }
  // 견제도 정산 0xa8024 를 지난다(I 4a-3) — 들어온 주자는 주자 운명으로 센다
  const applied = withMyRunnerPlay(faced, result, true)
  const { changed } = applied
  const advanceResult = result.advance
  const before = progress.game
  let next = applied.progress
  const call = result.resultCode === PICKOFF_RESULT.OUT ? '견제사' : result.errantThrow ? '악송구' : '세이프'
  next = appendLog(
    next,
    `${before.inning}회${before.half} ${play.targetBase}루 견제 — ${call}${
      advanceResult.runsScored > 0 ? ` (${advanceResult.runsScored}실점)` : ''
    }`,
    true,
  )
  // 반 이닝이 끝났으면(위에서 atBatPrepared 를 내렸다) 다음 사람 타석은 `advance` 가 새로 준비한다 —
  // 0xf 진입도 그 안에서 한 번 돈다
  if (!next.atBatPrepared) return advance(next, random)
  // 같은 타석이 이어지면 견제 판 끝(판정 B 0xae3e8 의 ae592)도 0xf 로 간다 — 0xf 진입 0x3d954 를 지난다
  return enterPitchSelection(changed ? advance(next, random) : next, random)
}

/**
 * **주자만 움직인 판**(견제 종류 4 · 도루 종류 5 · 폭투·포일 종류 9)을 경기 상태에 먹인다 — 내가 던지는 타석이라
 * 수비는 나다. 타순 커서는 그대로(`applyOpponentRunnerPlay`), 재생 칸(`lastDefensePlay`)에 판을 넣는다.
 *
 * - 득점마다 0xa5c34 가 승·패·세이브 칸을 고친다(`applyRunScoredFor`) · 이닝 실점 · 팀 실점.
 * - `settles` — 판 끝 판정 B 0xae3e8 이 정산 0xa8024 를 부르는가. 부르면 들어온 주자를 주자 운명으로 내 투수
 *   R+0x128 · +0x22 에 센다(`chargedRunsOfFates`). 견제(4)·도루(5)는 0xd·0xf 어느 쪽이든 0xae5a8 에서 부르고,
 *   폭투·포일(9)은 `state[0xc] == 5`(삼진) 일 때만 0xd 로 가며 부른다 — 아니면 ae5a2 → ae5b6 으로 **건너뛴다**.
 * - 반 이닝이 넘어갔으면 이닝 칸·삼자범퇴 표시·반 이닝 투구 수·볼카운트·타석 준비를 내린다 — 다음 타석은 `advance` 가 세운다.
 *
 * ⚠️ 미해결: 정산 0xa8024 의 나머지 기록 칸(투수 아웃 수 R+0x13c·돌발 판정 등)이 주자 판에서 어떻게 도는지는 손대지 않았다.
 */
function withMyRunnerPlay(
  progress: PitcherGameProgress,
  result: DefensePlayResult,
  settles: boolean,
): { readonly progress: PitcherGameProgress; readonly changed: boolean } {
  const before = progress.game
  const bases = before.bases
  const advanceResult = result.advance
  const changed =
    advanceResult.outsAdded > 0 ||
    advanceResult.runsScored > 0 ||
    advanceResult.bases.first !== bases.first ||
    advanceResult.bases.second !== bases.second ||
    advanceResult.bases.third !== bases.third
  let next: PitcherGameProgress = { ...progress, lastDefensePlay: result }
  if (!changed) return { progress: next, changed }
  const applied = applyOpponentRunnerPlay(before, progress.opponentOrderIndex, advanceResult)
  let decision = progress.decision
  for (let run = 1; run <= applied.runsScored; run += 1) {
    decision = applyRunScoredFor(progress, decision, run, true)
  }
  const halfChanged = applied.game.half !== before.half || applied.game.inning !== before.inning
  // 포스트시즌이면 0xa56dc 가 거짓이라 R+0x128 · +0x22 를 안 센다 (`countsMyPitcherRecord`).
  // 내가 마운드에 있을 때만이라 들어온 주자는 모두 내가 내보낸 주자다 (R+0x128 · +0x22)
  const charged =
    settles && countsMyPitcherRecord(progress)
      ? chargedRunsOfFates(result.runnerFates, before.outs + advanceResult.outsAdded)
      : 0
  next = {
    ...next,
    game: applied.game,
    decision,
    inningRuns: addInningRuns(progress.inningRuns, before.inning, applied.runsScored),
    runsAllowedByMe: progress.runsAllowedByMe + charged,
    record: {
      ...progress.record,
      runsAllowedField: progress.record.runsAllowedField + charged,
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
  return { progress: next, changed }
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
    // CPU 가 공이 나는 동안 건 도루 — 판 시작 리드(0x3d7b8)가 다음 루로 몰아 돌린다
    stealingFrom: progress.stealingFrom,
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
    runAbility: opponentBatterAbility(progress.options, opponentRosterSlotOf(progress)).run,
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
   *
   * 포스트시즌이면 0xa56dc 가 거짓이라 R+0x128 · +0x22 와 0xa57f8 의 R 칸(코드 0x14~0x1f)을 하나도 안 센다
   * (`countsMyPitcherRecord`). 남겨 둔 주자 수(`inheritedRunners`)의 장부는 그대로 줄인다 — 세는 일만 막힌다.
   */
  const chargedToMe = mine
    ? chargedRunsOfMyPlay(before.bases, outcome, defensePlay, before.outs + applied.outsAdded, applied.runsScored)
    : Math.min(applied.runsScored, progress.inheritedRunners)
  const inheritedRunners =
    mine || inningEnded
      ? 0
      : Math.min(progress.inheritedRunners - chargedToMe, runnerCountOf(applied.game.bases))

  const counts = countsMyPitcherRecord(progress)
  const playedRecord: PitcherEvaluationRecord = !mine
    ? progress.record
    : !counts
      // 게이트 밖인 코드 0x20(R+0x154 삼자범퇴 이닝)만 센다
      ? { ...progress.record, perfectInnings: progress.record.perfectInnings + (inningEnded && perfectInningFlag ? 1 : 0) }
      : {
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
  const chargedCounted = counts ? chargedToMe : 0
  const record: PitcherEvaluationRecord =
    chargedCounted > 0
      ? { ...playedRecord, runsAllowedField: playedRecord.runsAllowedField + chargedCounted }
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
    pitcherRecord: mine && counts ? pitcherRecordAfterPlay(progress.pitcherRecord, hitByPitch) : progress.pitcherRecord,
    runsAllowedByMe: progress.runsAllowedByMe + chargedCounted,
    inheritedRunners,
    teamHitsAllowed: progress.teamHitsAllowed + (hit ? 1 : 0),
    teamWalksAllowed: progress.teamWalksAllowed + (freePass ? 1 : 0),
    teamRunsAllowed: progress.teamRunsAllowed + applied.runsScored,
    perfectInningFlag,
    // 정산 0xa8024 — 타순 칸 기록(타석 +0x14 · 안타 +0x12 · 홈런 +0x13)이 CPU 대타 0xac228 의 재료다
    opponentLineup: recordLineupPlay(progress.opponentLineup, slot, outcome),
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

  // 0x8f414 는 사람 장면의 타석 끝(0x12 갱신 0x4e6d4 · 0x17 끝 0x528b0)에서만 돈다 — 내가 던진 타석만.
  // 내가 마운드에 없는 타석은 간이 엔진(0x21)이라 판정이 없다 (`triggerBurstAtPrep` 머리말)
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
          : teammatePitcherNumberOf(progress.ourMound.pitcherSlot)
        : opponentPitcherNumberOf(progress.opponentMound.pitcherSlot),
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
    // 우리 공격 중에도 우리 "지금 투수" 는 우리 마운드에 선 투수다 — 내가 마운드에 있으면 나 (0xa5c34 는 측의 현재 투수를 적는다)
    moundPitcherOf: (side) =>
      side === ourSide
        ? progress.onMound
          ? MY_PITCHER_NUMBER
          : teammatePitcherNumberOf(progress.ourMound.pitcherSlot)
        : opponentPitcherNumberOf(progress.opponentMound.pitcherSlot),
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
 * 타석 준비 — 상태 0xe 진입 0x50674 의 **감독 강판 판정**. 강판되면 0x23 으로 빠져 기다리지 않는다.
 * 아니면 0xe 에 서서 사람 OK 를 기다린다 — 돌발 발동 판정(0xe → 0xf 의 메시지 1)과 0xf 진입은 OK 뒤다 (`confirmScene`).
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

  // 강판이 아니면 0xe 에 머물러 사람 OK 를 기다린다 (0x532b0) — 그 뒤가 메시지 1 의 돌발 굴림이다
  return {
    ...progress,
    sceneConfirm: enterSceneConfirm(),
    sceneConfirmPending: true,
    hookFlags: hook.flags,
    atBatPrepared: true,
  }
}

/**
 * **상태 0xe 의 OK** — 사람 조작 0x532b0 의 OK → 메시지 1 → `0x50c18`: 0xf 예약 · 돌발 0x8f158 → (다음 틱) 0xf 진입
 * 0x3d954(CPU 대타 0xac228). 대타가 나면 0x16 → 0xd → 0xe(강판 판정 다시)로 다시 서서 OK 를 또 기다린다.
 * 0xe 에 서 있지 않으면 아무 일도 없다.
 */
export function confirmScene(progress: PitcherGameProgress, random: RandomPort): PitcherGameProgress {
  if (progress.sceneConfirmPending !== true) return progress
  const confirmed = { ...progress, sceneConfirmPending: false }
  if (confirmed.game.isFinished || !isPitchTurn(confirmed)) return confirmed
  return enterPitchSelection(triggerBurstAtPrep(confirmed, random), random)
}

/**
 * 상태 0xf(타석 준비)의 **돌발 발동 판정** (0x8f158).
 *
 * ## 굴리는 타석은 **내가 던지는 타석뿐** (2026-10-05 디스어셈 전수)
 * 0x8f158 을 부르는 곳은 메시지 1 "확인" 의 인자 0xe 갈래 한 곳(리터럴 0x50d8c ← 0x50c42)뿐이다 — 상태 0xe → 0xf.
 * 판정 0x8f414 도 사람 장면의 두 자리(0x12 갱신 0x4e6d4 · 0x17 끝 0x528b0)뿐이고, 간이 엔진 0xc262c · 0x21 갱신
 * 0x48480 의 호출 그래프에는 둘 다 없다. 모드 3 의 사람 장면 판정 0xc1e04 → 점프표 0xd90c0 칸 2 = 0xc1eac:
 * ```
 * 공격 팀이 사람 팀(st[0x31+st[9]] == 0) → 1 (자동)          ; 동료 타석은 늘 0x21
 * 아니면 0xc1d38 — 수비 팀 지금 투수가 0xb6389 내 선수인가 → 참 0 (사람) · 거짓 1 (자동)
 * ```
 * 그래서 동료 타석·내가 마운드에 없는 수비 타석(구원 대기·선발 아닌 날·강판 뒤)은 모두 0x21 이라 굴리지 않는다.
 * 타석 끝(0x4e7ae · 0x528b0 → 0x35108 → 0x350d4)도 다음이 자동이면 다음 상태를 0x21 로 덮는다.
 * ⚠️ 예전 웹은 K 4절 1-6 "매 타석 시작 때" 를 동료·수비 자동 타석까지로 읽어 거기서도 굴렸다 — 원본에 없는 굴림이었다.
 * 남은 돌발은 자동 타석 앞(0x21 진입 0x3abf0 · 0x18 진입 0x3ac90 의 0x8f628)에서 내린다 (`withoutPendingBurst`).
 */
function triggerBurstAtPrep(progress: PitcherGameProgress, random: RandomPort): PitcherGameProgress {
  const session = progress.burst
  if (session === null || progress.simpleEngineRunning) return progress
  const log = progress.opponentBatterLogs[progress.opponentOrderIndex] ?? { hits: 0, homeRuns: 0 }
  const next = tryTriggerBurst(
    session,
    {
      // 투수편 XlsPITCHER_BURST 44행의 목표는 전부 아웃 계열이라 사람 팀 공격 갈래가 따로 없다
      // (표를 가르는 것은 시즌 모드뿐 — 0x8f000). 내가 던지는 타석은 늘 상대 공격이다
      isHumanTeamBatting: false,
      bases: progress.game.bases,
      outs: progress.game.outs,
      // 원본 이닝은 0-기준이다 (game+0x6b)
      inning: progress.game.inning - 1,
      ourScore: progress.game.ourScore,
      opponentScore: progress.game.opponentScore,
      opponentBattingSlot: progress.opponentOrderIndex,
      // b0 마타자 행(0xae89d → 0xb633d) — 142 가 상대 명단에 넣은 마타자가 대타로 지금 타석에 섰으면 그 선수.
      // 마투수 행(0xae83d)은 마운드 투수를 보는데, 내가 던지는 타석의 마운드는 나라 걸리지 않는다
      opponentAceBatterId:
        opponentRosterSlotOf(progress) === ACE_BATTER_ROSTER_SLOT
          ? (aceBatterPlayerOf(teamAcesOf(progress.options, false).batter)?.id ?? null)
          : null,
      opponentAcePitcherId: null,
      hitsInGame: log.hits,
      homeRunsInGame: log.homeRuns,
      strikeoutsInGame: progress.record.strikeouts,
    },
    random,
  )
  return next === session ? progress : { ...progress, burst: next }
}

/* ── 0xf 진입 · CPU 대타 ─────────────────────────────────────────────────────── */

/** 지금 상대 타순 칸에 선 선수의 로스터 칸 — CPU 대타가 들어오면 타순 칸과 갈린다 */
function opponentRosterSlotOf(progress: PitcherGameProgress): number {
  return rosterSlotAt(progress.opponentLineup, progress.opponentOrderIndex)
}

/**
 * **상태 0xf 진입 `0x3d954`** — 내가 던지는 타석에서 공 하나를 고르기 전마다 돈다 (디스어셈 3d9e4~3da94).
 * ```
 * 3d9e4  수비 팀이 CPU 인가 (state[0x31 + state[0xa]] == 1) — 모드 3 의 내 팀은 사람 팀(0x3a20a)이라 거짓
 * 3da44  돌발 객체가 있고 진행 중(0x8eb94 = obj+0xc ≠ −1)이면 건너뜀
 * 3da70  r0 = 0xac228(…, 공격 팀, 주자관리, state)       ; CPU 대타 — 0x66864 가드는 투수 교체 갈래에만 있다
 * 3da74  r0 참 → 22 "Time!"(3da88) · 상태 0x16 예약(3da94)
 * ```
 * 0x16 → 0xd(이전 상태 0x16 이라 카운트·타석 초기화·state[0xe] 지우기를 건너뜀, 48e94) → **0xe 진입 0x50674**
 * (감독 강판 0x504cc 를 다시 판정, 506ea) → OK 를 기다린다 → (`confirmScene`) 메시지 1 → 0xf 예약 · **돌발 0x8f158 을
 * 다시** → 0xf 진입. 그때는 state[0xe] 가 서 있어 대타 판정이 굴림 없이 빠진다 (팀 경기 `enterPitchSelection` 과 같은 차례).
 *
 * 0xf 로 들어서는 길은 새 타석의 0xe 확인(`advance`), 볼·스트라이크·파울 뒤(판정 A 0xae24c, `startPitch`), 견제 판 끝
 * (판정 B 0xae3e8 의 ae592, `pickoff`)이다 — 그래서 공마다 카운트를 실은 채로 다시 묻는다
 * (카운트가 있으면 확률이 `>> (볼 + 스트라이크 + 1)` 로 준다, `judgeCpuPinchHit`).
 */
function enterPitchSelection(progress: PitcherGameProgress, random: RandomPort): PitcherGameProgress {
  if (!isPitchTurn(progress) || !progress.atBatPrepared) return progress
  if (progress.burst !== null && progress.burst.current !== null) return progress
  const pinched = applyOpponentCpuPinchHit(progress, random, true)
  if (pinched === progress) return progress
  // 0x16 → 0xd(지우기 건너뜀) → 0xe(강판 판정 · OK 대기) → OK 뒤 메시지 1(돌발 굴림) → 0xf 진입 (`confirmScene`)
  return prepareAtBat(pinched, random)
}

/**
 * 내가 던지는 타석의 **CPU 대타** `0xac228` — 공격 팀(상대)을 두고 한 번 묻는다 (Q1 4절, `pinchHitAi`).
 * 들어오면 확정 `0xaebe4` 의 대타 가지가 명단 두 칸과 기록 24바이트를 맞바꾸고 빠진 선수를 지운다 —
 * 그 타순 칸의 돌발 조건 기록(+0x12 안타 · +0x13 홈런 자리, `opponentBatterLogs`)도 들어온 선수 것(빈 기록)이 된다.
 * 카운트는 이어받는다 — 0x16 → 0xd 가 카운트 지우기(0xb6764)·타석 초기화(0xa5bcc)를 건너뛴다 (48e94).
 *
 * ⚠️ 원본이 보는 마선수 비트(0xb633d)·장비 레벨 니블(+0x19·+0x1a)은 웹 리그 로스터에 없다 — 늘 0 이라 결과가 같다.
 */
function applyOpponentCpuPinchHit(
  progress: PitcherGameProgress,
  random: RandomPort,
  /**
   * 사람 장면 0xf 진입(`0x3d954`)에서 불렀는가 — 그러면 "Time!" 22(3da88) → 교체 연출 0x16 → 0xe 등판음을 지난다
   * (`scenePinchHit`). 간이 엔진 `0xc1ba4`(0xc1c50) 대타는 연출이 없다.
   */
  inScene: boolean,
): PitcherGameProgress {
  const slot = progress.opponentOrderIndex
  const pinch = tryQuickCpuPinchHit(
    progress.opponentLineup,
    slot,
    {
      alreadyUsedThisGame: progress.pinchHitUsed,
      runnerCount: runnerCountOf(progress.game.bases),
      strikes: progress.atBat.strikes,
      balls: progress.atBat.balls,
    },
    random,
  )
  if (pinch === null) return progress
  const opponentBatterLogs = { ...progress.opponentBatterLogs }
  delete opponentBatterLogs[slot]
  return appendLog(
    {
      ...progress,
      opponentLineup: pinch.lineup,
      // state[0xe] = 1 (ac33e) — 다음 공(0xa5e14 a5e7c)이 나갈 때까지 다시 묻지 않는다
      pinchHitUsed: true,
      opponentBatterLogs,
      // 들어온 타자가 142 가 넣은 마타자면 등판음 0x38b64 의 마선수 가지 (0xb633c)
      scenePinchHit: inScene
        ? {
            serial: (progress.scenePinchHit?.serial ?? 0) + 1,
            by: 'CPU',
            incomingIsAce: rosterSlotAt(pinch.lineup, slot) === ACE_BATTER_ROSTER_SLOT,
          }
        : progress.scenePinchHit,
    },
    `${progress.game.inning}회${progress.game.half} 상대 ${(slot % BATTING_ORDER_SIZE) + 1}번 CPU 대타`,
    inScene,
  )
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
        ...replaceMyPitcher(progress, random),
        onMound: false,
        simpleEngineRunning: true,
        // 루에 남겨 둔 주자는 주자+0x30 이 나라서 들어오면 내 실점이다 (0xa8ee4)
        inheritedRunners: runnerCountOf(progress.game.bases),
        // 새 투수의 기록이 되므로 0 부터. (어차피 강판 뒤에는 기록 게이트가 닫힌다)
        moundStrikeouts: 0,
        moundStrikeoutCombo: 0,
        atBatPrepared: false,
        // 0xe 에서 물었으면 OK 를 안 받았으니 OK 뒤 굴림(돌발 0x8f158 · 0xf 진입 0x3d954)은 돌지 않는다
        sceneConfirmPending: false,
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
        // 0x50794 가 0xc1b48 을 부르고 0x21 로 간다
        ...replaceMyPitcher(progress, random),
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
      // 우리 공격은 모드 3 에서 늘 자동진행(0x21, 0xc1eac) — 진입 0x3abf0 이 남은 돌발을 내린다 (0x8f628)
      current = markAuto(playTeammateAtBat(withoutPendingBurst(current), random))
      continue
    }

    // 구원 등판 — 8회(0-기준 7) 우리 팀 수비 첫 타석에 벤치의 내 투수로 교체한다 (0xc1ba4)
    if (!current.onMound && !current.simpleEngineRunning && shouldEnterNow(current)) {
      current = enterAsRelief(current)
    }

    if (current.onMound) {
      if (current.atBatPrepared) return current
      // 상태 0x18(1회초 판) → 0xd → 0xe(강판 판정 · OK 대기) 차례 — 판의 굴림이 타석 준비보다 앞이다.
      // 새 타석의 0xd 진입 0x48d50 은 state[0xe](CPU 대타 막음)를 내린다 (48eb6).
      // 돌발(0x8f158)·0xf 진입 0x3d954 는 OK 뒤다 (`confirmScene`) — 강판(0x23)이면 0xf 에 안 간다
      const prepared = prepareAtBat(
        withHalfInningBoard({ ...current, pinchHitUsed: false }, random),
        random,
      )
      return {
        ...prepared,
        lastHumanHalf: { inning: prepared.game.inning, half: prepared.game.half },
        autoSinceHuman: false,
      }
    }
    // 내가 마운드에 없는 수비 타석도 자동진행(0x21) — 같은 진입이 남은 돌발을 내린다
    current = markAuto(playDefensiveAtBat(withoutPendingBurst(current), random))
  }
  throw new Error('투수편 경기 자동 진행이 끝나지 않았습니다 — 진행 규칙을 확인하세요')
}

/**
 * 자동진행(0x21) 진입 0x3abf0 · 공수 교대(0x18) 진입 0x3ac90 의 `0x8f628` — 판정 못 받고 남은 돌발을 내린다. 굴림 없음.
 * 모드 3 에서 사람 장면(내가 던지는 수비 반 이닝) 뒤에는 늘 자동 타석(우리 공격·강판 뒤)이 오므로
 * 자동 타석 앞에서 한 번 내리면 두 자리를 다 덮는다 (`cancelBurst` 머리말).
 */
function withoutPendingBurst(progress: PitcherGameProgress): PitcherGameProgress {
  if (progress.burst === null) return progress
  const burst = cancelBurst(progress.burst)
  return burst === progress.burst ? progress : { ...progress, burst }
}

/** 사람이 안 잡은 타석(간이 엔진)이 지났다는 표시 */
function markAuto(progress: PitcherGameProgress): PitcherGameProgress {
  return progress.autoSinceHuman ? progress : { ...progress, autoSinceHuman: true }
}

/**
 * 사람 타석 앞에 **공수 교대 판(상태 0x18)이 서는가** — 서면 틱 0 의 0x3fac4 가 36 번 굴린다
 * (`features/play-game/model/halfInningBoard` 머리말 · 팀 경기 `withHalfInningBoard` 와 같은 규칙).
 *
 * 판은 0x4f928 틱 0 에서 **앞 장면이 0x21 이 아니고 `0xc2198(sim, 1)` 이 거짓**(다음 장면을 사람이 잡음)일 때만 선다.
 * 모드 3 의 `0xc2198 → 0xc1e04` 는 점프표 0xd90c0 의 칸 2 = **0xc1eac** 로 간다 (디스어셈 확인):
 * ```
 * c1eac: r3 = st[0x31 + st[9]]           ; 공격 팀이 사람 팀(0)인가
 *        사람 팀 공격이면 → 1 (자동)       ; 우리 공격은 늘 0x21 — 투수편 주인공은 타석에 안 선다
 *        아니면 0xc1d38(sim) — 모드 3: 0xae8e9(수비 팀) 현재 투수가 0xb6389(내 선수)인가
 *          참 → 0 (사람 장면)  · 거짓 → 1 (자동 — 선발이 아닌 날 · 강판 뒤)
 * ```
 * 그래서 모드 3 에서는:
 * - 내 수비 반 이닝이 끝나면 다음은 우리 공격(자동)이라 곧장 0x21 — 판 없음.
 * - 우리 공격(0x21)이 끝나 오는 0x18 은 앞 장면이 0x21 이라 자동 OK — 판 없음. 구원 등판(8회)도 0x21 뒤라 판 없음.
 * - **1회초 판**: 인트로 0xc 끝(0x39e3c)은 모드 1 이 아니면 늘 0x18 로 보낸다 → 후공(상대가 1회초 공격)이고
 *   오늘 선발이 나면 첫 장면이 사람 장면이라 판이 선다. 선공이면 첫 장면이 우리 공격(0x21)이라 안 선다.
 * 웹은 "앞서 자동 타석이 없었고(`autoSinceHuman`) 반 이닝이 바뀌었다(`lastHumanHalf`)" 로 같은 자리를 잡는다 —
 * 모드 3 에서 이것이 참인 때는 위 1회초 판뿐이다.
 */
function withHalfInningBoard(progress: PitcherGameProgress, random: RandomPort): PitcherGameProgress {
  if (progress.autoSinceHuman) return progress
  const { game } = progress
  const last = progress.lastHumanHalf
  if (last !== null && last.inning === game.inning && last.half === game.half) return progress
  rollHalfInningFielders(random)
  return {
    ...progress,
    halfInningBoard: {
      serial: (progress.halfInningBoard?.serial ?? 0) + 1,
      inning: game.inning,
      half: game.half,
    },
  }
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
      // 0xaf09c(수비 팀, r7, 0) — 예약만 하고 state[0xd] 는 안 세운다. 확정(0xaebe4)이 카운터를 0 으로
      ourMound: {
        pitcherSlot: MY_PITCHER_SLOT,
        stamina: progress.stamina,
        runsAllowed: 0,
        pitches: 0,
        usedSlots: [...progress.ourMound.usedSlots, progress.ourMound.pitcherSlot],
        justChanged: false,
      },
      ourPitcherStaminas: withOutgoingStamina(progress.ourPitcherStaminas, progress.ourMound),
      pitcherLines: chargeCpuPitcherLine(progress.pitcherLines, progress.options.ourTeamId, progress.ourMound.pitcherSlot, {
        pitches: progress.ourMound.pitches,
      }),
      ourInningRunsAllowed: 0,
      // R+0x150 (코드 0x1f) — 포스트시즌이면 0xa56dc 가 거짓이라 안 적는다
      ...(countsMyPitcherRecord(progress)
        ? {
            pitcherRecord: recordEntryLead(progress.pitcherRecord, situation),
            record: { ...progress.record, leadingAtEntry: situation.leading },
          }
        : {}),
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
 *
 * 타석 앞에서 `0xc1ba4` 가 상대(공격) CPU 대타 → 우리(수비) 투수 교체를 본다 (`runQuickSubstitutions`). 우리 투수는
 * 내가 아닌 우리 마운드 투수(`ourMound`)이고 투구마다 스태미나가 깎인다 (0xa5e14, c26ca).
 */
function playDefensiveAtBat(
  progress: PitcherGameProgress,
  random: RandomPort,
): PitcherGameProgress {
  const { options } = progress
  progress = runQuickSubstitutions(progress, false, random)
  const mound = progress.ourMound
  const defense = ourQuickDefenseOf(progress)
  const pitched = perPitchDrainOf(defense, mound)
  // 내가 마운드에 없는 수비 타석은 자동진행(0x21) 안의 간이 타석 — 상태 0xf 를 안 지나 돌발을 굴리지 않는다
  const play = playQuickAtBat(
    quickBatterOfTeam(options, false, opponentRosterSlotOf(progress)),
    // 간이 엔진이 보는 투수 체력은 체력%(0xaebb0)다 — 마운드의 살아 있는 값을 넘긴다
    { ...defense.pitcherAt(mound.pitcherSlot), stamina: staminaPercentOf(mound.stamina) },
    { inning: progress.game.inning },
    random,
    { beforePitch: pitched.beforePitch },
  )
  const before = progress.game
  const played = applyDefensivePlay(
    {
      ...progress,
      atBatPitches: play.pitches,
      halfInningPitches: progress.halfInningPitches + play.pitches,
      // 간이 엔진도 공마다 0xa5e14 를 부른다 (c26ca) — state[0xe]·state[0xd] 가 내려간다
      pinchHitUsed: false,
      ...withMoundsPitched(progress),
    },
    play.outcome,
    false,
    play.balls,
    // 내가 마운드에 없는 타석은 간이 엔진이라 수비 시뮬레이션도 재생거리도 없다
    null,
    null,
  )
  const runs = played.game.opponentScore - before.opponentScore
  const halfChanged = played.game.half !== before.half || played.game.inning !== before.inning
  return {
    ...played,
    // 정산 0xa8024 — 우리 마운드 CPU 투수 레코드에 아웃·실점·탈삼진 (내 투수는 커리어가 따로 센다)
    pitcherLines: chargeCpuPitcherLine(played.pitcherLines, options.ourTeamId, mound.pitcherSlot, {
      outs: outsAddedBetween(before, played.game),
      runsAllowed: runs,
      strikeouts: play.outcome.kind === '삼진' ? 1 : 0,
    }),
    ourMound: {
      ...played.ourMound,
      // 공마다 이미 깎았다 (위 `beforePitch`, 0xc262c 의 c26c8)
      stamina: pitched.stamina(),
      runsAllowed: Math.min(MAXIMUM_PITCHER_COUNTER, mound.runsAllowed + runs),
      pitches: mound.pitches + play.pitches,
    },
    // 반 이닝 교대 0xa5b00 이 A 를 0 으로
    ourInningRunsAllowed: halfChanged
      ? 0
      : Math.min(MAXIMUM_PITCHER_COUNTER, progress.ourInningRunsAllowed + runs),
  }
}

/** 동료 타석 — 투수편 주인공은 타석에 서지 않으므로 아홉 칸 모두 간이 엔진이 돈다 */
function playTeammateAtBat(
  progress: PitcherGameProgress,
  random: RandomPort,
): PitcherGameProgress {
  const { options } = progress
  // 0xc262c 는 타석마다 먼저 0xc1ba4 — 우리(공격) CPU 대타 → 상대(수비) 투수 교체
  progress = runQuickSubstitutions(progress, true, random)
  // 동료 타석은 자동진행(0x21) 안의 간이 타석 — 상태 0xf 를 안 지나 돌발 굴림(0x8f158)·판정(0x8f414)이 없다
  const before = progress.game
  const mound = progress.opponentMound
  const defense = opponentQuickDefenseOf(progress)
  const pitched = perPitchDrainOf(defense, mound)
  const play = playQuickAtBat(
    // 대타가 들어오면 그 타순 칸에 선 선수가 바뀐다 — 명단(`team+0xe`)에서 고른다
    quickBatterOfTeam(options, true, rosterSlotAt(progress.ourLineup, before.battingOrderIndex)),
    // 간이 엔진이 보는 투수 체력은 체력%(0xaebb0)다 — 마운드의 살아 있는 값을 넘긴다
    { ...defense.pitcherAt(mound.pitcherSlot), stamina: staminaPercentOf(mound.stamina) },
    { inning: before.inning },
    random,
    { beforePitch: pitched.beforePitch },
  )
  const outcome = play.outcome
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
      game,
      decision,
      endedInningIndex: game.inning - 1,
      teammateLogs: { ...progress.teammateLogs, [slot]: recorded.log },
      // 정산 0xa8024 — 타순 칸 기록(타석·안타·홈런)이 다음 CPU 대타 판정의 재료다
      ourLineup: recordLineupPlay(progress.ourLineup, slot, outcome),
      // 같은 정산이 상대 마운드 투수 레코드에 아웃·실점·탈삼진을 쌓는다
      pitcherLines: chargeCpuPitcherLine(progress.pitcherLines, options.opponentTeamId, mound.pitcherSlot, {
        outs: outsAddedBetween(before, game),
        runsAllowed: runs,
        strikeouts: outcome.kind === '삼진' ? 1 : 0,
      }),
      recordIds: recordsAllowed(progress)
        ? [...progress.recordIds, ...recorded.recordIds]
        : progress.recordIds,
      perfectInningFlag: halfChanged ? true : progress.perfectInningFlag,
      inningRuns: halfChanged ? clearInningRuns(progress.inningRuns, game.inning) : progress.inningRuns,
      // 우리 공격이 끝나면 다음 수비 반 이닝의 투구 수를 0 부터 센다
      halfInningPitches: halfChanged ? 0 : progress.halfInningPitches,
      // 간이 엔진도 공마다 0xa5e14 를 부른다 (c26ca) — state[0xe]·state[0xd] 가 내려간다
      pinchHitUsed: false,
      ...withMoundsPitched(progress),
      opponentMound: {
        ...mound,
        // 공마다 이미 깎았다 (위 `beforePitch`, 0xc262c 의 c26c8)
        stamina: pitched.stamina(),
        runsAllowed: Math.min(MAXIMUM_PITCHER_COUNTER, mound.runsAllowed + runs),
        pitches: mound.pitches + play.pitches,
        justChanged: false,
      },
      // 반 이닝 교대 0xa5b00 이 A 를 0 으로
      opponentInningRunsAllowed: halfChanged
        ? 0
        : Math.min(MAXIMUM_PITCHER_COUNTER, progress.opponentInningRunsAllowed + runs),
    },
    `${before.inning}회${before.half} ${(slot % BATTING_ORDER_SIZE) + 1}번 — ${describeOutcome(outcome)}${
      runs > 0 ? ` (${runs}점)` : ''
    }`,
    false,
  )
}

/* ── 자동 타석의 교체 · 0xc1ba4 ──────────────────────────────────────────────── */

/** 원본 실점 카운터 A·B 는 99 에서 자른다 (P7 E1) */
const MAXIMUM_PITCHER_COUNTER = 99

/**
 * 간이 타석의 공 하나를 던지기 앞 — `0xc262c` 의 공 고리는 c26be 0xa5c2d → **c26c8 0xa5e14(소모)** → c26d4 경로 굴림
 * 차례라, 공 하나가 보는 체력%(0xaebb0)는 그 공의 소모까지 먹은 값이다 (반 이닝 엔진 `beforePitch` 와 같다, d9d376c).
 * 갈고리는 난수를 쓰지 않는다.
 */
function perPitchDrainOf(
  defense: HalfInningDefense,
  mound: HalfInningMound,
): { readonly beforePitch: () => QuickAtBatPitcher; readonly stamina: () => number } {
  let stamina = mound.stamina
  return {
    beforePitch: () => {
      stamina = drainQuickPitcher(defense, { ...mound, stamina }, 1)
      return { ...defense.pitcherAt(mound.pitcherSlot), stamina: staminaPercentOf(stamina) }
    },
    stamina: () => stamina,
  }
}

/** 한 타석 앞에서 `0xc1ba4` 를 다시 부르는 상한 — 대타 한 번 · 투수 한 번 · 마지막 빈 부름 */
const MAXIMUM_QUICK_SUBSTITUTION_CALLS = 3

/** 투구 처리 `0xa5e14` 의 a5e72 — `state[0xd]`(교체 직후)는 두 팀 공용 한 칸이라 공 하나에 둘 다 내려간다 */
function withMoundsPitched(
  progress: PitcherGameProgress,
): Pick<PitcherGameProgress, 'ourMound' | 'opponentMound'> {
  return {
    ourMound: progress.ourMound.justChanged ? { ...progress.ourMound, justChanged: false } : progress.ourMound,
    opponentMound: progress.opponentMound.justChanged
      ? { ...progress.opponentMound, justChanged: false }
      : progress.opponentMound,
  }
}

/**
 * **간이 타석 앞의 `0xc1ba4`** (디스어셈 c1ba4~c1d06) — 자동 타석(0x21: 동료 타석 · 내가 마운드에 없는 수비 타석)마다.
 * ```
 * c1bc6  모드 3 이고 0xb6ded(내 투수) == 2(구원) 이고 수비 팀이 사람 팀이고 수비 팀 지금 투수가 내 선수가 아니면
 *          r7 = 벤치(team+0x33 명)에서 0xb6389 참인 첫 번호
 *          이닝(0-기준) == 7 이고 r7 ≠ −1 → 0xaf09c(수비 팀, r7, 0) · return 1      ; 8회 구원 등판 (`enterAsRelief`)
 * c1c50  r6 = 0xac228(…, 공격 팀, 주자관리, state)                                 ; CPU 대타 — 가림막 없음
 * c1c74  r4 = 0x66864(스킨)                                                          ; 모드 3 은 늘 1
 * c1c8c  [engine+0x94] > 0 && 모드 3 && 수비 팀 지금 투수가 내 선수 → 투수 교체 건너뜀
 * c1ce2  r6 |= 0xac428(…, 수비 팀, …, [sp+4] = (모드 == 3), [sp+8] = 0, [sp+0xc] = max(r7, 0))
 * c1cfe  return r6
 * ```
 * 1 을 돌려주면 `0xc262c` 가 공 없이 돌아가(c266c) 다음 부름에서 **같은 타석**으로 다시 지난다 — 바뀐 쪽은 `state[0xe]`·
 * `state[0xd]` 로 곧장 빠지고 안 바뀐 쪽은 다시 판정(굴림 포함)한다. 그래서 고리로 옮긴다(많아야 세 번 — 팀 경기
 * `runQuickSubstitutions` 와 같은 차례). 8회 구원 갈래는 `advance` 가 이 앞에서 먼저 본다(`shouldEnterNow`).
 * 간이 엔진 쪽 교체는 연출(0x16)이 없어 소리도 없다.
 */
function runQuickSubstitutions(
  progress: PitcherGameProgress,
  battingIsOurs: boolean,
  random: RandomPort,
): PitcherGameProgress {
  let current = progress
  for (let call = 0; call < MAXIMUM_QUICK_SUBSTITUTION_CALLS; call += 1) {
    const pinched = battingIsOurs
      ? applyTeammateCpuPinchHit(current, random)
      : applyOpponentCpuPinchHit(current, random, false)
    const changed = battingIsOurs ? changeOpponentPitcher(pinched, random) : changeOurPitcher(pinched, random)
    if (changed === current) return current
    current = changed
  }
  return current
}

/**
 * 우리 공격 타석의 **CPU 대타** `0xac228`(0xc1c50) — 간이 엔진은 공격 팀이 누구든 가림막 없이 부른다.
 * 투수편 주인공은 타석에 안 서므로 우리 아홉 칸이 다 대상이다. 대타가 나면 그 칸의 이 경기 기록 24바이트(타격 기록
 * `teammateLogs` 자리)도 들어온 선수 것(빈 기록)이 된다 (aed02~aed16 — 타자편 `gameFlow` 의 동료 대타와 같다).
 */
function applyTeammateCpuPinchHit(progress: PitcherGameProgress, random: RandomPort): PitcherGameProgress {
  const slot = progress.game.battingOrderIndex
  const pinch = tryQuickCpuPinchHit(
    progress.ourLineup,
    slot,
    { alreadyUsedThisGame: progress.pinchHitUsed, runnerCount: runnerCountOf(progress.game.bases) },
    random,
  )
  if (pinch === null) return progress
  const teammateLogs = { ...progress.teammateLogs }
  delete teammateLogs[slot]
  return appendLog(
    { ...progress, ourLineup: pinch.lineup, pinchHitUsed: true, teammateLogs },
    `${progress.game.inning}회${progress.game.half} 우리 ${(slot % BATTING_ORDER_SIZE) + 1}번 CPU 대타`,
    false,
  )
}

/**
 * 한 팀의 수비 쪽 재료 — 투수 목록 차례·능력·사기. 모드 3 이라 `0xac428` 의 `[sp+4]` 가 서서
 * 내 투수(`MY_PITCHER_SLOT`)를 새 투수로 안 고른다 (`isOwnPlayerAt`).
 *
 * `bothTeamsAreCpu` 는 거짓 — 모드 3 경기 준비 `0x3a20a` 가 내 팀을 사람 팀으로 적는다. 다만 마무리 굴림 `0xac360` 은
 * 벤치에 마선수가 있을 때만(0xb8a8d) 돌아 이 화면 로스터에서는 돌지 않는다.
 * ⚠️ 상대 팀 사기는 이 화면이 들고 있지 않아 100 으로 본다 — **근사다** (타자편 `gameFlow.quickDefenseOf` 와 같다).
 */
function quickDefenseOf(
  progress: PitcherGameProgress,
  isOurs: boolean,
): HalfInningDefense {
  const { options } = progress
  const roster = teamPitchers(isOurs ? options.ourTeamId : options.opponentTeamId)
  // 142 가 명부 8번 칸에 넣은 마투수 — 웹 칸 번호는 우리 9(`OUR_ACE_PITCHER_SLOT`) · 상대 8
  const ace = teamAcePitcherOf(options, isOurs)
  const isAce = (slot: number) => ace !== undefined && slot === acePitcherSlotOf(isOurs)
  const myPitcher = {
    control: options.stats.control,
    velocity: options.stats.velocity,
    stamina: options.stats.stamina,
    skillIds: [],
  }
  return {
    mound: isOurs ? progress.ourMound : progress.opponentMound,
    pitcherSlots: isOurs ? ourPitcherOrderOf(options) : opponentPitcherOrderOf(options),
    // 벤치 투수는 제 레코드 +0x2c 로 올라온다 — 리그 표에서 이어 온 값 (내 자리는 `stamina`)
    staminaAt: (slot) =>
      isOurs && slot === MY_PITCHER_SLOT
        ? progress.stamina
        : (isOurs ? progress.ourPitcherStaminas : progress.opponentPitcherStaminas)[slot] ?? FULL_STAMINA,
    pitcherAt: (slot) =>
      isOurs && slot === MY_PITCHER_SLOT
        ? myPitcher
        : isAce(slot) && ace !== undefined
          ? ace.quick
          : quickPitcherOf(roster[slot % roster.length]),
    // 투수 능력치 순서는 제구·구속·변화·**체력** (칸 3)
    staminaAbilityAt: (slot) =>
      isOurs && slot === MY_PITCHER_SLOT
        ? options.staminaAbility
        : isAce(slot) && ace !== undefined
          ? ace.staminaAbility
          : roster[slot % roster.length].ability[3],
    lead: isOurs
      ? progress.game.ourScore - progress.game.opponentScore
      : progress.game.opponentScore - progress.game.ourScore,
    morale: isOurs ? options.teamMorale : 100,
    bothTeamsAreCpu: false,
    isOwnPlayerAt: (slot) => isOurs && slot === MY_PITCHER_SLOT,
    // 0xb6dec 보직 — 로스터 칸 0~3 선발 · 4~6 중간 · 7 마무리. 내 투수(칸 8)는 표 밖이라 0xabfcc 목록에 안 든다
    roleAt: (slot) => ((isOurs && slot === MY_PITCHER_SLOT) || isAce(slot) ? undefined : rosterPitcherRoleOf(slot)),
    // 마선수 0xb633c(+0xa 비트6) — 마운드면 특수 문턱(ac4f2), 벤치에 있으면 0xb8a8d 가 참이라 마무리 굴림 0xac360 을
    // 지나고, 0xabfcc 는 고르지 않는다 (`leagueDay.defenseOf` 와 같다)
    isSpecialPitcherAt: isAce,
    // 마무리 갈래(ac0be)의 정렬 열쇠 0xb5b50 = 0xb570c(팀, k, P, 1, 90, 1) 네 칸 합. 모드 3 은 팀 능력치(0x306)·코치
    // 정액이 없고 0xb574a 가지는 내 육성 선수(0xb6388)에만 붙는다 — 로스터 투수는 밑값을 0..999 로 자른 합.
    // 내 투수는 0xabfcc 가 모드 3 에서 거르므로(내선수거름) 그 칸 값은 쓰이지 않는다 — 실효 능력치 네 칸 합을 둔다
    abilitySumAt: (slot) =>
      isOurs && slot === MY_PITCHER_SLOT
        ? pitcherAbilitySumOf([
            options.stats.control,
            options.stats.velocity,
            options.stats.breaking,
            options.staminaAbility,
          ])
        : isAce(slot) && ace !== undefined
          ? pitcherAbilitySumOf([ace.control, ace.velocity, ace.breaking, ace.staminaAbility].map(clampAbility))
          : pitcherAbilitySumOf(roster[slot % roster.length].ability.map(clampAbility)),
  }
}

/** 0xb5b06 — 경기용 능력치를 0..999 로 자른다 */
const clampAbility = (value: number) => Math.min(999, Math.max(0, value))

function ourQuickDefenseOf(progress: PitcherGameProgress): HalfInningDefense {
  return quickDefenseOf(progress, true)
}

function opponentQuickDefenseOf(progress: PitcherGameProgress): HalfInningDefense {
  return quickDefenseOf(progress, false)
}

/**
 * `r7` — 벤치에서 내 투수의 번호 (c1bc6~c1c48). 내 투수가 **구원**이고 우리 팀이 수비이고 마운드에 내가 없을 때만 찾고,
 * 아니면 −1. 웹 벤치 차례는 `ourPitcherOrderOf` 에서 마운드·내려간 투수를 뺀 것이다.
 */
function myBenchIndexOf(progress: PitcherGameProgress): number {
  if (progress.options.role !== PITCHER_ROLE.relief) return -1
  if (progress.game.half !== opponentHalfOf(progress.game)) return -1
  const mound = progress.ourMound
  if (mound.pitcherSlot === MY_PITCHER_SLOT) return -1
  const bench = ourPitcherOrderOf(progress.options).filter(
    (slot) => slot !== mound.pitcherSlot && !mound.usedSlots.includes(slot),
  )
  return bench.indexOf(MY_PITCHER_SLOT)
}

/** 우리 수비 자동 타석의 `0xac428`(0xc1ce2) — 우리 CPU 투수를 바꿀지 본다 */
function changeOurPitcher(progress: PitcherGameProgress, random: RandomPort): PitcherGameProgress {
  // c1c8c — 내 투수가 마운드에 있으면 건너뛴다 (그때는 사람 장면이라 여기 오지 않는다)
  if (progress.game.isFinished || progress.ourMound.pitcherSlot === MY_PITCHER_SLOT) return progress
  const game = progress.game
  const before = progress.ourMound
  const after = changePitcherIfNeeded(ourQuickDefenseOf(progress), before, {
    // 원본 이닝은 0-기준이다 (state+0x6b)
    inningIndex: game.inning - 1,
    lead: game.ourScore - game.opponentScore,
    runnerCount: runnerCountOf(game.bases),
    inningRunsAllowed: progress.ourInningRunsAllowed,
    random,
    // [sp+0xc] = max(r7, 0) (0xc1c84~0xc1c8a)
    minimumBench: Math.max(myBenchIndexOf(progress), 0),
  })
  if (after === before) return progress
  return appendLog(
    withPitcherChanged(progress, true, after),
    `${game.inning}회${game.half} 우리 투수 교체`,
    false,
  )
}

/** 우리 공격 자동 타석의 `0xac428`(0xc1ce2) — 상대 투수를 바꿀지 본다 */
function changeOpponentPitcher(progress: PitcherGameProgress, random: RandomPort): PitcherGameProgress {
  if (progress.game.isFinished) return progress
  const game = progress.game
  const before = progress.opponentMound
  const after = changePitcherIfNeeded(opponentQuickDefenseOf(progress), before, {
    inningIndex: game.inning - 1,
    lead: game.opponentScore - game.ourScore,
    runnerCount: runnerCountOf(game.bases),
    inningRunsAllowed: progress.opponentInningRunsAllowed,
    random,
    // 수비 팀이 CPU 라 구원 갈래(c1bc6)를 안 타 r7 = −1 → 0
    minimumBench: 0,
  })
  if (after === before) return progress
  return appendLog(
    withPitcherChanged(progress, false, after),
    `${game.inning}회${game.half} 상대 투수 교체`,
    false,
  )
}

/**
 * 교체가 확정된 자리 — 새 마운드를 놓고 그 투수의 이닝 실점 A 를 0 으로(0xaec64), 세이브 후보 `0xa60c0` 을 잡는다
 * (간이 엔진 c26a2 — 수비 팀 `+0x296` 이 서 있으면. 강판 `0xc1b48` 의 교체도 다음 `0xc262c` 가 확정하며 같은 자리를 지난다).
 * ⚠️ c269c 가 함께 보는 `engine[1]` 의 뜻은 안 읽었다 — 타자편 `gameFlow` 처럼 늘 부른다.
 */
function withPitcherChanged(
  progress: PitcherGameProgress,
  isOurs: boolean,
  mound: HalfInningMound,
): PitcherGameProgress {
  const game = progress.game
  const ourSide = game.playerSide
  const opponentSide = 1 - ourSide
  const defenseSide = isOurs ? ourSide : opponentSide
  const decision = applyPitcherChange(progress.decision, {
    lastInningIndex: REGULATION_LAST_INNING_INDEX,
    inningIndex: game.inning - 1,
    outs: game.outs,
    defenseSide,
    offenseSide: 1 - defenseSide,
    scoreOf: (side) => (side === ourSide ? game.ourScore : game.opponentScore),
    moundPitcherOf: (side) =>
      side === ourSide
        ? teammatePitcherNumberOf(isOurs ? mound.pitcherSlot : progress.ourMound.pitcherSlot)
        : opponentPitcherNumberOf(isOurs ? progress.opponentMound.pitcherSlot : mound.pitcherSlot),
    runnerCount: runnerCountOf(game.bases),
  })
  // 내려간 투수의 +0x2c 는 레코드에 남는다 — 다음 경기(리그 표)로 이어진다. 그 투수의 투구 수(+0x27c)는 줄에 얹는다
  const outgoing = isOurs ? progress.ourMound : progress.opponentMound
  const pitcherLines = chargeCpuPitcherLine(
    progress.pitcherLines,
    isOurs ? progress.options.ourTeamId : progress.options.opponentTeamId,
    outgoing.pitcherSlot,
    { pitches: outgoing.pitches },
  )
  return isOurs
    ? {
        ...progress,
        decision,
        ourMound: mound,
        ourInningRunsAllowed: 0,
        ourPitcherStaminas: withOutgoingStamina(progress.ourPitcherStaminas, progress.ourMound),
        pitcherLines,
      }
    : {
        ...progress,
        decision,
        opponentMound: mound,
        opponentInningRunsAllowed: 0,
        opponentPitcherStaminas: withOutgoingStamina(progress.opponentPitcherStaminas, progress.opponentMound),
        pitcherLines,
      }
}

/**
 * **강판 `0xc1b48`** — 감독 강판 창을 닫을 때(0x50794)와 스스로 강판(0x498d4)이 부른다 (디스어셈 c1b48~c1b94):
 * ```
 * c1b78  0xac428(…, 수비 팀, …, [sp] = ctx, [sp+4] = (모드 == 3), [sp+8] = 1, [sp+0xc] = 0)   ; 강제 교체
 * c1b86  0x668cc(스킨, 수비 팀, 1) · engine[0] = 1                                         ; 간이 엔진 켜기
 * ```
 * 판정이 거짓이어도 바꾸고(ac5c4), 새 투수는 보통 교체와 같이 0xac360 굴림 → 벤치 마지막 / 0xabfcc 로 고른다 —
 * **굴림이 하나 이상 든다**. 내 투수(`[sp+4]`)는 고르지 않는다. 판정이 보는 지금 투수는 나다 — 보직(0xb6ded)·
 * 체력·이 이닝 실점이 마무리 상황 표시를 가른다.
 */
function replaceMyPitcher(progress: PitcherGameProgress, random: RandomPort): PitcherGameProgress {
  const game = progress.game
  const me: HalfInningMound = {
    ...progress.ourMound,
    pitcherSlot: MY_PITCHER_SLOT,
    stamina: progress.stamina,
    runsAllowed: Math.min(MAXIMUM_PITCHER_COUNTER, progress.runsAllowedByMe),
    pitches: progress.pitchCount,
  }
  const after = changePitcherIfNeeded(ourQuickDefenseOf({ ...progress, ourMound: me }), me, {
    inningIndex: game.inning - 1,
    lead: game.ourScore - game.opponentScore,
    runnerCount: runnerCountOf(game.bases),
    inningRunsAllowed: Math.min(MAXIMUM_PITCHER_COUNTER, inningRunsOf(progress.inningRuns, game.inning)),
    random,
    minimumBench: 0,
    force: true,
    moundRole: progress.options.role,
  })
  // 벤치가 비어 못 바꾸면 원본은 내 투수가 마운드에 남은 채 간이 엔진이 돈다 — 그 칸을 그대로 둔다
  if (after === me) return { ...progress, ourMound: me }
  return withPitcherChanged(progress, true, after)
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
  /**
   * 경기 끝 양 팀 투수 칸(붙박이 표 칸 0~7)별 레코드 스태미나 `+0x2c` — 리그 표로 이어지는 값(하루 끝 0xb617c 회복 전).
   * 마운드 값까지 얹었다. 내 값은 `stamina` 다.
   */
  readonly pitcherStaminas: { readonly ours: readonly number[]; readonly opponent: readonly number[] }
  /**
   * 리그 투수 기록 재료 — CPU 투수 줄(내 투수 빼고, 마운드 투구 수를 얹어)과 경기 끝 판정 0xa7de8 · 측 → 팀.
   * 판정이 내 투수(`MY_PITCHER_NUMBER`)를 가리키면 부르는 쪽이 건너뛴다(내 기록은 `seasonDelta`).
   */
  readonly leaguePitchers: GameLeaguePitchers
}

/**
 * 결과 판 세 줄(승리투수·패전투수·세이브)의 이름 — 상태 0x18 그리기 0x4fe9c 가 state+0x44/0x50/0x5c 를
 * 거르지 않고 그대로 읽는다(`0xb62c0(0xb8b60(팀[측], 번호))`). 측 2(없음)면 그 줄은 빈다.
 *
 * 투수편 진행기는 등번호 대신 표지(`MY_PITCHER_NUMBER` 나 · 동료/상대 = 기준값 − 로스터 칸)로 적는다 —
 * 교체 AI(0xac428)가 양 팀 투수를 바꾸므로 칸마다 다른 표지다. 내 이름은 진행기 옵션에 없어 부르는 쪽이 준다.
 */
export function pitchersOfRecordOf(progress: PitcherGameProgress, myName: string | null): PitcherOfRecordNames {
  const { options } = progress
  return pitcherOfRecordNamesOf(progress.decision, progress.game.playerSide, (isOurTeam, number) => {
    const slot = isOurTeam ? TEAMMATE_PITCHER_NUMBER_BASE - number : OPPONENT_PITCHER_NUMBER_BASE - number
    if (isOurTeam && number === MY_PITCHER_NUMBER) return myName ?? undefined
    if (slot === acePitcherSlotOf(isOurTeam)) {
      const ace = teamAcePitcherOf(options, isOurTeam)
      if (ace !== undefined) return ace.player.name
    }
    return rosterPitcherName(isOurTeam ? options.ourTeamId : options.opponentTeamId, slot)
  })
}

/** 로스터 칸의 투수 이름 */
function rosterPitcherName(teamId: number, index: number): string | undefined {
  const roster = teamPitchers(teamId)
  return roster[index % roster.length]?.name
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
    pitcherStaminas: {
      ours: withOutgoingStamina(progress.ourPitcherStaminas, progress.ourMound),
      opponent: withOutgoingStamina(progress.opponentPitcherStaminas, progress.opponentMound),
    },
    leaguePitchers: {
      lines: chargeCpuPitcherLine(
        chargeCpuPitcherLine(progress.pitcherLines, options.ourTeamId, progress.ourMound.pitcherSlot, {
          pitches: progress.ourMound.pitches,
        }),
        options.opponentTeamId,
        progress.opponentMound.pitcherSlot,
        { pitches: progress.opponentMound.pitches },
      ),
      decision: {
        // 판정의 등번호 자리는 표지(`teammatePitcherNumberOf`·`opponentPitcherNumberOf`)라 붙박이 표 칸으로 되돌린다.
        // 내 투수 표지는 표 밖 칸(`MY_PITCHER_SLOT`)이 된다
        winner: recordSlotOf(decision.winner, progress.game.playerSide),
        loser: recordSlotOf(decision.loser, progress.game.playerSide),
        save: recordSlotOf(decision.save, progress.game.playerSide),
      },
      sideTeams:
        progress.game.playerSide === 0
          ? [options.ourTeamId, options.opponentTeamId]
          : [options.opponentTeamId, options.ourTeamId],
    },
  }
}

/** 판정 칸의 표지를 붙박이 표 칸으로 — 내 측이면 동료 표지(나는 `MY_PITCHER_SLOT`), 아니면 상대 표지 */
function recordSlotOf(record: PitcherOfRecord | null, ourSide: number): PitcherOfRecord | null {
  if (record === null) return null
  if (record.side !== ourSide) return { side: record.side, number: OPPONENT_PITCHER_NUMBER_BASE - record.number }
  if (record.number === MY_PITCHER_NUMBER) return { side: record.side, number: MY_PITCHER_SLOT }
  return { side: record.side, number: TEAMMATE_PITCHER_NUMBER_BASE - record.number }
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
