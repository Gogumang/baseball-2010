import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { rollSimulatorInit } from '@/entities/game/model/simulatorInit'
import { openScenePatternDeck } from '@/entities/batting/model/battedBallOutcome'
import { describeOutcome, isFreePass, isHit } from '@/entities/at-bat/model/atBatOutcome'
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
import { playQuickAtBat } from '@/entities/game/model/quickAtBat'
import type { QuickAtBatBatter, QuickAtBatPitcher } from '@/entities/game/model/quickAtBat'
import type { PitcherAbility } from '@/entities/pitching/model/pitch'
import type { PitcherRepertoire } from '@/shared/config/original/pitcherRepertoires'
import type { BatterAbility } from '@/entities/batting/model/batter'
import { PITCHERS_PER_TEAM, rollStartingPitcherIndex } from '@/entities/team/model/teamRoster'
import { rotationSlotOf } from '@/entities/pitcher-career/model/pitcherRotation'
import { applyOpponentAtBat, applyOpponentRunnerPlay } from '@/features/play-pitcher-game/model/pitcherGameState'
import { battedBallTrajectory } from '@/entities/batting/model/battedBallFlight'
import {
  defenseAbilitiesOf,
  isBattedBallInPlay,
  recordedOutcomeOf,
  runDefensePlay,
  withPredictedOutcome,
} from '@/features/defense-play/model/runDefensePlay'
import type { DefensePlayInput, DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import type { ControlSide } from '@/entities/defense-controls/model/defenseKeys'
import type { StealBase } from '@/entities/fielding/model/stealStart'
import {
  arrivalApplicationOf,
  arrivesUnhit,
  pitchJudgementOf,
  rollCpuStealStart,
  runPitchArrivalPlay,
  startHumanSteal,
  type PitchArrivalPlay,
} from '@/features/defense-play/model/pitchArrivalPlay'
import { homeRunPlaybackOf } from '@/features/defense-play/model/homeRunPlayback'
import { PICKOFF_RESULT, runPickoffPlay } from '@/features/defense-play/model/pickoffPlay'
import type { PickoffPlayResult } from '@/features/defense-play/model/pickoffPlay'
import { baserunnerAllowedOfFates, runnerFatesWithoutPlay } from '@/features/defense-play/model/runnerFates'
import { PICKOFF_PLAY_KIND, pickoffPlayForKey } from '@/entities/defense-controls/model/pickoff'
import type { PickoffBase } from '@/entities/defense-controls/model/pickoff'
import { fixturePatternFor } from '@/features/defense-play/model/representativePattern'
import { isBattedBallKind } from '@/features/defense-play/model/playOutcome'
import { contactOfOutcome, registerContact, type BattedContact } from '@/entities/batting/model/battedContact'
import type { BattedBallPattern } from '@/shared/config/original/battedBallPatterns'
import type { LeaguePlateAppearance, LeagueStolenBase } from '@/entities/league/model/leaguePlayerStats'
import {
  popularityCompleteGameOf,
  reputationCompleteGameOf,
} from '@/entities/season-mode/model/seasonEvaluation'
import type { CompleteGameFlags } from '@/entities/season-mode/model/seasonEvaluation'
import {
  clearSeasonGameRecord,
  recordSeasonGameEvent,
  SEASON_RECORD_CODE,
} from '@/entities/season-mode/model/seasonReputation'
import type { CompleteGameKind, MySide } from '@/entities/season-mode/model/seasonReputation'
import { cancelBurst, createBurstSession, resolveBurst, tryTriggerBurst } from '@/entities/burst-mission/model/burstMissionSession'
import type { BurstResolution, BurstSession } from '@/entities/burst-mission/model/burstMissionSession'
import type { BurstRewardDelta } from '@/entities/burst-mission/model/burstMissionReward'
import { burstResultBitsOf } from '@/entities/burst-mission/model/burstResultBits'
import { batterRunnerSafeOfFates } from '@/features/defense-play/model/runnerFates'
import {
  benchClearingEffectOf,
  rollsIntoBenchClearing,
  staminaAfterBenchClearing,
} from '@/entities/game/model/benchClearing'
import { pitchAgainstBatterDetailed } from '@/entities/pitching/model/simulateBatter'
import { specialSwingCountOf } from '@/entities/batting/model/specialSwing'
import { aceLevelOf, aceLevelSlotOf } from '@/entities/mission/model/aceLevel'
import { isMistakePitch } from '@/entities/pitching/model/mistakePitch'
import type { Pitch } from '@/entities/pitching/model/pitch'
import { advanceMagicPitchGameState } from '@/entities/pitching/model/magicPitchGame'
import type { MagicPitchGameState } from '@/entities/pitching/model/magicPitchGame'
import {
  MAGIC_PITCH_TYPE_NUMBER,
  ballMagicNumberAfterPitch,
  magicPitchCountOf,
} from '@/entities/pitcher-career/model/magicPitch'
import {
  consumeStamina,
  FULL_STAMINA,
  pitchStaminaCostOf,
  staminaCapacityOf,
  staminaPercentOf,
} from '@/entities/pitcher-career/model/pitcherStamina'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import type { PitcherRole } from '@/entities/pitcher-career/model/pitcherRole'
import {
  EMPTY_MOUND_COUNTERS,
  judgePitcherChange,
  pitcherAbilitySumOf,
  replacementPitcherSlotOf,
} from '@/entities/pitching/model/pitcherChange'
import type { MoundPitcherCounters } from '@/entities/pitching/model/pitcherChange'
import { runnerCountOf } from '@/entities/game/model/baseState'
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
import { rollBenchClearingEntry, rollBenchClearingTargets } from '@/features/play-game/model/benchClearingScene'
import { introSkipsFirstBoard, rollHalfInningFielders } from '@/features/play-game/model/halfInningBoard'
import { EMPTY_DECISION_STATE, gameEndDecisionOf } from '@/entities/game/model/winLossSave'
import type { DecisionState, PitcherOfRecord } from '@/entities/game/model/winLossSave'
import { chargePitcherLine, outsAddedBetween } from '@/entities/game/model/gamePitcherLines'
import type { GameLeaguePitchers, GamePitcherLine } from '@/entities/game/model/gamePitcherLines'
import {
  decisionsAfterPitcherChange,
  decisionsAfterPlay,
  pitcherOfRecordNamesOf,
} from '@/features/play-game/model/gameDecisions'
import type { MoundBySide, PitcherOfRecordNames } from '@/features/play-game/model/gameDecisions'
import { FULL_PLAY_SETTINGS, isHumanControlled } from '@/features/play-team-game/model/matchSettings'
import type { MatchProgressSettings } from '@/features/play-team-game/model/matchSettings'
import {
  aceLeveledAbility,
  entryBatterGameAbilities,
  entryPitcherGameAbilities,
  entryPitcherGameAbilityParts,
  NO_ACE_BATTER,
  NO_ROSTER_SLOT,
  entryBattersOfOrder,
  entryPitchersOfOrder,
  rosterEntryBattersOf,
  rosterEntryPitchersOf,
  withAceBatter,
  withAcePitcher,
} from '@/features/play-team-game/model/teamGameRoster'
import type {
  TeamEntryBatter,
  TeamEntryOrder,
  TeamEntryPitcher,
  TeamGameAbilityContext,
} from '@/features/play-team-game/model/teamGameRoster'
import { rollOpponentAceIndex } from '@/entities/game/model/aceOpponent'
import { pitcherHandOf } from '@/entities/pitching/model/pitcherHand'
import {
  backToBackRecordOf,
  completeGameRecordIdsOf,
  foulRecordOf,
  gameEndRecordIdsOf,
  laserThrowOutRecordOf,
  multiOutPlayRecordIdsOf,
  passesRecordTeamGate,
  pinchHitHomeRunRecordIdsOf,
  recordGamePointsOf,
  strikeoutRecordIdsOf,
  threePitchInningRecordIdsOf,
} from '@/entities/game/model/gameRecords'
import { EMPTY_BATTER_GAME_LOG, recordBatterAtBat } from '@/entities/game/model/batterGameLog'
import type { BatterGameLog } from '@/entities/game/model/batterGameLog'
import {
  EMPTY_BATTER_GAME_RECORD,
  judgeCpuPinchHit,
  recordPlateAppearance,
} from '@/entities/batting/model/pinchHitAi'
import type { BatterGameRecord } from '@/entities/batting/model/pinchHitAi'
import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { enterSceneConfirm } from '@/features/play-game/model/sceneConfirm'
import { atBatResultCodeOf } from '@/entities/batting/model/atBatResultRing'
import type { SceneConfirmWait } from '@/features/play-game/model/sceneConfirm'
import { TEAMS } from '@/shared/config/original/teams'

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
 * 들어와 있는 것: 엔트리 편집기(0x55864)가 고친 명단(`ourEntryOrder`) · 사람·CPU 대타(`pinchHit`·0xac228, Q1 4절) ·
 * 경기 중 투수 교체(자동 타석은 CPU 교체 AI 0xac428 이 양 팀을, 사람 장면은 0xf 진입 0x3d954 가 CPU 쪽을, 우리 투수는
 * `#` 메뉴만 — `changePitcher`, R4 1a·1b·1c) · 30G 자동진행(`runAutoProgress` — 끝나는 조건 0xc2198 확정).
 *
 * ⚠️ **아직 안 옮긴 것** (원본에는 있다):
 *   - 자동진행 **중계 화면**(경기 상태 0x21, R10 7절) — 속도 칸 +0xbc · CLR 중단 질문. 웹은 결과를 한 번에 낸다
 *   - 감독 강판은 **투수편(모드 3) 전용**이라(P1 2절) 팀 경기에는 원본에도 없다
 *
 * ## 부르는 쪽에게 (시즌 세션 · 포스트시즌 · 국가대항전)
 * 시즌은 `app/ui/SeasonRoute` 가 `pages/team-game/ui/TeamGameScreen`(또는 `pages/team-game/model/useTeamGame`)을
 * 띄우고 `onFinish(summary)` 를 `useSeasonSession` 의 `finishGame` 이 받는다. 요약에서 읽을 칸:
 * ```
 *   summary.won · ourScore · opponentScore            → 리그 전적 · 시즌 평가 evaluateSeasonGame
 *   summary.popularityCompleteGame · reputationCompleteGame · gameRecord(평판 16칸, 평가 앞에 꽂는다)
 *   summary.leaguePlateAppearances · leaguePitchers   → 리그 타자·투수 기록표
 *   summary.recordIds · gamePoints                    → 기록달성 G (경기 끝 0x4ea0c)
 *   summary.ourPitcherStaminas · opponentPitcherStaminas → 다음 경기로 잇는 투수 +0x2c
 *   summary.burstRewardDeltas                         → 돌발 보상 (0x8e34c 모드 2 — 종류 1 사기 · 2 인기도 · 3 평판 ·
 *                                                       4 소지금). 원본은 경기 중에 더하므로 평가 **앞에** 얹는다
 * ```
 * 돌발 결과 창은 `closeBurstWindow` 로 닫는다.
 * 포스트시즌·국가대항전도 같은 화면을 쓴다 — `mode` 는 그대로 2 이고 상대 팀만 바뀐다.
 */

/** 팀 사기 = 팀 레코드 s16 +2 = XlsTEAM_DATA 둘째 u16 (전 팀 100) */
const TEAM_MORALE_VALUE_INDEX = 1
const DEFAULT_TEAM_MORALE = 100

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
  /**
   * **시즌 팀 번호** `[시즌+1]` (0~9) — 모드 2 에서만 본다. 안 넘기면 `ourTeamId` 와 같다고 본다
   * (정규·포스트시즌은 내 팀이 곧 시즌 팀이다).
   *
   * 질병·보직·사기 세 보정은 `0xb5804` 에서 `[시즌+1] == 팀레코드+0` 으로 **선수의 팀 번호**와
   * 비교한다 (b580e `ldrsb [S+1]` · b5816 `ldrsh [팀레코드+0]` · b581a `bne`).
   * 국가대항전은 내 팀이 대한민국(10)이라 시즌 팀(0~9)과 같을 수 없어서 **아무 팀에도 안 붙는다**.
   * 그래서 국가대항전을 부르는 쪽은 `ourTeamId: 10` 과 함께 원래 시즌 팀을 여기에 넘겨야 한다.
   */
  readonly seasonTeamId?: number
  /**
   * 리그 날짜 카운터 g (`리그+0x32` = `시즌+0xb2` = 시즌 레코드의 `games`) — **모드 2 에서만** 본다.
   * 시즌모드 경기 직전 화면 `0x6548` 이 `0xb8c80` 으로 양 팀 4인 로테이션을 한 칸 돌리는 자리다
   * (R13 4절). 안 넘기면 0 = 시즌 첫 경기라 두 팀 모두 로스터 0번이 선발이다.
   * 국가대항전 중에는 같은 칸 `L+0x32` 가 **대회 날짜**다 (0xb7bf0 이 0 으로 놓는다).
   */
  readonly dayCounter?: number
  /**
   * **상대 팀만** 다른 로테이션 날짜로 돌릴 때 — 모드 2 에서만 본다. 안 넘기면 `dayCounter` 와 같다
   * (정규·포스트시즌은 원본 `0x6548` 이 두 팀을 같은 `S+0xb2` 로 돌린다).
   *
   * 국가대항전은 두 팀이 다르다 (7dd3826 확정): 로테이션 `0xb5ca8` 은 팀 레코드를 **제자리에서** 당기는데,
   * 상대국 슬롯 `base+0x934` 는 대회 시작 `0x20648`(b7ca4)과 하루 끝 `0xb818c`(b8216)에서 **마스터 팀 표에서
   * 새로 복사**된 뒤 그날 경기 준비에서 한 번만 돈다 → 첫날(L+0x32 == 0, 670e 가 안 돌림)은 0번, 그 뒤로는
   * **늘 1번**. 대한민국 슬롯(+0x918)은 대회 초기화에서 한 번 만들고 매일 돌아 `cup.day % 4` 가 맞다.
   * 그래서 국가대항전을 부르는 쪽은 `dayCounter: cup.day` 와 함께 `opponentDayCounter: cup.day === 0 ? 0 : 1`
   * 을 넘긴다.
   */
  readonly opponentDayCounter?: number
  /** 팀별 능력치 네 칸. 안 넘기면 XlsTEAM_DATA 값 */
  readonly teamAbilities?: readonly (readonly number[])[]
  /** 내 팀 타순 칸별 수비 자리·보직 — 보직 불일치 −20% 입력 (시즌모드 전용) */
  readonly lineup?: readonly FieldingAssignment[]
  /** 환경설정 "투구 게이지" (설정 +0x2d) — **원본 기본값은 꺼짐** (K 5-2) */
  readonly gaugeSettingOn?: boolean
  /**
   * 환경설정 "주루" 가 **수동**인가 (설정 +0xbd). 안 넘기면 자동이다.
   * 갈림길은 `0xae690` — `(경기[0x31 + 공격측] == 1) || (설정+0xbd != 0)` 이 거짓이면
   * 자동 진루 제어기(0xaf8c0)를 통째로 안 돌린다. 곧 **사람이 공격일 때만** 설정이 먹는다.
   */
  readonly runningModeManual?: boolean
  /**
   * 환경설정 "송구" 가 **수동**인가 (설정 +0xf4). 안 넘기면 **원본 기본값인 수동**이다.
   *
   * 갈림길은 `0xae6c8` — 직접 떴다 (`0xae690` 과 오프셋 한 글자만 다른 쌍둥이):
   * ```
   * ae6ce: r2 = [obj + 0x174]                       ; = 경기 상태
   * ae6d4: r3 = (s8)경기[0xa]                       ; ★ 수비 측 (주루 쪽은 경기[9] = 공격 측)
   * ae6de: r3 = 경기[0x31 + 수비측]
   * ae6e6: r1 = (r3 == 1)                           ; 그 팀을 CPU 가 조작하는가
   * ae6ee: 반환 = r1 || (인자 != 0)                  ; 인자 = 설정 +0xf4 (0 = 수동)
   * ```
   * 거짓이면 CPU 송구 결정 `0xafa60` 을 **아예 안 돌린다** (0x526ac, 예외 없음).
   * 곧 **사람이 수비하는 타석에서만** 이 설정이 먹는다 — 우리 공격 타석은 수비가 CPU 라
   * 앞 항이 늘 참이어서 설정과 무관하다. 그래서 이 칸은 `defensiveDefenseInputOf` 한 곳에만 간다.
   */
  readonly throwModeManual?: boolean
  /**
   * 준비 화면에서 고른 **마타자** 0~4 (준비 기록 `skin+0xbc` +0xd). 안 넘기면 없다.
   *
   * 경기 세우기 `0x30f20` 이 `0xb8870(팀, 이 값)` 으로 마타자를 **벤치 첫 칸(9번)** 에 끼워 넣고
   * 벤치 타자 수 `team+0x28c` 를 하나 올린다 (`31046` · `b8898~b88b2`). 원본에서 마타자가
   * 타석에 서는 길은 **대타(`#`)뿐**이다 — 타순 아홉 칸에는 안 들어간다.
   *
   * 원본은 같은 자리에서 **AI 팀에도** 마타자를 넣는다 — 이 값으로 `0x66994` 를 굴려 나온 번호다
   * (`3106c`). 그래서 이 칸은 상대 팀 마타자의 **입력**이기도 하다 (`rollOpponentAceIndex`).
   */
  readonly aceBatterId?: number
  /**
   * 준비 화면에서 고른 **마투수** 0~4 (준비 기록 `skin+0xbc` +0xe). 안 넘기면 없다.
   *
   * 경기 세우기 `0x30f20` 이 `0xb88c8(팀, 이 값)` 으로 마투수를 **투수 명단 8번 칸**에 넣고
   * 벤치 투수 수 `team+0x33` 을 하나 올린다 (`31042` · `b88f6~b8906`). 마타자의 9번과 **칸이 다르다**
   * — `0xb521c` 의 `0x60` 가지가 8번이다 (`teamGameRoster.PITCHER_ENTRY_ACE_SLOT` 주석).
   * 원본에서 마투수가 마운드에 서는 길은 **`#` 투수 교체(또는 CPU 교체 AI)** 뿐이다 — 선발이 아니다.
   *
   * 원본은 같은 자리에서 **AI 팀에도** 마투수를 넣는다 — 이 값으로 `0x66968` 을 굴려 나온 번호다
   * (`31058`). 그래서 이 칸은 상대 팀 마투수의 **입력**이기도 하다 (`rollOpponentAceIndex`).
   */
  readonly acePitcherId?: number
  /**
   * **마선수 레벨 열 칸** = 원본 전역 기록 `mgr[0x13a..0x143]` (`entities/mission/model/useAceLevels` 의 `levels`).
   * 명단의 마선수(사람 팀·AI 팀 모두)가 능력치 0xb6414 첫 단계에서 `0xd88aa[레벨]` 배율을 먹고,
   * 마투수의 마구 횟수 0xd8509[레벨] 도 이 칸을 본다 — 우리 마투수는 진행기가(`magicCountOfPitcher`),
   * 상대 마투수는 타석 화면이 `BattingStage.aceLevels` 로 받는다.
   * 안 넘기면 모두 Lv1(0) — 배율 60% · 마구 3 회다.
   *
   * 넘기는 곳: 일반모드는 `generalModeSetup.teamGameOptionsOf(extra.aceLevels)` 가 App 의
   * `useAceLevels().levels` 를 싣는다 (ded2d81). 시즌(국가대항전 포함)은 App 이 같은 값을 `useSeasonSession`
   * 넷째 인자로 넘기고 그 세션이 싣는다 (69d6bcc · 6402929). 웹에 대전모드(8·9) 팀 경기는 아직 없다.
   */
  readonly aceLevels?: Readonly<Record<number, number>>
  /**
   * **엔트리 편집기(0x55864)가 고친 내 팀 명단 차례** — 있으면 붙박이 표 차례(`rosterEntryBattersOf` ·
   * `rosterEntryPitchersOf`) 대신 이 차례로 타순·벤치·투수 명단을 세운다 (`teamGameRoster.TeamEntryOrder`).
   * 마선수는 이 뒤에 지금처럼 끼운다(마투수 8번 · 마타자 9번).
   *
   * 선발 칸은 따로 정한다 — 시즌은 지금처럼 `rotationSlotOf(dayCounter)`: 원본 시즌 저장 레코드는 g 번 돈 모양이고
   * 웹 차례는 돌기 전 모양이라(`seasonEntry.unrotatedPitchersOf`) g % 4 번 = 원본 0번이다 (40870f1).
   * 일반모드는 `startingPitcherSlots.ours`(0x30f20 의 0↔k) — 편집기는 맞바꾼 모양을 보이고 되적을 때 되돌린다.
   *
   * 넘기는 곳: 시즌 `seasonEntryOrderOf(save.roster)` (app `useSeasonSession.optionsFor`) ·
   * 일반모드 상태 23 이 고친 유저 팀 (`generalModeSetup.teamGameOptionsOf`).
   */
  readonly ourEntryOrder?: TeamEntryOrder
  /**
   * **상대 팀 레코드의 명단 차례** — 있으면 붙박이 표 차례 대신 이 차례로 상대 타순·벤치·투수 명단을 세운다
   * (`teamGameRoster.TeamEntryOrder`, 투수는 레코드 첨자 차례 — `opponentPitcherOrder` 가 그 첨자를 늘어세운다).
   * 원본 경기용 팀 `0xb891c` 는 `team[i] = i` 첨자만 들고 선수는 `0xb8680` 이 모드 2·3·4 에서 `0x1f570(저장, 팀)` —
   * **시즌 저장의 그 팀 레코드**에서 꺼낸다(b869e, 직접 떴다). 트레이드(0xd1cc~0xd3ae)가 CPU 팀 레코드도 바꾸므로
   * 시즌은 바뀐 팀의 저장 명단(`SeasonSave.cpuRosters`)을 넘긴다. 안 넘기면 붙박이 표다.
   */
  readonly opponentEntryOrder?: TeamEntryOrder
  /**
   * **이미 굴린 상대 마선수** 0~4 (`0x66968` 마투수 · `0x66994` 마타자). 있으면 `startTeamGame` 은 굴리지 않는다.
   * 원본은 경기 장면 전에 굴린다 — 일반모드 상태 22 진입 `0x314b0` → `0x30f20`(31058·3106c) ·
   * 시즌 0xdd 진입 `0x6548`(66ea·66fc). 그래서 경기정보·엔트리 화면이 이미 그 마선수를 본다.
   */
  readonly opponentAces?: { readonly pitcher: number; readonly batter: number }
  /**
   * **이미 굴린 선발 칸** (모드 1·8·9 — `0x30f20` 3107a AI · 31090 사람, `rollStartingPitcherIndex`).
   * 있으면 `startTeamGame` 은 굴리지 않는다. 시즌(모드 2)은 보지 않는다 (로테이션이다).
   */
  readonly startingPitcherSlots?: { readonly opponent: number; readonly ours: number }
  /**
   * **시즌 상대 팀 마선수를 굴려 넣는가** (모드 2 에서만 본다, `opponentAces` 가 없을 때).
   * 원본 0xdd 진입 `0x6548` 은 국가대항전(SR+0x12c)이 아니면 내 팀에 고른 마선수를 싣고(66da·66e6) 이어
   * **상대 팀에도** `0x66968(rec+0xe)`(66ee) → `0x66994(rec+0xd)`(6700) 로 굴린 마선수를 넣는다(66f8·670a).
   * 정규·포스트시즌은 참, 국가대항전·0xdd 를 지나지 않는 길은 거짓(기본).
   */
  readonly seasonOpponentAces?: boolean
  /**
   * **경기 시작 때 투수 스태미나** `+0x2c` (0~10000) — 투수 명단 차례(`ourEntryOrder.pitchers`, 없으면 표 칸)
   * 마다 하나. 안 넘기거나 모자란 칸은 10000 이다. 마투수(명단 밖 저장 레코드 `0x1f824`)의 값은 못 읽어 늘 10000.
   *
   * 원본 투수 레코드 +0x2c 는 경기용 칸이 아니라 **시즌 내내 이어지는 값**이다 (a583fe0): 정규시즌은 첫날만 열 팀
   * `0xb6190` = 10000 이고 그 뒤로는 하루 끝 `0xb617c` 가 +20% 만 채운다 — 경기에서 깎인 값이 다음 경기로 이어진다.
   * 끝 값은 `summaryOf(...).ourPitcherStaminas` 로 나온다. 저장·하루 끝 회복은 부르는 쪽 몫이다.
   */
  readonly ourPitcherStaminas?: readonly number[]
  /** 상대 팀 투수 시작 스태미나 — 표 칸 차례. 뜻은 `ourPitcherStaminas` 와 같다 */
  readonly opponentPitcherStaminas?: readonly number[]
  /**
   * **상대 팀 투수 레코드 차례** (시즌 모드 2 만 본다) — 리그가 들고 다니는 차례(`League.pitcherOrders` ·
   * `postseasonPitcherOrderOf`)를 경기 준비 `0x6548`(670e~673e)이 g ≠ 0 이면 0xb8c80 → 0xb5ca8 로 한 칸 돌린 뒤의 것.
   * 칸 p 에 앉은 붙박이 표 칸이고 0번이 선발 · 나머지가 벤치 차례다 (`0xb891c` 의 `team[i] = i`).
   * 있으면 상대 투수 명단을 이 차례로 세우고 선발은 명단 0번이다. 없으면 `rotationSlotOf(…DayCounter)` 셈(첫 시즌
   * 정규시즌에서만 원본과 같다) · 명단은 표 차례 그대로다.
   */
  readonly opponentPitcherOrder?: readonly number[]
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
  /** 볼넷 + 사구 — 투수 +0x2a 와 같은 셈 (0xa8b58 · 0xa8bd2) */
  readonly walksAllowed: number
  readonly runsAllowed: number
  /**
   * `state+0x88` 출루 허용 — 정산 `0xa8024` 의 `0xa8c5c~0xa8ca6` 이 **주자 목록의 마지막 원소** `+0x96 == 0` 이고
   * 수비 팀이 사람이면 1 로 세운다(지우는 곳 없음). `movs r5,#0` 가 루프 안이라 마지막 원소 하나만 본다 —
   * 야수선택(타자주자 살고 앞 주자 아웃)은 안 깨고, 에러로 산 타자주자는 깬다 (CORRECTIONS 2-1, S5 U-13 1 확정).
   * 웹은 주자 운명 목록(`runnerFates`, 90c7864)을 `baserunnerAllowedOfFates` 로 읽는다 (`allowedBaserunnerOfPlay`).
   */
  readonly allowedBaserunner: boolean
}

/**
 * 기록달성 판정이 보는 원본 칸 (R8 4절 표·5절·6절).
 */
export interface TeamRecordTally {
  /** `ctx+0x162` — 사람 팀 연속 홈런 수 (백투백 6·7). 홈런 아닌 타석·상대 타석이면 0 (0xa794c · 5-4) */
  readonly homeRunStreak: number
  /** `ctx+0x15f` — 이 타석 연속 파울 (32·33). 파울 아닌 공(0xa5fdc, 유력)·타석 초기화(0xa5bcc)에서 0 */
  readonly foulStreak: number
  /** `ctx+0x161` — 이 타석 투구 수 (16 삼구 삼진). 타석 초기화 0xa5bcc 에서 0 — 교체 연출 뒤 타석은 이어받는다 */
  readonly atBatPitches: number
  /** `ctx+0x16c` — 이 반 이닝 투구 수 (25 삼구 삼자범퇴). 반 이닝 시작 0xa5b00 에서 0 — 반 이닝 열쇠로 가른다 */
  readonly halfInningPitches: { readonly inning: number; readonly half: GameState['half']; readonly pitches: number }
  /** 우리 **현재** 투수 경기 기록 `R = team+0x244+4·team[0]` 의 R[0] 삼진 · R[1] 연속 삼진 · R[3] 잡은 아웃 */
  readonly moundStrikeouts: number
  readonly moundStrikeoutCombo: number
  readonly moundOuts: number
  /** `state[0x8c]` — 이 경기에서 사람이 투구 코스를 한 번이라도 확정했는가 (유일한 1 쓰기 0x50e9c) */
  readonly pitchCourseConfirmed: boolean
  // 0xa77f0 첫 게이트(a77f2)가 보는 `[ctx+0x24]` 첫 바이트는 팀 경기에서 늘 0 이라 칸을 두지 않는다 — 1 을 쓰는 곳은
  // 0xc1b48 하나이고 부르는 곳(0x52c62 "그만 던지시겠습니까?" 0x1b · 0x507f8 감독 강판 0x23)이 모두 투수편 강판 길이다.
  // 30G 자동진행 0x3c8da 는 시뮬 초기화 0xc0dac 로 오히려 0 을 쓰고 표시는 engine+0xa0 에 둔다 (R15 10-2·10-3 확정).
}

const EMPTY_RECORD_TALLY: TeamRecordTally = {
  homeRunStreak: 0,
  foulStreak: 0,
  atBatPitches: 0,
  halfInningPitches: { inning: 1, half: '초', pitches: 0 },
  moundStrikeouts: 0,
  moundStrikeoutCombo: 0,
  moundOuts: 0,
  pitchCourseConfirmed: false,
}

/**
 * 화면이 실시간으로 돌리는 한 타구 — 진행기에 넘길 것과, 그것이 끝난 뒤 어느 길로 먹일지.
 *
 * `side` 는 **사람이 어느 쪽을 잡는가** 다 — 조작 객체 `[+0xc]` (0 공격 · 1 수비).
 * 원본은 상태 0x17 갈래 `0x53420` 에서 **공격이면 주루 `0x5331c`**(진루 0x582 · 귀루 0x584 ·
 * OK → 슬라이딩 0x585), **수비면 송구 `0x533c8`**(0x588, 목표 루)로 가른다 (I 0절 표).
 * 팀 경기는 공수를 모두 사람이 맡으니 이 칸도 타석마다 갈린다 — 나만의리그 타자편처럼 고정이 아니다.
 */
export interface PendingDefensePlay {
  /** 사람이 잡은 쪽 — 우리 공격 타석이면 '공격'(주루), 사람이 던진 타석이면 '수비'(송구) */
  readonly side: ControlSide
  /** 진행기에 그대로 넘기는 한 타구 (`startDefensePlay`/`stepDefensePlay` 가 받는다) */
  readonly input: DefensePlayInput
  /** 이 타구를 낸 타석 결과 — 다 돌린 뒤 경기 상태에 먹일 때 쓴다 */
  readonly outcome: AtBatOutcome
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
  /**
   * 장면 +0xfdc — 마지막으로 쓴 번트 종류(0 스윙 · 1~3 번트). CPU 타자는 휘두를 때만(0x34436), 사람은 번트 · 스윙 키가 쓴다.
   * 장면 new 의 0 에서 시작하고 공수가 바뀌어도 남는다. 안 휘두른 공의 주자 판(도루 리드 0x3d7b8)이 본다. 없으면 0
   */
  readonly sceneBuntKind?: number
  /**
   * **승·패·세 투수 칸** state+0x44/0x50/0x5c (S1). 한 점마다(0xa5c34)·투수 교체마다(0xa60c0) 고친다.
   * 경기 끝 결과 판(상태 0x18, 0x4fe9c)이 그대로 읽는다 (`pitchersOfRecordOf`). 칸 번호 = 투수 명단 칸.
   */
  readonly decisions: DecisionState
  /**
   * 마지막으로 **OK 를 기다리며 선** 공수 교대 판(상태 0x18 교대 가지) — 화면은 `serial` 이 바뀌면 판을 띄운다.
   * 판은 앞 장면이 사람 장면이고 다음 장면도 사람 장면일 때만 선다 (`features/play-game/model/halfInningBoard`).
   */
  readonly halfInningBoard: { readonly serial: number; readonly inning: number; readonly half: GameState['half'] } | null
  /** 마지막으로 사람이 잡은 타석의 반 이닝 — 반 이닝이 바뀐 뒤 첫 사람 타석인지 가린다 */
  readonly lastHumanHalf: { readonly inning: number; readonly half: GameState['half'] } | null
  /** 그 뒤로 자동(간이 엔진, 상태 0x21) 타석이 지났는가 — 지났으면 0x18 이 판 없이 넘어간다 (4fab6) */
  readonly autoSinceHuman: boolean
  /**
   * **벤치 클리어링 연출 중**(상태 0x1e) — 사람 타석의 사구가 20/99 굴림에 걸리면 진입(0x3a5f0)의 굴림 45 번까지
   * 쓰고 사구 결과를 붙든 채 멈춘다. 화면이 연출을 끝내고 `resolveBenchClearing` 을 부르면 보통 길(0xae24c)로 간다.
   * `side` 는 사람이 잡은 쪽 — '공격' 우리 타자가 맞음 · '수비' 우리 투수가 맞힘.
   */
  readonly pendingBenchClearing: { readonly side: '공격' | '수비'; readonly outcome: AtBatOutcome } | null
  /** 지금 타석의 볼 카운트 (사람이 잡은 타석에서만 찬다) */
  readonly atBat: AtBatState
  /** 상대 타순 커서 0~8 */
  readonly opponentOrderIndex: number
  /**
   * **지금 마운드에 선** 투수의 로스터 칸. 경기를 세울 때 선발을 정하고(`startingPitcherSlotsOf`
   * — 모드 1·8·9 는 무작위 0x3107a·0x31090, 모드 2 는 4인 로테이션 0xb8c80),
   * 그 뒤로는 CPU 교체 AI(0xac428)나 `#` 메뉴(R4 1b)가 이 칸을 바꾼다 (교체 실행 0xaf09c).
   */
  readonly ourPitcherIndex: number
  readonly opponentPitcherIndex: number
  /**
   * 우리 팀 **투수 명단** — 원본 `team+0x00` 의 "칸 → 투수" 목록이다 (0xb8950).
   * 0번이 선발, 1번부터가 벤치이고, 고른 마투수는 **8번 칸**에 앉는다 (`withAcePitcher`).
   */
  readonly ourPitcherEntry: readonly TeamEntryPitcher[]
  /** 상대 팀 투수 명단 — 일반·대전모드에서는 `0x66968` 이 고른 AI 마투수가 8번에 있다 */
  readonly opponentPitcherEntry: readonly TeamEntryPitcher[]
  /** 이미 마운드를 밟은 투수 칸 — 벤치에서 빠진다 (`team+0x33` 이 줄어드는 자리, 0xaec22) */
  readonly ourUsedPitchers: readonly number[]
  readonly opponentUsedPitchers: readonly number[]
  /** 지금 상대 투수의 스태미나 0~10000 (`+0x2c`). 우리 쪽은 `stamina` 가 들고 있다 */
  readonly opponentStamina: number
  /**
   * **투수 명단 칸마다의 스태미나** `+0x2c` — 원본은 투수 레코드마다 들고 있다. 소모·벤치 클리어링은 지금 투수
   * 레코드(`0xae83c`)의 +0x2c 를 깎고(`0xaeab0`), 교체 실행 `0xaebe4` 에는 +0x2c 쓰기가 없다(직접 떴다) —
   * 그래서 내려간 투수는 깎인 값이 남고 올라온 투수는 **제 레코드 값**으로 선다. 지금 마운드 칸은 `stamina` ·
   * `opponentStamina` 가 들고 있고 이 배열의 그 칸은 **올라설 때의 값**이다 (내려갈 때 되적는다).
   */
  readonly ourPitcherStaminas: readonly number[]
  readonly opponentPitcherStaminas: readonly number[]
  /** 지금 우리·상대 투수의 실점 카운터 A·B 와 투구 수 (`team+0x27c` 묶음, P7 E1) */
  readonly ourPitcherCounters: MoundPitcherCounters
  readonly opponentPitcherCounters: MoundPitcherCounters
  /**
   * 이 경기를 던진 양 팀 투수 줄 (`entities/game/model/gamePitcherLines`, 붙박이 표 칸 — 마투수는 뺀다) — 사람·간이 타석·
   * 주자 판의 정산 0xa8024 마다 아웃·실점·삼진을 그 순간 마운드 투수에게, 투구 0xa5e14 마다 투구 수를 쌓는다.
   */
  readonly pitcherLines: readonly GamePitcherLine[]
  /**
   * 우리 팀 **명단** — 원본 `team+0xe` 의 "칸 → 선수" 목록이다.
   * 칸 0~8 이 타순, 9 부터가 벤치다. 대타(`pinchHit`)가 두 칸을 맞바꾸고 빠진 선수를 지운다.
   */
  readonly ourEntry: readonly TeamEntryBatter[]
  /** 벤치에 남은 우리 타자 수 (`team+0x28c`) — `#` 대타 화면의 진입 조건이다 */
  readonly ourBenchBatters: number
  /**
   * 상대 팀 **명단** — 우리 것과 같은 `team+0xe` 목록이다. CPU 대타(`0xac228`)가 이 목록을 바꾼다.
   * 일반·대전모드에서는 `0x66994` 로 고른 AI 마타자가 벤치 첫 칸(9번)에 들어가 있다.
   */
  readonly opponentEntry: readonly TeamEntryBatter[]
  /** 벤치에 남은 상대 타자 수 (`team+0x28c`) */
  readonly opponentBenchBatters: number
  /**
   * 타순 칸별 이 경기 기록 (`team + 0x34 + 타순×0x18` 의 안타·홈런·타석) — `0xac228` 이 본다.
   * 명단과 길이·차례가 같다: 대타가 두 칸을 맞바꾸고 빠진 칸을 지우면 기록도 같이 움직인다
   * (원본 `0xaebe4` 도 24바이트 기록을 함께 옮긴다).
   */
  readonly ourEntryRecords: readonly BatterGameRecord[]
  readonly opponentEntryRecords: readonly BatterGameRecord[]
  /**
   * **우리 타순 칸별 루타 목록** — 원본도 같은 24바이트 기록(`team + 0x34 + 타순×0x18`) 안에
   * 루타 값 1~4 를 하나씩 밀어 넣는다 (`0xa86e0`). 사이클 판정 `0xa7610` 이 이 목록만 훑어
   * 1·2·3·4 가 다 들어 있는지 본다.
   *
   * `0xa7610` 은 **공격측이 사람일 때만** 참을 돌려주므로(`a7644`: `st[0x31+st[9]] == 0`)
   * 우리 타순만 들고 있으면 된다. 대타가 두 칸을 맞바꿀 때 기록 24바이트와 **같이 움직인다**
   * (`aed02~aed16` — `substituteBatter`).
   */
  readonly ourHitBases: readonly (readonly number[])[]
  /**
   * **시즌 평판 평가 16칸** (`SR+0x1a0..0x1af`) — 경기 중 `0xa755c(ctx, k)` → `0xa3440(SR, k)`
   * 이 한 칸씩 올리는 그 배열이다 (S4 2b·3절).
   *
   * 원본은 시즌 레코드를 직접 올리지만 웹 진행기는 시즌 세이브를 모르므로 여기에 쌓아 두고,
   * `summaryOf` 가 실어 보내면 `useSeasonSession.finishGame` 이 `evaluateSeasonGame` 앞에서
   * `record.gameRecord` 에 꽂는다. 지우는 곳은 **경기 직전 화면 한 곳뿐**이라(`0xa3424`)
   * 여기서는 경기를 세울 때 한 번만 비운다.
   */
  readonly gameRecord: readonly number[]
  /**
   * `state[0xe]` — **다음 공이 나가기 전까지** CPU 대타를 다시 묻지 않게 막는 칸 (양 팀 공용 한 칸).
   * "경기에 한 번" 이 아니다 — 대타 횟수를 막는 것은 벤치 수·타순 칸 기록(`0xac228` 의 다른 조건)뿐이다.
   *
   * - 세우는 곳: `0xac228` 이 대타를 낼 때 1 (ac33e).
   * - 지우는 곳(전수 — `strb …,[state+0xe]` 꼴 셋):
   *   · **공마다** 투구 처리 `0xa5e14` 의 a5e7c (a5e72 의 state[0xd] = 0 바로 뒤) — 사람 장면 공이 손을 떠날 때
   *     (`0x3de10` 의 3dec6)와 간이 엔진 공마다(`0xc262c` 의 c26ca) 둘 다 부른다.
   *   · 사람 장면 타석 시작 `0x48d50` 의 48eb6 — 이전 상태(`scene+0x28`)가 0x16 이면 건너뛴다 (48e94).
   *   · 경기 상태 초기화 `0xb67d0` 의 b6806 (경기를 세울 때).
   * 그래서 간이 엔진에서는 대타를 낸 뒤 `0xc262c` 가 같은 타석으로 다시 들어올 때(`0xc1ba4` 재호출) 한 번 막고,
   * 사람 장면에서는 0x16 → 0xd → 0xe → 0xf 로 다시 들어온 `0x3d954` 를 한 번 막는다. 공이 하나 나가면 다시 열린다.
   */
  readonly cpuPinchHitUsed: boolean
  /**
   * **대타 홈런 칸 `ctx+0x160`** — 사람 팀이 대타를 낸 그 타석인가. 세운 반 이닝을 같이 들어 반 이닝이 바뀌면
   * 저절로 무효다 (다음 타석 시작이 지우는 것과 같은 결과).
   *
   * - 세우는 곳: 교체 연출 상태 0x16 진입 `0x3d458` 의 `0xa5bf0(ctx, 0)`(3d57e) 하나 — 대타 예약 `team[+0x291]` 이
   *   서 있고 **공격 팀이 사람**일 때만 1 (a5c04~a5c26). 웹은 사람 대타 `pinchHit` 뿐이다.
   * - 지우는 곳: 타석 초기화 `0xa5bcc` (ctx+0x15f·0x160·0x161·+0x2c·+0x188 = 0). 사람 장면 타석 시작 `0x48d50` 이
   *   부르지만 **이전 상태 `scene+0x28` 이 0x16 이면 건너뛴다** (48e94 `cmp r3,#0x16 ; beq 48eb8`) — 그래서 대타를
   *   낸 바로 그 타석에서는 칸이 살아 있다. 간이 엔진 `0xc262c` 는 타석마다 지운다(c26b6).
   * - 쓰는 곳: 정산 0xa8024 안타 갈래 a8764 — 홈런이고 이 칸이 서 있으면 기록 5 (`pinchHitHomeRunRecordIdsOf`).
   */
  readonly pinchHitHomeRunHalf: { readonly inning: number; readonly half: GameState['half'] } | null
  /**
   * 이 경기에서 쌓인 **기록달성 번호** (지급 `0xa77f0` 게이트를 지난 것) — 경기 끝 0xa7de8 몫(28~31·37~39)은
   * `summaryOf` 가 덧붙인다.
   *
   * 원본은 팀 경기에서도 쌓고 준다: 0xa77f0 은 모드 5·6·7 만 막고(a780a) 경기 끝 0x4ea0c 는 모드 5·6 만 다른 갈래로
   * 보낸 뒤(4eb64) 나머지 모드는 `scene+0x17f4 = Σ 횟수 × 0xcfbf8[k]`(4ebe0~4ec36)를 저장 G(+0x64)에 더한다(4ec5a,
   * 99999 상한). 방향 게이트(공격 0~15·32~39 / 수비 16~31·36)는 `passesRecordTeamGate`. 30G 자동진행은 기록을
   * 막지 않는다 — 간이 엔진 쪽 지급 지점(0xc15a4·0xc1818)이 살아 있다 (R15 10-3).
   */
  readonly recordIds: readonly number[]
  /** 기록달성 판정이 보는 원본 칸들 (경기 객체 ctx · 경기 상태 state · 우리 투수 경기 기록 R) */
  readonly recordTally: TeamRecordTally
  /**
   * **우리 타순 칸별 이번 경기 타석 결과** — 원본은 같은 24바이트 기록(`team + 0x34 + 타순×0x18`)에 결과 코드를
   * 쌓고(0xa908d) 연타석(0xa7b90)·한 타자 홈런(0xa7b00)·볼넷(0xa7a7c)·사이클(0xa7610)이 이 목록을 본다.
   * 명단과 길이·차례가 같고 대타가 두 칸을 맞바꿀 때 **같이 움직인다** (`aed02~aed16` — `substituteBatter`).
   * 기록달성의 방향 게이트가 "공격 팀이 사람" 이라 우리 타순만 들고 있으면 된다.
   */
  readonly ourBatterLogs: readonly BatterGameLog[]
  /**
   * 사람 경기 장면에서 지난 **대타 교체 연출(상태 0x16)** 의 마지막 한 번 — 소리 고리가 앞뒤를 견준다.
   * `by` 가 'CPU' 면 0xf 진입 `0x3d954` 의 CPU 대타(3da70 → 22 @3da88 → 0x16), '사람' 이면 `#` 교체 창의 OK.
   * `incomingIsAce` 는 들어온 타자 레코드의 `0xb633c`(+0xa & 0x40) — 등판음 0x38b64 타자 가지가 본다.
   */
  readonly scenePinchHit: {
    readonly serial: number
    readonly by: '사람' | 'CPU'
    readonly incomingIsAce: boolean
  } | null
  /**
   * 사람 경기 장면에서 지난 **CPU 투수 교체 연출(상태 0x16)** 의 마지막 한 번 — 0xf 진입 `0x3d954` 의 0xac428
   * (3da3e, 수비 팀이 CPU 일 때) → "Time!" 22(3da88) → 0x16 → 0xe 투수 등판음(0x38b64 투수 가지).
   * `incomingIsAce` 는 올라온 투수가 마투수인가(`0xb633c`). 간이 엔진 교체는 연출이 없어 이 칸을 안 바꾼다.
   */
  readonly scenePitcherChange: { readonly serial: number; readonly incomingIsAce: boolean } | null
  /**
   * `0x66968`·`0x66994` 가 뽑은 **AI 팀 마투수·마타자 번호** 0~4 — 일반모드 `0x30f20` · 시즌 정규·포스트시즌
   * 0xdd 진입 `0x6548`(`seasonOpponentAces`). 굴리지 않은 경기(국가대항전 등)는 −1.
   * 마타자는 `opponentEntry` 벤치 첫 칸(9번)에, 마투수는 `opponentPitcherEntry` 8번 칸에 들어가 있다.
   */
  readonly opponentAcePitcherIndex: number
  readonly opponentAceBatterIndex: number
  /** `state[0xd]` — 교체 직후 한 투구 동안은 다시 안 바꾼다 (0xa5e72 가 투구마다 0 으로) */
  readonly pitcherJustChanged: boolean
  /** 이 타석의 준비(상태 0xe·0xf)를 이미 지났는가 */
  readonly atBatPrepared: boolean
  /**
   * **상태 0xe 의 OK 대기** — 0xe 에 들어설 때마다 새 객체다 (`features/play-game/model/sceneConfirm`). 화면이
   * `useSceneConfirm` 으로 OK 를 받을 때까지 타석·투구를 내지 않는다. 0xe 를 아직 안 지났으면 null.
   */
  readonly sceneConfirm: SceneConfirmWait | null
  /**
   * 0xe 에 서서 **OK 를 아직 안 받았다** — OK 뒤의 굴림(메시지 1 의 돌발 0x8f158 · 0xf 진입 0x3d954 의 CPU 교체)을 아직
   * 안 돌렸다. 화면이 OK 를 받으면 `confirmScene` 이 그때 돌린다. 그래서 0xe 에서 연 '#' 교체 창(0x4994a)을 확정·취소해도
   * 굴림은 OK 뒤 한 번뿐이다(원본 차례). 없으면 거짓.
   */
  readonly sceneConfirmPending?: boolean
  /** 우리 투수 스태미나 0~10000 (레코드 +0x2c) */
  readonly stamina: number
  /**
   * **우리 팀 남은 마구 횟수** = s8 팀[+0x28] (0xaea10 이 읽고 0xae9c4 가 쓴다) — 팀당 한 칸이다.
   * 마운드에 오른 투수로 채운다(`magicCountOfPitcher`): 선발은 경기 시작, 구원은 교체 때.
   */
  readonly magicRemaining: number
  /**
   * **상대 팀 남은 마구 횟수** = 상대 팀 s8 [+0x28] — `magicRemaining` 과 같은 규칙(`magicCountOfPitcher`)으로
   * 선발·교체 때 채운다. 사람 타석에서 CPU 구질 고르기 0x344dc 가 보고 소모 0x345fc 가 줄인다(`throwOpponentPitch`).
   * 타석 화면(`BattingStage.cpuMagic`)은 이 값의 사본으로 고를 뿐이라 반 이닝·화면을 건너도 이어진다.
   */
  readonly opponentMagicRemaining: number
  /**
   * **공 객체 +0x10** — 이번 공에 실린 마구 번호 (0x3de10, H2 3-4). 되돌리는 코드가 없어
   * 한 번 마구를 던진 뒤로는 직구·변화구에도 남는다. 타석 판정의 보정 구조체 0x34d6c 투수 쪽이 본다.
   *
   * 원본 공 객체(경기+0xf98)는 **경기에 하나**라 사람 투구(0x50e9c → 0x3de10)와 CPU 투구(0x345fc → 0x3de10)가
   * 이 한 칸을 함께 쓴다 — 그래서 결과가 갈린다:
   *   ① CPU 소모 조건 `구질 22 && 공+0x10 ≠ 0 && 남은 > 0`(0x34894~0x348d2) — 사람이 먼저 마구를 던졌으면
   *      CPU 의 그 경기 첫 마구도 **공짜가 아니다**(따로 들면 늘 공짜).
   *   ② 0x34d6c 투수 쪽은 공+0x10 ≠ 0 이면 **지금 수비 투수**(0xae83c)로 칸을 고른다 — CPU 마구 뒤 사람 마투수의
   *      직구에도(사람이 아직 마구를 안 던졌어도) 그 마투수 레벨 보정이 붙고, 사람 마구 뒤 CPU 마투수 공도 같다.
   */
  readonly ballMagicNumber: number
  /**
   * **타순 칸별 이 경기 남은 필살 횟수** = s8 팀[+0x29 + 타순] (0xaea30 이 읽고 0xae9e8 이 쓴다). 아홉 칸.
   * −1 은 "아직 안 채움" — 타석 교대 0xaebe4 가 그 타순 선수로 채운다(`specialSwingRemainingAt`).
   * 대타 교체(0xaede0) 때 그 칸을 −1 로 되돌린다. 이닝이 바뀌어도 다시 차지 않는다 (H2 1-2).
   */
  readonly ourSpecialSwingRemaining: readonly number[]
  readonly opponentSpecialSwingRemaining: readonly number[]
  readonly pitchCount: number
  readonly lastPitch: Pitch | null
  readonly lastResolution: PitchResolution | null
  /**
   * **재생만 하면 되는** 장면 — 매 틱 스냅샷이 들어 있어 화면은 이것만 받아 그리면 된다.
   * 홈런 비행처럼 사람이 조작할 것이 없는 장면이 여기 들어온다. 사람이 주루·송구를 잡는
   * 인플레이 타구는 `pendingDefensePlay` 쪽으로 가고, 다 본 뒤에는 **여기 남기지 않는다**
   * — 남기면 같은 장면을 한 번 더 튼다.
   */
  readonly lastDefensePlay: DefensePlayResult | null
  /**
   * **이번 투구에 출발한 주자들의 루** — state[0x14 + 루] (도루 메시지 0x583 → `0xa9bd4`).
   * 사람 공격은 공이 나는 동안(상태 0x11) 키 '3'·'2'·'1' 로 쌓이고(`startSteal`, 난수 없음), CPU 공격은 투구마다
   * CPU 타자 결정(0x34334) 바로 앞에서 `0x520de` 를 굴려 넣는다(`rollCpuStealStart`). 공이 도착하면(0x3dfac)
   * 도루 판(종류 5)을 열거나 그냥 지워지고, 인플레이 타구면 타구 판의 리드(0x3d7b8)가 이 칸을 본다.
   */
  readonly stealingFrom: readonly StealBase[]
  /**
   * **마지막으로 열린 공 도착 판** (0x3dfac — 종류 9 폭투·포일 · 종류 5 도루). 판정 콜(17 · 62/20)을 고르는 데만 쓴다 —
   * 걸음 앞뒤가 다른 객체면 이번 걸음에 새로 열린 판이다. 재생은 `lastDefensePlay` 가 맡는다.
   */
  readonly lastArrivalPlay: PitchArrivalPlay | null
  /**
   * **지금 화면이 실시간으로 돌리고 있는 타구.** 차 있으면 이 경기는 "수비 진행 중" 이고,
   * 타석 결과(안타/아웃 코드)만 정해졌을 뿐 **진루·아웃·득점은 아직 하나도 안 먹였다**.
   *
   * 원본은 타구가 뜨면 경기 장면이 상태 0x17 로 넘어가 공이 멈출 때까지 같은 루프를 돌며
   * 매 갱신 눌린 키를 읽는다 (R10 · I 0절). 그 동안 다음 투구는 나가지 않는다 —
   * 웹도 이 칸이 차 있는 동안 `isHumanTurn` 이 거짓이 되어 다음 타석을 시작하지 않는다.
   *
   * 화면이 다 돌고 나면 `resolveDefensePlay` 가 그 결과를 먹이고 이 칸을 비운다.
   * 미리 다 계산해도 되는 자리(자동 소화·테스트)는 `applyBatterOutcome`·`throwPitch` 를 부르면
   * 이 칸을 거쳐 가되 한 번에 비워져 나온다 — 밖에서 보면 예전과 똑같다.
   */
  readonly pendingDefensePlay: PendingDefensePlay | null
  readonly pitching: TeamPitchingLine
  /** 우리 팀 타선이 친 안타 수 (간단 박스스코어) */
  readonly ourHits: number
  /** 리그 선수 기록표에 넘길 타석 결과 — **양 팀 전부** (원본 0xa8024 가 사람 경기도 같게 쌓는다) */
  readonly leaguePlateAppearances: readonly LeaguePlateAppearance[]
  /** 리그 기록표 +0x2c 에 넘길 도루 (`withLeagueStolenBases`). 없으면 빈 것 */
  readonly leagueStolenBases?: readonly LeagueStolenBase[]
  /** 이번 경기의 돌발미션 (경기 장면이 모드 2·3·4 에서만 만든다 — 팀 경기에서는 **시즌만**) */
  readonly burst: BurstSession | null
  readonly lastBurstResolution: BurstResolution | null
  /** 이 경기에서 난 돌발 판정의 보상·페널티 — `resolveBurst` 의 `deltas` 를 판정 차례대로 이어 붙인다 */
  readonly burstRewardDeltas: readonly BurstRewardDelta[]
  readonly log: readonly TeamGameLogEntry[]
  readonly nextLogId: number
  /**
   * **마지막 이어하기 저장 시점의 진행** (원본 반 이닝 자동 저장 `0x4f928` 이 파일에 쓴 그 순간) — 없으면 아직 안 썼다.
   * 이 진행 자신의 `halfInningSave` 는 늘 null 이다(사슬이 생기지 않게). 부르는 쪽(일반모드 앱)이 받아 저장소에 담고,
   * 이어하기는 `resumeTeamGame` 으로 다시 세운다. 쓰는 자리·담기는 것은 `TEAM_GAME_RESUME_SAVE` 주석.
   */
  readonly halfInningSave?: TeamGameProgress | null
}

/**
 * **이어하기 자동 저장** — 원본 경기 상태 0x18 갱신 `0x4f928` 의 틱 0 (R10 5절, 2026-10-06 직접 다시 뜸).
 *
 * ## 쓰는 자리
 * ```
 * 4f938 0xb68fd(st) 경기 끝이면 → 저장 없이 결과 판 가지
 * 4f962 틱 [경기+0x2c] == 0 일 때만:
 * 4f978 0xaebe4(팀0, 0) · 0xaebe4(팀1, 0)      ; 예약 교체 확정(team+0x293 → +0x32 다음 타자 등) — **저장보다 앞**
 * 4f990 모드 [+0x1104] ∈ {1,2,8,9} (비트 0x306) 이고 이전 상태 [경기+0x28] ≠ 9 이면:
 * 4f9b2   0x1fdec(저장)  — 대기열 비우기
 *         모드 1: 0x1fdb0(저장, 0x32, 팀[+0x228], 0) · (저장, 0x32, 팀[+0x22c], 1) · (저장, 0x33, st, 0)
 *         (2 → 0xb·0xc·0xd · 8 → 0x29·0x2a · 9 → 0x3d·0x3e)
 * 4fa9e   0x4e8b0(경기)  — 모드별 플레이 시간 누계(0x22efc), 기록 아님
 * 4faaa   0x22754(저장, 1) — 대기열을 저장 블록에 복사(팀 0x290 바이트 × 2 → 블록+4 · +0x294, st 0xa4 바이트 → 블록+0x524)
 *                            하고 **모드 블록 전체**를 직렬화(0x226dc → 0x2264c)해 파일에 쓴다
 * 4fac2 그 뒤에야 0xc2198 (자동진행 갈림) · 판이 서면 0x3fac4 (굴림 36)
 * ```
 * 0x18 은 3아웃 뒤(진입 0x3ac90 이 초/말을 뒤집고 주자·반 이닝 투구 수를 지운 **뒤**)뿐 아니라 인트로 0xc 끝(1회초 판)·
 * 자동진행 0x21 이 사람에게 넘길 때(반 이닝 중간이어도 48544)도 지난다 — 그때마다 쓴다. 경기 끝이면 안 쓴다.
 * 이전 상태 9(적재)에서 곧장 0x18 로 오는 길은 모드 1 에 없다(1~4 는 인트로 0xc 를 지난다).
 *
 * ## 담기는 것 — 모드 1 파일 (0x2264c)
 * 시간 4바이트(app+0xd8) · 두 팀 객체 0x290 바이트씩(타순·명단·투수 차례·벤치 수·타순 칸 기록 24바이트·필살/마구 남은 횟수·
 * 투구 수 +0x27c·실점 A/B — 객체 0x29c 중 **+0x290~ 교체 예약 바이트만 빠진다**) · 경기 상태 st 0xa4 바이트(이닝·초말·아웃·
 * 점수·승패세 칸·출루 허용 등) · 두 팀 레코드(0x20854 — 선수 레코드, 투수 스태미나 +0x2c) · 기록달성 횟수 40칸(블록+0x600).
 * **난수 씨앗은 없다** — 전역 rand(0xbfa54)의 상태는 bss 0x15606d4 라 어느 저장 블록에도 안 든다.
 * 경기 장면 객체(+0x1780 시뮬 · 돌발 · 공 객체 +0x10 마구 · 기록 ctx 의 연속 홈런/파울/타석 투구 수 · 화면 G 누계 evt+0x180)는
 * 장면 쪽이라 안 남는다.
 *
 * ## 다시 세우기 — 이어하기 0x213c0(앱, 1, 0) → 장면 0x104
 * 0x213c0 이 모드 1 파일을 블록에 올리고 → 상태 7 → 9(0x3f584): 3f60a `0x1fdb0` 로 같은 칸 셋을 걸고 3f834 `0x21c54(저장, 0)` 이
 * 블록 → 팀 둘·st 로 되복사 → 3f856 0x39fdc(모드 1 갈래 3a076 은 구장·관중 그림만, 팀을 새로 안 세운다) → 3fa0e 시뮬 초기화
 * rand(0, 2) · 0xa5bb0 · 0xa5b00(기록 ctx·반 이닝 투구 수) → 8 → 인트로 0xc → 0x18(판, 아웃 0 이라 뒤집지 않음) 또는 0xd.
 * 새 경기도 같은 길이다 — 경기정보 OK(0x3136e)가 0x30f20 이 세운 팀·st 를 블록에 두고 파일을 쓴 뒤 장면 0x104 로 간다.
 */
export const TEAM_GAME_RESUME_SAVE = { modes: [1, 2, 8, 9] } as const

/** 저장 진행 — 제 안의 저장 칸은 비운다 */
function savePointOf(progress: TeamGameProgress): TeamGameProgress {
  return { ...progress, halfInningSave: null }
}

/**
 * **이어하기** — 저장된 진행(`halfInningSave`)에서 경기를 다시 세운다 (0x213c0(앱, 1, 0) → 장면 0x104 의 상태 9 · 8 · 0xc).
 *
 * 저장 블록에 드는 것(팀 둘·st·팀 레코드·기록달성 횟수)은 그대로 두고, 장면·기록 ctx·공·돌발 쪽은 새 장면처럼 비운다.
 * 그 뒤 새 경기와 같은 꼬리 — 시뮬 초기화 rand(0, 2) 한 번(3fa0e) → 인트로 끝의 판(굴림 36) 또는 곧장 첫 타석.
 * 저장된 진행은 아웃 0 · 볼카운트 0 인 자리라(0x18 진입이 지웠다) 판은 그 반 이닝으로 선다.
 */
export function resumeTeamGame(saved: TeamGameProgress, random: RandomPort): TeamGameProgress {
  const { game } = saved
  const restored: TeamGameProgress = {
    ...saved,
    // 장면 쪽 — 상태 0x18 판·자동진행 표시(+0x1784)·벤치 클리어링·수비 재생·교체 연출·공 도착 판
    halfInningBoard: null,
    lastHumanHalf: null,
    autoSinceHuman: false,
    pendingBenchClearing: null,
    atBat: createAtBat(),
    atBatPrepared: false,
    sceneConfirm: null,
    sceneConfirmPending: false,
    lastPitch: null,
    lastResolution: null,
    lastDefensePlay: null,
    lastArrivalPlay: null,
    pendingDefensePlay: null,
    scenePinchHit: null,
    scenePitcherChange: null,
    // 공 객체 +0x10 — 장면이 새로 만든다 (startTeamGame 과 같은 0)
    ballMagicNumber: 0,
    // 기록 ctx(0xa5bb0 · 0xa5b00) — 연속 홈런 +0x162 · 연속 파울 +0x15f · 타석 투구 수 +0x161 · 반 이닝 투구 수 +0x16c · 대타 칸 +0x160.
    // 우리 투수 경기 기록 R(team+0x244)·코스 확정 st[0x8c] 는 저장 블록이라 남는다
    recordTally: {
      ...saved.recordTally,
      homeRunStreak: 0,
      foulStreak: 0,
      atBatPitches: 0,
      halfInningPitches: { inning: game.inning, half: game.half, pitches: 0 },
    },
    pinchHitHomeRunHalf: null,
    // 돌발 객체(경기 장면 +0xf28)도 장면이 새로 만든다 — 팀 경기에서는 시즌만 있다
    burst: createBurstSession(saved.options.mode),
    lastBurstResolution: null,
    halfInningSave: null,
  }
  // 이어하기도 상태 7(0x3e340)부터 장면을 새로 연다 — 3ed76 → 0xb08e8 패턴 덱을 새로 섞는다
  openScenePatternDeck(random)
  // 상태 9 의 공통 꼬리 0x3fa0e — 새 경기와 같은 rand(0, 2) 한 번
  rollSimulatorInit(random)
  return advance({ ...restored, halfInningSave: savePointOf(restored) }, random)
}

/* ── 시작 ────────────────────────────────────────────────────────────────────── */

/**
 * 이 경기의 양 팀 선발 칸 — **모드마다 원본이 다르다**.
 *
 *   - 모드 1 일반 · 8·9 대전 (`0x30f20`·`0x30be0`): 경기를 세울 때 `0xb8c94(팀, 0, bfa54(0,4))`
 *     로 **로스터 앞 4명 중 무작위** (S13 1-4b 확정). AI 팀 → 사람 팀 차례로 뽑는다.
 *   - 모드 2 시즌: 경기 직전 화면 `0x6548` 이 `0xb8c80` → `0xb5ca8` 로 **양 팀 4인 로테이션**을
 *     한 칸 돌린다 (R13 4절 · P1 1-1 과 같은 규칙). 무작위가 아니다.
 *
 * 로테이션 쪽은 붙박이 로스터를 섞을 수 없어 칸 번호로 셈한다 — `rotationSlotOf` 주석(**근사다**).
 */
function startingPitcherSlotsOf(
  options: TeamGameOptions,
  random: RandomPort,
): { readonly opponent: number; readonly ours: number } {
  if (options.mode === TEAM_GAME_MODE.시즌) {
    const day = options.dayCounter ?? 0
    // 리그 차례를 받았으면 상대 명단이 그 차례라 선발은 명단 0번이다 (`opponentPitcherEntryOf`)
    if (options.opponentPitcherOrder !== undefined) return { opponent: 0, ours: rotationSlotOf(day) }
    // 상대 칸만 다른 날짜를 받을 수 있다 — 국가대항전 상대국 슬롯은 매일 새로 복사된다 (`opponentDayCounter`)
    return { opponent: rotationSlotOf(options.opponentDayCounter ?? day), ours: rotationSlotOf(day) }
  }
  // 일반모드는 상태 22 진입(0x30f20)에서 이미 굴렸다 — `rollTeamSetup`
  if (options.startingPitcherSlots !== undefined) return options.startingPitcherSlots
  // 원본은 AI 팀 → 사람 팀 차례로 뽑는다 (0x31088 → 0x3109e)
  const opponent = rollStartingPitcherIndex(random)
  return { opponent, ours: rollStartingPitcherIndex(random) }
}

/**
 * **AI 팀 마선수 번호 둘**을 굴린다 — 마투수 `0x66968` → 마타자 `0x66994` 차례 (난수 2).
 * 인자는 사람이 고른 마선수(준비 기록 `+0xe`·`+0xd`)다 — 겹치지 않는 번호가 나온다(`rollOpponentAceIndex`).
 *
 * 부르는 자리 (둘 다 경기 장면 **전**이다):
 *   - 일반모드 경기 세우기 `0x30f20` (31058 → 31064 `0xb88c8(AI팀, v)` · 3106c → 31076 `0xb8870(AI팀, w)`)
 *     — 상태 22 진입 `0x314b0`(이전 상태가 23 이 아니고 모드 1 일 때, 3158c)과 `*` 재굴림 끝(31290)이 부른다.
 *   - 시즌 0xdd 진입 `0x6548` (국가대항전이 아닐 때 66ee → 66f8 · 6700 → 670a, 상대 팀 `[sp+4]`).
 */
export function rollOpponentAces(
  acePitcherId: number,
  aceBatterId: number,
  random: RandomPort,
): { readonly pitcher: number; readonly batter: number } {
  const pitcher = rollOpponentAceIndex(acePitcherId, random)
  const batter = rollOpponentAceIndex(aceBatterId, random)
  return { pitcher, batter }
}

/** 일반모드 `0x30f20` 이 굴리는 넷 — 상대 마선수 둘과 선발 둘 */
export interface TeamSetupRolls {
  readonly opponentAces: { readonly pitcher: number; readonly batter: number }
  readonly startingPitcherSlots: { readonly opponent: number; readonly ours: number }
}

/**
 * **일반모드 경기 세우기 `0x30f20` 의 굴림 넷** — 마투수(31058) → 마타자(3106c) → AI 선발(3107a) →
 * 사람 선발(31090). 원본은 이것을 **상태 22 진입**(`0x314b0` 3158c · 재굴림 끝 31290)에서 한다 — 그래서
 * 경기정보·엔트리 편집(상태 23)이 이미 굴린 팀을 본다. 결과는 옵션 `opponentAces` · `startingPitcherSlots` 로 넘긴다.
 */
export function rollTeamSetup(
  acePitcherId: number,
  aceBatterId: number,
  random: RandomPort,
): TeamSetupRolls {
  const opponentAces = rollOpponentAces(acePitcherId, aceBatterId, random)
  // 3107a: 0xb8c94(AI팀, 0, rand(0,4)) → 31090: 0xb8c94(사람팀, 0, rand(0,4))
  const opponent = rollStartingPitcherIndex(random)
  return { opponentAces, startingPitcherSlots: { opponent, ours: rollStartingPitcherIndex(random) } }
}

/**
 * 이 경기의 **AI 팀 마선수 번호 둘** — 미리 굴린 것(`opponentAces`)이 있으면 그것, 없으면 여기서 굴린다.
 *
 * ⚠️ **굴림 차례가 원본과 같아야 한다** — `0x30f20` 은 마투수(`31058`) → 마타자(`3106c`) →
 * AI 선발(`3107a`) → 사람 선발(`31090`) 차례로 넉 장을 뽑는다. 그래서 여기가
 * `startingPitcherSlotsOf` 보다 **먼저** 돌아야 한다.
 *
 * 시즌(모드 2)은 `0x30f20` 을 타지 않는다 — `seasonOpponentAces` 가 서 있을 때만 0xdd 진입 `0x6548` 의
 * 굴림 둘을 여기서 한다 (국가대항전은 안 굴린다).
 */
function opponentAceIndexesOf(
  options: TeamGameOptions,
  random: RandomPort,
): { readonly pitcher: number; readonly batter: number } {
  if (options.opponentAces !== undefined) return options.opponentAces
  if (options.mode === TEAM_GAME_MODE.시즌 && options.seasonOpponentAces !== true) return { pitcher: -1, batter: -1 }
  return rollOpponentAces(options.acePitcherId ?? NO_ACE_BATTER, options.aceBatterId ?? NO_ACE_BATTER, random)
}

/**
 * 상대 팀 투수 명단 — 시즌에 리그 차례(`opponentPitcherOrder`)를 받았으면 그 차례로 표 칸을 늘어세운다(칸마다 제 표 칸
 * `orderIndex` · 보직을 그대로 든다 — 로테이션 0xb5ca8 은 레코드째 옮긴다). 그 밖은 표 차례 그대로.
 */
function opponentPitcherEntryOf(options: TeamGameOptions): readonly TeamEntryPitcher[] {
  const table = options.opponentEntryOrder === undefined
    ? rosterEntryPitchersOf(options.opponentTeamId)
    : entryPitchersOfOrder(options.opponentTeamId, options.opponentEntryOrder)
  const order = options.mode === TEAM_GAME_MODE.시즌 ? options.opponentPitcherOrder : undefined
  if (order === undefined) return table
  return order.flatMap((slot) => {
    const pitcher = table[slot]
    return pitcher === undefined ? [] : [pitcher]
  })
}

/** 시작 스태미나 배열을 명단 칸으로 — 명단 차례(`orderIndex`)로 찾고, 없는 칸·마투수는 10000 */
function pitcherStaminasOf(
  entry: readonly TeamEntryPitcher[],
  given: readonly number[] | undefined,
): readonly number[] {
  return entry.map((pitcher) => {
    const value = pitcher.orderIndex >= 0 ? given?.[pitcher.orderIndex] : undefined
    return value === undefined ? FULL_STAMINA : Math.max(0, Math.min(FULL_STAMINA, value))
  })
}

export function startTeamGame(options: TeamGameOptions, random: RandomPort): TeamGameProgress {
  const opponentAces = opponentAceIndexesOf(options, random)
  const startingSlots = startingPitcherSlotsOf(options, random)
  // 0x30f20 의 순서 그대로 — 팀을 세운 뒤 고른 마타자를 벤치에 끼워 넣는다 (0xb8870).
  // 엔트리 편집기가 고친 차례가 있으면 그 차례가 곧 팀 레코드다 (0xb891c 는 첨자만 든다)
  const ourOrder = options.ourEntryOrder
  const ourEntry = withAceBatter(
    ourOrder === undefined ? rosterEntryBattersOf(options.ourTeamId) : entryBattersOfOrder(options.ourTeamId, ourOrder),
    options.aceBatterId ?? NO_ACE_BATTER,
  )
  // 상대 팀도 그 팀 레코드 차례로 선다 (0xb8680 → 0x1f570 — 트레이드로 바뀐 CPU 팀이면 바뀐 레코드)
  const opponentEntry = withAceBatter(
    options.opponentEntryOrder === undefined
      ? rosterEntryBattersOf(options.opponentTeamId)
      : entryBattersOfOrder(options.opponentTeamId, options.opponentEntryOrder),
    opponentAces.batter,
  )
  // 0x31042 · 0x31064 — 마타자와 **같은 자리에서** 마투수도 양 팀에 들어간다 (0xb88c8)
  const ourPitcherEntry = withAcePitcher(
    ourOrder === undefined
      ? rosterEntryPitchersOf(options.ourTeamId)
      : entryPitchersOfOrder(options.ourTeamId, ourOrder),
    options.acePitcherId ?? NO_ACE_BATTER,
  )
  const opponentPitcherEntry = withAcePitcher(opponentPitcherEntryOf(options), opponentAces.pitcher)
  const ourPitcherStaminas = pitcherStaminasOf(ourPitcherEntry, options.ourPitcherStaminas)
  const opponentPitcherStaminas = pitcherStaminasOf(opponentPitcherEntry, options.opponentPitcherStaminas)
  const initial: TeamGameProgress = {
    options,
    ourEntry,
    opponentEntry,
    ourPitcherEntry,
    opponentPitcherEntry,
    ourEntryRecords: ourEntry.map(() => EMPTY_BATTER_GAME_RECORD),
    opponentEntryRecords: opponentEntry.map(() => EMPTY_BATTER_GAME_RECORD),
    ourHitBases: ourEntry.map(() => []),
    gameRecord: clearSeasonGameRecord(),
    cpuPinchHitUsed: false,
    pinchHitHomeRunHalf: null,
    recordIds: [],
    recordTally: EMPTY_RECORD_TALLY,
    ourBatterLogs: ourEntry.map(() => EMPTY_BATTER_GAME_LOG),
    scenePinchHit: null,
    scenePitcherChange: null,
    opponentAcePitcherIndex: opponentAces.pitcher,
    opponentAceBatterIndex: opponentAces.batter,
    opponentBenchBatters: Math.max(0, opponentEntry.length - BATTING_ORDER_SIZE),
    // 원본은 팀을 세울 때 이 칸을 채우고 마타자를 넣을 때 하나 올린다 — 결과가 명단 − 타순 아홉이다
    ourBenchBatters: Math.max(0, ourEntry.length - BATTING_ORDER_SIZE),
    // 타순 칸은 "사람이 서는 자리" 가 아니다 — 팀 경기는 아홉 칸을 모두 사람이 친다
    game: createGame(-1, options.playerSide),
    // 경기 상태 초기화 0xb6814 — 셋 다 측 2(없음)
    decisions: EMPTY_DECISION_STATE,
    halfInningBoard: null,
    lastHumanHalf: null,
    autoSinceHuman: false,
    pendingBenchClearing: null,
    atBat: createAtBat(),
    opponentOrderIndex: 0,
    opponentPitcherIndex: startingSlots.opponent,
    ourPitcherIndex: startingSlots.ours,
    ourUsedPitchers: [],
    opponentUsedPitchers: [],
    // 선발은 제 레코드 +0x2c 로 선다 (시즌 정규는 경기 사이에 이어진 값 — a583fe0)
    opponentStamina: opponentPitcherStaminas[startingSlots.opponent] ?? FULL_STAMINA,
    ourPitcherStaminas,
    opponentPitcherStaminas,
    ourPitcherCounters: EMPTY_MOUND_COUNTERS,
    opponentPitcherCounters: EMPTY_MOUND_COUNTERS,
    pitcherLines: [],
    pitcherJustChanged: false,
    atBatPrepared: false,
    sceneConfirm: null,
    stamina: ourPitcherStaminas[startingSlots.ours] ?? FULL_STAMINA,
    // 팀 new 0xb891c 가 팀+0x28 을 −1 로 두고(b89b4~b89ba) 첫 타석 준비(상태 0xd 0x48d50 → 0xaebe4)가 선발로 채운다
    magicRemaining: magicCountOfPitcher(ourPitcherEntry[startingSlots.ours] ?? ourPitcherEntry[0], options.aceLevels),
    opponentMagicRemaining: magicCountOfPitcher(
      opponentPitcherEntry[startingSlots.opponent] ?? opponentPitcherEntry[0],
      options.aceLevels,
    ),
    // 공 객체 new — +0x10 = 0 (0x1239 new 의 0 채움은 원본 미확인 — H2 3-4)
    ballMagicNumber: 0,
    ourSpecialSwingRemaining: UNFILLED_SPECIAL_SWINGS,
    opponentSpecialSwingRemaining: UNFILLED_SPECIAL_SWINGS,
    pitchCount: 0,
    lastPitch: null,
    lastResolution: null,
    lastDefensePlay: null,
    stealingFrom: [],
    lastArrivalPlay: null,
    pendingDefensePlay: null,
    pitching: EMPTY_PITCHING_LINE,
    ourHits: 0,
    leaguePlateAppearances: [],
    burst: createBurstSession(options.mode),
    lastBurstResolution: null,
    burstRewardDeltas: [],
    log: [],
    nextLogId: 1,
  }
  // 상태 9 갱신 0x3f584 의 공통 꼬리 0x3fa0e — 시뮬 초기화 0xc0dac 의 rand(0, 2) 한 번 (모든 모드 — 마선수·선발 굴림 0x30f20 뒤, 1회초 판 0x18 보다 앞)
  // 상태 7 장면 초기화 0x3e340 의 3ed76 → 0xb08e8 — 이 경기 장면의 패턴 덱을 섞는다(상태 9 의 시뮬 초기화보다 앞)
  openScenePatternDeck(random)
  rollSimulatorInit(random)
  // 경기정보 OK(0x3136e)가 0x30f20 이 세운 두 팀·st 를 저장 블록에 두고 파일을 쓴다 — 이어하기의 첫 자리다
  return advance({ ...initial, halfInningSave: savePointOf(initial) }, random)
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
  // 수비 진행 중(원본 상태 0x17)에는 타석·투구 차례가 아니다 — 원본도 공이 멈출 때까지
  // 0xe·0xf 로 돌아가지 않아 다음 투구가 나가지 않는다
  if (progress.pendingDefensePlay !== null) return false
  // 벤치 클리어링 연출(0x1e) 중에도 다음 공이 안 나간다
  if (progress.pendingBenchClearing !== null) return false
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
    // 내 팀 보정 셋(질병·보직·사기)은 시즌모드에서만 붙는다 (0xb581a).
    // 비교 대상은 [시즌+1] = 시즌 팀 번호다 (0xb5804) — 국가대항전의 대한민국(10)과는 안 맞는다
    seasonTeamId: options.mode === TEAM_GAME_MODE.시즌 ? seasonTeamIdOf(options) : -1,
    season: options.season,
    teamAbilities: options.teamAbilities,
    lineup: options.lineup,
    aceLevels: options.aceLevels,
  }
}

/** 시즌 팀 번호 `[시즌+1]` — 안 넘기면 내 팀이 곧 시즌 팀이다 (정규·포스트시즌) */
function seasonTeamIdOf(options: TeamGameOptions): number {
  return options.seasonTeamId ?? options.ourTeamId
}

/**
 * 스태미나 용량이 보는 **내 팀 사기** — `0x66e44(V, 투수, 첫투수)` 의 `V+2`.
 *
 * `V` 는 소모 `0xaeb08` 이 `0x1f9a9(g, 모드, 팀+0x25)` 로 얻는 **투수 팀의 팀 레코드**다.
 * 팀 번호 비교(`0xb5804`) 같은 건 없고 그냥 그 팀 레코드의 +2 를 읽는다. 모드 2 가지
 * `0x1f570` 은 국가대항전 중(`S+0x12c` ≠ 0)이면 팀 10 을 리그 배열이 아닌 **대표팀 슬롯
 * `base+0x918`** 로 돌린다 (1f58a~1f59c). 그 슬롯은 대회를 시작할 때 `0xb7bf0 → 0x205c0` 이
 * 마스터 팀 데이터(XlsTEAM_DATA)에서 새로 만들어 사기가 **원본 표값 100** 이다 (S6 2-2).
 *
 * 그래서 시즌 팀으로 치는 경기만 시즌 사기(팀 레코드 +2)를 쓰고, 국가대항전의 대한민국은
 * 표값을 쓴다. 다른 모드는 지금까지처럼 넘긴 사기(없으면 100)다.
 */
function ourTeamMoraleOf(options: TeamGameOptions): number {
  if (options.mode === TEAM_GAME_MODE.시즌 && seasonTeamIdOf(options) !== options.ourTeamId) {
    return TEAMS[options.ourTeamId]?.values[TEAM_MORALE_VALUE_INDEX] ?? DEFAULT_TEAM_MORALE
  }
  return options.season?.morale ?? DEFAULT_TEAM_MORALE
}

/**
 * 한 팀의 **명단** — 양 팀 모두 대타로 바뀔 수 있어 진행 상태가 들고 있다
 * (우리 쪽은 `#` 대타 `0xaf06c`, 상대 쪽은 CPU 대타 `0xac228`).
 */
function entryBattersOf(progress: TeamGameProgress, teamId: number): readonly TeamEntryBatter[] {
  return teamId === progress.options.ourTeamId ? progress.ourEntry : progress.opponentEntry
}

/* ── 기록달성 (0xa8024 등 → 지급 0xa77f0) ─────────────────────────────────────── */

/**
 * 지급 게이트 `0xa77f0` 을 지나 기록을 쌓는다 (R8 1절).
 * a77f2 게이트(`[ctx+0x24]`, 투수편 강판 뒤)는 팀 경기에서 늘 열려 있고, 번호마다 방향(a7818·a785e·a78bc)을 본다 — 팀 경기에서 사람 팀은 우리 팀 하나라
 * 우리 공격이면 공격 팀이, 우리 수비면 수비 팀이 사람이다. 모드 5·6·7 갈래(a780a)는 팀 경기에 없다.
 */
function withGameRecords(
  progress: TeamGameProgress,
  recordIds: readonly number[],
  humanOffense: boolean,
): TeamGameProgress {
  if (recordIds.length === 0) return progress
  const passed = recordIds.filter((id) =>
    passesRecordTeamGate(id, { offenseIsHuman: humanOffense, defenseIsHuman: !humanOffense }),
  )
  return passed.length === 0 ? progress : { ...progress, recordIds: [...progress.recordIds, ...passed] }
}

/**
 * **우리 타석 하나의 기록달성** — 정산 `0xa8024` 의 안타 갈래(5-3)와 범타·볼넷·사구 갈래(5-4).
 *
 * - 0 3루타 · 1~4 홈런 단계 · 9~11 연타석 · 12~14 한 타자 홈런 · 15 사이클 · 34·35 한 타자 볼넷 —
 *   타순 칸 결과 목록(`ourBatterLogs`)으로 가린다(`recordBatterAtBat`, 타자편 동료 타석과 같은 함수).
 * - 6·7 백투백 — `ctx+0x162` (`backToBackRecordOf`). 홈런 아닌 결과면 0.
 * - 5 대타 홈런 — 사람이 대타를 낸 그 타석의 홈런 (`ctx+0x160`).
 * 사람 장면 타석과 간이 엔진 타석(0xc11f0·0xc15a4 도 같은 0xa8024 를 지난다) 둘 다 여기로 온다.
 */
function withOurAtBatRecords(
  progress: TeamGameProgress,
  slot: number,
  outcome: AtBatOutcome,
  runsBattedIn: number,
  isPinchHitAtBat: boolean,
): TeamGameProgress {
  const recorded = recordBatterAtBat(progress.ourBatterLogs[slot] ?? EMPTY_BATTER_GAME_LOG, outcome, runsBattedIn)
  const isHomeRun = outcome.kind === '홈런'
  const backToBack = backToBackRecordOf({
    streak: progress.recordTally.homeRunStreak,
    humanOffense: true,
    isHomeRun,
  })
  const ourBatterLogs = [...progress.ourBatterLogs]
  ourBatterLogs[slot] = recorded.log
  return withGameRecords(
    { ...progress, ourBatterLogs, recordTally: { ...progress.recordTally, homeRunStreak: backToBack.streak } },
    [
      ...recorded.recordIds,
      ...backToBack.recordIds,
      // a8764 — 홈런이고 ctx+0x160 이 서 있으면
      ...pinchHitHomeRunRecordIdsOf({ isHomeRun, isPinchHitAtBat }),
    ],
    true,
  )
}

/** 지금 반 이닝에 던진 공 수 (`ctx+0x16c`) — 반 이닝이 바뀌었으면 0xa5b00 이 0 으로 되돌린 것이다 */
function halfInningPitchesOf(tally: TeamRecordTally, game: GameState): number {
  const half = tally.halfInningPitches
  return half.inning === game.inning && half.half === game.half ? half.pitches : 0
}

/** 공 `pitches` 개를 반 이닝 투구 수에 더한다 (0xa5e14 의 a5e4e) */
function withHalfInningPitches(tally: TeamRecordTally, game: GameState, pitches: number): TeamRecordTally {
  return {
    ...tally,
    halfInningPitches: {
      inning: game.inning,
      half: game.half,
      pitches: halfInningPitchesOf(tally, game) + pitches,
    },
  }
}

/**
 * **우리 수비 타석 하나의 기록달성** — 사람 장면·간이 엔진 공통.
 *
 * - 16 삼구 삼진 · 17 풀카운트 삼진 — 삼진 처리 `0xa7c4c` (이 타석 투구 수 `ctx+0x161` == 3 · 볼 3).
 * - 18~20 삼진 콤보 · 21~23 한 투수 10/15/20삼진 — `0xa7998`, 우리 **현재** 투수의 R[1]·R[0].
 *   삼진 아닌 결과로 끝난 타석이면 R[1] = 0 (0xa8fb2~). 플레이 종류 4·5(견제·주자만)는 이 길로 안 온다.
 * - 25 삼구 삼자범퇴 — 아웃 처리 `0xa7d0c`: 반 이닝 투구 수(`ctx+0x16c`) == 3 이고 3아웃.
 * - 26·27 병살·삼중살 — 한 플레이 아웃 2·3 (`0xa8e58`). 주자 달리는 중 삼진(state[0x1a])은 웹에 없어 늘 거짓.
 * - 36 필살송구 아웃 — 레이저 연출이 끝난 뒤(+0x1999) 수비 화면 결과 팝업 0x46844 가 **결과 코드 0xd** 를 보이면
 *   state[0x8b] = 1 (46892~46932), 정산이 이 플레이 아웃 이벤트 > 0 이면 36 (0xa80f8~0xa8116).
 *   결과 코드 0xd 는 **타석 결과가 아니다** — 플레이 틱 b4540 에서 그 틱의 아웃 판정 vt90(0xb36d0)이 아웃을 내면
 *   곧바로 vt44(13)·vt54(13) 로 보내는 "아웃이 났다" 코드다(포스·태그·뜬공 포구 모두, `runDefensePlay` 의
 *   `runOutJudgement` 주석). 그래서 안타 타석이라도 레이저 뒤 주자가 잡히면 서고, 아웃 타석이라도 아웃이 없으면
 *   안 선다 — 레이저 송구가 난 판(`laserThrow`)에 아웃이 있으면 세운다.
 *   ⚠️ 미해결: 팝업 차례 — 레이저 연출이 끝나기 **전** 아웃 팝업(+0x1997 = 1)이나 그 뒤 다른 코드 팝업(세이프 9 등)이
 *   +0x1998·+0x1999 를 지우는 경우는 틱별 결과 코드를 진행기가 내주지 않아 가리지 못한다.
 * 상대 타석은 공격 팀이 사람이 아니라 백투백 카운터 `ctx+0x162` 를 0 으로 (0xa794c · 5-4).
 */
function withOurDefenseRecords(
  progress: TeamGameProgress,
  play: {
    readonly outcome: AtBatOutcome
    readonly outsBefore: number
    readonly outsAdded: number
    /** 이 타석 투구 수 (`ctx+0x161`) */
    readonly atBatPitches: number
    /** 끝났을 때 볼 (`state[5]`) */
    readonly balls: number
    /** 반 이닝 투구 수 (`ctx+0x16c`) — 이 타석의 공까지 든 값 */
    readonly halfInningPitches: number
    /** 이 플레이에서 레이저 송구가 나갔는가 (`DefensePlayResult.laserThrow`) */
    readonly laserThrow: boolean
  },
): TeamGameProgress {
  const tally = progress.recordTally
  const strikeout = play.outcome.kind === '삼진'
  const moundStrikeouts = tally.moundStrikeouts + (strikeout ? 1 : 0)
  const moundStrikeoutCombo = strikeout ? tally.moundStrikeoutCombo + 1 : 0
  const outs = play.outsBefore + play.outsAdded
  const recordIds = [
    ...(strikeout
      ? strikeoutRecordIdsOf({
          pitches: play.atBatPitches,
          balls: play.balls,
          comboCount: moundStrikeoutCombo,
          pitcherStrikeouts: moundStrikeouts,
        })
      : []),
    ...laserThrowOutRecordOf({
      // 결과 코드 0xd(그 판의 아웃 판정) — 타석 결과 '아웃' 이 아니다
      laserThrowFlag: play.laserThrow && play.outsAdded > 0,
      outsInPlay: play.outsAdded,
    }).recordIds,
    ...multiOutPlayRecordIdsOf({ outsInPlay: play.outsAdded, strikeoutWhileRunning: false }),
    ...(strikeout ? [] : threePitchInningRecordIdsOf(play.halfInningPitches, outs)),
  ]
  return withGameRecords(
    {
      ...progress,
      recordTally: {
        ...tally,
        homeRunStreak: 0,
        moundStrikeouts,
        moundStrikeoutCombo,
        moundOuts: tally.moundOuts + play.outsAdded,
      },
    },
    recordIds,
    false,
  )
}

/**
 * **경기 끝 기록** — `0xa7de8`(0x4ea0c 가 부른다): 37~39 점수차 승 · 28~31 완투 계열. 둘 다 0xa77f0 의 방향 게이트는
 * 건너뛰지만 자동진행 게이트(a77f2)는 지난다.
 *
 * 이긴 팀은 `0xb69c8`: 팀 1 점수(state[0x7f]) > 팀 0 점수면 팀 1, **아니면(동점 포함) 팀 0** 을 보고 그 팀의
 * `state[0x31+팀] == 0`(사람)인지 본다 — 팀 0 = 선공(측 0). 그래서 비긴 경기는 우리가 선공일 때 "이긴 경기" 다
 * (원본 그대로 — 점수차 0 이라 37~39 는 안 나오지만 완투 계열은 나올 수 있다).
 * 완투 계열은 그 밖에 모드 ≠ 4 · `state[0x8c]`(사람이 코스를 확정한 적 있음) · 우리 **현재** 투수 R[3] == 3 × 치른 이닝.
 * 피안타·출루·실점은 팀 단위 칸 state[0x89]·[0x88]·[0x8a] 다 (`pitching`).
 */
function gameEndRecordIdsFor(progress: TeamGameProgress): readonly number[] {
  // 0x4ea0c 는 경기가 끝나야 부른다 — 도중의 요약에는 안 붙인다
  if (!progress.game.isFinished) return []
  const game = progress.game
  const won =
    game.ourScore > game.opponentScore || (game.ourScore === game.opponentScore && ourHalfOf(game) === '초')
  if (!won) return []
  return [
    ...gameEndRecordIdsOf(game.ourScore - game.opponentScore),
    ...completeGameRecordIdsOf({
      mode: progress.options.mode,
      won,
      pitchCourseConfirmed: progress.recordTally.pitchCourseConfirmed,
      // state[0x6b] + 1 — 치른 이닝 전부 (연장이면 그만큼)
      inningsPlayed: game.inning,
      outsRecorded: progress.recordTally.moundOuts,
      hitsAllowed: progress.pitching.hitsAllowed,
      walksAllowed: progress.pitching.walksAllowed,
      runsAllowed: progress.pitching.runsAllowed,
    }),
  ]
}

/* ── 시즌 평판 16칸 (0xa8024 → 0xa755c → 0xa3440) ─────────────────────────────── */

/**
 * 게이트 `0xa755c` 를 통과시켜 코드 몇 개를 한꺼번에 올린다.
 *
 * 원본 게이트는 (1) **모드 2(시즌)** 이고 (2) 시즌 레코드가 있고 (3) 코드 ≤ 5 면 공격측이,
 * ≥ 6 이면 수비측이 **CPU** 일 때만 적는다. (2)는 부르는 쪽(시즌 세션)이 보장하고,
 * (3)은 `recordSeasonGameEvent` 가 `mySide` 로 가른다 — 여기서는 (1)만 본다.
 */
function withSeasonRecord(
  progress: TeamGameProgress,
  mySide: MySide,
  codes: readonly number[],
): readonly number[] {
  if (progress.options.mode !== TEAM_GAME_MODE.시즌) return progress.gameRecord
  return codes.reduce(
    (slots, code) => recordSeasonGameEvent(slots, code, mySide),
    progress.gameRecord,
  )
}

/** 사이클 판정 `0xa7610` — 그 타순 칸의 루타 목록에 1·2·3·4 가 다 들어 있는가 */
function hasCycle(hitBases: readonly number[]): boolean {
  return [1, 2, 3, 4].every((bases) => hitBases.includes(bases))
}

/**
 * **우리 타석 하나**가 올리는 코드들 — `0xa8024` 의 안타 가지 차례 그대로다.
 *
 * ```
 * a8490: [sp+0x14](안타인가) == 0 이면 안타 가지를 통째로 건너뛴다
 * a8518:   k=7  안타 — **루타를 가르기 전이라 홈런·2루타·3루타도 함께 오른다**
 * a856e:   k=8  [sp+0x10] == 2
 * a85b8:   k=9  [sp+0x10] == 3
 * a85be:   [sp+0x24](이 플레이 홈런 수) > 0 이면
 * a8648~:   k=0xa/0xb/0xc/0xd — [sp+0x28](이 플레이 득점) 1/2/3/4
 * a86e0:   루타 값을 타순 칸 기록 목록에 민다
 * a878a:   k=0xe 사이클 — 플레이 **전** 판정 [sp+0x1c] 이 거짓인데 지금 참이면
 * a8a46:  k=6  삼진 (수비가 CPU 인 쪽 — 내 타자가 당한 삼진)
 * ```
 */
function offenseRecordOf(
  outcome: AtBatOutcome,
  runsBattedIn: number,
  hitBasesBefore: readonly number[],
): { readonly codes: readonly number[]; readonly hitBases: readonly number[] } {
  const codes: number[] = []
  let hitBases = hitBasesBefore
  if (isHit(outcome)) {
    const bases: number = outcome.kind === '안타' ? outcome.bases : 4
    const cycleBefore = hasCycle(hitBases)
    hitBases = [...hitBases, bases]
    codes.push(SEASON_RECORD_CODE.안타)
    if (bases === 2) codes.push(SEASON_RECORD_CODE.이루타)
    if (bases === 3) codes.push(SEASON_RECORD_CODE.삼루타)
    // 홈런 네 칸은 **타점**이 가른다 — 원본도 득점이 1~4 가 아니면 아무 칸도 안 올린다
    if (outcome.kind === '홈런' && runsBattedIn >= 1 && runsBattedIn <= 4) {
      codes.push(SEASON_RECORD_CODE.솔로홈런 + runsBattedIn - 1)
    }
    if (!cycleBefore && hasCycle(hitBases)) codes.push(SEASON_RECORD_CODE.사이클)
  }
  if (outcome.kind === '삼진') codes.push(SEASON_RECORD_CODE.내타자삼진)
  return { codes, hitBases }
}

/**
 * **내가 던진 타석 하나**가 올리는 코드들 — `0xa8024` 의 공통 꼬리다.
 *
 * ```
 * a8a40: k=4  [sp+0x20](삼진 수) > 0 이고 **수비가 사람**이면 4 (아니면 6)
 *             ⚠️ 값 인자가 없어 삼진이 둘이어도 +1 이다
 * a8d6e: k=2  [sp+0x14](안타) — 피안타
 * a8e76: k=5  [sp+0x30](이 플레이 아웃 수) == 2 이고 state[0x1a] 가 0 일 때 — 병살
 * a8e8a: k=0  [sp+0x30] == 3 — 삼중살 (state[0x1a] 가 막지 않는다)
 * ```
 * ⚠️ `state[0x1a]` 는 "삼진 뒤 주자가 움직여 두 번째 아웃이 난 플레이" 표시다 (P7 F절).
 * 웹에는 그 플레이(삼진 + 주자 아웃)가 없어 아웃 둘이 나는 타석은 늘 병살이다.
 */
function defenseRecordCodesOf(outcome: AtBatOutcome, outsAdded: number): readonly number[] {
  const codes: number[] = []
  if (outcome.kind === '삼진') codes.push(SEASON_RECORD_CODE.탈삼진)
  if (isHit(outcome)) codes.push(SEASON_RECORD_CODE.피안타)
  if (outsAdded === 2) codes.push(SEASON_RECORD_CODE.병살)
  else if (outsAdded === 3) codes.push(SEASON_RECORD_CODE.삼중살)
  return codes
}

/** 우리 타순 칸 하나의 루타 목록에 이번 루타를 얹는다 (`0xa86e0`) */
function withHitBases(
  lists: readonly (readonly number[])[],
  slot: number,
  hitBases: readonly number[],
): readonly (readonly number[])[] {
  const next = [...lists]
  next[slot] = hitBases
  return next
}

/**
 * 타순 칸 기록에 플레이 하나를 얹는다 (`0xa8024`).
 *
 * `outcome` 이 null 이면 **타석 결과 없이 끝난 판**(견제 = 플레이 종류 4)이다 — 원본도 견제 판 끝
 * `0xae3e8` 이 `0xa8024` 를 부르지만(`0xae57e~0xae5b2`) `state[0x26] = 4` 라 타석 칸(+0x14)이 안 오르고,
 * 안타·홈런 칸은 안타 가지(`0xa86e0`) 안이라 애초에 안 선다. 게이트는 `recordPlateAppearance` 의 `playKind` 다.
 */
function withPlateAppearance(
  records: readonly BatterGameRecord[],
  slot: number,
  outcome: AtBatOutcome | null,
): readonly BatterGameRecord[] {
  const next = [...records]
  next[slot] = recordPlateAppearance(next[slot] ?? EMPTY_BATTER_GAME_RECORD, {
    isHit: outcome !== null && isHit(outcome),
    isHomeRun: outcome !== null && outcome.kind === '홈런',
    // 같은 정산이 오늘 타석 결과 링에도 넣는다 (0xa908c) — 견제 판은 게이트에 막힌다
    ...(outcome === null ? { playKind: PICKOFF_PLAY_KIND } : { resultCode: atBatResultCodeOf(outcome) }),
  })
  return next
}

/**
 * 리그 선수 기록표에 타석 하나를 쌓는다 — **지금 그 타순 칸에 선 선수의 로스터 칸**으로.
 *
 * 원본 기록 함수 `0xa8024` 는 명단 칸(`team+0xe`)이 가리키는 선수 레코드에 쌓는다. 명단 칸은 대타
 * 확정 `0xaebe4` 가 맞바꾸고 지우므로(`aed02~aed16`) 대타가 들어온 뒤에는 타순 칸 번호와 로스터 칸이
 * 갈린다 — 타순 칸 번호로 쌓으면 기록이 빠진 선수나 엉뚱한 선수에게 붙는다 (`entities/game` 의
 * `quickLineup` 이 간이 엔진 경기에서 같은 자리를 고친 785796d 와 같은 이치다).
 *
 * 마타자(`NO_ROSTER_SLOT`)는 리그 로스터 선수가 아니라 표에 칸이 없다 — 원본도 저장에서 꺼낸 마타자
 * 레코드(`0x1f84c`)에 쌓으므로 리그 로스터 선수 기록은 오르지 않는다. 그래서 빼고 넘긴다.
 * (마타자는 일반·대전모드에만 들어오고 리그 기록표를 쓰는 시즌모드에는 없다.)
 */
function withLeaguePlateAppearance(
  appearances: readonly LeaguePlateAppearance[],
  teamId: number,
  entry: readonly TeamEntryBatter[],
  slot: number,
  outcome: AtBatOutcome,
  runsBattedIn: number,
): readonly LeaguePlateAppearance[] {
  const rosterSlot = entry[slot]?.rosterSlot ?? slot
  if (rosterSlot === NO_ROSTER_SLOT) {
    // 기록을 실어 선 표 밖 선수(영입한 명전·나리)는 제 레코드에 쌓인다 — 원본 id 로 넘긴다. 마타자는 넘기지 않는다
    const recordId = entry[slot]?.recordId
    if (recordId === undefined || (entry[slot]?.aceIndex ?? NO_ACE_BATTER) >= 0) return appearances
    return [...appearances, { teamId, battingOrderIndex: NO_ROSTER_SLOT, outcome, runsBattedIn, recordId }]
  }
  // 트레이드로 옮겨 온 선수는 옛 팀 표 자리(원본 id)로 쌓는다 — 레코드 +0x20~ 가 선수를 따라간다
  const tableTeamId = entry[slot]?.tableTeamId ?? teamId
  return [...appearances, { teamId: tableTeamId, battingOrderIndex: rosterSlot, outcome, runsBattedIn }]
}

/** 지금 타석에 선 우리 타자 (명단 칸 = 타순 칸) */
export function currentBatterEntry(progress: TeamGameProgress): TeamEntryBatter | undefined {
  return progress.ourEntry[progress.game.battingOrderIndex]
}

/** 필살 남은 칸의 "아직 안 채움" (0xaebe4 가 음수일 때만 채운다) */
const UNFILLED_SPECIAL_SWING = -1
const UNFILLED_SPECIAL_SWINGS: readonly number[] = Array.from({ length: BATTING_ORDER_SIZE }, () => UNFILLED_SPECIAL_SWING)

/** 마선수 레코드 +0x18 = 순번 + 5 (H2 4-1) */
const ACE_SPECIAL_NUMBER_OFFSET = 5

/**
 * 명단 한 칸 타자의 **한 경기 필살 횟수** — 타석 교대 0xaebe4 가 채우는 값 (`specialSwingCountOf`).
 *   마타자: s8 0xd84fa[레벨] — 레벨 = 전역 기록 `mgr[0x13f + 순번]` (`options.aceLevels`, 양 팀 모두 같은 전역 칸)
 *   그 밖:  `+0x18 == 0 → 0` — 팀 경기 명단은 리그 로스터와 마선수뿐이고 일반 레코드 +0x18 은 모두 0 이다 (H2 4-2)
 * ⚠️ 미해결: 스킬 23 무자비 +1 (0xb62b4(B, 0x17)) — 팀 경기 명단(`TeamEntryBatter`)·로스터 표·마선수 표에
 *    스킬 비트(+0x14)가 없어 늘 거짓으로 둔다.
 */
function specialSwingCountFor(progress: TeamGameProgress, batter: TeamEntryBatter | undefined): number {
  if (batter === undefined || batter.aceIndex === NO_ACE_BATTER) return 0
  return specialSwingCountOf({
    swingNumber: batter.aceIndex + ACE_SPECIAL_NUMBER_OFFSET,
    isAceBatter: true,
    aceLevel: aceBatterLevelOf(progress, batter.aceIndex),
    hasRuthlessSkill: false,
  })
}

/** 마타자 순번의 레벨 0~4 = `mgr[0x13f + 순번]` */
function aceBatterLevelOf(progress: TeamGameProgress, aceIndex: number): number {
  return aceLevelOf(progress.options.aceLevels, aceLevelSlotOf('타자', aceIndex + 1))
}

/**
 * 지금 타순 칸의 **남은 필살 횟수** = 0xaea30 — 칸이 −1 이면 0xaebe4 처럼 그 타자의 횟수로 채운 값을 돌려준다.
 * `side` 가 '우리' 면 사람 타석(`BattingStage` 의 `specialSwingRemaining`), '상대' 면 사람이 던지는 CPU 타석.
 */
export function specialSwingRemainingAt(progress: TeamGameProgress, side: '우리' | '상대'): number {
  const ours = side === '우리'
  const slot = ours ? progress.game.battingOrderIndex : progress.opponentOrderIndex
  const stored = (ours ? progress.ourSpecialSwingRemaining : progress.opponentSpecialSwingRemaining)[slot]
  if (stored !== undefined && stored >= 0) return stored
  return specialSwingCountFor(progress, (ours ? progress.ourEntry : progress.opponentEntry)[slot])
}

function withSpecialSwingSlot(cells: readonly number[], slot: number, value: number): readonly number[] {
  if (slot < 0 || slot >= cells.length || cells[slot] === value) return cells
  return cells.map((cell, index) => (index === slot ? value : cell))
}

/**
 * 사람 타석의 필살 스윙이 나갔다 — 스윙 틱 0x4e136 의 `0xae9e8(팀, 남은 − 1)`. `remaining` 은 `BattingStage` 의
 * `onSpecialSwingUsed` 가 넘긴 줄인 뒤 값이다. 난수는 쓰지 않는다.
 */
export function spendOurSpecialSwing(progress: TeamGameProgress, remaining: number): TeamGameProgress {
  if (!isBatterTurn(progress)) return progress
  const cells = withSpecialSwingSlot(progress.ourSpecialSwingRemaining, progress.game.battingOrderIndex, remaining)
  return cells === progress.ourSpecialSwingRemaining ? progress : { ...progress, ourSpecialSwingRemaining: cells }
}

/** 명단 한 칸의 경기용 능력치 네 칸 — 없는 칸이면 0 이다 */
function entryAbilitiesAt(
  progress: TeamGameProgress,
  teamId: number,
  slot: number,
): readonly number[] {
  const entry = entryBattersOf(progress, teamId)[slot]
  if (entry === undefined) return [0, 0, 0, 0]
  return entryBatterGameAbilities(abilityContextOf(progress.options), teamId, entry, slot)
}

/** 타석 화면이 보는 능력치 (0~999 그대로) */
function entryStageAbilityOf(
  progress: TeamGameProgress,
  teamId: number,
  slot: number,
): BatterAbility {
  const ability = entryAbilitiesAt(progress, teamId, slot)
  return { hit: ability[0], power: ability[1], defense: ability[2], run: ability[3] }
}

/** 간이 타석 엔진이 보는 타자 — 히트·파워·주루만 쓴다 */
function entryQuickBatterOf(
  progress: TeamGameProgress,
  teamId: number,
  slot: number,
): QuickAtBatBatter {
  const ability = entryAbilitiesAt(progress, teamId, slot)
  return { hit: ability[0], power: ability[1], run: ability[3], skillIds: [] }
}

/** 간이 타석 엔진이 보는 투수 — 제구·구속·체력만 쓴다 */
function entryQuickPitcherOf(
  progress: TeamGameProgress,
  teamId: number,
  slot: number,
): QuickAtBatPitcher {
  const ability = pitcherAbilitiesAt(progress, teamId, slot)
  const entry = pitcherEntryAt(progress, teamId, slot)
  return {
    control: ability[0],
    velocity: ability[1],
    stamina: ability[3],
    skillIds: [],
    // 손 0xb63c0 — 마투수(+0xa 비트6)는 폼 7·9·10 이 0, 그 밖은 폼 & 1 (0xab214 의 스킬 13·14)
    ...(entry === undefined ? {} : { hand: pitcherHandOf(entry.repertoire.form, entry.aceIndex >= 0) }),
  }
}

/** 지금 타석에 선 우리 타자의 경기용 능력치 */
export function currentBatterAbility(progress: TeamGameProgress) {
  return entryStageAbilityOf(progress, progress.options.ourTeamId, progress.game.battingOrderIndex)
}

/**
 * 한 팀의 **투수 명단** — 타자 명단과 짝을 이루는 원본 `team+0x00` 목록이다 (0xb8950).
 * 0번이 선발, 1번부터가 벤치이고, 마투수가 있으면 8번에 앉아 있다 (`PITCHER_ENTRY_ACE_SLOT`).
 */
function pitcherEntriesOf(progress: TeamGameProgress, teamId: number): readonly TeamEntryPitcher[] {
  return teamId === progress.options.ourTeamId
    ? progress.ourPitcherEntry
    : progress.opponentPitcherEntry
}

/** 투수 명단 한 칸 — 없는 칸이면 0번(선발)으로 떨어진다 */
function pitcherEntryAt(
  progress: TeamGameProgress,
  teamId: number,
  slot: number,
): TeamEntryPitcher | undefined {
  const entry = pitcherEntriesOf(progress, teamId)
  return entry[slot] ?? entry[0]
}

/** 투수 명단 한 칸의 경기용 능력치 네 칸 (제구·구속·변화·체력) */
function pitcherAbilitiesAt(
  progress: TeamGameProgress,
  teamId: number,
  slot: number,
): readonly number[] {
  const entry = pitcherEntryAt(progress, teamId, slot)
  if (entry === undefined) return [0, 0, 0, 0]
  return entryPitcherGameAbilities(abilityContextOf(progress.options), teamId, entry)
}

/** 투수 명단 한 칸의 구질 표 (폼·마구·보유 구질) */
function pitcherRepertoireAt(
  progress: TeamGameProgress,
  teamId: number,
  slot: number,
): PitcherRepertoire {
  return (
    pitcherEntryAt(progress, teamId, slot)?.repertoire ?? {
      name: '',
      form: 0,
      magicId: 0,
      pitchMask: 1,
    }
  )
}

/** 원본 0~999 를 타석 화면의 0~100 눈금으로 (다른 화면들이 쓰는 것과 같은 나눗셈) */
const STAGE_PITCHER_DIVISOR = 10

/**
 * 지금 우리 타자를 상대하는 투수의 경기용 능력치 (0~100 눈금).
 *
 * 투구 AI·스윙 판정은 0~100 칸 대신 `gameAbility`·`staminaPercent` 로 원본 눈금을 다시 낸다 — 사람 타석의
 * 0x34968·0x4dbac·0xab214(ab548·ab582)는 수비 투수를 `0xb570c(…, [sp] = 체력% 0xaebb0)` 로 불러 시즌 내 팀 보정 →
 * **피로 0xb58e6** → 팀 능력치·코치 정액 차례로 먹인다 (45f5d4a). 체력%는 그 투수 레코드 +0x2c / 100.
 */
export function currentPitcherAbility(progress: TeamGameProgress): PitcherAbility {
  const teamId = progress.options.opponentTeamId
  const slot = progress.opponentPitcherIndex
  const ability = pitcherAbilitiesAt(progress, teamId, slot)
  const repertoire = pitcherRepertoireAt(progress, teamId, slot)
  const entry = pitcherEntryAt(progress, teamId, slot)
  return {
    control: Math.round(ability[0] / STAGE_PITCHER_DIVISOR),
    velocity: Math.round(ability[1] / STAGE_PITCHER_DIVISOR),
    breaking: Math.round(ability[2] / STAGE_PITCHER_DIVISOR),
    ...(entry === undefined
      ? {}
      : { gameAbility: entryPitcherGameAbilityParts(abilityContextOf(progress.options), teamId, entry) }),
    staminaPercent: staminaPercentOf(progress.opponentStamina),
    repertoire: {
      form: repertoire.form,
      pitchMask: repertoire.pitchMask,
      magicId: repertoire.magicId,
    },
  }
}

/**
 * 사람 타석의 CPU 투수가 구질을 고를 때 볼 마구 상태 — 상대 팀+0x28 과 경기에 하나뿐인 공+0x10.
 * 타석 화면(`BattingStage.cpuMagic`)에 넘기면 화면이 따로 상태를 세우지 않는다.
 */
export function opponentMagicStateOf(progress: TeamGameProgress): {
  readonly remaining: number
  readonly ballMagicNumber: number
} {
  return { remaining: progress.opponentMagicRemaining, ballMagicNumber: progress.ballMagicNumber }
}

/** 지금 마운드에 선 상대 투수가 마투수면 `ACE_PITCHERS` 칸 0~4, 아니면 −1 */
export function currentPitcherAceIndex(progress: TeamGameProgress): number {
  return (
    pitcherEntryAt(progress, progress.options.opponentTeamId, progress.opponentPitcherIndex)
      ?.aceIndex ?? NO_ACE_BATTER
  )
}

/** 우리 선발 투수의 경기용 능력치 (제구·구속·변화·체력) */
export function ourPitcherStats(progress: TeamGameProgress): PitcherStats {
  const ability = pitcherAbilitiesAt(progress, progress.options.ourTeamId, progress.ourPitcherIndex)
  return { control: ability[0], velocity: ability[1], breaking: ability[2], stamina: ability[3] }
}

/**
 * **교체 화면 상세 창의 능력치 네 칸** — 원본은 교체 목록이 아니라 '0' 키로 여는 **상세 창**에서만
 * 능력치를 적는다. 그 값은 **`0xb6414(레코드, 칸, 1)`** 이고 경기용 `0xb570c` 를 거치지 않는다 (직접 떴다):
 * ```
 * 0x384b8 그리기 → 0x37e5c 벤치 목록 끝 (0x38420~0x38468):
 *   투수 교체면 rec = 0xb8b09(scene[0x224], 커서), 종류 3 · 대타면 rec = 0xb8b19(scene[0x220], 커서), 종류 2
 *   0x5b798(skin, 종류, rec)              ; skin+0x424('0' 키 상세 창)가 꺼져 있으면 바로 빠진다 (5b7a8)
 * 0x5b798 → 0x5aefc(…, [sp]=종류, [sp+4]=rec, …, [sp+0x18]=0)   ; 5b86a(종류 2) · 5bfbe(종류 3)
 * 0x5aefc 종류 2 (5b1aa) · 종류 3 (5b294): 칸 0..3 마다
 *   ctx([sp+0x198]) ≠ 0 이면 0xb570c(ctx, 칸, rec, 0x5a, 1) — **교체 창은 늘 0 을 넘긴다**
 *   그 밖 0xb6414(rec, 칸, 1) → 막대 값 · 0xb6414(rec, 칸, 0) → 기본 값
 * ```
 * 곧 마선수 레벨 배율(0xd88aa) → 장비(+0x19 니블) → 장착 스킬 보정까지이고, 시즌 질병·보직·사기·
 * 팀 능력치·코치(0xb570c 쪽)는 **안 먹는다**. 웹 팀 경기 명단에는 장비 니블도 스킬 비트(+0x14)도 없어
 * (`TeamEntryBatter` · `TeamEntryPitcher`) 남는 것은 **레벨 배율 하나**다 — 마선수가 아니면 명단 값 그대로.
 *
 * 목록 줄(`0x37904` 현재 선수 · `0x37e5c` 벤치)에는 능력치가 없다: 이름 · 보직/수비 아이콘 ·
 * 방어율(0xb6ce9)/타율(0xb8e3d) · 탈삼진(+0x26)/홈런(+0x28) 넷이고 두 함수 모두 0xb570c·0xb6414 를 안 부른다 (R4 1b).
 *
 * @param kind '투수' 면 우리 투수 명단 칸, '대타' 면 우리 타자 명단 칸
 * @returns 제구·구속·변화·체력 / 히트·파워·수비·주루. 칸이 없으면 null
 */
export function substitutionDetailAbilities(
  progress: TeamGameProgress,
  kind: '투수' | '대타',
  index: number,
): readonly [number, number, number, number] | null {
  const player = kind === '투수' ? progress.ourPitcherEntry[index] : progress.ourEntry[index]
  if (player === undefined) return null
  return aceLeveledAbility(player.ability, kind === '투수' ? '투수' : '타자', player.aceIndex, progress.options.aceLevels)
}

/**
 * 한 팀의 수비 아홉 칸 능력치 — 타순에 선 선수의 **경기용** 수비(질병·보직·사기·팀 능력치·코치까지
 * 먹인 값, J-4)를 로스터의 수비 자리 코드로 칸에 꽂는다.
 * 칸 0(투수)은 지금 마운드에 선 투수의 능력치 칸 2 다 (⚠️ 원본 그대로 — `defenseAbilitiesOf` 주석).
 */
function defenseAbilitiesFor(
  progress: TeamGameProgress,
  teamId: number,
  pitcherIndex: number,
): readonly number[] {
  const context = abilityContextOf(progress.options)
  return defenseAbilitiesOf(
    entryBattersOf(progress, teamId).map((player, slot) => ({
      position: player.position,
      defense: entryBatterGameAbilities(context, teamId, player, slot)[2],
    })),
    pitcherAbilitiesAt(progress, teamId, pitcherIndex)[2],
  )
}

/** 타순 한 칸의 경기용 주루 능력치 (칸 3) — 진행기의 주자 속도가 된다 */
function runAbilityFor(progress: TeamGameProgress, teamId: number, battingOrderIndex: number): number {
  return entryAbilitiesAt(progress, teamId, battingOrderIndex)[3]
}

/** 고를 수 있는 구질 칸 여섯 (0xb6d2c) */
export function pitchSlotsFor(progress: TeamGameProgress): readonly PitchSlot[] {
  const repertoire = pitcherRepertoireAt(
    progress,
    progress.options.ourTeamId,
    progress.ourPitcherIndex,
  )
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
 *
 * ⚠️ 수비 화면을 띄우는 화면은 `startBatterPitch` 를 쓴다 — 이쪽은 타구까지 미리 다 돌려 버린다.
 */
export function applyBatterPitch(
  progress: TeamGameProgress,
  detail: PitchOutcomeDetail,
  random: RandomPort,
  options: BatterOutcomeOptions = {},
): TeamGameProgress {
  return batterPitch(progress, detail, random, options, applyBatterOutcome)
}

/**
 * 같은 공 하나지만, 타석이 인플레이 타구로 끝나면 **주자 처리를 수비 화면 뒤로 미룬다**
 * (`pendingDefensePlay` 에 얹고 멈춘다). 화면이 다 돌면 `resolveDefensePlay` 를 부르면 된다.
 */
export function startBatterPitch(
  progress: TeamGameProgress,
  detail: PitchOutcomeDetail,
  random: RandomPort,
  options: BatterOutcomeOptions = {},
): TeamGameProgress {
  return batterPitch(progress, detail, random, options, startBatterOutcome)
}

function batterPitch(
  progress: TeamGameProgress,
  detail: PitchOutcomeDetail,
  random: RandomPort,
  options: BatterOutcomeOptions,
  applyOutcome: (
    progress: TeamGameProgress,
    outcome: AtBatOutcome,
    random: RandomPort,
    options: BatterOutcomeOptions,
  ) => TeamGameProgress,
): TeamGameProgress {
  if (!isBatterTurn(progress)) return progress
  progress = throwOpponentPitch(progress, detail.pitchTypeNumber)
  // 장면 +0xfdc — 사람 타석은 번트 · 스윙 키(0x51dce · 0x51e2c · 0x51e84 · 0x51eba)가 쓴다. ⚠️ 웹 타석 화면은 안 휘두른 공을 0 으로 낸다
  progress = { ...progress, sceneBuntKind: options.buntKind ?? 0 }
  // 파울 각 공 — 원본도 판(상태 0x17)을 돈다. 연속 파울 기록(0xa7dbc)은 판의 결과 코드 7 메시지(51c5c)에서라 판이 파울로 닫힐 때 센다.
  // 필살 스윙의 성공 굴림(0x517e6)은 타석 판정이 쏜 공(`detail.foulContact`)에 재료만 실어 판 시작(필살수비 · 폴 굴림 뒤)이 굴린다
  if (detail.resolution.kind === '파울' && detail.pattern !== undefined && detail.resultCode !== null) {
    const contact = detail.foulContact ?? { pattern: detail.pattern, resultCode: detail.resultCode }
    const started = startBatterFoulPlay(progress, contact, random, options)
    if (applyOutcome === startBatterOutcome) return started
    const pending = started.pendingDefensePlay
    if (pending === null) return started
    const result = runDefensePlay(pending.input)
    return resolveDefensePlay({ ...started, lastDefensePlay: result }, result, random)
  }
  progress = withFoulRecords(progress, detail.resolution.kind === '파울')
  const atBat = applyPitchResolution(progress.atBat, detail.resolution)
  const outcome = atBat.outcome
  // 공 도착 0x3dfac — 못 맞힌 공이면 0.1% 폭투·포일(종류 9)이나 출발한 도루(종류 5) 판을 연다
  const arrival = arriveTeamPitch(
    { ...progress, atBat },
    // 사람 타자의 이 공 번트 종류 — 못 맞힌 번트면 그 종류 (useTeamGame 이 타석 화면에서 받아 넘긴다)
    { resolution: detail.resolution, outcomeAfter: outcome, buntKind: options.buntKind ?? 0 },
    '공격',
    random,
  )
  // 판에서 반 이닝·경기가 끝났다 — 이 타석은 끊긴다 (판정 B 0xae3e8: 아웃 > 2 → 0x18)
  if (arrival.interrupted) return advance(arrival.progress, random)
  // 판정 A(0xae24c)의 "그 밖 → 0xf" — 같은 타석 다음 공. 0xf 진입 0x3d954 가 CPU 투수 교체를 다시 묻는다
  if (outcome === null) return enterPitchSelection(arrival.progress, random)
  return applyOutcome(arrival.progress, outcome, random, { ...options, arrivalPlay: arrival.play })
}

/**
 * **32·33 연속 파울** — 파울 판정 `0x51408` 의 v = 7 갈래가 `0xa7dbc` 로 `ctx+0x15f` 를 올리고 3·4 에서 준다(사람 공격).
 * 파울이 아닌 공이 오면 공 도착 판정 `0x3dfac` 끝의 `0xa5fdc` 가 0 으로 되돌린다 — ⚠️ R8 4-4 의 **유력**
 * (0x3dfac 의 모든 갈래가 끝을 지나는지는 안 봤다). 타석 초기화 0xa5bcc 도 지운다(`prepareAtBat`).
 */
function withFoulRecords(progress: TeamGameProgress, isFoul: boolean): TeamGameProgress {
  if (!isFoul) {
    return progress.recordTally.foulStreak === 0
      ? progress
      : { ...progress, recordTally: { ...progress.recordTally, foulStreak: 0 } }
  }
  const fouled = foulRecordOf(progress.recordTally.foulStreak)
  return withGameRecords(
    { ...progress, recordTally: { ...progress.recordTally, foulStreak: fouled.foulStreak } },
    fouled.recordIds,
    true,
  )
}

/**
 * 사람 타석에서 **상대 CPU 투수가 공 하나를 던졌다** — 공이 손을 떠날 때(상태 0x11 진입 0x3de10 의 0x3dec6)
 * `0xa5e14(ctx, game+0xfc8 = 구질)` 이 수비 팀 투수를 깎는다 (P1 3-1, 4099ec6 과 같은 자리):
 *   투구 수 +1 (`team+0x27c` 묶음) · state[0xd] = 0 (`pitcherJustChanged`) · 스태미나 −c·용량 (0xaeb08)
 *   c = 0x66ef0(구질), 타자 스킬 22 압도 또는 투수 스킬 18 이면 ×2, 투수 스킬 10 이면 −1.
 * 용량 X 는 간이 타석 쪽(`quickPitcherDrainOf`)과 같은 입력이다 — 상대 팀 사기 100 · 첫 투수 보너스(0x66e44).
 *
 * ⚠️ 미해결: 타자 스킬 22 압도 — 팀 경기 명단(`TeamEntryBatter`)에 스킬 비트(+0x14)가 없어 늘 거짓이다.
 *    상대 CPU 투수 스킬 18·10 도 같은 까닭으로 늘 거짓.
 * 구질이 없으면(`PitchOutcomeDetail.pitchTypeNumber` 를 안 실은 호출) 깎지 않는다. 난수는 쓰지 않는다.
 */
function throwOpponentPitch(progress: TeamGameProgress, pitchTypeNumber: number | undefined): TeamGameProgress {
  if (pitchTypeNumber === undefined) return progress
  // 소모 0x345fc(`공+0x10 ≠ 0` 일 때만) → 싣기 0x3de10 — 타석 화면이 이 값의 사본으로 고른 구질을 같은 차례로 밟는다.
  // 공은 사람 투구와 함께 쓰는 한 칸이다 (`ballMagicNumber` 주석)
  const magic: MagicPitchGameState = {
    remaining: progress.opponentMagicRemaining,
    ballMagicNumber: progress.ballMagicNumber,
  }
  advanceMagicPitchGameState(
    magic,
    pitchTypeNumber,
    pitcherRepertoireAt(progress, progress.options.opponentTeamId, progress.opponentPitcherIndex).magicId,
  )
  return {
    ...progress,
    opponentMagicRemaining: magic.remaining,
    ballMagicNumber: magic.ballMagicNumber,
    opponentStamina: drainStamina({
      stamina: progress.opponentStamina,
      typeNumber: pitchTypeNumber,
      staminaAbility: opponentPitcherStaminaAbility(progress),
      teamMorale: 100,
      isFirstPitcher: progress.opponentUsedPitchers.length === 0,
      batterIntimidates: false,
      pitcherIsCoward: false,
      pitcherEndures: false,
    }),
    opponentPitcherCounters: addRunsToCounters(progress.opponentPitcherCounters, 0, 1, false),
    pitcherLines: chargeMoundLine(progress, false, { pitches: 1 }),
    pitcherJustChanged: false,
    // 같은 0xa5e14 가 바로 뒤(a5e7c)에서 state[0xe] 도 내린다
    cpuPinchHitUsed: false,
  }
}

export interface BatterOutcomeOptions {
  readonly pattern?: BattedBallPattern
  readonly isUncatchable?: boolean
  /**
   * 이 공이 도착하며 연 주자 판(`arriveTeamPitch`). 낫아웃(종류 9 · `'batterRuns'`)이면 그 판의 advance 가 곧
   * 이 삼진 타석의 진루다. 그 밖(볼넷·사구·삼진 + 도루·폭투)은 이미 주자 판으로 먹였으니 재생 칸만 지킨다.
   */
  readonly arrivalPlay?: PitchArrivalPlay | null
  /**
   * 이 공의 **번트 종류** 장면 +0xfdc (0 스윙 · 1~3 번트 — 타석 화면 `onPitchResolved` 넷째 인자). 타구 판 시작 리드
   * (0x3d7b8)가 도루 안 한 주자에게 +3 틱을 더한다(`DefensePlayInput.buntKind`). 안 넘기면 0.
   * 번트는 늘 맞히므로(swingResult `contact = 번트 > 0`) 못 맞힌 공의 도루·폭투 판에는 실릴 일이 없다.
   */
  readonly buntKind?: number
}

/**
 * 사람 타석 하나의 **결과**를 반영하고 다음 사람 차례까지 민다.
 * 인플레이 타구는 수비 시뮬레이션을 돌려 아웃·득점·루 상황을 그 결과로 갈아 끼운다.
 *
 * ⚠️ 사람이 주루를 조작하는 화면은 이것을 쓰지 않는다 — `startBatterOutcome` 으로 타석 결과만
 * 먼저 정하고, 화면이 틱을 다 돌린 뒤 `resolveDefensePlay` 로 주자 처리를 먹인다.
 * 여기는 그 둘을 한 줄로 이어 붙인 **얇은 껍데기**다 (자동 소화·테스트처럼 끼어들 사람이 없는 자리용).
 */
export function applyBatterOutcome(
  progress: TeamGameProgress,
  outcome: AtBatOutcome,
  random: RandomPort,
  options: BatterOutcomeOptions = {},
): TeamGameProgress {
  let started = startBatterOutcome(progress, outcome, random, options)
  // 끼어들 사람이 없으면 벤치 클리어링도 100틱을 다 본 것으로 친다 — 틱 10 의 굴림 8 번까지 나간다
  if (started.pendingBenchClearing !== null) {
    started = resolveBenchClearing(started, { reachedTargetTick: true }, random)
  }
  const pending = started.pendingDefensePlay
  if (pending === null) return started
  // 미리 다 돌려 버린다 — `runDefensePlay` 는 스테퍼를 끝까지 도는 얇은 껍데기라 난수 차례가 같다.
  // 이 갈래는 아직 아무것도 안 보여 줬으므로 돌린 결과를 그대로 재생거리로 넘긴다 (예전 그대로).
  const result = runDefensePlay(pending.input)
  // 판 끝 정산(0xa8024)이 낸 결과로 적는다 — 넘겨받은 결과는 타석을 끝낸 임시 값이다
  return finishBatterOutcome({ ...started, pendingDefensePlay: null }, recordedOutcomeOf(pending.input, result), random, result, result)
}

/**
 * 사람 타석의 결과 코드만 먼저 정한다 — **인플레이 타구면 주자 처리를 뒤로 미룬다.**
 *
 * 인플레이 타구는 진행기에 넘길 `DefensePlayInput` 만 만들어 `pendingDefensePlay` 에 얹고
 * 경기 상태는 **한 톨도 건드리지 않은 채** 돌려준다. 그 동안 `isHumanTurn` 이 거짓이라
 * 다음 투구가 나가지 않는 것이 이 칸의 뜻이다 (원본 상태 0x17 이 도는 동안 0xf 로 안 돌아간다).
 *
 * 우리 공격 타석이므로 사람이 잡는 쪽은 **공격(주루 0x5331c)** 이다 (I 0절 상태 0x17 표).
 * 삼진·볼넷·사구·홈런은 수비가 개입할 것이 없어 여기서 곧장 끝낸다. 사구는 그 앞에서 벤치 클리어링을 굴린다.
 */
export function startBatterOutcome(
  progress: TeamGameProgress,
  outcome: AtBatOutcome,
  random: RandomPort,
  options: BatterOutcomeOptions = {},
): TeamGameProgress {
  if (progress.game.isFinished) return progress
  // 출발 칸은 이 공 하나의 것이다 — 타구 판 입력이 읽고 나면 비운다
  const stealing = progress
  progress = withoutSteal(progress)
  // 사구면 상태 0x12 끝(0x4e74c)에서 벤치 클리어링을 굴린다 — 밀어내기 주루·정산보다 앞이다
  const cleared = withBatterBenchClearing(progress, outcome, random)
  if (cleared !== progress) {
    // 들어갔다 — 진입 0x3a5f0 의 굴림 45 번 뒤 연출에서 붙든다
    rollBenchClearingEntry(random)
    return { ...cleared, pendingBenchClearing: { side: '공격', outcome } }
  }
  // 페어 타구면 쏜 패턴이 따라온다 — 넘겨받았거나(`options.pattern`) 타석 결과 객체에 묶여 있다(`contactOfOutcome`)
  const pattern = options.pattern ?? contactOfOutcome(outcome)?.pattern
  // 판정 11(2스트라이크 번트 파울 아웃)도 파울 각 공 판이 낸다 — 여기 오는 맞은 공은 모두 판을 돈다
  const inPlay = pattern !== undefined ? isBattedBallKind(outcome) : isBattedBallInPlay(outcome)
  if (!inPlay) {
    const arrival = options.arrivalPlay ?? null
    // 낫아웃 — 폭투·포일 판의 진루(타자주자 포함)를 이 삼진 타석의 진루로 먹인다 (0x3e0d0 state[0x1a])
    if (arrival !== null && arrivalApplicationOf(arrival) === 'batterRuns') {
      return finishBatterOutcome(progress, outcome, random, arrival.result, arrival.result)
    }
    // ⚠️ 패턴 없이 들어온 홈런(시험·옛 호출)은 날아가는 그림만 따로 만든다 — 점수는 타석 쪽 규칙(전원 득점)이다.
    // 이 공이 연 도루·폭투 판이 있으면 그 판을 재생 칸에 남긴다
    const playback =
      homeRunPlaybackOf({ outcome, bases: progress.game.bases, pattern: options.pattern }) ?? arrival?.result ?? null
    return finishBatterOutcome(progress, outcome, random, null, playback)
  }
  // ⚠️ 패턴이 없으면(시험·옛 호출 — 원본에 없는 길) 결과에 맞는 패턴을 원본 표에서 골라 쓴다 (`fixturePatternFor`).
  // 결과 칸은 판 앞 예측이다(`predictedOutcomeOf`) — 기록은 실제 판의 정산 결과다
  const input = withPredictedOutcome(
    pattern !== undefined
      ? batterDefenseInputOf(stealing, outcome, pattern, random, options)
      : { ...batterDefenseInputOf(stealing, outcome, fixturePatternFor(outcome), random, options), outcomeIsGiven: true },
  )
  return { ...progress, pendingDefensePlay: { side: '공격', input, outcome: input.outcome } }
}

/**
 * **벤치 클리어링 연출이 끝났다** — 출구 0xae24c (100틱 뒤 화면 전환이 끝났거나 OK·'5' 로 건너뜀).
 * `reachedTargetTick` = 틱 10 의 갱신이 돌았는가 — 돌았으면 수비 8명 목표 굴림 8 번이 그때 나갔다
 * (`features/play-game/model/benchClearingScene`). 그 뒤 사구는 보통 길 그대로다.
 */
export function resolveBenchClearing(
  progress: TeamGameProgress,
  scene: { readonly reachedTargetTick: boolean },
  random: RandomPort,
): TeamGameProgress {
  const pending = progress.pendingBenchClearing
  if (pending === null) return progress
  if (scene.reachedTargetTick) rollBenchClearingTargets(random)
  const cleared: TeamGameProgress = { ...progress, pendingBenchClearing: null }
  if (pending.side === '공격') {
    const playback = homeRunPlaybackOf({ outcome: pending.outcome, bases: cleared.game.bases })
    return finishBatterOutcome(cleared, pending.outcome, random, null, playback)
  }
  // 사구는 인플레이가 아니라 수비 화면 없이 곧장 끝난다
  return advance(startDefensiveAtBat(cleared, pending.outcome, true, random), random)
}

/**
 * **사구 뒤 벤치 클리어링** (`entities/game/model/benchClearing`, R10 6절) — 우리 타석이라 수비(상대)는 CPU 다.
 * 들어가면 상대 투수 투구 수(`+0x27c`) +10 (0x3ab82). 시즌 평판 S[1](코드 1, 0x3ab92)도 부르지만 코드 ≤ 5 는
 * 공격측이 CPU 일 때만 적히므로 우리 공격에서는 게이트에서 버려진다 (`withSeasonRecord` 가 그대로 가른다).
 * 홈런더비가 아니라 사구면 늘 한 번 굴린다 — **사구 타석만 난수를 하나 더 쓴다.**
 * 들어가면 부르는 쪽이 연출(상태 0x1e)을 붙든다 — `pendingBenchClearing` · `resolveBenchClearing`.
 * 우리가 던진 공에 CPU 타자가 맞는 쪽(코드 1 이 S[1] 에 남고 우리 투수 스태미나 −1000)은 `withPitcherBenchClearing`.
 */
function withBatterBenchClearing(
  progress: TeamGameProgress,
  outcome: AtBatOutcome,
  random: RandomPort,
): TeamGameProgress {
  const entered = rollsIntoBenchClearing(
    {
      isHitByPitch: outcome.kind === '사구',
      isHomeRunDerby: false,
      burstInProgress: progress.burst !== null && progress.burst.current !== null,
    },
    random,
  )
  if (!entered) return progress
  const effect = benchClearingEffectOf(false)
  return appendLog(
    {
      ...progress,
      opponentPitcherCounters: addRunsToCounters(
        progress.opponentPitcherCounters,
        0,
        effect.defensePitchCountGain,
        false,
      ),
      gameRecord: withSeasonRecord(progress, '공격', [effect.seasonRecordCode]),
    },
    `${progress.game.inning}회${progress.game.half} 벤치 클리어링`,
    true,
  )
}

/**
 * 우리 공격 타석의 타구 하나 — 능력치·난수·모드·수비 주체까지 다 여기서 채운다.
 * 이 객체를 만드는 데는 난수를 **한 번도 쓰지 않는다** (굴림은 전부 진행기 안에서 돈다).
 */
function batterDefenseInputOf(
  progress: TeamGameProgress,
  outcome: AtBatOutcome,
  pattern: BattedBallPattern,
  random: RandomPort,
  options: BatterOutcomeOptions,
): DefensePlayInput {
  const before = progress.game
  return {
    // 타석을 끝낸 임시 결과 — 진행기는 보지 않는다(결과는 판 끝 정산이 낸다)
    outcome,
    trajectory: battedBallTrajectory(pattern),
    bases: before.bases,
    outs: before.outs,
    // 공이 나는 동안 출발한 주자 — 판 시작 리드(0x3d7b8)가 다음 루로 몰아 돌린다
    stealingFrom: progress.stealingFrom,
    // 우리 공격이니 수비는 상대 팀이다
    defenseAbilities: defenseAbilitiesFor(progress, progress.options.opponentTeamId, progress.opponentPitcherIndex),
    runAbility: runAbilityFor(progress, progress.options.ourTeamId, before.battingOrderIndex),
    // 난수를 넘겨야 펌블·악송구·필살수비·레이저 굴림이 돈다
    random,
    gameMode: progress.options.mode,
    // 상대 수비는 CPU 다 → 협살(AI 상태 8)이 돈다
    defenseIsCpu: true,
    // 우리가 공격이다 — 여기서만 환경설정 "주루" 가 먹는다 (0xae690 의 둘째 항)
    offenseIsCpu: false,
    runningMode: progress.options.runningModeManual === true ? '수동' : '자동',
    // 필살타법이 성공한 타구면 야수가 쥐지 않는다 (0x51800)
    isUncatchable: options.isUncatchable,
    // 장면 +0xfdc — 번트면 도루 안 한 주자의 판 시작 리드가 +3 틱 (0x3d7b8)
    buntKind: options.buntKind ?? 0,
  }
}

/**
 * 사람 타석 하나를 경기 상태에 먹이고 다음 사람 차례까지 민다 — 예전 `applyBatterOutcome` 의 몸통이다.
 *
 * `defensePlay` 가 있으면 그 결과로 진루·아웃·득점을 갈아 끼운다. `playback` 은 화면에 재생시킬 것 —
 * **실시간으로 이미 다 보여 준 플레이는 null** 이고, 홈런은 부르는 쪽이 비행 틱을 만들어 넘긴다.
 */
function finishBatterOutcome(
  progress: TeamGameProgress,
  outcome: AtBatOutcome,
  random: RandomPort,
  defensePlay: DefensePlayResult | null,
  playback: DefensePlayResult | null,
): TeamGameProgress {
  const before = progress.game

  const game = applyAtBatOutcome(before, outcome, defensePlay?.advance)
  const runsBattedIn = game.ourScore - before.ourScore
  // 아웃 수는 반 이닝이 넘어가면 0 으로 되돌아가므로 진행 결과에서 직접 읽는다 (`gameFlow` 와 같은 길)
  const outsAdded =
    defensePlay?.advance.outsAdded ?? advanceRunners(before.bases, outcome, before.outs).outsAdded
  const slot = before.battingOrderIndex
  const inningEnded = before.outs + outsAdded >= OUTS_PER_INNING
  const isWalkOff = game.isFinished && runsBattedIn > 0 && game.ourScore > game.opponentScore
  // 시즌 평판 16칸 — 우리 공격이라 **수비측(상대)이 CPU** 인 코드(≥ 6)만 선다
  const offense = offenseRecordOf(outcome, runsBattedIn, progress.ourHitBases[slot] ?? [])
  // 기록달성 (0xa8024 → 0xa77f0) — 사람 공격이라 공격 계열이 게이트를 지난다. 5 대타 홈런은 ctx+0x160 을 본다
  const recorded = withOurAtBatRecords(progress, slot, outcome, runsBattedIn, isPinchHitAtBat(progress))

  const next: TeamGameProgress = {
    ...recorded,
    game,
    // 득점 처리 0xa5c34 — 한 점씩 승·패·세 칸을 고친다
    decisions: decisionsAfterPlay(progress.decisions, before, game, moundsOf(progress)),
    // 정산 0xa8024 — 상대 마운드 투수 레코드에 아웃(결과 코드 5·0xd)·실점·탈삼진
    pitcherLines: chargeMoundLine(progress, false, {
      outs: outsAddedBetween(before, game),
      runsAllowed: runsBattedIn,
      strikeouts: outcome.kind === '삼진' ? 1 : 0,
    }),
    gameRecord: withSeasonRecord(progress, '공격', offense.codes),
    ourHitBases: withHitBases(progress.ourHitBases, slot, offense.hitBases),
    lastDefensePlay: playback,
    atBat: createAtBat(),
    atBatPrepared: false,
    // 다음 타석 시작 0x48d50 → 0xa5bcc 가 ctx+0x160 을 지운다
    pinchHitHomeRunHalf: null,
    // 우리 타석의 득점은 **상대 투수**의 A·B 로 들어간다 (0xa5c34 는 수비 팀 칸을 올린다)
    opponentPitcherCounters: addRunsToCounters(
      progress.opponentPitcherCounters,
      runsBattedIn,
      0,
      game.inning !== before.inning || game.half !== before.half,
    ),
    ourHits: progress.ourHits + (isHit(outcome) ? 1 : 0),
    ourEntryRecords: withPlateAppearance(progress.ourEntryRecords, slot, outcome),
    leaguePlateAppearances: withLeaguePlateAppearance(
      progress.leaguePlateAppearances,
      progress.options.ourTeamId,
      progress.ourEntry,
      slot,
      outcome,
      runsBattedIn,
    ),
  }

  const resolved = resolveBurstFor(next, {
    outcome,
    runsBattedIn,
    outsBefore: before.outs,
    outsAdded,
    inningEnded,
    humanTeamWalkOff: isWalkOff,
    batterRunnerSafe: defensePlay === null ? undefined : batterRunnerSafeOfFates(defensePlay.runnerFates),
    // B6 — 번트 타구(state[0x13]) && (희생 [sp+8] || 득점) (a88e0 · a88f8)
    isBunt: defensePlay?.buntBall === true,
    runnersAdvanced: defensePlay?.sacrifice === true,
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
 *
 * ⚠️ 수비 화면을 띄우는 화면은 `startThrowPitch` 를 쓴다 — 이쪽은 타구까지 미리 다 돌려 버린다.
 */
export function throwPitch(
  progress: TeamGameProgress,
  input: TeamPitchInput,
  random: RandomPort,
): TeamGameProgress {
  return pitchOnce(progress, input, random, false)
}

/**
 * 같은 공 하나지만, 인플레이 타구가 나오면 **송구를 사람이 잡도록 거기서 멈춘다**
 * (`pendingDefensePlay` 에 얹는다). 화면이 다 돌면 `resolveDefensePlay` 를 부르면 된다.
 */
export function startThrowPitch(
  progress: TeamGameProgress,
  input: TeamPitchInput,
  random: RandomPort,
): TeamGameProgress {
  return pitchOnce(progress, input, random, true)
}

/** `defer` 가 참이면 인플레이 타구에서 멈춘다 — 그 밖은 예전처럼 타구까지 한 번에 돌린다 */
function pitchOnce(
  progress: TeamGameProgress,
  input: TeamPitchInput,
  random: RandomPort,
  defer: boolean,
): TeamGameProgress {
  if (!isPitchTurn(progress)) return progress
  const { options } = progress
  const isMagic = input.typeNumber === MAGIC_PITCH_TYPE_NUMBER
  if (isMagic && progress.magicRemaining <= 0) return progress

  const stats = ourPitcherStats(progress)
  const fatigued = fatiguedStatsOf(stats, progress.stamina)
  const staminaPercent = staminaPercentOf(progress.stamina)
  const repertoire = pitcherRepertoireAt(progress, options.ourTeamId, progress.ourPitcherIndex)
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
  const builtPitch = buildHumanPitch(
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

  // 코스 확정 0x50e9c 가 남은 마구를 줄이고(아래 magicRemaining) 상태 0x11 진입 0x3de10 이 그 **뒤**에
  // `구질 == 22 && 남은 > 0` 이면 공+0x10 = 투수+0x18 을 싣는다 — 마지막 한 개(1 → 0)는 안 싣는다 (H2 3-4).
  // 되돌리는 줄이 없어 마구 뒤의 공에도 남는다. CPU 타석 판정의 0x34d6c 투수 쪽이 이 칸을 본다
  const magicRemainingAfter = isMagic ? progress.magicRemaining - 1 : progress.magicRemaining
  const ballMagicNumber = ballMagicNumberAfterPitch(
    progress.ballMagicNumber,
    input.typeNumber,
    repertoire.magicId,
    magicRemainingAfter,
  )
  const pitch: Pitch = { ...builtPitch, magicNumber: ballMagicNumber, pitcherMagicNumber: repertoire.magicId }

  // 실투 판정 0x33cbc — 투구 순간 0x4dc78 이 궤적 준비 0x9e669 **뒤**(0x4dea0)에 부른다.
  // 등급 뽑기·제구 흩어짐 굴림 뒤, CPU 타자 결정 0x34334 앞이다. 마구가 아니면 rand(0,100) 한 번.
  const isMistake = isMistakePitch(
    {
      isMagicPitch: isMagic,
      grade,
      // 0xb570d(ctx, 1, 투수, 1, 90, 1) — 칸 1 구속, 체력 인자 90 이라 피로 감소가 없다.
      // `ourPitcherStats` 가 곧 그 경기용 값(질병·사기·팀 능력치·코치, 피로 전)이다
      effectiveVelocity: stats.velocity,
      runnerCount: runnerCountOf(progress.game.bases),
      hasSecondBaseRunner: progress.game.bases.second,
      // 웹 로스터·마선수 표에 스킬 비트(+0x14)가 없어 타자 22 · 투수 16·17·22 를 늘 거짓으로 둔다
      batterIntimidates: false,
      pitcherIsSteady: false,
      pitcherIsTimid: false,
      pitcherIsCool: false,
    },
    random,
  )

  const batter = entryStageAbilityOf(progress, options.opponentTeamId, progress.opponentOrderIndex)
  // 0xb633d(타자) — 레코드 +0xa 비트 6. 명단에 끼운 마타자(`withAceBatter`)만 참이다
  const aceBatterIndex =
    entryBattersOf(progress, options.opponentTeamId)[progress.opponentOrderIndex]?.aceIndex ?? NO_ACE_BATTER
  const isMagicBatter = aceBatterIndex >= 0
  const ourRepertoireAce = repertoire.magicId >= ACE_SPECIAL_NUMBER_OFFSET
  // CPU 도루 0x520de — 상태 0x11 의 10번째 틱(0x537dc → 메시지 0x583)이라 CPU 타자 결정(11번째 틱 0x34334)
  // **바로 앞**이다. 후보가 있을 때만 rand(0,1000) 한 번 → 0xa9bd4 출발 (`rollCpuStealStart`)
  const stealingFrom = rollCpuStealStart(
    {
      bases: progress.game.bases,
      offenseIsCpu: true,
      runAbilityOf: (base) => runAbilitiesOnBaseOf(progress, '수비')[base] ?? 0,
    },
    random,
  )
  const thrown = pitchAgainstBatterDetailed(
    pitch,
    batter,
    random,
    {
      control: fatigued.control,
      velocity: fatigued.velocity,
    },
    // 원본 0x34334 는 state+4·+5·+6(S·B·O)과 주자 유무로 타격 표(0x9f190)의 행을 고른다
    {
      strikes: progress.atBat.strikes,
      balls: progress.atBat.balls,
      outs: progress.game.outs,
      hasRunner: runnerCountOf(progress.game.bases) > 0,
    },
    {
      isMistakePitch: isMistake,
      isMagicBatter,
      // 마타자 필살 0x34468~0x34488 — 남은 칸(0xaea30)이 0 이 아니면 휘두를 때마다 필살이다 (난수 없음).
      // 번호 = 마선수 +0x18 = 순번 + 5, 보정 구조체 k = 레벨·5 + 순번
      ...(isMagicBatter
        ? {
            specialSwing: {
              swingNumber: aceBatterIndex + ACE_SPECIAL_NUMBER_OFFSET,
              remaining: specialSwingRemainingAt(progress, '상대'),
              aceOrder: aceBatterIndex,
              aceLevel: aceBatterLevelOf(progress, aceBatterIndex),
            },
          }
        : {}),
      // 0x34d6c 투수 쪽 — 공+0x10 이 서 있고 우리 투수가 마투수면 `mgr[0x13a + 순번]`
      pitcherAceLevel: ourRepertoireAce
        ? aceLevelOf(options.aceLevels, aceLevelSlotOf('투수', repertoire.magicId - ACE_SPECIAL_NUMBER_OFFSET + 1))
        : 0,
      // 팀 경기 모드 1·2·8·9 는 판정 묶음 '일반' — 수비(우리)가 사람이라 hit·power 쪽 −10 (0xab5c0).
      // 내 선수 보너스(모드 3·4)·투수 미션 +100(모드 5)은 없다 — 팀 명단에 비트7 선수가 없다
      swingMode: '일반',
      // 파울 각 공도 수비 판을 돈다 — 낙구 전에 잡히면 파울 뜬공 아웃(13), 아니면 판이 닫힌 뒤 스트라이크(0x35108 → 0xb6b58)
      playsFoulBall: true,
      // 장면 +0xfdc — 안 휘두른 공은 앞 공의 값이 남는다(0x34436 은 휘두를 때만 쓴다)
      previousBuntKind: progress.sceneBuntKind ?? 0,
    },
  )
  const resolution = thrown.resolution
  const foulContact = thrown.foulContact

  // 스태미나는 게이지 결과와 무관하다 — 인자가 (game, 구질) 뿐이다 (P1 3-1 확정)
  const stamina = drainStamina({
    stamina: progress.stamina,
    typeNumber: input.typeNumber,
    staminaAbility: stats.stamina,
    teamMorale: ourTeamMoraleOf(options),
    // 0xaeb08 `team+0x26 − team+0x33 == 1` — 마운드를 밟은 투수가 지금 투수 하나뿐일 때만 첫 투수 보너스(0x66e44 +200).
    // 교체로 올라온 구원 투수는 받지 않는다 (P1 3-2, 상대 쪽 `throwOpponentPitch` 와 같은 식)
    isFirstPitcher: progress.ourUsedPitchers.length === 0,
    // 상대 타자의 스킬 22(0xb62b4)를 웹 로스터가 들고 있지 않아 늘 거짓이다
    batterIntimidates: false,
    pitcherIsCoward: false,
    pitcherEndures: false,
  })

  const afterPitch: TeamGameProgress = {
    ...progress,
    stamina,
    // ⚠️ 마구 횟수는 **코스 확정(OK)** 때 줄어든다 — 구질을 고른 순간이 아니다 (0x50e9c)
    magicRemaining: magicRemainingAfter,
    ballMagicNumber,
    // 0x4e136 — CPU 마타자의 필살 스윙이 나간 틱에 그 타순 칸 −1 (헛스윙도)
    opponentSpecialSwingRemaining:
      thrown.specialSwingRemaining === null
        ? progress.opponentSpecialSwingRemaining
        : withSpecialSwingSlot(
            progress.opponentSpecialSwingRemaining,
            progress.opponentOrderIndex,
            thrown.specialSwingRemaining,
          ),
    pitchCount: progress.pitchCount + 1,
    // 투구마다 state[0xd] 가 내려간다 (0xa5e72) — 그 뒤라야 다시 교체를 볼 수 있다
    pitcherJustChanged: false,
    // 같은 0xa5e14 가 state[0xe](CPU 대타 막음)도 내린다 (a5e7c)
    cpuPinchHitUsed: false,
    // 0xa5e14 가 이 타석·반 이닝 투구 수(ctx+0x161 a5eda · +0x16c a5e4e)를 올린다.
    // 코스를 확정했으니(0x50e9c) state[0x8c] = 1 — 완투 계열의 조건이다
    recordTally: withHalfInningPitches(
      {
        ...progress.recordTally,
        atBatPitches: progress.recordTally.atBatPitches + 1,
        pitchCourseConfirmed: true,
      },
      progress.game,
      1,
    ),
    ourPitcherCounters: {
      ...progress.ourPitcherCounters,
      pitches: progress.ourPitcherCounters.pitches + 1,
    },
    pitcherLines: chargeMoundLine(progress, true, { pitches: 1 }),
    lastPitch: pitch,
    lastResolution: resolution,
    // 판을 도는 파울 각 공은 판이 파울로 닫힌 뒤에야 스트라이크가 오른다(0x35108 → 0xb6b58)
    atBat: foulContact === undefined ? applyPitchResolution(progress.atBat, resolution) : progress.atBat,
    stealingFrom,
    sceneBuntKind: thrown.buntKind ?? 0,
  }

  // 파울 각 공 — 원본도 판(상태 0x17)을 돈다(맞은 공은 모두 메시지 0x11 → 0x13 → 0x17). 공 도착 판(0x3dfac)은 못 맞힌 공만이다
  if (foulContact !== undefined) {
    const started = startDefensiveFoulPlay(afterPitch, foulContact, random, thrown.buntKind ?? 0)
    if (defer) return started
    const pending = started.pendingDefensePlay
    if (pending === null) return started
    const result = runDefensePlay(pending.input)
    return resolveDefensePlay({ ...started, lastDefensePlay: result }, result, random)
  }

  // 공 도착 0x3dfac — 못 맞힌 공이면 0.1% 폭투·포일(종류 9)이나 CPU 가 건 도루(종류 5) 판을 연다.
  // 우리 수비라 송구는 사람 쪽이다 — 판은 키 없는 사람 수비로 미리 다 돌려 재생한다 (견제와 같은 근사)
  const arrival = arriveTeamPitch(
    afterPitch,
    // CPU 타자의 이 공 번트 종류(`simulateBatter`) — ⚠️ 번트 헛스윙은 아직 안 낸다(pitcherGameFlow `arrivePitcherPitch` 머리말)
    { resolution, outcomeAfter: afterPitch.atBat.outcome, buntKind: thrown.buntKind ?? 0 },
    '수비',
    random,
  )
  // 판에서 반 이닝·경기가 끝났다 — 이 타석은 끊긴다 (판정 B 0xae3e8: 아웃 > 2 → 0x18)
  if (arrival.interrupted) return advance(arrival.progress, random)
  const arrived = arrival.progress
  const outcome = arrived.atBat.outcome
  // 판정 A(0xae24c)의 "그 밖 → 0xf" — 같은 타석 다음 공. 0xf 진입 0x3d954 가 CPU 대타를 다시 묻는다
  if (outcome === null) return enterPitchSelection(arrived, random)

  // 사구면 상태 0x12 끝(0x4e74c)에서 벤치 클리어링을 굴린다 — 밀어내기 주루(0x17)·정산 0xa8024 보다 앞이다
  const cleared = withPitcherBenchClearing(arrived, outcome, random)
  if (cleared !== arrived) {
    // 들어갔다 — 진입 0x3a5f0 의 굴림 45 번 뒤 연출에서 붙든다. 끼어들 사람이 없는 갈래는 끝까지 본 것으로
    rollBenchClearingEntry(random)
    const held: TeamGameProgress = { ...cleared, pendingBenchClearing: { side: '수비', outcome } }
    return defer ? held : resolveBenchClearing(held, { reachedTargetTick: true }, random)
  }
  // 0x517e6 — CPU 마타자 필살이 성공한 타구는 "송구공" 비트(0xaf180)가 서서 야수가 쥐지 못한다
  const started = startDefensiveAtBat(cleared, outcome, true, random, thrown.isUncatchable, arrival.play, thrown.buntKind ?? 0)
  const pending = started.pendingDefensePlay
  // 수비 진행 중 — 화면이 틱을 돌리는 동안 경기를 붙들어 둔다 (원본 상태 0x17)
  if (pending === null) return advance(started, random)
  if (defer) return started
  // 미리 다 돌려 버리는 갈래 — 난수를 쓰는 자리가 예전 `runDefensePlay` 호출과 똑같다
  const result = runDefensePlay(pending.input)
  return advance(
    // 판 끝 정산(0xa8024)이 낸 결과로 적는다 — 타석 쪽 결과는 임시 값이다(`battedContact`)
    finishDefensiveAtBat({ ...started, pendingDefensePlay: null }, recordedOutcomeOf(pending.input, result), true, result, result),
    random,
  )
}

/**
 * **사구 뒤 벤치 클리어링** (`entities/game/model/benchClearing`, R10 6절) — 우리가 던진 공이라 수비는 사람이다.
 * 들어가면 0x3ab7c `0xaeab0(수비 팀, 1000)` — 지금 마운드의 우리 투수 스태미나(+0x2c) −1000, [0, 10000] 로 자른다.
 * 시즌 평판 S[1](코드 1, 0x3ab92)은 코드 ≤ 5 라 공격측(상대)이 CPU 인 지금 남는다 — `withSeasonRecord` 가
 * 시즌 팀 경기(모드 2)일 때만 적는다. 홈런더비가 아니라 사구면 늘 한 번 굴린다 — **사구 타석만 난수를 하나 더 쓴다.**
 * 들어가면 부르는 쪽이 연출(상태 0x1e)을 붙든다 — `pendingBenchClearing` · `resolveBenchClearing`.
 */
function withPitcherBenchClearing(
  progress: TeamGameProgress,
  outcome: AtBatOutcome,
  random: RandomPort,
): TeamGameProgress {
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
    {
      ...progress,
      stamina: staminaAfterBenchClearing(progress.stamina, effect.defenseStaminaLoss),
      gameRecord: withSeasonRecord(progress, '수비', [effect.seasonRecordCode]),
    },
    `${progress.game.inning}회${progress.game.half} 벤치 클리어링`,
    true,
  )
}

/**
 * 상대 타석 하나의 결과 코드만 먼저 정한다. `mine` 이 참이면 사람이 던진 타석이라
 * 인플레이 타구를 `pendingDefensePlay` 에 얹고 **경기 상태는 한 톨도 안 건드린 채** 멈춘다.
 *
 * 사람이 잡는 쪽은 **수비(송구 0x533c8)** 다 — 원본 상태 0x17 갈래가 공/수로 가르는 그 자리다
 * (I 0절 표: 공격이면 0x5331c 주루, 수비면 0x533c8 송구).
 *
 * 자동으로 넘긴 타석(`mine` 거짓)은 수비 시뮬레이션 자체가 없어 곧장 끝난다.
 */
function startDefensiveAtBat(
  progress: TeamGameProgress,
  outcome: AtBatOutcome,
  mine: boolean,
  random: RandomPort,
  /** 필살 성공 타구인가 (0x517e6 → 0x51800) — 사람이 던진 타석의 CPU 마타자만 */
  isUncatchable = false,
  /** 이 공이 도착하며 연 주자 판 (`arriveTeamPitch`) — 낫아웃이면 그 판의 진루가 이 삼진 타석의 진루다 */
  arrival: PitchArrivalPlay | null = null,
  /** 장면 +0xfdc — CPU 타자의 번트 종류(`simulateBatter`). 판 시작 리드(0x3d7b8) · 필살수비 관문(50fc8) · 정산이 본다 */
  buntKind = 0,
): TeamGameProgress {
  // 출발 칸은 이 공 하나의 것이다 — 타구 판 입력이 읽고 나면 비운다
  const stealing = progress
  progress = withoutSteal(progress)
  // 사람이 던진 타석의 맞은 공은 쏜 패턴(`simulateBatter` 가 결과 객체에 묶어 둔 것)으로 판을 돈다
  const pattern = contactOfOutcome(outcome)?.pattern
  const inPlay = mine && (pattern !== undefined ? isBattedBallKind(outcome) : isBattedBallInPlay(outcome))
  if (!inPlay) {
    // 낫아웃 — 폭투·포일 판의 진루(타자주자 포함)를 이 삼진 타석의 진루로 먹인다 (0x3e0d0 state[0x1a])
    if (arrival !== null && arrivalApplicationOf(arrival) === 'batterRuns') {
      return finishDefensiveAtBat(progress, outcome, mine, arrival.result, arrival.result)
    }
    // 내가 던진 타석이면 홈런도 날아가는 그림을 보여 준다 (자동으로 넘긴 타석은 재생 자체가 없다)
    const playback = mine ? homeRunPlaybackOf({ outcome, bases: progress.game.bases }) : null
    return finishDefensiveAtBat(progress, outcome, mine, null, playback)
  }
  // ⚠️ 패턴이 없으면(시험·옛 호출 — 원본에 없는 길) 결과에 맞는 패턴을 원본 표에서 골라 쓴다 (`fixturePatternFor`).
  // 결과 칸은 판 앞 예측이다(`predictedOutcomeOf`) — 기록은 실제 판의 정산 결과다
  const input = withPredictedOutcome(
    pattern !== undefined
      ? { ...defensiveDefenseInputOf(stealing, outcome, pattern, random, isUncatchable), buntKind }
      : {
          ...defensiveDefenseInputOf(stealing, outcome, fixturePatternFor(outcome), random, isUncatchable),
          buntKind,
          outcomeIsGiven: true,
        },
  )
  return { ...progress, pendingDefensePlay: { side: '수비', input, outcome: input.outcome } }
}

/** 파울 각 공 판의 임시 결과 칸 — 판이 파울로 닫히면 쓰지 않고, 잡히면 판 끝 정산(뜬공 아웃)이 갈아 끼운다 */
const FOUL_PLAY_OUTCOME: AtBatOutcome = { kind: '아웃', detail: '뜬공아웃' }

/**
 * **사람이 던진 타석의 파울 각 공 판** — 맞은 공이라 판을 돈다(타석은 아직 안 끝났다). 판이 파울로 닫히면(`foulEnded`)
 * `resolveDefensePlay` 가 스트라이크를 올리고 같은 타석 다음 공으로, 낙구 전에 잡히면 파울 뜬공 아웃으로 타석을 끝낸다.
 */
function startDefensiveFoulPlay(
  progress: TeamGameProgress,
  contact: BattedContact,
  random: RandomPort,
  buntKind: number,
): TeamGameProgress {
  const stealing = progress
  const cleared = withoutSteal(progress)
  const outcome = registerContact(FOUL_PLAY_OUTCOME, contact)
  const input = withPredictedOutcome({
    ...defensiveDefenseInputOf(stealing, outcome, contact.pattern, random, false),
    // 판 끝 결과 코드 11(2스트라이크 번트 파울) · 판 뒤 스트라이크(0xb6b58)가 이 공 앞의 스트라이크를 본다
    strikes: progress.atBat.strikes,
    // 장면 +0xfdc — CPU 타자의 번트 종류. 11 은 번트(state[0x13])일 때만 난다
    buntKind,
  })
  return { ...cleared, pendingDefensePlay: { side: '수비', input, outcome: input.outcome } }
}

/** **우리 타석의 파울 각 공 판** — `startDefensiveFoulPlay` 의 공격 쪽. 상대 수비(CPU)가 공을 쫓고 사람은 주루를 잡는다 */
function startBatterFoulPlay(
  progress: TeamGameProgress,
  contact: BattedContact,
  random: RandomPort,
  options: BatterOutcomeOptions,
): TeamGameProgress {
  const stealing = progress
  const cleared = withoutSteal(progress)
  const outcome = registerContact(FOUL_PLAY_OUTCOME, contact)
  const input = withPredictedOutcome({
    ...batterDefenseInputOf(stealing, outcome, contact.pattern, random, options),
    strikes: progress.atBat.strikes,
  })
  return { ...cleared, pendingDefensePlay: { side: '공격', input, outcome: input.outcome } }
}

/**
 * **파울로 닫힌 판의 뒤** — 판 끝 판정 B 0xae3e8 ae568 이 정산 0xa8024 를 건너뛰고 0xf(같은 타석 다음 공)로, 0x35108 이
 * 0xa975c(주자를 판 앞 자리로) · 0xb6b58(스트라이크 ≤ 1 이면 +1)을 부른다. 웹 타석 칸의 '파울' 과 같은 규칙이다.
 * 우리 타석이면 판의 결과 코드 7 메시지(51c5c)의 연속 파울 기록(0xa7dbc)도 이때 센다.
 */
function afterFoulPlay(progress: TeamGameProgress, side: ControlSide, random: RandomPort): TeamGameProgress {
  const recorded = side === '공격' ? withFoulRecords(progress, true) : progress
  return enterPitchSelection({ ...recorded, atBat: applyPitchResolution(recorded.atBat, { kind: '파울' }) }, random)
}

/**
 * 사람이 던진 타석의 타구 하나. 이 객체를 만드는 데는 난수를 **한 번도 쓰지 않는다**
 * (굴림은 전부 진행기 안에서 돈다).
 */
function defensiveDefenseInputOf(
  progress: TeamGameProgress,
  outcome: AtBatOutcome,
  pattern: BattedBallPattern,
  random: RandomPort,
  isUncatchable: boolean,
): DefensePlayInput {
  const before = progress.game
  return {
    // 타석을 끝낸 임시 결과 — 진행기는 보지 않는다(결과는 판 끝 정산이 낸다)
    outcome,
    isUncatchable,
    trajectory: battedBallTrajectory(pattern),
    bases: before.bases,
    outs: before.outs,
    // CPU 가 공이 나는 동안 건 도루 — 판 시작 리드(0x3d7b8)가 다음 루로 몰아 돌린다
    stealingFrom: progress.stealingFrom,
    // 우리가 수비 중이다 — 아홉 칸은 우리 팀, 주자는 상대 타자
    defenseAbilities: defenseAbilitiesFor(progress, progress.options.ourTeamId, progress.ourPitcherIndex),
    runAbility: runAbilityFor(progress, progress.options.opponentTeamId, progress.opponentOrderIndex),
    random,
    gameMode: progress.options.mode,
    // 이 타석의 수비는 **사람**이다 → 협살은 원본에서도 안 일어난다 (S8 1-4)
    defenseIsCpu: false,
    // 공격이 CPU 라 0xae690 의 첫 항이 서서 설정과 무관하게 늘 자동 진루다
    offenseIsCpu: true,
    // 반대로 **송구는 여기서만 환경설정이 먹는다** — 0xae6c8 의 첫 항(`경기[0x31 + 수비측] == 1`)이
    // 사람 수비라 거짓이다. 안 넘기면 원본 기본값인 수동이다
    throwMode: progress.options.throwModeManual === false ? '자동' : '수동',
  }
}

/**
 * 이 정산(`0xa8024`)이 `state[0x88]`(출루 허용)을 세우는가 — `0xa8c5c~0xa8ca6`:
 * ```
 * a8c2e  r5 = 0 ; r4 = 0
 * a8c5c  for i < 0xa9598(목록 크기):  r3 = 주자[i]+0x96 ; r5 = 0 ; if r3 == 0: r5 = 1   ; ★ 루프 안에서 지운다
 * a8c86  0xa57f8(R, 0x17, r5)                                                          ; R+0x130 = r5 (읽는 곳 없음)
 * a8ca6  if r5 && 수비 팀이 사람: state[0x88] = 1
 * ```
 * 목록은 `[타자주자?, 1루?, 2루?, 3루?]` 라 마지막 원소 하나만 본다 (`baserunnerAllowedOfFates`).
 * - 수비 화면을 돈 판(인플레이 · 낫아웃 판)은 진행기의 `runnerFates`.
 * - 사람 장면의 삼진·볼넷·사구·홈런은 수비 화면 없이 정산으로 가므로 `runnerFatesWithoutPlay`.
 *
 * ⚠️ 미해결: **간이 엔진 타석**(자동으로 넘긴 상대 타석, `mine` 거짓)이 정산 때 주자 목록에 무엇을 두는지는 못 읽었다
 *    (간이 엔진 홈런 0xc1054 → 0xc10b8 이 목록 전원에 +0x95·+0x96 을 세운다는 것만 안다). 그래서 거기만 예전처럼
 *    안타·볼넷·사구면 세운다 (근사).
 */
function allowedBaserunnerOfPlay(
  bases: GameState['bases'],
  outcome: AtBatOutcome,
  mine: boolean,
  defensePlay: DefensePlayResult | null,
): boolean {
  if (defensePlay !== null) return baserunnerAllowedOfFates(defensePlay.runnerFates)
  if (mine && outcome.kind !== '안타' && outcome.kind !== '아웃') {
    return baserunnerAllowedOfFates(runnerFatesWithoutPlay(bases, outcome))
  }
  return isHit(outcome) || isFreePass(outcome)
}

/**
 * 상대 타석 하나를 경기 상태에 먹인다 — 예전 `applyDefensiveAtBat` 의 몸통이다.
 * `playback` 이 null 이면 재생할 것이 없다는 뜻이라 `lastDefensePlay` 는 그대로 둔다
 * (실시간으로 이미 다 보여 준 플레이가 여기로 온다 — 넣으면 같은 장면을 한 번 더 튼다).
 */
function finishDefensiveAtBat(
  progress: TeamGameProgress,
  outcome: AtBatOutcome,
  mine: boolean,
  defensePlay: DefensePlayResult | null,
  playback: DefensePlayResult | null,
): TeamGameProgress {
  const before = progress.game
  const applied = applyOpponentAtBat(
    before,
    progress.opponentOrderIndex,
    outcome,
    // 자동으로 넘긴 타석은 원본도 간이 엔진이다 — **간이 엔진에는 희생플라이가 없다** (E-2 확정)
    defensePlay?.advance ?? advanceRunners(before.bases, outcome, before.outs, { quickEngine: true }),
  )
  const slot = progress.opponentOrderIndex
  const hit = isHit(outcome)
  // 투수 +0x2a 는 볼넷·사구를 함께 센다
  const walk = isFreePass(outcome)
  const inningEnded = before.outs + applied.outsAdded >= OUTS_PER_INNING

  const next: TeamGameProgress = {
    ...progress,
    game: applied.game,
    decisions: decisionsAfterPlay(progress.decisions, before, applied.game, moundsOf(progress)),
    // 정산 0xa8024 — 우리 마운드 투수 레코드에 아웃·실점·탈삼진
    pitcherLines: chargeMoundLine(progress, true, {
      outs: applied.outsAdded,
      runsAllowed: applied.runsScored,
      strikeouts: outcome.kind === '삼진' ? 1 : 0,
    }),
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
      allowedBaserunner:
        progress.pitching.allowedBaserunner || allowedBaserunnerOfPlay(before.bases, outcome, mine, defensePlay),
    },
    // 시즌 평판 16칸 — 우리 수비라 **공격측(상대)이 CPU** 인 코드(≤ 5)만 선다
    gameRecord: withSeasonRecord(
      progress,
      '수비',
      defenseRecordCodesOf(outcome, applied.outsAdded),
    ),
    opponentEntryRecords: withPlateAppearance(progress.opponentEntryRecords, slot, outcome),
    leaguePlateAppearances: withLeaguePlateAppearance(
      progress.leaguePlateAppearances,
      progress.options.opponentTeamId,
      progress.opponentEntry,
      slot,
      outcome,
      applied.runsScored,
    ),
  }

  // 기록달성 (0xa7c4c · 0xa7998 · 0xa7d0c · 0xa8024 → 0xa77f0) — 사람 수비라 수비 계열이 게이트를 지난다
  const recorded = withOurDefenseRecords(next, {
    outcome,
    outsBefore: before.outs,
    outsAdded: applied.outsAdded,
    atBatPitches: progress.recordTally.atBatPitches,
    balls: progress.atBat.balls,
    halfInningPitches: halfInningPitchesOf(progress.recordTally, before),
    laserThrow: defensePlay?.laserThrow ?? false,
  })

  const resolved = mine
    ? resolveBurstFor(recorded, {
        outcome,
        runsBattedIn: applied.runsScored,
        outsBefore: before.outs,
        outsAdded: applied.outsAdded,
        inningEnded,
        // ⚠️ 0xa89f0 — 사람 팀 승리로 경기가 끝나면 홈런·볼넷 비트를 함께 켠다 (P7 K1)
        humanTeamWalkOff:
          applied.game.isFinished && applied.game.ourScore > applied.game.opponentScore,
        batterRunnerSafe: defensePlay === null ? undefined : batterRunnerSafeOfFates(defensePlay.runnerFates),
        // B6 — 번트 타구(state[0x13]) && (희생 [sp+8] || 득점) (a88e0 · a88f8)
        isBunt: defensePlay?.buntBall === true,
        runnersAdvanced: defensePlay?.sacrifice === true,
      })
    : recorded

  return appendLog(
    resolved,
    `${before.inning}회${before.half} 상대 ${slot + 1}번 — ${describeOutcome(outcome)}${
      applied.runsScored > 0 ? ` (${applied.runsScored}실점)` : ''
    }`,
    mine,
  )
}

/* ── 수비 화면이 끝났을 때 (원본 상태 0x17 → 0x18/0xe) ───────────────────────── */

/**
 * 화면이 다 돌린 수비 플레이를 **그때** 경기 상태에 먹인다.
 *
 * `result.advance`(진루·아웃·득점)와 `result.voidedRuns`(3아웃으로 날아간 보류 득점)가 여기서
 * 비로소 경기 상태가 된다. 붙들어 둔 칸을 비우므로 다음 타석이 그제서야 시작된다.
 *
 * 공격이었으면 우리 타석 길로, 수비였으면 상대 타석 길로 간다 — 붙들 때 적어 둔 `side` 가 가른다.
 * 이미 눈으로 다 본 플레이라 재생거리(`lastDefensePlay`)로는 남기지 않는다.
 */
export function resolveDefensePlay(
  progress: TeamGameProgress,
  result: DefensePlayResult,
  random: RandomPort,
): TeamGameProgress {
  const pending = progress.pendingDefensePlay
  if (pending === null) return progress
  const cleared = { ...progress, pendingDefensePlay: null }
  // 파울로 닫힌 판 — 같은 타석이 이어진다(정산 없음)
  if (result.foulEnded === true) return afterFoulPlay(cleared, pending.side, random)
  if (pending.side === '공격') {
    // 우리 타석 쪽은 몸통 끝에서 이미 다음 사람 차례까지 민다
    // 기록은 판 끝 정산(0xa8024)이 낸 결과다 — `pending.outcome` 은 타석을 끝낸 임시 값이다(`battedContact`)
    return finishBatterOutcome(cleared, recordedOutcomeOf(pending.input, result), random, result, null)
  }
  return advance(finishDefensiveAtBat(cleared, recordedOutcomeOf(pending.input, result), true, result, null), random)
}

/* ── 견제 (메시지 0x10 → 0x50f28 → 플레이 종류 4) ─────────────────────────────── */

/**
 * **사람 투수의 견제** — 구질 고르기(상태 0xf)에서 '3' 1루 · '1' 2루 · '7' 3루 (0x53548 → 메시지 0x10 → 0x50f28).
 * 투수편 `pitcherGameFlow.pickoff` 와 같은 길이다.
 *
 * 그 루에 주자가 없거나 견제 키가 아니면 **아무 일도 없다**(원본도 키를 먹고 끝난다 — 같은 객체를 돌려준다).
 * 견제는 투구가 아니다: 투구 수·스태미나·볼카운트·마구 횟수·상대 타순을 건드리지 않는다 (0x10~0x12 를 안 지난다).
 *
 * 수비 화면은 `runPickoffPlay` 가 미리 끝까지 돌린 틱을 `lastDefensePlay` 로 재생한다 — 견제 중에는 사람이
 * 바꿀 것이 없어서다(`pickoffPlay` 머리 주석). 난수는 그 안의 **악송구 굴림(0xa1828) 1번 · 악송구면 +2번**뿐이다.
 */
export function pickoff(progress: TeamGameProgress, webKey: string, random: RandomPort): TeamGameProgress {
  if (!isPitchTurn(progress) || !progress.atBatPrepared) return progress
  const bases = progress.game.bases
  const play = pickoffPlayForKey(webKey, (base) => hasRunnerOn(bases, base))
  if (play === null) return progress
  const result = runPickoffPlay({
    targetBase: play.targetBase,
    bases,
    outs: progress.game.outs,
    // 우리가 수비 중이다 — 아홉 칸은 우리 팀, 주자는 상대 (타구 진행기 `defensiveDefenseInputOf` 와 같은 근사:
    // 주자 모두가 지금 타자의 주루를 쓴다)
    defenseAbilities: defenseAbilitiesFor(progress, progress.options.ourTeamId, progress.ourPitcherIndex),
    runAbility: runAbilityFor(progress, progress.options.opponentTeamId, progress.opponentOrderIndex),
    random,
    // 공격이 CPU 라 자동 진루 제어기(0xaf918)가 돈다 (0xae690 첫 항)
    offenseIsCpu: true,
    // 사람이 수비한다 — 0xae6c8 은 환경설정 "송구"(+0xf4) 혼자가 받은 야수의 0xafa60 을 켠다 (타구 진행기와 같은 배선)
    defenseIsCpu: false,
    throwMode: progress.options.throwModeManual === false ? '자동' : '수동',
  })
  return applyPickoffPlay(progress, result, '수비', random)
}

/**
 * **CPU 투수의 견제** — 사람이 칠 차례에 CPU 투수 AI 목표점 고르기 `0x345fc` 가 종류 4 를 뽑으면
 * 목표점을 안 만들고 `0x34848` 이 `rand(1,4)` 를 주자 있는 루가 나올 때까지 굴려 **사람 견제와 같은
 * 메시지 0x10** 을 보낸다(I-controls 4a-2). 공은 안 던진다 — 상태 0x11 예약(0x34888)을 안 지난다.
 *
 * 여기는 **그 루가 정해진 뒤**(메시지 0x10 이후)다. 루를 고르는 굴림(`entities/pitching/model/pitchTarget`
 * 의 `isCpuPickoff` · `cpuPickoffBaseOf`)은 CPU 투구를 고르는 자리 `selectPitch`(← `widgets/batting-stage/
 * model/useStageAnimation`)에서 굴린다: 구질(0x344dc) → 목표 종류(0x9eeac) → **견제 루(0x34848, 주자 있는
 * 루까지 반복)** 이고, 그 뒤 목표점·제구·곡선 굴림은 없다. 타석 화면이 `onPickoff(루)` 로 알려 주면
 * `TeamGameScreen` 이 `TeamGameSession.actions.cpuPickoff` 로 여기에 넘긴다.
 *
 * 그 루가 비었으면 원본 루프가 거기서 안 멈추므로 부르는 쪽 잘못이다 — 아무 일도 없다.
 */
export function cpuPickoff(progress: TeamGameProgress, base: PickoffBase, random: RandomPort): TeamGameProgress {
  if (!isBatterTurn(progress) || !progress.atBatPrepared) return progress
  const bases = progress.game.bases
  if (!hasRunnerOn(bases, base)) return progress
  const result = runPickoffPlay({
    targetBase: base,
    bases,
    outs: progress.game.outs,
    // 우리 공격이니 수비는 상대 팀이다
    defenseAbilities: defenseAbilitiesFor(progress, progress.options.opponentTeamId, progress.opponentPitcherIndex),
    runAbility: runAbilityFor(progress, progress.options.ourTeamId, progress.game.battingOrderIndex),
    random,
    // 우리가 공격이다 — 환경설정 "주루" 가 먹는다 (0xae690 의 둘째 항)
    offenseIsCpu: false,
    runningMode: progress.options.runningModeManual === true ? '수동' : '자동',
    // 수비는 CPU 다 — 0xae6c8 첫 항이 서서 받은 야수의 0xafa60 이 매 틱 돈다 (d80918a)
    defenseIsCpu: true,
  })
  return applyPickoffPlay(progress, result, '공격', random)
}

function hasRunnerOn(bases: GameState['bases'], base: number): boolean {
  return base === 1 ? bases.first : base === 2 ? bases.second : base === 3 ? bases.third : false
}

/** `applyAtBatOutcome` 은 `precomputed` 를 받으면 결과 코드를 안 읽는다 — 주자 판에는 타석 결과가 없어 자리만 채운다 */
const RUNNER_PLAY_OUTCOME_PLACEHOLDER: AtBatOutcome = { kind: '아웃', detail: '땅볼아웃' }

/**
 * **주자만 움직인 판**(견제 종류 4 · 도루 종류 5 · 폭투·포일 종류 9)의 진루·아웃·득점을 경기 상태에 먹인다.
 * 타석이 끝난 것이 아니라 타순 커서는 그대로다(사람 수비면 `applyOpponentRunnerPlay`).
 * 득점 처리 0xa5c34 는 1점마다 수비 팀 실점 A·B 와 승·패·세 칸을 고친다 (타석 정산과 같은 칸).
 * 반 이닝이 넘어갔으면 볼카운트·타석 준비를 내린다 — 다음 타석은 `advance` 가 세운다.
 */
function withRunnerOnlyAdvance(
  progress: TeamGameProgress,
  advanceResult: DefensePlayResult['advance'],
  humanSide: ControlSide,
): { readonly progress: TeamGameProgress; readonly changed: boolean; readonly runs: number } {
  const before = progress.game
  const humanDefends = humanSide === '수비'
  const changed =
    advanceResult.outsAdded > 0 ||
    advanceResult.runsScored > 0 ||
    advanceResult.bases.first !== before.bases.first ||
    advanceResult.bases.second !== before.bases.second ||
    advanceResult.bases.third !== before.bases.third
  if (!changed) return { progress, changed, runs: 0 }
  let game: GameState
  let runs: number
  if (humanDefends) {
    const applied = applyOpponentRunnerPlay(before, progress.opponentOrderIndex, advanceResult)
    game = applied.game
    runs = applied.runsScored
  } else {
    // 타석이 끝난 것이 아니라 타순 커서는 그대로 둔다
    game = {
      ...applyAtBatOutcome(before, RUNNER_PLAY_OUTCOME_PLACEHOLDER, advanceResult),
      battingOrderIndex: before.battingOrderIndex,
    }
    runs = game.ourScore - before.ourScore
  }
  const halfChanged = game.half !== before.half || game.inning !== before.inning
  const next: TeamGameProgress = {
    ...progress,
    game,
    decisions: decisionsAfterPlay(progress.decisions, before, game, moundsOf(progress)),
    // 주자 판(견제·도루)도 정산 0xa8024 를 지난다 — 아웃·실점을 지금 수비 마운드 투수에게
    pitcherLines: chargeMoundLine(progress, humanDefends, {
      outs: advanceResult.outsAdded,
      runsAllowed: runs,
    }),
    // 득점 처리 0xa5c34 는 1점마다 수비 팀 A·B 를 올린다 (P7 E1)
    ...(humanDefends
      ? {
          ourPitcherCounters: addRunsToCounters(progress.ourPitcherCounters, runs, 0, halfChanged),
          pitching: { ...progress.pitching, runsAllowed: progress.pitching.runsAllowed + runs },
        }
      : {
          opponentPitcherCounters: addRunsToCounters(progress.opponentPitcherCounters, runs, 0, halfChanged),
        }),
    ...(halfChanged ? { atBat: createAtBat(), atBatPrepared: false } : {}),
  }
  return { progress: next, changed, runs }
}

/**
 * 견제 한 판을 경기 상태에 먹인다 — 원본 견제 판 끝 `0xae3e8` 의 길이다.
 *
 * - `0xae576~0xae592`: `state[0x26]` 이 4 면 (아웃 ≤ 2 이고 다른 갈래에 안 걸리면) 다음 상태 **0xf**(같은 타석,
 *   다음 공) — 볼카운트·타순 그대로 두고 `atBatPrepared` 도 그대로 둔다.
 * - `0xae5a8`: 그리고 정산 `0xa8024` 를 부른다 — **종류 4 라 타석 칸(+0x14)이 안 오른다**(`withPlateAppearance`
 *   에 결과 null). 타석에 서 있는 타자(사람 수비면 상대 타순 칸, 사람 공격이면 우리 타순 칸)의 칸이다.
 *
 * ⚠️ 미해결·근사
 * - 0xf 에 다시 들어서며 진입 `0x3d954` 가 CPU 대타(0xac228)·CPU 투수 교체(0xac428)를 다시 부른다 —
 *   `enterPitchSelection` (공마다 다시 들어서는 것과 같은 자리).
 * - 견제 판이 아웃·진루를 내면(판 시작 리드 0x3d7b8 로 루를 떠난 주자 — 3370bf0) 경기 상태(루·아웃·점수·반 이닝
 *   교대)와 승·패·세 칸(득점 처리 0xa5c34)에 먹인다(`withRunnerOnlyAdvance`). 그때 `0xa8024` 의 나머지 칸(투수 아웃 수·
 *   평판 16칸·리그 기록·돌발 판정 0x8f414)이 견제 판에서 어떻게 도는지는 손대지 않았다 — 타순도 안 민다
 *   (`applyOpponentRunnerPlay` 주석과 같은 미해결).
 */
function applyPickoffPlay(
  progress: TeamGameProgress,
  result: PickoffPlayResult,
  humanSide: ControlSide,
  random: RandomPort,
): TeamGameProgress {
  const before = progress.game
  const humanDefends = humanSide === '수비'
  const recorded: TeamGameProgress = humanDefends
    ? {
        ...progress,
        lastDefensePlay: result,
        opponentEntryRecords: withPlateAppearance(progress.opponentEntryRecords, progress.opponentOrderIndex, null),
      }
    : {
        ...progress,
        lastDefensePlay: result,
        ourEntryRecords: withPlateAppearance(progress.ourEntryRecords, before.battingOrderIndex, null),
      }
  const applied = withRunnerOnlyAdvance(recorded, result.advance, humanSide)
  const { changed, runs } = applied
  let next = applied.progress
  // 견제 판도 정산 0xa8024 를 지난다(ae5a8) — 사람 수비면 그 판 주자 목록의 마지막 원소로 state[0x88] (a8ca6)
  if (humanDefends && !next.pitching.allowedBaserunner && baserunnerAllowedOfFates(result.runnerFates)) {
    next = { ...next, pitching: { ...next.pitching, allowedBaserunner: true } }
  }

  const call = result.resultCode === PICKOFF_RESULT.OUT ? '견제사' : result.errantThrow ? '악송구' : '세이프'
  next = appendLog(
    next,
    `${before.inning}회${before.half} ${humanDefends ? '' : '상대 '}${result.targetBase}루 견제 — ${call}${
      runs > 0 ? ` (${runs}${humanDefends ? '실점' : '점'})` : ''
    }`,
    true,
  )
  // 아웃 ≤ 2 면 같은 타석 다음 공 0xf (ae592) — 0xf 진입 0x3d954 가 교체를 다시 묻는다.
  // 반 이닝이 넘어갔으면 advance 가 새 타석(prepareAtBat)을 세운다
  if (!changed) return enterPitchSelection(next, random)
  const advanced = advance(next, random)
  return advanced === next ? enterPitchSelection(next, random) : advanced
}

/* ── 공 도착 (상태 0x12 진입 0x3dfac → 종류 9 폭투·포일 · 종류 5 도루) ───────────────── */

/** 공 도착 한 걸음의 결과 */
interface TeamPitchArrival {
  readonly progress: TeamGameProgress
  /** 열린 주자 판 (종류 9 폭투·포일 · 종류 5 도루). 없으면 null */
  readonly play: PitchArrivalPlay | null
  /** 판에서 반 이닝·경기가 끝나 이 타석이 끊겼다 — 타석 결과를 먹이지 말고 `advance` 로 다음 타석을 세운다 */
  readonly interrupted: boolean
}

/**
 * **공 도착** — 상태 0x12 진입 `0x3dfac` (`features/defense-play/model/pitchArrivalPlay`). 타자편 `gameFlow.arrivePitch`
 * 와 같은 길을 팀 경기 두 쪽(사람 공격 `batterPitch` · 사람 수비 `pitchOnce`)이 같은 차례로 지난다.
 *
 * - 맞힌 공(파울·타구)은 0x3dfac 를 안 지난다. 파울이면 출발이 풀리고, 타구면 출발 칸을 타구 판 입력이 읽는다.
 * - 못 맞힌 공: `rollPassedBall` 1번 → 종류 9 / 종류 5 / 없음. 판이 열리면 그 advance 를 견제와 같은 주자 판
 *   (`withRunnerOnlyAdvance`, 타순 그대로)으로 먹이고 재생 칸(`lastDefensePlay`)에 넣는다. 낫아웃(종류 9 + 삼진 +
 *   타자주자)만은 여기서 안 먹이고 타석 결과 쪽(`arrivalPlay`)으로 넘긴다.
 * - 기록: 도루 판의 8(도루)·24(도루 저지)는 0xa77f0 게이트를 지난다 — 사람 공격이면 8, 사람 수비면 24 만 남는다.
 * - 사람 수비 쪽 판은 **송구 키 없이 미리 다 돌린다**(견제 `pickoff` 와 같은 근사 — 판이 짧아 화면이 재생만 한다).
 *   ⚠️ 원본은 상태 0x17 동안 사람이 송구 키(0x533c8)를 누를 수 있다 — 키 송구 루(+0x160)는 안 받는다(미해결).
 *
 * ⚠️ 근사: 루에 선 주자가 누구인지 웹 `GameState` 가 모른다 — 1·2·3루 주자 = 타순 1·2·3칸 앞 타자(`runAbilitiesOnBaseOf`).
 * ⚠️ 미해결: 주자 속도의 팀 등급(전역 모드 1·2·8, R3 4절)은 팀 경기의 다른 판(타구·견제)처럼 안 싣는다(0).
 * ⚠️ 미해결: 종류 5 판 정산 0xa8024 의 기록 칸(투수 아웃 수·평판·리그 기록)은 견제 판처럼 손대지 않았다.
 *
 * 난수: `rollPassedBall` 1번(매 못 맞힌 공) → 판이 열리면 그 안의 굴림 (`runPitchArrivalPlay`).
 */
function arriveTeamPitch(
  progress: TeamGameProgress,
  pitch: {
    readonly resolution: PitchResolution
    readonly outcomeAfter: AtBatOutcome | null
    /** 장면 +0xfdc — 이 공의 번트 종류(못 맞힌 번트면 그 종류, 안 휘둘렀으면 0). 도루 판 리드 0x3d7b8 이 본다 */
    readonly buntKind?: number
  },
  humanSide: ControlSide,
  random: RandomPort,
): TeamPitchArrival {
  if (!arrivesUnhit(pitch.resolution)) {
    const next = pitch.resolution.kind === '타구' ? progress : withoutSteal(progress)
    return { progress: next, play: null, interrupted: false }
  }
  const { options } = progress
  const before = progress.game
  const humanOffense = humanSide === '공격'
  const play = runPitchArrivalPlay(
    {
      gameMode: options.mode,
      pitchJudgement: pitchJudgementOf(pitch.resolution, pitch.outcomeAfter),
      stealingFrom: progress.stealingFrom,
      bases: before.bases,
      outs: before.outs,
      runAbilities: runAbilitiesOnBaseOf(progress, humanSide),
      ...(humanOffense
        ? {
            // 우리 공격이니 수비는 상대(CPU) — 환경설정 "주루" 혼자가 자동 진루 제어기를 켠다 (0xae690 의 둘째 항)
            defenseAbilities: defenseAbilitiesFor(progress, options.opponentTeamId, progress.opponentPitcherIndex),
            defenseIsCpu: true,
            offenseIsCpu: false,
            runningMode: options.runningModeManual === true ? ('수동' as const) : ('자동' as const),
          }
        : {
            // 우리 수비 — 공격이 CPU 라 늘 자동 진루, 송구만 환경설정이 먹는다 (0xae6c8 의 첫 항이 거짓)
            defenseAbilities: defenseAbilitiesFor(progress, options.ourTeamId, progress.ourPitcherIndex),
            defenseIsCpu: false,
            offenseIsCpu: true,
            throwMode: options.throwModeManual === false ? ('자동' as const) : ('수동' as const),
          }),
      // 장면 +0xfdc — 도루 판 리드 0x3d7b8 이 도루 안 한 주자에게 +3 틱 (안 휘두른 공은 앞 공의 값 — `sceneBuntKind`)
      buntKind: pitch.buntKind ?? 0,
    },
    random,
  )
  const cleared = withoutSteal(progress)
  if (play === null) return { progress: cleared, play: null, interrupted: false }
  const opened: TeamGameProgress = { ...cleared, lastArrivalPlay: play }
  if (arrivalApplicationOf(play) === 'batterRuns') return { progress: opened, play, interrupted: false }

  let next = withRunnerOnlyAdvance({ ...opened, lastDefensePlay: play.result }, play.result.advance, humanSide).progress
  next = withGameRecords(next, play.recordIds, humanOffense)
  next = withLeagueStolenBases(next, progress, play, humanOffense)
  next = appendLog(next, `${before.inning}회${before.half} ${describeArrivalPlay(play, humanOffense)}`, true)
  const interrupted =
    next.game.isFinished || next.game.inning !== before.inning || next.game.half !== before.half
  return { progress: next, play, interrupted }
}

/**
 * 도루 판(종류 5) 정산의 리그 기록 — 0xa8024 의 0xa8340~0xa83c0 (R8 5-2, 직접 떴다).
 * ```
 * sp+0x34 = 0xa56dc(ctx, 지금 타자, 0)                 ; 시즌 모드 2: 국가대항전·포스트시즌 아님 && 타자가 마선수 아님
 * (가) 잡힌 도루 주자가 하나라도 있으면 아무도 안 쌓는다
 * (나) 루를 옮긴 도루 주자 r 마다: p = 0xb8b99(공격팀, r) ; sp+0x34 && p && !마선수(p) → p+0x2c += 1
 * ```
 * 원본 그대로: 게이트가 **주자가 아니라 지금 타자**를 본다 — 마타자 타석에 한 도루는 아무도 안 쌓인다.
 * 국가대항전·포스트시즌 거르기는 기록표에 넣는 쪽(시즌 세션의 정규시즌 갈래)이 맡는다.
 * ⚠️ 주자 신원 근사: 루 b 의 주자를 타순 − b 로 본다(`runAbilitiesOnBaseOf` 와 같은 근사).
 */
function withLeagueStolenBases(
  next: TeamGameProgress,
  before: TeamGameProgress,
  play: PitchArrivalPlay,
  humanOffense: boolean,
): TeamGameProgress {
  if (play.kind !== 5 || play.result.caughtFrom.length > 0 || play.result.stolenFrom.length === 0) return next
  const teamId = humanOffense ? before.options.ourTeamId : before.options.opponentTeamId
  const entry = humanOffense ? before.ourEntry : before.opponentEntry
  const order = humanOffense ? before.game.battingOrderIndex : before.opponentOrderIndex
  const slotOf = (back: number) => (((order - back) % BATTING_ORDER_SIZE) + BATTING_ORDER_SIZE) % BATTING_ORDER_SIZE
  const isAce = (slot: number) => (entry[slot]?.aceIndex ?? NO_ACE_BATTER) >= 0
  if (isAce(slotOf(0))) return next
  const stolen: LeagueStolenBase[] = []
  for (const from of play.result.stolenFrom) {
    const slot = slotOf(from)
    if (isAce(slot)) continue
    const rosterSlot = entry[slot]?.rosterSlot ?? slot
    if (rosterSlot === NO_ROSTER_SLOT) {
      const recordId = entry[slot]?.recordId
      if (recordId !== undefined) stolen.push({ teamId, battingOrderIndex: NO_ROSTER_SLOT, recordId })
      continue
    }
    stolen.push({ teamId: entry[slot]?.tableTeamId ?? teamId, battingOrderIndex: rosterSlot })
  }
  if (stolen.length === 0) return next
  return { ...next, leagueStolenBases: [...(next.leagueStolenBases ?? []), ...stolen] }
}

function describeArrivalPlay(play: PitchArrivalPlay, humanOffense: boolean): string {
  const runs = play.result.advance.runsScored
  const tail = runs > 0 ? ` (${runs}${humanOffense ? '점' : '실점'})` : ''
  const who = humanOffense ? '' : '상대 '
  if (play.kind === 9) return `폭투·포일${tail}`
  if (play.result.caughtFrom.length > 0) return `${who}도루 실패 — 아웃${tail}`
  if (play.result.stolenFrom.length > 0) return `${who}도루 성공${tail}`
  return `${who}도루${tail}`
}

function withoutSteal(progress: TeamGameProgress): TeamGameProgress {
  return progress.stealingFrom.length === 0 ? progress : { ...progress, stealingFrom: [] }
}

/**
 * 루별 주자 주루 (경기용 칸 3) — 0 은 지금 타자(낫아웃 타자주자).
 * ⚠️ **근사**: 웹 `GameState` 는 루에 선 주자가 누구인지 모른다 — 1루 = 직전 타자 · 2루 = 그 앞 · 3루 = 그 앞으로
 * 공격 팀 타순을 거꾸로 센다 (타자편 `gameFlow` 와 예전 도루 표 굴림과 같은 근사).
 */
function runAbilitiesOnBaseOf(
  progress: TeamGameProgress,
  humanSide: ControlSide,
): Partial<Record<0 | 1 | 2 | 3, number>> {
  const ours = humanSide === '공격'
  const teamId = ours ? progress.options.ourTeamId : progress.options.opponentTeamId
  const order = ours ? progress.game.battingOrderIndex : progress.opponentOrderIndex
  const runOf = (slotsBack: number) =>
    runAbilityFor(progress, teamId, (((order - slotsBack) % BATTING_ORDER_SIZE) + BATTING_ORDER_SIZE) % BATTING_ORDER_SIZE)
  return { 0: runOf(0), 1: runOf(1), 2: runOf(2), 3: runOf(3) }
}

/* ── 타석 준비 · 돌발 ─────────────────────────────────────────────────────────── */

/**
 * **새 타석** — 상태 0xd 진입 `0x48d50` 부터 0xe → 0xf 까지.
 *
 * 0xd 는 이전 상태가 교체 연출 0x16 이 아니면 `state[0xe] = 0` 을 쓴다 (48eb0~48eb6). 이 함수로 오는 것은 늘
 * 새 타석이다 — 교체 연출 뒤 다시 들어오는 길(0x16 → 0xd 건너뜀)은 `enterPitchSelection`(CPU 교체)·`changePitcher`·
 * `pinchHit`(사람 `#` 교체)이 `readyAtBat` 으로 곧장 간다. 교체 창 취소(→ 0xe, `cancelSubstitution`)도 같다.
 */
function prepareAtBat(progress: TeamGameProgress): TeamGameProgress {
  // 0xd → 0xe (0x39e14) — 사람 OK 를 기다린다 (0x532b0). 굴림은 OK 뒤(`confirmScene`)
  return enterConfirmWait({
    ...progress,
    cpuPinchHitUsed: false,
    // 같은 0x48d50 의 타석 초기화 0xa5bcc — 연속 파울 ctx+0x15f · 타석 투구 수 ctx+0x161 = 0
    recordTally: { ...progress.recordTally, foulStreak: 0, atBatPitches: 0 },
  })
}

/**
 * **상태 0xe 에 선다** — 새 대기 객체를 싣고 OK 를 기다린다. 들어오는 길: 새 타석(0xd → 0xe) · 교체 연출 0x16 → 0xd → 0xe
 * (사람 `#` 교체 확정 · 0xf 진입의 CPU 대타·투수 교체) · 교체 창 취소(곧장 0xe, 0x495fc).
 * 0xe 진입 0x50674 의 감독 강판 0x504cc 는 모드 1·2·8·9 에서 늘 거짓이라 굴림이 없다. 0xe 에서는 굴림이 없고
 * OK(메시지 1 → 0x50c18) 뒤에야 돌발 0x8f158 · 0xf 진입 0x3d954 가 돈다 (`confirmScene`).
 */
function enterConfirmWait(progress: TeamGameProgress): TeamGameProgress {
  return { ...progress, sceneConfirm: enterSceneConfirm(), sceneConfirmPending: true, atBatPrepared: true }
}

/**
 * **상태 0xe 의 OK** — 사람 조작 0x532b0 의 OK → 메시지 1 → `0x50c18`: 0xf 예약 · 돌발 0x8f158 → (다음 틱) 0xf 진입 0x3d954.
 * 0xf 진입이 CPU 교체를 내면 0x16 → 0xd → 0xe 로 다시 서서 OK 를 또 기다린다(그 OK 뒤 돌발을 다시 굴린다).
 * 0xe 에 서 있지 않으면 아무 일도 없다.
 */
export function confirmScene(progress: TeamGameProgress, random: RandomPort): TeamGameProgress {
  if (progress.sceneConfirmPending !== true) return progress
  const confirmed = { ...progress, sceneConfirmPending: false }
  if (confirmed.game.isFinished || !isHumanTurn(confirmed)) return confirmed
  return readyAtBat(confirmed, random)
}

/**
 * 상태 0xe 의 확인(메시지 1) → **0xf 예약 · 돌발 발동 판정 0x8f158 · 0xf 진입 `0x3d954`** 차례.
 *
 * 메시지 1 처리 `0x50c18` 은 `0xbcb48(…, 0xf)` 로 0xf 를 **예약만** 하고(R10 69행 — 다음 틱에 옮긴다) 곧바로
 * 돌발 객체가 있으면 `0x8f158` 을 굴린다. 발동하면 `0xbcb48(…, 0x1b)` 로 예약을 덮어 0xf 에 들어가지 않고, 돌발
 * 창(0x1b)을 닫은 뒤(0x3b032) 0xf 에 들어간다. 그러니 **돌발 굴림이 0xf 진입보다 먼저**고, 발동했으면 0xf 진입의
 * 교체 판정은 진행 중인 돌발(`0x8eb94`) 때문에 건너뛴다 (`enterPitchSelection`).
 *
 * 돌발미션 표는 시즌(모드 2)에만 있다 — 경기 장면이 모드 2·3·4 에서만 객체를 만든다 (0x48658).
 * 시즌 표 56행은 **사람 팀이 공격이면 0~30(타자형), 수비면 31~55(투수형)** 로 갈린다 (0x8f000).
 *
 * **근사**: 원본은 경기 장면이 지나는 모든 타석에서 굴리지만, 자동 진행 구간은 상태 0x21
 * (간이 엔진 중계)로 빠져 0xf 를 지나지 않는다. 그래서 여기서도 **사람이 잡은 타석에서만** 굴린다.
 */
function readyAtBat(progress: TeamGameProgress, random: RandomPort): TeamGameProgress {
  const session = progress.burst
  if (session === null) return enterPitchSelection({ ...progress, atBatPrepared: true }, random)
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
      ...burstGameRecordOf(progress, ours),
    },
    random,
  )
  return enterPitchSelection({ ...progress, burst: next, atBatPrepared: true }, random)
}

/**
 * 돌발 경기 기록 검사 `0x8ec9c`(b6·b7)가 보는 세 값 — 돌발 객체의 state(+0x22c)·팀 표(+0x230)로 읽는다:
 * ```
 * 8ecbe  b6 == 1: team = 팀[state[9]](공격) ; rec = team + 0x34 + team[0x32]·0x18 ; rec[+0x12]   ; 그 타순 칸 안타
 * 8ece8  b6 == 2:                                 같은 rec 의 [+0x13]                            ; 그 타순 칸 홈런
 * 8ed14  b6 == 3: team = 팀[state[0xa]](수비) ; 0xb8cec(team)[0]                                ; 지금 투수 경기 탈삼진
 * ```
 * `+0x13` 은 정산 `0xa8024` 의 안타 갈래 a874c 가 `[sp+0x24] > 0` 일 때 올린다 — sp+0x24 는 홈런 이벤트(8)·그라운드
 * 홈런(state[0x25])이 세는 **홈런 수**다(a80a8 · E-defense 1e, 바로 뒤가 한 타자 홈런 0xa7b00·대타 홈런 5).
 * `0xb8cec` 는 `team + 0x244 + 4·team[0]` — 지금 마운드 투수의 경기 기록이고 R[0] 이 탈삼진이다(`recordTally` 주석).
 *
 * 웹 칸: 안타·홈런 = 타순 칸 기록 `+0x12`·`+0x13`(`*EntryRecords[칸].hits`·`.homeRuns` — 양 팀 같은 칸),
 * 우리 투수 탈삼진 = `recordTally.moundStrikeouts`(교체 때 0), 상대 투수 탈삼진 = 그 투수의 경기 줄(`pitcherLines`).
 *
 * ⚠️ 미해결 하나 — **상대 마투수의 탈삼진**은 웹이 들고 있지 않아 0 이다(마투수는 리그 붙박이 표 칸이 없어 경기 줄이 없다).
 *    시즌 표(XlsSEASON_BURST 56행)에는 b6 ≠ 0 인 행이 하나도 없어 지금 경기 결과는 같다 (b6 은 타자·투수편 표만 쓴다).
 */
export function burstGameRecordOf(
  progress: TeamGameProgress,
  humanBatting: boolean,
): { readonly hitsInGame: number; readonly homeRunsInGame: number; readonly strikeoutsInGame: number } {
  if (humanBatting) {
    const slot = progress.game.battingOrderIndex
    const entry = pitcherEntryAt(progress, progress.options.opponentTeamId, progress.opponentPitcherIndex)
    const line =
      entry?.tableSlot === undefined || entry.aceIndex >= 0
        ? undefined
        : progress.pitcherLines.find(
            (candidate) =>
              candidate.teamId === (entry.tableTeamId ?? progress.options.opponentTeamId)
              && candidate.pitcherSlot === entry.tableSlot,
          )
    return {
      hitsInGame: progress.ourEntryRecords[slot]?.hits ?? 0,
      homeRunsInGame: progress.ourEntryRecords[slot]?.homeRuns ?? 0,
      strikeoutsInGame: line?.strikeouts ?? 0,
    }
  }
  return {
    hitsInGame: progress.opponentEntryRecords[progress.opponentOrderIndex]?.hits ?? 0,
    homeRunsInGame: progress.opponentEntryRecords[progress.opponentOrderIndex]?.homeRuns ?? 0,
    strikeoutsInGame: progress.recordTally.moundStrikeouts,
  }
}

/**
 * **상태 0xf 진입 `0x3d954`** — 사람 장면에서 공 하나를 고르기 전마다 돈다.
 *
 * 0xf 에 들어서는 길은 넷이다: 0xe 확인(`readyAtBat` — 새 타석, 교체 연출 0x16 뒤, 교체 창 취소 뒤), 인플레이 없이
 * 끝난 공의 다음 공(판정 A `0xae24c` 의 "그 밖 → 0xf" — 볼·스트라이크·파울), 견제 판 끝(판정 B `0xae3e8` 의 ae592),
 * 코스 고르기(0x10)의 CLR(0x50ee6, `returnToPitchSelection`). 그때마다:
 *
 * ```
 * 3d9e4  r2 = (state[0x31 + state[0xa]] == 1)            ; 수비 팀이 CPU 인가
 *   참:  3d9fc  돌발 객체가 있고 0x8eb94(진행 중) 참 → 건너뜀
 *        3da0e  0x66864() 거짓 → 건너뜀                    ; 모드 5·6 의 일부 미션만 거짓 — 팀 경기는 늘 참
 *        3da3e  r0 = 0xac428(…, 수비 팀, …, state, [sp]=ctx, 0, 0, 0)   ; CPU 투수 교체
 *   거짓: 3da44  돌발 진행 중 → 건너뜀
 *        3da70  r0 = 0xac228(…, 공격 팀, 주자관리, state)   ; CPU 대타
 * 3da74  r0 참 → 3da88 소리 0x16("Time!") · 3da94 상태 0x16(교체 연출) 예약
 * ```
 * 0x16 → 0xd(이전 상태 0x16 이라 카운트·타석 초기화·state[0xe] 지우기를 건너뜀, 48e94) → 0xe(OK 를 다시 기다린다)
 * → OK 뒤 `readyAtBat` 을 다시 지난다(돌발 굴림 포함, `confirmScene`). 그때는 바뀐 쪽 막음 칸(state[0xd]·[0xe])이
 * 서 있어 같은 판정이 곧장 빠진다. 이 함수 안에 다른 굴림은 없다(3d954~3ddd6 의 호출을 다 봤다).
 *
 * 0xac428 의 인자는 간이 엔진(0xc1ba4 의 0xc1ce2)과 같다 — 팀 경기 모드(1·2·8·9)에서 `[sp+4]`(모드 3)·`[sp+0xc]`
 * (최소 벤치)가 둘 다 0 이다 — 그래서 `judgeAutoPitcherChange` 를 그대로 쓴다.
 */
function enterPitchSelection(progress: TeamGameProgress, random: RandomPort): TeamGameProgress {
  if (progress.game.isFinished || !isHumanTurn(progress)) return progress
  // 3d9fc · 3da44 — 돌발 진행 중(0x8eb94 = obj+0xc ≠ −1)이면 두 판정 모두 건너뛴다
  if (progress.burst !== null && progress.burst.current !== null) return progress
  const changed = isOurOffense(progress)
    ? judgeAutoPitcherChange(progress, false, random, true)
    : applyCpuPinchHit(progress, false, random, true)
  if (changed === progress) return progress
  // 22 → 0x16 → 0xd(지우기 건너뜀) → 0xe(OK 를 다시 기다린다) → OK 뒤 0xf
  return enterConfirmWait(changed)
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
    /** B5 — 안타 없이 살아 나간 타자주자(야수 선택)도 출루다 (0xa87ba r5). 판 없는 타석은 undefined */
    batterRunnerSafe?: boolean
    /** B6 — 번트 타구(state[0x13]) */
    isBunt?: boolean
    /** B6 — 희생 [sp+8] (`DefensePlayResult.sacrifice`) */
    runnersAdvanced?: boolean
  },
): TeamGameProgress {
  if (progress.burst === null) return progress
  // 사구도 B5(출루)·B11 을 켠다 (0xa882a "볼 4개 || 사구" · 0xa8bf4) — burstResultBitsOf 가 '사구' 를 직접 받는다
  const resolution = resolveBurst(progress.burst, burstResultBitsOf(play))
  return {
    ...progress,
    burst: resolution.session,
    lastBurstResolution: resolution.judgement !== null ? resolution : null,
    burstRewardDeltas:
      resolution.deltas.length === 0 ? progress.burstRewardDeltas : [...progress.burstRewardDeltas, ...resolution.deltas],
  }
}

/** 돌발 결과 창을 닫는다 (보상은 앱이 시즌 레코드에 얹는다 — 판정에 변화량이 들어 있다) */
export function closeBurstWindow(progress: TeamGameProgress): TeamGameProgress {
  return progress.lastBurstResolution === null ? progress : { ...progress, lastBurstResolution: null }
}

/* ── 경기 중 투수 교체 (0xc1ba4 → 0xac428 · 0xabfcc · 0xaf09c) ───────────────── */

/**
 * **CPU 투수 교체 `0xac428`** 한 번 — 부르는 자리는 둘이다.
 *   - 간이 타석 하나를 돌리기 **전에** (0xc262c 가 타석마다 0xc1ba4 를 부른다, 0xc1ce2) — 양 팀 모두.
 *   - 사람 장면 0xf 진입 `0x3d954` 의 3da3e — **수비 팀이 CPU 일 때**(우리 공격), 공마다 (`enterPitchSelection`).
 *
 * `defendingIsOurs` 가 참이면 우리 팀이 수비(= 우리 투수), 거짓이면 상대 투수를 본다.
 * 사람이 직접 던지는 타석은 우리 투수를 이 길로 바꾸지 않는다 — 그때는 `#` 메뉴(`changePitcher`)뿐이다.
 *
 * ⚠️ 원본 `0xc1ba4` 의 첫 갈래(모드 3 에서 8회에 벤치 마선수로 교체)는 **투수편 전용**이라 여기 없다.
 */
function judgeAutoPitcherChange(
  progress: TeamGameProgress,
  defendingIsOurs: boolean,
  random: RandomPort,
  /** 사람 경기 장면 `0x3d954` 에서 불렀는가 — 그러면 22 → 교체 연출 0x16 → 0xe 등판음을 지난다 */
  inScene = false,
): TeamGameProgress {
  const game = progress.game
  const used = defendingIsOurs ? progress.ourUsedPitchers : progress.opponentUsedPitchers
  const current = defendingIsOurs ? progress.ourPitcherIndex : progress.opponentPitcherIndex
  const stamina = defendingIsOurs ? progress.stamina : progress.opponentStamina
  const counters = defendingIsOurs ? progress.ourPitcherCounters : progress.opponentPitcherCounters
  const bench = benchIndexesOf(
    current,
    used,
    pitcherEntriesOf(progress, defendingIsOurs ? progress.options.ourTeamId : progress.options.opponentTeamId)
      .length,
  )
  const defenseScore = defendingIsOurs ? game.ourScore : game.opponentScore
  const offenseScore = defendingIsOurs ? game.opponentScore : game.ourScore

  const entries = pitcherEntriesOf(
    progress,
    defendingIsOurs ? progress.options.ourTeamId : progress.options.opponentTeamId,
  )
  const decision = judgePitcherChange({
    ...counters,
    // ac4a0 0xb6ded(마운드 투수) — 명단 칸의 보직(로스터 칸 표), 모르면 선발
    role: entries[current]?.role ?? PITCHER_ROLE.starter,
    // ac4f2 0xb633c(마운드 투수) — 마투수면 특수 문턱(A>2 · B>3 · s≤39)
    isSpecialPitcher: (entries[current]?.aceIndex ?? -1) >= 0,
    stamina,
    benchCount: bench.length,
    // 0xac428 의 일곱째 인자(`[sp+0x58]`)는 0xc1cd8 이 넘기는 `[sp+0x10] = max(r7, 0)` 이다.
    // r7 은 0xc1bbc 에서 −1 로 서고 모드 3(투수편) 갈래(0xc1bc6~0xc1c48)에서만 벤치 번호가 된다 —
    // 팀 경기 모드(1·2·8·9)는 그 갈래를 안 타 늘 −1 → **0** 이다. 곧 벤치가 한 명만 남아도 바꾼다
    // (`judgePitcherChange` 의 기본값 1 은 이 자리와 맞지 않는다).
    minimumBench: 0,
    justChanged: progress.pitcherJustChanged,
    lead: defenseScore - offenseScore,
    // 원본 이닝은 0-기준이다 (state+0x6b)
    inningIndex: game.inning - 1,
    runnerCount: runnerCountOf(game.bases),
  })
  if (!decision.replace) return progress

  const benchStaminas = defendingIsOurs ? progress.ourPitcherStaminas : progress.opponentPitcherStaminas
  const next = replacementPitcherIndexOf(
    bench,
    {
      saveSituation: decision.saveSituation,
      // 원본 이닝은 0-기준이다 (state+0x6b)
      inningIndex: game.inning - 1,
      lead: defenseScore - offenseScore,
      runnerCount: runnerCountOf(game.bases),
      currentStamina: stamina,
      // 0xabfcc 는 벤치 투수 레코드의 +0x2c 를 견준다 — 경기 사이에 이어진 값이 그대로 들어간다
      benchStaminaOf: (index) => benchStaminas[index] ?? FULL_STAMINA,
      // 0xb8a8d · 0xabfcc 가 보는 마선수(0xb633c) — 명부의 마투수 칸
      benchIsSpecialPitcherAt: (index) => (entries[index]?.aceIndex ?? -1) >= 0,
      // 0xabfcc 의 보직 목록 (0xb6dec)
      benchRoleOf: (index) => entries[index]?.role,
      // 마무리 갈래(ac0be)의 정렬 열쇠 0xb5b50 = 경기용 능력치(체력 인자 90) 네 칸 합 — 시즌 내 팀 보정·팀 능력치·코치까지
      benchAbilitySumOf: (index) =>
        pitcherAbilitySumOf(
          pitcherAbilitiesAt(
            progress,
            defendingIsOurs ? progress.options.ourTeamId : progress.options.opponentTeamId,
            index,
          ),
        ),
    },
    random,
  )
  if (next < 0) return progress

  const changed = applyPitcherChange(progress, defendingIsOurs, next)
  return appendLog(
    inScene
      ? {
          ...changed,
          // 3da88 "Time!" 22 → 0x16 진입 0x3d458 이 투수 교체 예약(team[+0x290])을 보고 +0x195c 비트1 → 0xe 등판음
          scenePitcherChange: {
            serial: (progress.scenePitcherChange?.serial ?? 0) + 1,
            incomingIsAce:
              (pitcherEntriesOf(
                progress,
                defendingIsOurs ? progress.options.ourTeamId : progress.options.opponentTeamId,
              )[next]?.aceIndex ?? -1) >= 0,
          },
        }
      : changed,
    `${game.inning}회${game.half} ${defendingIsOurs ? '우리' : '상대'} 투수 교체 — ${current + 1}번 → ${next + 1}번`,
    false,
  )
}

export interface ReplacementPickInput {
  /** `judgePitcherChange` 가 세운 "마무리 상황" 표시 */
  readonly saveSituation: boolean
  /** **0-기준** 이닝 (state+0x6b) */
  readonly inningIndex: number
  /** 수비 팀 점수 − 공격 팀 점수 */
  readonly lead: number
  readonly runnerCount: number
  /** 지금 마운드에 선 투수의 스태미나 */
  readonly currentStamina: number
  /** 벤치 투수 칸의 스태미나 `+0x2c` — 안 넘기면 모두 가득으로 본다 */
  readonly benchStaminaOf?: (index: number) => number
  /** 벤치 투수 칸이 마선수(0xb633c)인가 — 안 넘기면 아무도 아니다 */
  readonly benchIsSpecialPitcherAt?: (index: number) => boolean
  /** 벤치 투수 칸의 보직 `+0xb & 3` — 안 넘기면(또는 모르면) 0xabfcc 가 스태미나 최고 근사로 고른다 */
  readonly benchRoleOf?: (index: number) => PitcherRole | undefined
  /** 벤치 투수 칸의 능력 합 `0xb5b50` — 마무리 갈래(ac0be) 정렬 열쇠. 안 넘기면 그 갈래는 스태미나 순 근사 */
  readonly benchAbilitySumOf?: (index: number) => number
}

/**
 * 새 투수 고르기 `0xac5d6~0xac640` — `entities/pitching` 의 `replacementPitcherSlotOf` 에 벤치 칸을 넘긴다
 * (디스어셈 대조는 그쪽 주석).
 *
 * 벤치에 마투수가 있을 때만(0xb8a8d) 마무리 굴림 0xac360 이 돌고, 참이면 벤치 **마지막**(명부 끝의 마투수 자리)을
 * 올린다. 마무리 상황이거나 벤치에 마투수가 없으면 난수 없이 0xabfcc 로 가고, 0xabfcc 는 마선수를 고르지 않는다.
 * 팀 경기는 한 팀을 사람이 잡으므로 "두 팀 다 CPU"(0xb6c20)가 아니고, 모드 3 이 아니라 내 선수 거르기도 없다.
 */
export function replacementPitcherIndexOf(
  bench: readonly number[],
  input: ReplacementPickInput,
  random: RandomPort,
): number {
  return replacementPitcherSlotOf(
    bench.map((index) => ({
      index,
      ...(input.benchStaminaOf === undefined ? {} : { stamina: input.benchStaminaOf(index) }),
      ...(input.benchIsSpecialPitcherAt?.(index) === true ? { isSpecialPitcher: true } : {}),
      ...(input.benchRoleOf === undefined ? {} : { role: input.benchRoleOf(index) }),
      ...(input.benchAbilitySumOf === undefined ? {} : { abilitySum: input.benchAbilitySumOf(index) }),
    })),
    {
      saveSituation: input.saveSituation,
      inningIndex: input.inningIndex,
      lead: input.lead,
      runnerCount: input.runnerCount,
      currentStamina: input.currentStamina,
      bothTeamsAreCpu: false,
    },
    random,
  )
}

/**
 * 벤치에 남은 투수 칸 (`team+0x33`) — 이미 던진 투수와 지금 투수는 빠진다.
 *
 * 칸 수는 **투수 명단 길이**다. 원본도 `team+0x33 = 명부[0xc] − 1` 로 명부 길이에서 셈하므로
 * (0xb896c), 마투수가 들어와 명부가 8 → 9 로 늘면 벤치 투수도 7 → 8 로 는다.
 */
function benchIndexesOf(
  current: number,
  used: readonly number[],
  entryLength: number,
): readonly number[] {
  const out: number[] = []
  for (let index = 0; index < entryLength; index += 1) {
    if (index === current || used.includes(index)) continue
    out.push(index)
  }
  return out
}

/**
 * 마운드에 오른 투수의 **한 경기 마구 횟수** — 팀+0x28 을 채우는 `0xaebe4` (aee9a~aef24, H2 1-2):
 * ```
 * aee9a  P = 0xae83c(팀) ; P+0x18 == 0 → 0xae9c4(팀, 0)          ; 마구 없음
 * aeea8  0xaea10(팀) < 0 일 때만:
 * aeeb6    마투수 0xb633d(P) → n = s8 0xd8509[ s8 mgr[0x13a + 순번 0xb63a1(P)] ]   ; [3,4,5,6,7]
 *          아니면           → n = u8 0xd84ff[ P+0x18 ]                          ; [0,4,5,6,7…]
 * aef06    스킬 23(0xb62b4(P, 0x17)) 이면 n += 2
 * ```
 * 칸이 −1 이 되는 곳은 팀 new(0xb891c, b89b4~b89ba)와 투수 교체(aec7a · aee3e) 뿐이라, 이 값은 **그 투수가
 * 마운드에 오를 때 한 번** 주어지고 이닝이 바뀌어도 다시 차지 않는다.
 * 쓰기 0xae9c4 는 지금 투수 +0x18 이 0 이면 칸을 안 건드리지만, 읽기 0xaea10 도 그때 0 을 주므로 0 과 같다.
 *
 * ⚠️ 미해결: 스킬 23 혼신(+2) — 팀 경기 명단(`TeamEntryPitcher`)·로스터·마선수 표에 스킬 비트(+0x14)가 없어 늘 거짓.
 */
function magicCountOfPitcher(
  pitcher: TeamEntryPitcher | undefined,
  aceLevels: TeamGameOptions['aceLevels'],
): number {
  if (pitcher === undefined) return 0
  const isAce = pitcher.aceIndex >= 0
  return magicPitchCountOf({
    number: pitcher.repertoire.magicId,
    isAce,
    // 레벨 = 전역 기록 mgr[0x13a + 순번] — 마투수는 열 칸 중 앞 다섯 (aeec8~aeee4)
    aceLevel: isAce ? aceLevelOf(aceLevels, aceLevelSlotOf('투수', pitcher.aceIndex + 1)) : 0,
    hasSpiritSkill: false,
  })
}

/**
 * 교체 실행 `0xaf09c` → `0xaebe4`. 새 투수는 **제 레코드 스태미나**(`+0x2c`)로 서고 카운터가 0 이며,
 * `state[0xd]` 가 서서 **다음 한 투구 동안**은 다시 바뀌지 않는다 (0xaec64 memset · 0xa5e72).
 * 내려간 투수의 깎인 스태미나는 그 칸에 남는다 (`ourPitcherStaminas` 주석).
 *
 * 마구 횟수 팀+0x28: 교체 가지(aebfe~aec8a)가 투수 명단 0번 ↔ 고른 칸을 맞바꾼 뒤 `0xae9c4(팀, −1)` 로 칸을 비우고
 * 같은 함수 끝(aee9a~)이 **새 투수로 다시 채운다** (`magicCountOfPitcher`). 내려간 투수의 남은 횟수는 버려진다.
 * 내려간 투수는 다시 오를 수 없다 — 맞바꾼 뒤 0xb95b0 이 벤치 칸을 돌려 그를 맨 끝으로 보내고 벤치 투수 수
 * 팀+0x33 을 하나 줄인다(aec1e~aec32) (웹은 `ourUsedPitchers` 로 벤치에서 뺀다).
 */
function applyPitcherChange(
  progress: TeamGameProgress,
  ours: boolean,
  nextIndex: number,
): TeamGameProgress {
  // 교체 자리에서 세이브 후보를 잡는다 (0xa60c0 — 수비 측의 새 투수, 그 순간 이닝·아웃·주자)
  const decisions = decisionsAfterPitcherChange(progress.decisions, progress.game, {
    our: ours ? nextIndex : progress.ourPitcherIndex,
    opponent: ours ? progress.opponentPitcherIndex : nextIndex,
  })
  const base = { ...progress, pitcherJustChanged: true, decisions }
  if (ours) {
    return {
      ...base,
      ourUsedPitchers: [...progress.ourUsedPitchers, progress.ourPitcherIndex],
      ourPitcherIndex: nextIndex,
      ourPitcherStaminas: withValueAt(progress.ourPitcherStaminas, progress.ourPitcherIndex, progress.stamina),
      stamina: progress.ourPitcherStaminas[nextIndex] ?? FULL_STAMINA,
      magicRemaining: magicCountOfPitcher(
        pitcherEntryAt(progress, progress.options.ourTeamId, nextIndex),
        progress.options.aceLevels,
      ),
      ourPitcherCounters: EMPTY_MOUND_COUNTERS,
      pitchCount: 0,
      // 기록달성이 보는 R 은 **새 투수의** 경기 기록이다(0xb8cec = team+0x244+4·team[0]) — 이 경기에 처음 서니 0
      recordTally: { ...progress.recordTally, moundStrikeouts: 0, moundStrikeoutCombo: 0, moundOuts: 0 },
    }
  }
  return {
    ...base,
    opponentUsedPitchers: [...progress.opponentUsedPitchers, progress.opponentPitcherIndex],
    opponentPitcherIndex: nextIndex,
    opponentPitcherStaminas: withValueAt(
      progress.opponentPitcherStaminas,
      progress.opponentPitcherIndex,
      progress.opponentStamina,
    ),
    opponentStamina: progress.opponentPitcherStaminas[nextIndex] ?? FULL_STAMINA,
    opponentMagicRemaining: magicCountOfPitcher(
      pitcherEntryAt(progress, progress.options.opponentTeamId, nextIndex),
      progress.options.aceLevels,
    ),
    opponentPitcherCounters: EMPTY_MOUND_COUNTERS,
  }
}

/** 배열 한 칸만 바꾼 새 배열 — 칸이 없으면 그대로 */
function withValueAt(values: readonly number[], index: number, value: number): readonly number[] {
  if (index < 0 || index >= values.length) return values
  const next = [...values]
  next[index] = value
  return next
}

/**
 * 사람이 `#` 메뉴로 투수를 바꾼다 (R4 1b — 원본도 **사람 손으로만** 우리 투수를 바꾼다).
 * `benchIndex` 는 아직 안 쓴 우리 팀 투수 칸이어야 한다.
 *
 * 교체 화면(상태 0xb) 키 `0x495fc` 의 OK(0x496f0~0x4970c)는 상태 **0x16**(교체 연출)로 가고, 0x16 → 0xd(이전 상태
 * 0x16 이라 카운트·타석 초기화·state[0xe] 지우기를 건너뜀, 48e94) → 0xe(모드 1·2·8·9 는 0x504cc 강판이 늘 거짓)
 * → 메시지 1(0xf 예약 · 돌발 0x8f158) → 0xf 진입 `0x3d954` 로 다시 들어온다 — `readyAtBat` 을 다시 지난다.
 * 사람 수비라 0x3d954 는 CPU 대타 `0xac228`(3da70)를 묻는다.
 */
export function changePitcher(
  progress: TeamGameProgress,
  benchIndex: number,
  /** 굴림 없음 — 다시 선 0xe 의 OK 뒤에 돈다 (`confirmScene`) */
  _random?: RandomPort,
): TeamGameProgress {
  if (progress.game.isFinished) return progress
  if (!availablePitchers(progress).includes(benchIndex)) return progress
  const changed = appendLog(
    applyPitcherChange(progress, true, benchIndex),
    `${progress.game.inning}회${progress.game.half} 투수 교체 — ${progress.ourPitcherIndex + 1}번 → ${benchIndex + 1}번`,
    true,
  )
  // 0x16 → 0xd → 0xe — 사람 OK 를 다시 기다린다 (굴림은 OK 뒤, `confirmScene`)
  return enterConfirmWait(changed)
}

/**
 * **교체 화면 취소** — `0x495fc` 의 '#'·CLR 가지: 두 팀 예약을 지우고(`0xae989` = team+0x290·+0x291 = 0) 경기 상태
 * **0xe** 로 간다 (R4 1a). 0xe 의 메시지 1 이 다시 0xf 를 예약하고 돌발 `0x8f158` 을 굴린 뒤 0xf 진입 `0x3d954` 를
 * 지나므로(`readyAtBat`), 바꾼 것이 없어도 그 둘이 한 번 더 돈다. 화면이 교체 창을 닫을 때 부른다.
 * 교체 창은 0xe·0xf 에서만 열리므로(0x498d4) 사람 차례이고 타석 준비를 지난 때만 먹는다.
 */
export function cancelSubstitution(
  progress: TeamGameProgress,
  /** 굴림 없음 — 다시 선 0xe 의 OK 뒤에 돈다 (`confirmScene`) */
  _random?: RandomPort,
): TeamGameProgress {
  if (progress.game.isFinished || !isHumanTurn(progress) || !progress.atBatPrepared) return progress
  // '#'·CLR → 곧장 0xe — 사람 OK 를 다시 기다린다 (굴림은 OK 뒤, `confirmScene`)
  return enterConfirmWait(progress)
}

/**
 * **코스 고르기 취소** — 상태 0x10(코스 고르기)의 CLR(−16) 가지가 경기 상태를 **0xf** 로 되돌린다
 * (`0x50ee0~0x50ee6` `0xbcb49(…, 0xf)`, OK(−5) 가지는 0x50ed6 의 0x11). 0xf 진입 `0x3d954` 가 다시 돌아
 * 사람 수비면 CPU 대타 `0xac228` 를 한 번 더 묻는다 (돌발 굴림은 0xe 메시지 1 몫이라 없다).
 * 화면이 코스 단계에서 구질 단계로 돌아갈 때 부른다.
 */
export function returnToPitchSelection(progress: TeamGameProgress, random: RandomPort): TeamGameProgress {
  if (!isPitchTurn(progress) || !progress.atBatPrepared) return progress
  return enterPitchSelection(progress, random)
}

/** 지금 바꿔 넣을 수 있는 우리 팀 투수 칸 — 화면의 투수 교체 목록이 쓴다 */
export function availablePitchers(progress: TeamGameProgress): readonly number[] {
  return benchIndexesOf(
    progress.ourPitcherIndex,
    progress.ourUsedPitchers,
    progress.ourPitcherEntry.length,
  )
}

/**
 * `#` 로 교체 화면(경기 상태 0xb)을 열 수 있는가 — 진입 조건 `0x498d4` 의 '#' 가지 (I-controls 4b · R4 1a).
 *
 * 원본 조건 셋: ① `0x38984` 참(모드 4·7 은 막는다 — 팀 경기 모드 1·2·8·9 는 통과),
 * ② 경기 상태가 **0xe 또는 0xf**(투구 전·구질 고르기) — 웹에서는 *사람이 던질 차례이고 아직 안 던진 상태*,
 * ③ 사람 팀 벤치 투수 수 `팀+0x33` > 0.
 *
 * 사람이 **공격** 중이면 같은 키가 **대타**로 간다 (`canOpenPinchHit`) — 갈림길은 `0x49598`
 * 한 줄이다: `state[0x31+공격] == 0`(공격이 사람) → `0xaf06c`(대타), 아니면 `0xaf09c`(투수 교체).
 */
export function canOpenPitcherChange(progress: TeamGameProgress): boolean {
  if (progress.game.isFinished) return false
  if (!isPitchTurn(progress)) return false
  return availablePitchers(progress).length > 0
}

/* ── 대타 (0xaf06c → 0xaebe4 의 +0x291 가지) ──────────────────────────────────── */

/**
 * 지금 올릴 수 있는 우리 벤치 타자의 **명단 칸** — 타순 아홉 칸 뒤가 그대로 벤치다.
 * 칸 수는 원본과 같이 `team+0x28c`(= `ourBenchBatters`)가 정한다.
 */
export function availablePinchHitters(progress: TeamGameProgress): readonly number[] {
  const count = Math.min(progress.ourBenchBatters, progress.ourEntry.length - BATTING_ORDER_SIZE)
  return Array.from({ length: Math.max(0, count) }, (_unused, k) => BATTING_ORDER_SIZE + k)
}

/**
 * `#` 로 **대타** 화면(경기 상태 0xb)을 열 수 있는가 — `canOpenPitcherChange` 와 같은 '#' 가지의
 * 공격 쪽이다 (R4 1a): 경기 상태 0xe·0xf 이고 **벤치 타자 수 `팀+0x28c` > 0**.
 *
 * 원본은 한 경기 대타 횟수를 사람에게 제한하지 않는다 — 벤치가 남아 있는 만큼 낼 수 있다
 * (CPU 대타 `0xac228` 쪽에도 경기당 횟수 제한은 없다 — `state[0xe]` 는 다음 공까지만 막는 칸이다).
 */
export function canOpenPinchHit(progress: TeamGameProgress): boolean {
  if (progress.game.isFinished) return false
  if (!isBatterTurn(progress)) return false
  return availablePinchHitters(progress).length > 0
}

/**
 * **대타를 낸다** — 예약 `0xaf06c(team, k, 0)`(`team+0x291 = 1`, `team+0x293 = 9 + k`)이 서고,
 * 교체 연출(상태 0x16)을 지나 **다음 타석 시작(상태 0xd) 진입 `0x48d50` 이 `0xaebe4(team, 0)`**
 * 으로 확정한다. 여기서는 그 한 줄기를 한 번에 돌린다.
 *
 * 확정 `0xaebe4` 의 대타 가지(`aecac~aedec`) 그대로:
 *   1. 수비 위치 니블을 맞바꾼다 — 나가는 선수가 벤치 자리(0)를, **들어오는 선수가 그 수비 자리**를
 *      받는다 (`aecde~aecfe`: `0xb8e85(옛 타자, pb, 1)` · `0xb8e85(새 타자, pa, 1)`).
 *   2. 명단 두 칸을 맞바꾼다 (`aed02~aed14`).
 *   3. `0xb95b1` 로 뒤를 한 칸 당겨 **빠진 선수를 명단에서 지운다** — 재출장은 없다 (`aed16`).
 *      (원본은 타순별 경기 기록 24바이트도 같이 옮기고 당긴다. 리그 기록표 `leaguePlateAppearances`
 *      는 명단 칸이 든 **로스터 칸**(`TeamEntryBatter.rosterSlot`)으로 쌓으므로 선수를 따라간다.)
 *   4. 벤치 타자 수 `team+0x28c` 를 하나 줄인다 (0 밑으로는 안 간다, `aed9c~aedae`).
 *
 * **볼카운트는 이어받는다** — 원본 그대로다. 상태 0x16 다음이 0xd 인데 그 진입 `0x48d50` 은 이전 상태
 * (`scene+0x28`)가 0x16 이면 카운트 지우기 `0xb6764(state)`(state[4]·[5]·[0x14..0x17]·[0xa4..0xa7] = 0)와
 * 타석 초기화 `0xa5bcc(ctx)` 를 **건너뛴다** (48e94 `cmp r3,#0x16 ; beq 48eb8`). 곧 볼 셋에서 대타를 내면 새 타자가
 * 볼 셋에서 친다. (앞 판은 "0-0 으로 돌아간다" 로 옮겼는데 이 건너뛰기를 안 읽은 것이었다.)
 *
 * 같은 까닭으로 **대타 홈런 칸 `ctx+0x160`** 이 그 타석 동안 살아 있다: 0x16 진입 `0x3d458` 이 대타 예약을 보고
 * `0xa5bf0(ctx, 0)`(3d57e)으로 세우고(공격 팀이 사람일 때만), 다음 0xd 가 안 지운다 → 이 타석의 홈런은 기록 5
 * (`pinchHitHomeRunHalf` · `finishBatterOutcome`).
 *
 * 그 뒤 0xd → 0xe → 메시지 1(돌발 0x8f158) → 0xf 진입 `0x3d954` 를 다시 지난다 (`readyAtBat`, `changePitcher` 와 같은
 * 길) — 사람 공격이라 0x3d954 는 상대 CPU 투수 교체 `0xac428`(3da3e)를 묻는다.
 */
export function pinchHit(
  progress: TeamGameProgress,
  benchIndex: number,
  /** 굴림 없음 — 다시 선 0xe 의 OK 뒤에 돈다 (`confirmScene`) */
  _random?: RandomPort,
): TeamGameProgress {
  if (progress.game.isFinished) return progress
  if (!availablePinchHitters(progress).includes(benchIndex)) return progress
  const swapped = substituteBatter(
    progress.ourEntry,
    progress.ourEntryRecords,
    progress.game.battingOrderIndex,
    benchIndex,
    progress.ourHitBases,
    progress.ourBatterLogs,
  )
  if (swapped === null) return progress

  const changed = appendLog(
    {
      ...progress,
      ourEntry: swapped.entry,
      ourEntryRecords: swapped.records,
      ourHitBases: swapped.hitBases ?? progress.ourHitBases,
      ourBatterLogs: swapped.logs ?? progress.ourBatterLogs,
      // 4. 벤치 타자 수 −1
      ourBenchBatters: Math.max(0, progress.ourBenchBatters - 1),
      // 0xaede0 — 그 타순의 필살 남은 칸을 −1 로 되돌려 들어온 선수가 자기 횟수를 새로 받는다 (H2 1-2)
      ourSpecialSwingRemaining: withSpecialSwingSlot(
        progress.ourSpecialSwingRemaining,
        progress.game.battingOrderIndex,
        UNFILLED_SPECIAL_SWING,
      ),
      // 상태 0x16 → 0xd: 이전 상태가 0x16 이라 0xb6764·0xa5bcc 를 건너뛴다 — 카운트를 그대로 둔다
      atBat: progress.atBat,
      // 0x3d458 → 0xa5bf0(ctx, 0): 사람 공격이라 ctx+0x160 = 1
      pinchHitHomeRunHalf: { inning: progress.game.inning, half: progress.game.half },
      scenePinchHit: {
        serial: (progress.scenePinchHit?.serial ?? 0) + 1,
        by: '사람',
        incomingIsAce: swapped.incoming.aceIndex !== NO_ACE_BATTER,
      },
    },
    `${progress.game.inning}회${progress.game.half} 대타 — ${swapped.outgoing.name} → ${swapped.incoming.name}`,
    true,
  )
  // 0x16 → 0xd → 0xe — 사람 OK 를 다시 기다린다 (굴림은 OK 뒤, `confirmScene`)
  return enterConfirmWait(changed)
}

/** 지금 타석이 사람 팀이 대타를 낸 그 타석인가 (`ctx+0x160`) — 반 이닝이 바뀌었으면 이미 지워진 칸이다 */
function isPinchHitAtBat(progress: TeamGameProgress): boolean {
  const armed = progress.pinchHitHomeRunHalf
  return armed !== null && armed.inning === progress.game.inning && armed.half === progress.game.half
}

/**
 * **확정 `0xaebe4` 의 대타 가지 한 덩어리** — 사람 대타(`pinchHit`)와 CPU 대타(`0xac228`)가 같이 쓴다.
 * 타순별 경기 기록 24바이트도 원본처럼 선수를 따라 움직인다 (`aed02~aed16`).
 */
function substituteBatter(
  entryBefore: readonly TeamEntryBatter[],
  recordsBefore: readonly BatterGameRecord[],
  slot: number,
  benchIndex: number,
  /** 우리 팀일 때만 넘긴다 — 사이클 판정은 사람 팀 타순만 본다 (`0xa7610` 의 `st[0x31+st[9]]`) */
  hitBasesBefore?: readonly (readonly number[])[],
  /** 우리 팀일 때만 넘긴다 — 기록달성이 보는 타석 결과 목록도 같은 24바이트 안이다 */
  logsBefore?: readonly BatterGameLog[],
): {
  readonly entry: readonly TeamEntryBatter[]
  readonly records: readonly BatterGameRecord[]
  readonly hitBases: readonly (readonly number[])[] | undefined
  readonly logs: readonly BatterGameLog[] | undefined
  readonly outgoing: TeamEntryBatter
  readonly incoming: TeamEntryBatter
} | null {
  const outgoing = entryBefore[slot]
  const incoming = entryBefore[benchIndex]
  if (outgoing === undefined || incoming === undefined) return null

  const entry = [...entryBefore]
  // 1·2. 수비 자리는 자리에 남고 선수만 바뀐다
  entry[slot] = { ...incoming, position: outgoing.position }
  entry[benchIndex] = { ...outgoing, position: incoming.position }
  const records = [...recordsBefore]
  records[slot] = records[benchIndex] ?? EMPTY_BATTER_GAME_RECORD
  records[benchIndex] = recordsBefore[slot] ?? EMPTY_BATTER_GAME_RECORD
  // 루타 목록도 같은 24바이트 안에 있으니 함께 움직인다 (aed02~aed16)
  const hitBases = hitBasesBefore === undefined ? undefined : [...hitBasesBefore]
  if (hitBases !== undefined && hitBasesBefore !== undefined) {
    hitBases[slot] = hitBasesBefore[benchIndex] ?? []
    hitBases[benchIndex] = hitBasesBefore[slot] ?? []
  }
  const logs = logsBefore === undefined ? undefined : [...logsBefore]
  if (logs !== undefined && logsBefore !== undefined) {
    logs[slot] = logsBefore[benchIndex] ?? EMPTY_BATTER_GAME_LOG
    logs[benchIndex] = logsBefore[slot] ?? EMPTY_BATTER_GAME_LOG
  }
  // 3. 빠진 선수를 명단에서 지운다
  entry.splice(benchIndex, 1)
  records.splice(benchIndex, 1)
  hitBases?.splice(benchIndex, 1)
  logs?.splice(benchIndex, 1)

  return { entry, records, hitBases, logs, outgoing, incoming }
}

/* ── CPU 대타 (0xac228) ──────────────────────────────────────────────────────── */

/**
 * **CPU 대타 한 번** — 공격 팀을 두고 `0xac228` 을 물어본다 (Q1 4절, `pinchHitAi`).
 *
 * 부르는 자리는 원본 둘을 그대로 옮긴 것이다:
 *   - 자동으로 넘기는 타석: 간이 엔진 `0xc1ba4` 가 **공격 팀**을 두고 부른다 (`0xc1c50`) —
 *     투수 교체 `0xac428` 보다 **먼저**. 공격이 우리 팀이어도 마찬가지다 (원본에 가림막이 없다).
 *   - 사람이 잡은 타석: 0xf 진입 `0x3d954` 가 **수비가 사람일 때만** 부른다 (`0x3da6e`) — 곧 우리가
 *     던지는 타석에서 상대 타순에만 선다. 0xf 는 **공마다** 다시 들어서므로 카운트가 붙은 채로도 묻는다
 *     (`enterPitchSelection` — 카운트가 있으면 확률이 `>> (볼+스트라이크+1)` 로 준다).
 *
 * 막음 칸 `state[0xe]`(`cpuPinchHitUsed`)은 공마다 내려가므로(`0xa5e14` a5e7c) **한 경기에 여러 번** 나올 수 있다 —
 * 벤치 수·타순 칸 기록(타석 둘 이상·홈런 없음·안타 하나 이하)이 실제 상한이다.
 *
 * ⚠️ 원본이 보는 **장비 레벨 니블**(레코드 `+0x19`·`+0x1a`)은 웹 로스터 표에 없어 늘 0 으로 둔다.
 */
function applyCpuPinchHit(
  progress: TeamGameProgress,
  battingIsOurs: boolean,
  random: RandomPort,
  /** 사람 경기 장면의 타석 시작 `0x3d954` 에서 불렀는가 — 그러면 교체 연출 0x16 을 지난다 (간이 엔진은 안 지난다) */
  inScene = false,
): TeamGameProgress {
  if (progress.game.isFinished) return progress
  const entry = battingIsOurs ? progress.ourEntry : progress.opponentEntry
  const records = battingIsOurs ? progress.ourEntryRecords : progress.opponentEntryRecords
  const bench = battingIsOurs ? progress.ourBenchBatters : progress.opponentBenchBatters
  const slot = battingIsOurs ? progress.game.battingOrderIndex : progress.opponentOrderIndex
  const batter = entry[slot]
  if (batter === undefined) return progress

  const benchIndex = judgeCpuPinchHit(
    {
      blockedUntilNextPitch: progress.cpuPinchHitUsed,
      batterIsAce: batter.aceIndex !== NO_ACE_BATTER,
      // 원본은 명단 칸이 모자라도 team+0x28c 만 보고 rand(0, n) 을 돌린다 — 실제 칸 수로 자른다
      benchBatters: Math.min(bench, Math.max(0, entry.length - BATTING_ORDER_SIZE)),
      record: records[slot] ?? EMPTY_BATTER_GAME_RECORD,
      runnerCount: runnerCountOf(progress.game.bases),
      // state[4]·state[5] — 간이 엔진은 타석 시작이라 0, 사람 장면은 공마다 다시 물어 그때의 카운트다
      strikes: progress.atBat.strikes,
      balls: progress.atBat.balls,
    },
    random,
  )
  if (benchIndex < 0) return progress

  const swapped = substituteBatter(
    entry,
    records,
    slot,
    BATTING_ORDER_SIZE + benchIndex,
    battingIsOurs ? progress.ourHitBases : undefined,
    battingIsOurs ? progress.ourBatterLogs : undefined,
  )
  if (swapped === null) return progress

  const changed: TeamGameProgress = battingIsOurs
    ? {
        ...progress,
        ourEntry: swapped.entry,
        ourEntryRecords: swapped.records,
        ourHitBases: swapped.hitBases ?? progress.ourHitBases,
        ourBatterLogs: swapped.logs ?? progress.ourBatterLogs,
        ourBenchBatters: Math.max(0, progress.ourBenchBatters - 1),
        // 0xaede0 — 대타가 선 타순의 필살 남은 칸을 −1 로 (새 선수가 0xaebe4 에서 자기 횟수를 받는다)
        ourSpecialSwingRemaining: withSpecialSwingSlot(progress.ourSpecialSwingRemaining, slot, UNFILLED_SPECIAL_SWING),
      }
    : {
        ...progress,
        opponentEntry: swapped.entry,
        opponentEntryRecords: swapped.records,
        opponentBenchBatters: Math.max(0, progress.opponentBenchBatters - 1),
        opponentSpecialSwingRemaining: withSpecialSwingSlot(
          progress.opponentSpecialSwingRemaining,
          slot,
          UNFILLED_SPECIAL_SWING,
        ),
      }

  return appendLog(
    {
      ...changed,
      // state[0xe] = 1 (ac33e) — 다음 공(0xa5e14)이 나갈 때까지 다시 묻지 않는다
      cpuPinchHitUsed: true,
      // 간이 엔진은 타석 시작이라 카운트가 이미 0-0 이다(0xc0ee8 → 0xb6764). 사람 장면은 공마다 0xf 에서 묻고
      // 0x16 → 0xd 가 카운트 지우기(0xb6764)를 건너뛰므로(48e94) **카운트를 이어받는다**
      atBat: inScene ? progress.atBat : createAtBat(),
      // 사람 장면이면 22(3da88) → 0x16 연출 → 0xe 타자 등판음. 공격 팀이 CPU 라 ctx+0x160 은 안 선다 (a5c1c)
      ...(inScene
        ? {
            scenePinchHit: {
              serial: (progress.scenePinchHit?.serial ?? 0) + 1,
              by: 'CPU' as const,
              incomingIsAce: swapped.incoming.aceIndex !== NO_ACE_BATTER,
            },
          }
        : {}),
    },
    `${progress.game.inning}회${progress.game.half} ${battingIsOurs ? '우리' : '상대'} CPU 대타 — ${swapped.outgoing.name} → ${swapped.incoming.name}`,
    false,
  )
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
 * **들어가기** (경기 중 메뉴 0x3c158 의 자동진행 가지 0x3c8da~0x3c95a, R15 10-3):
 * ```
 * 3c93c  0xc0dac(sim, …)      ; 시뮬 초기화 — c0df6 rand(0, 2) → sim+4 · sim[0] = 0 · sim+0x94 = 0 …
 * 3c942  sim+0xa0 = 1         ; 자동진행 표시
 * 3c94a  0xc0ea8(sim, 0)      ; sim+0x9f(중단) = 0
 * 3c956  0xbcb48(…, 0x21)     ; → 진입 0x3abf0: 남은 돌발 0x8f628 (굴림 없음)
 * ```
 * **끝나는 조건** — 갱신 0x48480 이 틱마다 `r = 0xc2198(sim, 1)` 을 보고 참이면 `0xc262c`(간이 타석 하나):
 * ```
 * c21d6  0xb68fc(state) 경기 끝 → sim[0] = 0, 거짓
 * c2274  r = 0xc1e04(sim) || sim[1] || sim+0x94 > 0          ; 30G 길은 sim[1]·+0x94 가 0
 * 0xc1e04 모드 1·2 (c1f20): sim+0x9f → 거짓 · sim+0xa0 → 참
 *         모드 8·9 (c1f04): 이닝(0-기준 state+0x6b) > 5 → 거짓 · sim+0x9f → 거짓 · sim+0xa0 → 참
 * ```
 * 곧 일반·시즌은 **경기 끝까지**, 대전은 **0-기준 이닝이 6(7회)에 들면** 멈춘다 — 둘 다 원본 그대로다 (확정).
 * 간이 엔진 타석의 기록달성은 그대로 쌓인다(`[ctx+0x24]` 를 안 세운다 — R15 10-3).
 *
 * ⚠️ **중계 화면(경기 상태 0x21)은 옮기지 않았다** — 속도 칸 v = 전역 +0xbc(0..2, 틱 간격 8·4·1)·주자 그림·
 *    "공격팀(PLAYER/COM)" 띠·CLR 중단 질문(StrGAME[6], 예 → sim+0xa0 = 0 · 0xc0ea8(sim, 1) → 다음 0xc2198 이 거짓)은
 *    R10 7절에 있다. 웹은 결과를 한 번에 계산해 사람이 도중에 멈출 틈이 없다.
 * **멈출 때** (대전 7회 진입 — 경기 끝 전): 0x21 갱신 0x48480 이 `+0x1784 = 0` · 다음 상태 0x18 을 걸고 경기 끝(0xb68fc)이
 * 아니면 `0xc0ee8(sim)` → `0xc22b4(sim)` 를 부른다 (0x48538~0x48564). 둘 다 팀 경기에서는 **굴림이 없다** (확정):
 * ```
 * 0xc0ee8  sim[0] = 1 · 수비 팀 0xaebe4(명단 확정) · 마투수 칸 sim+0xa8 · 공격 팀 지금/다음 타자가 다르면 0xaebe4 ·
 *          마타자 칸 sim+0xa4 · 0xb6764(카운트 지우기) · 0xb68bc(플레이 칸 지우기) · sim[0] 되돌림 — 직접 부르는 함수에 rand 없음
 * 0xc22b4  c22c0 st[1] != 4 → 끝 — 모드 4(타자편)만의 9회 끝내기 판 (`play-game/gameFlow.withAutoStopLateInningSetup`)
 * ```
 * 웹 간이 타석은 타석째로 끝나 카운트·플레이 칸이 이미 비어 있고 대타 교체도 그 자리에서 확정하므로 0xc0ee8 몫은 할 일이 없다.
 */
export function runAutoProgress(progress: TeamGameProgress, random: RandomPort): TeamGameProgress {
  // 수비 진행 중에는 손대지 않는다 — 붙들어 둔 타구를 버리고 다음 타석으로 넘어가면 안 된다
  if (progress.pendingDefensePlay !== null) return progress
  // 3c93c 시뮬 초기화 0xc0dac 의 c0df6 rand(0, 2) → sim+4 — 그 값의 쓰임은 안 읽었다 (굴림 차례만 맞춘다)
  rollSimulatorInit(random)
  // 상태 0x21 진입 0x3abf0 — 사람 장면에서 뜬 채 남은 돌발을 판정 없이 내린다 (0x8f628).
  // 0xe 에서 '*' 메뉴로 왔으면 OK 를 안 받았으니 OK 뒤 굴림(돌발 0x8f158 · 0xf 진입 0x3d954)은 돌지 않는다
  let current: TeamGameProgress = withoutPendingBurst({ ...progress, sceneConfirmPending: false })
  for (let step = 0; step < MAXIMUM_AUTO_STEPS; step += 1) {
    if (current.game.isFinished) return current
    if (isVersusMode(current.options.mode) && current.game.inning - 1 > AUTO_PROGRESS_LAST_INNING_INDEX) {
      break
    }
    current = playAutoAtBat(current, random)
  }
  // 자동진행이 멈춘 자리부터는 평소대로 — 다음 사람 차례에서 선다
  return advance(current, random)
}

/* ── 도루 출발 (상태 0x11 공격, 0x53610 → 메시지 0x583 → 0xa9bd4) ─────────────────── */

/**
 * 지금 출발시킬 수 있는 루 — 원본 키는 '3' → 1루 주자 · '2' → 2루 주자 · '1' → 3루 주자다
 * (`0x53610`, 인자 = 대상 주자 1·2·3). 사람이 칠 차례에만 받는다. 문턱은 `canStartSteal`(0xa97a0 · 0xa9924 앞길 검사) —
 * 이번 공에 이미 출발한 주자는 빠지고, 앞 주자가 이미 출발했으면 겹도루가 된다. 3루 주자도 홈으로 뛴다(0xb6228).
 */
export function stealableBases(progress: TeamGameProgress): readonly StealBase[] {
  if (!isBatterTurn(progress)) return []
  return ([1, 2, 3] as const).filter(
    (base) => startHumanSteal(progress.game.bases, progress.stealingFrom, base) !== progress.stealingFrom,
  )
}

/** 도루 대상 주자가 선 루 */
export type { StealBase }

/**
 * **도루 출발** — 공이 나는 동안(상태 0x11) 사람 키 '3'·'2'·'1'(`0x53610` → 메시지 0x583 → `0xa9bd4`).
 *
 * 주자를 출발만 시킨다 — 성공·실패는 공이 도착한 뒤(`arriveTeamPitch`) 여는 도루 판(종류 5)에서 포수 송구와 주자
 * 도착이 겨뤄 정한다(`features/defense-play/model/stealPlay`). 간이 엔진 표 0xd9064 는 CPU 끼리 경기(자동 진행) 전용이라
 * 여기서는 안 쓴다(c18a833). **난수 없음.** 걸 수 없는 루면 같은 객체를 돌려준다.
 */
export function startSteal(progress: TeamGameProgress, base: StealBase): TeamGameProgress {
  if (!isBatterTurn(progress)) return progress
  const stealingFrom = startHumanSteal(progress.game.bases, progress.stealingFrom, base)
  if (stealingFrom === progress.stealingFrom) return progress
  return { ...progress, stealingFrom }
}

/**
 * 간이 타석의 투구 한 개마다 수비 팀 투수의 스태미나가 깎이고 투구 수가 는다 (0xa5e14).
 *
 * 원본 `0xc262c` 의 공 고리는 c26be 0xa5c2d → **c26c8 0xa5e14(소모)** → c26d4 rand(0,100) 경로 굴림 →
 * 0xc11f0/0xc1818 차례다 — 공 하나가 보는 체력%(0xaebb0)는 **그 공의 소모까지 먹은 값**이다
 * (`simulateHalfInning` 의 `beforePitch` 와 같다, d9d376c). 그래서 `playQuickAtBat` 의 `beforePitch` 갈고리로
 * 공마다 한 번 깎고, 그 공의 투수 체력%를 `QuickAtBatPitcher.stamina` 에 실어 돌려준다(0 이면 0xab214 탈진 갈래·
 * 제구 등급 지친 갈래). 갈고리는 난수를 쓰지 않는다.
 *
 * 간이 엔진 소모는 늘 구질 1(`0xa5e14` 의 c26c8 인자) — `pitchStaminaCostOf` 의 기본 소모다.
 * 용량 X 는 그 투수의 체력 능력치(칸 3)와 팀 사기로 구한다 (0x66e44).
 */
interface QuickPitcherDrain {
  /** 공 하나를 던지기 앞 — 깎고 그 공의 투수(체력% 실음)를 돌려준다 */
  readonly beforePitch: () => QuickAtBatPitcher
  /** 지금까지 깎은 스태미나 */
  readonly stamina: () => number
}

function quickPitcherDrainOf(
  pitcher: QuickAtBatPitcher,
  stamina: number,
  staminaAbility: number,
  teamMorale: number,
  isFirstPitcher: boolean,
): QuickPitcherDrain {
  const capacity = staminaCapacityOf(staminaAbility, teamMorale, isFirstPitcher)
  const cost = pitchStaminaCostOf({
    pitchTypeNumber: 1,
    batterIntimidates: false,
    pitcherIsCoward: false,
    pitcherEndures: false,
  })
  let current = stamina
  return {
    beforePitch: () => {
      current = consumeStamina(current, cost, capacity)
      return { ...pitcher, stamina: staminaPercentOf(current) }
    },
    stamina: () => current,
  }
}

/* ── 자동 진행 ───────────────────────────────────────────────────────────────── */

function advance(progress: TeamGameProgress, random: RandomPort): TeamGameProgress {
  let current = progress
  for (let step = 0; step < MAXIMUM_AUTO_STEPS; step += 1) {
    if (current.game.isFinished) return current
    if (isHumanTurn(current)) {
      if (current.atBatPrepared) return current
      // 상태 0x18(공수 교대·1회초 판) → 0xd → 0xe → 0xf(타석 준비) 차례 — 판의 굴림이 타석 준비보다 앞이다.
      // 반 이닝이 뒤집혔으면 0x18 진입 0x3ac90 이 남은 돌발을 먼저 내린다 (0xe 메시지 1 의 굴림 0x8f158 보다 앞)
      const entered = withoutBurstOnHalfFlip(current)
      // 상태 0x18 을 지나면 틱 0 의 0x4f928 이 판·굴림(0x3fac4)·타석 준비보다 **먼저** 이어하기 저장을 쓴다
      const saved = passesHalfInningState(entered) ? { ...entered, halfInningSave: savePointOf(entered) } : entered
      const prepared = prepareAtBat(withHalfInningBoard(saved, random))
      return {
        ...prepared,
        lastHumanHalf: { inning: prepared.game.inning, half: prepared.game.half },
        autoSinceHuman: false,
      }
    }
    // 상태 0x21 진입 0x3abf0 — 사람 장면에서 뜬 채 남은 돌발을 판정 없이 내린다 (0x8f628)
    current = playAutoAtBat(withoutPendingBurst(current), random)
  }
  throw new Error('팀 경기 자동 진행이 끝나지 않았습니다 — 진행 규칙을 확인하세요')
}

/**
 * **남은 돌발을 판정 없이 내린다** — `0x8f628` (`cancelBurst`, 굴림 없음 · obj+0x21c·+0xc 만 −1).
 * 부르는 곳은 상태 0x21(자동진행) 진입 `0x3abf0` 과 0x18 뒤집힘 진입 `0x3ac90` 둘뿐이다.
 * 돌발 객체는 시즌(모드 2)에만 있어 다른 모드에서는 아무 일도 없다.
 */
function withoutPendingBurst(progress: TeamGameProgress): TeamGameProgress {
  if (progress.burst === null) return progress
  const burst = cancelBurst(progress.burst)
  return burst === progress.burst ? progress : { ...progress, burst }
}

/**
 * 상태 0x18 진입 `0x3ac90` — 경기가 안 끝났고 `0xb6b6c`(아웃 > 2 → 초/말 뒤집기)가 참이면 `0x8f628`.
 * 사람이 잡은 마지막 반 이닝(`lastHumanHalf`)과 지금 반 이닝이 다르면 그 사이에 뒤집힘이 있었다
 * (그 사이 자동 타석이 있었으면 0x21 진입이 이미 내렸다 — 두 번 내려도 같다).
 */
function withoutBurstOnHalfFlip(progress: TeamGameProgress): TeamGameProgress {
  const last = progress.lastHumanHalf
  if (last === null || (last.inning === progress.game.inning && last.half === progress.game.half)) return progress
  return withoutPendingBurst(progress)
}

/** 자동 타석 하나 (간이 엔진, 상태 0x21) — 지났다는 표시를 남긴다 */
function playAutoAtBat(progress: TeamGameProgress, random: RandomPort): TeamGameProgress {
  const played = isOurOffense(progress)
    ? playAutoOffenseAtBat(progress, random)
    : playAutoDefenseAtBat(progress, random)
  return played.autoSinceHuman ? played : { ...played, autoSinceHuman: true }
}

/**
 * 사람 타석 앞에서 경기 장면이 **상태 0x18 을 지나는가** — 지나면 틱 0 에 이어하기 저장(`TEAM_GAME_RESUME_SAVE`)을 쓴다.
 *
 * - 앞 장면이 자동진행 중계(0x21)였다 — 0x21 갱신은 사람에게 넘길 때 늘 0x18 로 간다(48544, 반 이닝 중간이어도).
 * - 반 이닝이 뒤집혔다 — 3아웃 → 0x18.
 * - 경기 첫 타석 — 인트로 0xc 끝이 0x18 로 보낸다. 모드 1·이닝/전체 설정이면 곧장 0xd 라 안 지난다 (0x39e3c).
 * 판이 서는지(`withHalfInningBoard`)와 달리 자동진행 뒤에도 0x18 은 지난다(판만 안 선다, 4fb08).
 */
function passesHalfInningState(progress: TeamGameProgress): boolean {
  if (progress.autoSinceHuman) return true
  const last = progress.lastHumanHalf
  if (last === null) return !introSkipsFirstBoard(progress.options.mode, settingsOf(progress))
  return last.inning !== progress.game.inning || last.half !== progress.game.half
}

/**
 * 사람 타석 앞에 **공수 교대 판(상태 0x18)이 서는가** — 서면 틱 0 의 0x3fac4 가 36 번 굴린다.
 *
 * - 앞 장면이 자동진행 중계(0x21)였으면 판 없이 넘어간다 (4fab6 → 4fb08 자동 OK) — `autoSinceHuman`.
 * - 같은 반 이닝의 다음 타석이면 0x18 을 안 지난다 (0x18 은 3아웃·1회초에만 들어온다).
 * - 경기 첫 타석이면 인트로 0xc 끝이 0x18 로 보내는데, 모드 1·이닝/전체 설정이면 곧장 0xd 다 (0x39e3c).
 * - 다음 장면을 사람이 잡는 것은 여기 왔다는 것 자체가 말해 준다(`isHumanTurn` — 0xc2198 거짓 자리).
 */
function withHalfInningBoard(progress: TeamGameProgress, random: RandomPort): TeamGameProgress {
  if (progress.autoSinceHuman) return progress
  const { game } = progress
  const last = progress.lastHumanHalf
  if (last !== null && last.inning === game.inning && last.half === game.half) return progress
  if (last === null && introSkipsFirstBoard(progress.options.mode, settingsOf(progress))) return progress
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

/**
 * 간이 타석 하나 앞의 **교체 판정** — `0xc262c` 가 `0xc1ba4` 를 부르는 모양 그대로다.
 *
 * `0xc1ba4` 는 한 번 불릴 때 CPU 대타 `0xac228`(공격 팀, 0xc1c50)과 CPU 투수 교체 `0xac428`(수비 팀, 0xc1ce2)을
 * **둘 다** 부르고 하나라도 참이면 1 을 돌려준다(0xc1ce6 `orrs`). 그러면 `0xc262c` 는 공을 안 던지고 돌아가고
 * (c266c `bne c2732`), 다음 부름에서 **같은 타석**으로 다시 `0xc1ba4` 를 지난다. 그때 대타를 낸 쪽은
 * `state[0xe]`(ac234), 투수를 바꾼 쪽은 `state[0xd]` 가 서 있어 곧장 빠지지만, **안 바뀐 쪽은 처음부터 다시
 * 판정한다** — 투수만 바뀐 부름 뒤에는 대타 굴림(`rand(0,1000)`)이 한 번 더 돈다. 둘 다 안 바뀌어야 공을 던진다.
 * 두 칸은 공이 나가야(0xa5e14) 내려가므로 이 고리는 많아야 세 번 돈다.
 */
function runQuickSubstitutions(
  progress: TeamGameProgress,
  battingIsOurs: boolean,
  random: RandomPort,
): TeamGameProgress {
  let current = progress
  for (let call = 0; call < MAXIMUM_QUICK_SUBSTITUTION_CALLS; call += 1) {
    const pinched = applyCpuPinchHit(current, battingIsOurs, random)
    const changed = judgeAutoPitcherChange(pinched, !battingIsOurs, random)
    if (changed === current) return current
    current = changed
  }
  return current
}

/** `runQuickSubstitutions` 이 도는 상한 — 대타 한 번 · 투수 한 번 · 마지막 빈 부름 */
const MAXIMUM_QUICK_SUBSTITUTION_CALLS = 3

/** 자동으로 넘기는 우리 타석 — 원본도 같은 간이 엔진을 쓴다 (0xc11f0) */
function playAutoOffenseAtBat(progress: TeamGameProgress, random: RandomPort): TeamGameProgress {
  // 0xc262c 는 타석마다 먼저 0xc1ba4 를 부른다 — CPU 대타(공격 팀, 0xc1c50) 뒤 CPU 투수 교체(0xc1ce2).
  // 우리가 공격 중이면 **상대 투수**를 본다
  progress = runQuickSubstitutions(progress, true, random)
  // 이어 c26b6 0xa5bcc 가 대타 홈런 칸 ctx+0x160 을 지운다 — 간이 엔진 타석은 기록 5 를 못 낸다
  if (progress.pinchHitHomeRunHalf !== null) progress = { ...progress, pinchHitHomeRunHalf: null }
  const { options } = progress
  const before = progress.game
  const pitcher = entryQuickPitcherOf(progress, options.opponentTeamId, progress.opponentPitcherIndex)
  const drain = quickPitcherDrainOf(
    pitcher,
    progress.opponentStamina,
    opponentPitcherStaminaAbility(progress),
    100,
    progress.opponentUsedPitchers.length === 0,
  )
  const play = playQuickAtBat(
    entryQuickBatterOf(progress, options.ourTeamId, before.battingOrderIndex),
    pitcher,
    { inning: before.inning },
    random,
    { beforePitch: drain.beforePitch },
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
  const autoOffense = offenseRecordOf(outcome, runsBattedIn, progress.ourHitBases[slot] ?? [])

  // 간이 엔진 타석도 같은 0xa8024 → 0xa77f0 을 지난다 — 기록달성도 똑같이 쌓인다 (대타 홈런 5 는 c26b6 이 지워 없다)
  const recorded = withOurAtBatRecords(progress, slot, outcome, runsBattedIn, false)

  return appendLog(
    {
      ...recorded,
      game,
      // 간이 엔진 득점(0xc0fb4·0xc1054)도 같은 0xa5c34 를 부른다
      decisions: decisionsAfterPlay(progress.decisions, before, game, moundsOf(progress)),
      atBat: createAtBat(),
      atBatPrepared: false,
      // 투구마다 state[0xd]·state[0xe] 가 내려간다 (0xa5e14 의 a5e72·a5e7c, c26ca)
      pitcherJustChanged: false,
      cpuPinchHitUsed: false,
      // 공마다 이미 깎았다 (위 `beforePitch`)
      opponentStamina: drain.stamina(),
      pitcherLines: chargeMoundLine(progress, false, {
        outs: outsAddedBetween(before, game),
        runsAllowed: runsBattedIn,
        strikeouts: outcome.kind === '삼진' ? 1 : 0,
        pitches: play.pitches,
      }),
      opponentPitcherCounters: addRunsToCounters(
        progress.opponentPitcherCounters,
        runsBattedIn,
        play.pitches,
        game.inning !== before.inning || game.half !== before.half,
      ),
      ourHits: progress.ourHits + (isHit(outcome) ? 1 : 0),
      ourEntryRecords: withPlateAppearance(progress.ourEntryRecords, slot, outcome),
      // 자동으로 넘긴 타석도 원본은 같은 0xa8024 를 지난다 — 평판 16칸도 똑같이 오른다
      gameRecord: withSeasonRecord(progress, '공격', autoOffense.codes),
      ourHitBases: withHitBases(progress.ourHitBases, slot, autoOffense.hitBases),
      leaguePlateAppearances: withLeaguePlateAppearance(
        progress.leaguePlateAppearances,
        options.ourTeamId,
        progress.ourEntry,
        slot,
        outcome,
        runsBattedIn,
      ),
    },
    `${before.inning}회${before.half} ${(slot % BATTING_ORDER_SIZE) + 1}번 — ${describeOutcome(outcome)}${
      runsBattedIn > 0 ? ` (${runsBattedIn}점)` : ''
    }`,
    false,
  )
}

/** 자동으로 넘기는 상대 타석 */
function playAutoDefenseAtBat(progress: TeamGameProgress, random: RandomPort): TeamGameProgress {
  // 0xc1ba4 안 차례 그대로 — CPU 대타(공격 = 상대 팀, 0xc1c50) 뒤 **우리 투수** 교체 판정(0xc1ce2)
  progress = runQuickSubstitutions(progress, false, random)
  const { options } = progress
  const pitcher = entryQuickPitcherOf(progress, options.ourTeamId, progress.ourPitcherIndex)
  const drain = quickPitcherDrainOf(
    pitcher,
    progress.stamina,
    ourPitcherStats(progress).stamina,
    ourTeamMoraleOf(progress.options),
    progress.ourUsedPitchers.length === 0,
  )
  const play = playQuickAtBat(
    entryQuickBatterOf(progress, options.opponentTeamId, progress.opponentOrderIndex),
    pitcher,
    { inning: progress.game.inning },
    random,
    { beforePitch: drain.beforePitch },
  )
  return startDefensiveAtBat(
    {
      ...progress,
      // 간이 엔진도 공마다 0xa5e14 가 이 타석·반 이닝 투구 수(ctx+0x161·+0x16c)를 올리고, 0xc1818 이 볼카운트
      // state[4]·[5] 를 쓴다 — 삼진(0xa7c4c)·아웃(0xa7d0c) 기록 판정이 그 값을 본다
      recordTally: withHalfInningPitches(
        { ...progress.recordTally, atBatPitches: play.pitches },
        progress.game,
        play.pitches,
      ),
      atBat: createAtBat({ balls: play.balls, strikes: 0 }),
      // 투구마다 state[0xd]·state[0xe] 가 내려간다 (0xa5e14 의 a5e72·a5e7c, c26ca)
      pitcherJustChanged: false,
      cpuPinchHitUsed: false,
      // 공마다 이미 깎았다 (위 `beforePitch`)
      stamina: drain.stamina(),
      pitcherLines: chargeMoundLine(progress, true, { pitches: play.pitches }),
    },
    play.outcome,
    false,
    random,
  )
}

/**
 * 지금 마운드 투수의 스태미나 재료 — 용량 X `0x66e44(사기, 투수, f)` 와 % `0xaebb0` 을 셈하는 칸들. 공마다 깎는 셈
 * (`drainStamina` · `quickPitcherDrainOf`)이 쓰는 값 그대로다 — 상태 0xe 의 소개 판 체력 막대(0x44ea0~)가 읽는다.
 * ⚠️ 상대 팀 사기는 투구 소모와 같이 100 으로 둔다(진행기 근사 그대로).
 */
export function moundStaminaOf(progress: TeamGameProgress, ours: boolean): {
  readonly staminaAbility: number
  readonly teamMorale: number
  readonly isFirstPitcher: boolean
  readonly stamina: number
} {
  return ours
    ? {
        staminaAbility: ourPitcherStats(progress).stamina,
        teamMorale: ourTeamMoraleOf(progress.options),
        isFirstPitcher: progress.ourUsedPitchers.length === 0,
        stamina: progress.stamina,
      }
    : {
        staminaAbility: opponentPitcherStaminaAbility(progress),
        teamMorale: 100,
        isFirstPitcher: progress.opponentUsedPitchers.length === 0,
        stamina: progress.opponentStamina,
      }
}

/** 상대 투수의 체력 능력치 (칸 3) — 스태미나 용량 X 의 바탕 */
function opponentPitcherStaminaAbility(progress: TeamGameProgress): number {
  return pitcherAbilitiesAt(
    progress,
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

/** 지금 마운드 투수 줄에 더한다 — 붙박이 표 칸이 없는 투수(마투수)는 리그 기록표에 칸이 없어 건너뛴다 */
function chargeMoundLine(
  progress: TeamGameProgress,
  ours: boolean,
  delta: Parameters<typeof chargePitcherLine>[3],
): readonly GamePitcherLine[] {
  const teamId = ours ? progress.options.ourTeamId : progress.options.opponentTeamId
  const entry = pitcherEntryAt(progress, teamId, ours ? progress.ourPitcherIndex : progress.opponentPitcherIndex)
  if (entry === undefined || entry.aceIndex >= 0) return progress.pitcherLines
  // 기록을 실어 선 표 밖 투수(영입한 명전·나리)는 원본 id 로 줄을 가른다 (칸 −1)
  if (entry.tableSlot === undefined) {
    return entry.recordId === undefined
      ? progress.pitcherLines
      : chargePitcherLine(progress.pitcherLines, teamId, NO_ROSTER_SLOT, delta, entry.recordId)
  }
  // 줄은 그 투수의 붙박이 표 자리로 — 트레이드로 옮겨 온 투수는 옛 팀이다 (`TeamEntryPitcher.tableTeamId`)
  return chargePitcherLine(progress.pitcherLines, entry.tableTeamId ?? teamId, entry.tableSlot, delta)
}

/** 판정 칸(측 · 명단 칸)을 붙박이 표 칸으로 — 표 칸이 없는 투수(마투수)는 표 밖 칸(8)으로 둬 기록표가 건너뛴다 */
function decisionTableSlotOf(progress: TeamGameProgress, record: PitcherOfRecord | null): PitcherOfRecord | null {
  if (record === null) return null
  const isOurs = record.side === progress.game.playerSide
  const entry = (isOurs ? progress.ourPitcherEntry : progress.opponentPitcherEntry)[record.number]
  const tableSlot = entry === undefined || entry.aceIndex >= 0 ? undefined : entry.tableSlot
  return { side: record.side, number: tableSlot ?? PITCHERS_PER_TEAM }
}

/** 판정 받은 투수의 붙박이 표 팀 — 트레이드로 옮겨 온 투수만(그 밖은 측의 팀이라 undefined) */
function decisionTableTeamOf(progress: TeamGameProgress, record: PitcherOfRecord | null): number | undefined {
  if (record === null) return undefined
  const isOurs = record.side === progress.game.playerSide
  const entry = (isOurs ? progress.ourPitcherEntry : progress.opponentPitcherEntry)[record.number]
  return entry === undefined || entry.aceIndex >= 0 ? undefined : entry.tableTeamId
}

/** 판정 받은 투수가 표 밖 투수(영입한 명전·나리)면 그 원본 id */
function decisionRecordIdOf(progress: TeamGameProgress, record: PitcherOfRecord | null): number | undefined {
  if (record === null) return undefined
  const isOurs = record.side === progress.game.playerSide
  const entry = (isOurs ? progress.ourPitcherEntry : progress.opponentPitcherEntry)[record.number]
  return entry === undefined || entry.aceIndex >= 0 || entry.tableSlot !== undefined ? undefined : entry.recordId
}

type DecisionKeys = { readonly winner?: number; readonly loser?: number; readonly save?: number }

/** 판정 셋에서 칸 하나씩 — 하나도 없으면 undefined (요약에 칸째 안 싣는다 — 예전 모양 그대로) */
function decisionKeysOf(
  ended: { readonly winner: PitcherOfRecord | null; readonly loser: PitcherOfRecord | null; readonly save: PitcherOfRecord | null },
  keyOf: (record: PitcherOfRecord | null) => number | undefined,
): DecisionKeys | undefined {
  const winner = keyOf(ended.winner)
  const loser = keyOf(ended.loser)
  const save = keyOf(ended.save)
  if (winner === undefined && loser === undefined && save === undefined) return undefined
  return {
    ...(winner === undefined ? {} : { winner }),
    ...(loser === undefined ? {} : { loser }),
    ...(save === undefined ? {} : { save }),
  }
}

/** 판정 셋의 표 팀(트레이드로 옮겨 온 투수)·원본 id(표 밖 투수) — 없는 칸은 싣지 않는다 */
function decisionTableTeamsOf(
  progress: TeamGameProgress,
  ended: { readonly winner: PitcherOfRecord | null; readonly loser: PitcherOfRecord | null; readonly save: PitcherOfRecord | null },
): Pick<GameLeaguePitchers, 'decisionTableTeams' | 'decisionRecordIds'> {
  const tableTeams = decisionKeysOf(ended, (record) => decisionTableTeamOf(progress, record))
  const recordIds = decisionKeysOf(ended, (record) => decisionRecordIdOf(progress, record))
  return {
    ...(tableTeams === undefined ? {} : { decisionTableTeams: tableTeams }),
    ...(recordIds === undefined ? {} : { decisionRecordIds: recordIds }),
  }
}

/** 측별 지금 마운드 투수 칸 — 승·패·세 칸이 "그 순간 마운드에 선 투수" 로 적는다 */
function moundsOf(progress: TeamGameProgress): MoundBySide {
  return { our: progress.ourPitcherIndex, opponent: progress.opponentPitcherIndex }
}

/**
 * 결과 판 세 줄(승리투수·패전투수·세이브)의 이름 — 상태 0x18 그리기 0x4fe9c 가 state+0x44/0x50/0x5c 를
 * 거르지 않고 그대로 읽는다(`0xb62c0(0xb8b60(팀[측], 번호))`). 측 2(없음)면 그 줄은 빈다.
 */
export function pitchersOfRecordOf(progress: TeamGameProgress): PitcherOfRecordNames {
  return pitcherOfRecordNamesOf(progress.decisions, progress.game.playerSide, (isOurTeam, index) =>
    (isOurTeam ? progress.ourPitcherEntry : progress.opponentPitcherEntry)[index]?.name,
  )
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
  /** 리그 기록표 +0x2c 도루 (`recordLeagueStolenBases`) — 양 팀. 없으면 빈 것 */
  readonly leagueStolenBases?: readonly LeagueStolenBase[]
  /** 시즌 평가 `evaluateSeasonGame` 에 그대로 넘기는 두 칸 (인기도·평판이 서로 다른 이닝 칸을 본다) */
  readonly popularityCompleteGame: CompleteGameKind
  readonly reputationCompleteGame: CompleteGameKind
  /**
   * 시즌 평판 평가 16칸 (`SR+0x1a0..0x1af`) — 부르는 쪽이 `evaluateSeasonGame` **앞에서**
   * `record.gameRecord` 에 꽂는다. 시즌(모드 2)이 아니면 전부 0 이다 (게이트 `0xa755c`).
   */
  readonly gameRecord: readonly number[]
  /**
   * 이 경기 **기록달성 번호** — 경기 중 쌓인 것 + 경기 끝 0xa7de8 몫(37~39 점수차 승 · 28~31 완투 계열).
   * 원본 경기 끝 0x4ea0c 는 모드 5·6 이 아니면 `Σ 횟수 × 0xcfbf8[k]` 를 저장 G(+0x64)에 더한다(4ebe0~4ec5a, 99999 상한).
   * (`summaryOf` 는 늘 채운다. 선택 칸인 것은 이 칸을 아직 안 읽는 앱 쪽 시험용 요약들이 그대로 맞게 하려는 것뿐이다.)
   */
  readonly recordIds?: readonly number[]
  /**
   * 리그 투수 기록 재료 — 양 팀 투수 줄(붙박이 표 칸, 마투수 뺌)과 경기 끝 판정 0xa7de8 (판정 칸도 표 칸으로 되돌린 것).
   * 부르는 쪽이 `leaguePitcherAppearancesOf` → `recordLeaguePitcherAppearances` 로 쌓는다 — 정산의 투수 칸 쓰기는
   * `0xa56dc` 가 참일 때만이라 시즌(모드 2 갈래 0xa56fa)도 국가대항전·포스트시즌 경기는 쌓지 않는다.
   */
  readonly leaguePitchers?: GameLeaguePitchers
  /** 위 기록의 G — `recordGamePointsOf` (0xcfbf8 표). 저장 G 에 더하는 것은 부르는 쪽(앱 세션)의 몫이다 */
  readonly gamePoints?: number
  /**
   * **경기가 끝났을 때의 투수 스태미나** `+0x2c` — 옵션 `ourPitcherStaminas` 와 같은 차례(명단 차례, 마투수 뺌).
   * 원본은 이 값이 레코드에 남아 다음 경기로 이어진다 — 시즌 저장에 되적고 하루 끝 회복을 거는 것은 부르는 쪽 몫이다.
   * 하루 끝 회복은 정규·포스트시즌 모두 `0x4ea0c` 4f2bc 의 열 팀 `0xb617c`(+20%) 하나뿐이다 (5d61cf2).
   * `0xb818c` 의 10000 채우기(b81e0)는 **국가대항전 갈래 안에만** 있고 포스트시즌 갈래(L+0x34)는 b8228 → b8320 으로
   * 곧장 끝난다 — a583fe0 이 적은 "포스트시즌은 내 팀만 10000" 은 틀렸다.
   */
  readonly ourPitcherStaminas?: readonly number[]
  /** 상대 팀 투수의 끝 스태미나 — 표 칸 차례 (`opponentPitcherStaminas` 와 같은 차례) */
  readonly opponentPitcherStaminas?: readonly number[]
  /**
   * 이 경기 **돌발 보상·페널티** — `resolveBurst` 의 `deltas` 를 판정 차례대로 모은 것 (시즌 모드 2 만, 한 경기 최대 1회
   * 발동이라 많아야 한 판정 몫). 원본 0x8e34c 는 판정이 난 경기 중에 더하므로 부르는 쪽이 경기 끝 평가 0x4ea0c **앞에**
   * 먹인다 (`seasonRewards`, fded413).
   */
  readonly burstRewardDeltas?: readonly BurstRewardDelta[]
}

/** 명단 칸별 스태미나(지금 마운드 칸은 `current`)를 명단 차례로 되돌린다 — 마투수는 뺀다 */
function orderedPitcherStaminasOf(
  entry: readonly TeamEntryPitcher[],
  staminas: readonly number[],
  moundIndex: number,
  current: number,
): readonly number[] {
  const out: number[] = []
  entry.forEach((pitcher, index) => {
    if (pitcher.orderIndex < 0) return
    out[pitcher.orderIndex] = index === moundIndex ? current : (staminas[index] ?? FULL_STAMINA)
  })
  return Array.from(out, (value) => value ?? FULL_STAMINA)
}

export function summaryOf(progress: TeamGameProgress): TeamGameSummary {
  const ended = gameEndDecisionOf(progress.decisions)
  const recordIds = [...progress.recordIds, ...gameEndRecordIdsFor(progress)]
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
    leagueStolenBases: progress.leagueStolenBases ?? [],
    // ⚠️ 원본 그대로 — 인기도는 `st+0x6b`(현재 이닝), 평판은 `st+0x69`(정규 마지막 이닝)를 본다.
    //    그래서 **연장 완투는 인기도만 보너스를 받는다** (P4 "원본 버그·이상" 3번)
    popularityCompleteGame: popularityCompleteGameOf(outs, game.inning - 1, flags),
    reputationCompleteGame: reputationCompleteGameOf(outs, REGULATION_LAST_INNING_INDEX, flags),
    gameRecord: progress.gameRecord,
    recordIds,
    gamePoints: recordGamePointsOf(recordIds),
    ourPitcherStaminas: orderedPitcherStaminasOf(
      progress.ourPitcherEntry,
      progress.ourPitcherStaminas,
      progress.ourPitcherIndex,
      progress.stamina,
    ),
    opponentPitcherStaminas: orderedPitcherStaminasOf(
      progress.opponentPitcherEntry,
      progress.opponentPitcherStaminas,
      progress.opponentPitcherIndex,
      progress.opponentStamina,
    ),
    leaguePitchers: {
      lines: progress.pitcherLines,
      decision: {
        winner: decisionTableSlotOf(progress, ended.winner),
        loser: decisionTableSlotOf(progress, ended.loser),
        save: decisionTableSlotOf(progress, ended.save),
      },
      sideTeams:
        game.playerSide === 0
          ? [progress.options.ourTeamId, progress.options.opponentTeamId]
          : [progress.options.opponentTeamId, progress.options.ourTeamId],
      ...decisionTableTeamsOf(progress, ended),
    },
    burstRewardDeltas: progress.burstRewardDeltas,
  }
}
