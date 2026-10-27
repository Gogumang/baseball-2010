import type { FielderRecordSeat } from '@/entities/fielding/model/fielderRecords'
import { postJudgeMessage } from '@/features/defense-play/model/laserPresentation'
import { judgeCallSoundIdOf } from '@/features/defense-play/model/judgeCall'
import {
  DEFENSE_SCENE_START,
  drawDefenseScene,
  enterDefenseScene,
  fireLaser,
  playEndStateOf,
  turnOnDeadlyFlash,
  type DefenseScene,
} from '@/features/defense-play/model/defenseScene'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import {
  battedBallTrajectory,
  carryDistanceOf,
  isBallTrajectory,
  launchTrajectory,
  holdTrajectoryAt,
  spliceTrajectory,
  trajectoryWithRandom,
  type BallTrajectory,
} from '@/entities/batting/model/battedBallFlight'
import { earlyPassPatternOf } from '@/entities/batting/model/earlyPassBall'
import {
  displayPatternOf,
  isFairAngle,
  isWideFairAngle,
  isWideFairOriginalAngle,
  scenePatternDeckOf,
} from '@/entities/batting/model/battedBallOutcome'
import type { BattedBallPattern } from '@/shared/config/original/battedBallPatterns'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { inPlayCommandOf, type ControlSide } from '@/entities/defense-controls/model/defenseKeys'
import { applyBaserunningKey } from '@/entities/fielding/model/baserunningKey'
import {
  SIXTH_SENSE_SKILL_ID,
  HOME_RUN_DERBY_MODE,
  BATTER_CAREER_MODE,
} from '@/entities/defense-controls/model/laserThrow'
import { canFireLaserNow, laserWindowTick } from '@/features/defense-play/model/laserTick'
import {
  autoSlideRunnerIndexes,
  slideOnKey,
  SLIDING_SOUND_EFFECT,
  SLIDING_SPEED_BONUS,
  type SlidingRunner,
} from '@/entities/defense-controls/model/sliding'
import {
  autoAdvanceDecisions,
  requiredBasePinOf,
  requiredBasesOnBounce,
  requiredBasesOnFlyCatch,
} from '@/entities/fielding/model/autoAdvance'
import {
  BOUNCE_THROW_DISTANCE,
  rollFumble,
  rollSpecialDefense,
} from '@/entities/fielding/model/fieldingErrors'
import { backupPointOf, CATCH_KIND, type BattedBallTrajectory } from '@/entities/fielding/model/catchPrediction'
import {
  basePosition,
  FIELDER_COUNT,
  FIELDER_START_POSITIONS,
  horizontalDistance,
  isSamePoint,
  progressPercent,
  runnerSpeedOf,
  stepToward,
  ticksToReach,
  type WorldPoint,
} from '@/entities/fielding/model/fieldGeometry'
import {
  buildRundownPlan,
  canStartRundown,
  chooseRundownRunner,
  endRundown,
  rundownAction,
  tagsRunner,
  NO_RUNDOWN,
  type RundownPlan,
} from '@/entities/fielding/model/rundown'
import {
  AI_STATE,
  createFielders,
  createRunner,
  fielderAbilityOf,
  recordPlayerAbilityOf,
  fielderArrivalTicks,
  initialPlayView,
  NONE,
  type DefenseContext,
  type FielderState,
  type PlayView,
  type RunnerState,
} from '@/entities/fielding/model/fieldingState'
import {
  EMPTY_HELD_RUNS,
  onRunnerReachesHome,
  releaseHeldRuns,
  type HeldRunState,
} from '@/entities/fielding/model/heldRuns'
import {
  baseUnderFoot,
  judgeOut,
  OUT_KIND,
  releaseForcesAfterOut,
} from '@/entities/fielding/model/outJudgement'
import { baseAtPoint, claimCoverOfBase, needsCover, withCoverBaseTarget } from '@/entities/fielding/model/coverAssignment'
import { runCoverTick } from '@/features/defense-play/model/coverTick'
import {
  FIELDER_ACTION,
  acceptsTargetVt14,
  canStepNextListTick,
  fielderSlackAtPlayEnd,
  isFreeToRetarget,
  isFreeToStep,
  isReadyToThrow,
  listTickFielder,
  withAction,
  withCatchMotion,
  withFlyWaitPose,
  withPoseCleared,
  withReturnToStartTick,
  withThrowMotion,
} from '@/entities/fielding/model/fielderPose'
import {
  planThrow,
  LASER_THROW_SPEED,
  readyTicksOf,
  thrownWith,
  throwTicksTo,
  throwTicksToFielder,
} from '@/entities/fielding/model/throwPlan'
import { chooseThrowTargetBase, isForcedRunner, isSpecialThrow } from '@/entities/fielding/model/throwTargetBase'
import { applyRunnerLead, runnerLeadOf } from '@/entities/fielding/model/runnerLead'
import { stealTargetBaseOf } from '@/entities/fielding/model/stealStart'
import { EMPTY_BASES, type AdvanceResult, type BaseState } from '@/entities/game/model/baseState'
import type { ManualAutoMode } from '@/entities/settings/model/gameSettings'
import {
  eventCodeEffectOf,
  isFoulEnded,
  strikesAfterPlay,
  liveRunnerCountOf,
  gateRunnerViewsOf,
  passPlayGate,
  passPlayGateBetweenTicks,
  playEndResultCode,
  someRunnerStillActive,
  type PlayEndState,
  type PlayGateFrameResult,
  type PlayGateInput,
} from '@/entities/fielding/model/playGate'
import { DIVE_TICK_NONE, forecastCatch } from '@/features/defense-play/model/catchForecast'
import { diveCheckOf, logDiveCheck } from '@/features/defense-play/model/diveCheck'
import { loadedRunnerAceOf, runnerAceIndexesOf, type RunnerAces } from '@/features/defense-play/model/runnerAces'
import {
  FUMBLE_MARK_TICKS,
  THROW_ERROR_MARK_TICKS,
  tickMarkCounter,
} from '@/features/defense-play/model/playerEffects'
import { forecastOptionsOf, launchThrow, type ThrownBall } from '@/features/defense-play/model/throwLaunch'
import { runnerFateOf, scoringBaseRunnerAfterOf, type RunnerFate } from '@/features/defense-play/model/runnerFates'
import { carryContact, contactOfOutcome } from '@/entities/batting/model/battedContact'
import { rollSpecialSwing } from '@/entities/batting/model/specialSwing'
import { isBigHitWatch } from '@/entities/batting/model/bigHitWatch'
import { isSacrificeOf, settledBatterOutcomeOf, type PlayOutcomeInput } from '@/features/defense-play/model/playOutcome'
import { ballParticleFactsOf } from '@/features/defense-play/model/ballParticleFacts'
import { isBugFixed } from '@/shared/config/bugfixes'
import {
  holderMarkOf,
  viewStateOf,
  type ActionMemory,
  type DefensePlayView,
  type HolderPlate,
} from '@/features/defense-play/model/defensePlayView'

/** 슬롯 2 의 52602 — 판 종류가 이 마스크(0x58c)면 플레이 vt4c 0xb45dc 를 안 부른다 (`runnerPlayEngine` 과 같은 표) */
const VT4C_BLOCKED_PLAY_KINDS: readonly number[] = [2, 3, 7, 8, 10]

/**
 * 타구 하나를 **틱 단위로 돌리는 진행기**.
 *
 * ## 틱 스테퍼 — 사람이 실시간으로 끼어들 수 있게
 * 예전에는 타구 하나를 통째로 미리 계산해 `ticks` 배열을 뱉는 한 덩이 함수였다. 그러면
 * **사람이 아직 안 누른 키를 알 수 없어** 실시간 조작이 원리적으로 불가능하다. 그래서 넷으로 쪼갰다:
 *   `startDefensePlay` → `stepDefensePlay`(한 갱신 = 한 틱, 0xc2198) → `isDefensePlayFinished` →
 *   `defensePlayResultOf`
 * `runDefensePlay` 는 그 넷을 끝까지 돌리는 **얇은 껍데기**로 남아 있다 — 미리 다 계산해도 되는
 * 자리(CPU 경기·미션)는 그대로 부르면 되고, 결과는 쪼개기 전과 **한 톨도 다르지 않다**.
 *
 * `entities/fielding` 에 따로따로 들어와 있는 조각들을 여기서 한 줄로 잇는다:
 *   포구 예보(0xb12d0 · 0xb3b38) → 송구 목표 루(0xafb24) → 송구 도착 틱(0xaf284) →
 *   자동 추가 진루(0xaf918) → 2아웃 득점 보류(state[0]).
 *
 * ## 무엇이 무엇을 정하는가 (중요)
 * **원본처럼 이 판이 다 정한다.** 타석 판정(0x51408)은 덱에서 뽑은 패턴을 그대로 쏠 뿐이고(메시지 0x11 → 51188),
 * 타자주자도 다른 주자처럼 포구 예보 · 아웃 판정 0xb36d0(1루 포스 · 태그 · 쥐는 순간의 뜬공 아웃) · 자동 진루 0xaf918 로
 * 움직인다. 판이 끝나면 판 끝 정산 0xa8024 의 타자 갈래(`playOutcome`)가 사건(6 안타 · 8 홈런 · 0xd 아웃)과 타자주자 칸
 * (+0x7c · +0x84 · +0x8c)으로 기록할 결과를 낸다 — `DefensePlayResult.outcome`.
 * (예전 웹은 타석 결과 코드를 먼저 정하고 그에 맞춰 예보 구간 자르기 · 타자주자 최소 루 · 1루 송구 도착 틱 아웃 ·
 * 타자주자 판정 빼기 같은 다리를 걸었다. 2026-10-07 에 모두 걷었다.)
 *
 * 타구 궤적은 `entities/batting/model/battedBallFlight` 가 원본 물리 세계 0xbfed0 대로 미리 깐 점이다
 * (점마다 속도·수직 속도·각·바운드 표시, 사건 틱 aa0 · aa4 · aa8 · ab0).
 */

/** 능력치를 안 주면 쓰는 값 — 원본 평균대(등급 3) */
const DEFAULT_ABILITY = 500
/** 야수.vte4 = 0xa1e60 — 필살타법 타구에 맞은 야수의 동작 잠금 +0xb4 (`movs r3, #0xf`, a1e70) */
const HIT_STAGGER_LOCK_TICKS = 15
/** 한 플레이가 이 틱을 넘기면 강제로 끊는다 (원본에는 없는 우리 쪽 안전망) */
const DEFAULT_MAXIMUM_TICKS = 240
/** 보류 해제 0xaa39e 가 메시지 0x13 에 싣는 주자 칸 (`movs r2, #0x64`) — 타자주자(0)가 아니다 */
export const RELEASED_RUN_SLOT = 0x64

/** 필살타법 타구에 맞은 야수 — 0xa1e60 의 `movs r1, #0x35` (b4588 vt74 → 0xb3420 → 야수 vte4) */
export const HIT_STAGGER_SOUND_EFFECT = 53

/**
 * 공+0xac4 의 거리 문턱 — 낙구점이 홈 (20000, 0, 29445)(표 0xd7be8)에서 **10274 넘게** 떨어지면 깊은 낙구(P2 2절).
 * `atBatSounds.deepHitCheerSoundIdOf` 의 문턱과 같은 값이다
 */
const DEEP_LANDING_DISTANCE = 10_274

/**
 * 진행기 한 틱의 소리 한 칸 (`DefensePlayState.tickSounds`) — 번호가 정해진 소리, 메시지 0x13 의 주자 칸(함성 0x51fb8 은 결과 코드
 * [경기+0xfd4] 의 0x357e0 을 보므로 화면이 고른다), 깊은 낙구 함성 60 의 후보(0x357e0 은 화면이 본다)
 */
export type DefenseTickSound =
  | { readonly kind: 'sound'; readonly soundId: number }
  | { readonly kind: 'runIn'; readonly slot: number }
  | { readonly kind: 'deepLanding' }
/** 홈을 가리키는 루 번호 — 원본 루 표의 [4] 가 홈의 사본이라 진루는 4 로 센다 */
const HOME_BASE = 4

export interface DefensePlayInput {
  /**
   * 타석을 끝낸 **임시 결과** — ⚠️ 진행기는 이 칸을 **보지 않는다**. 결과는 판 끝 정산이 낸다(`DefensePlayResult.outcome`).
   * 받는 쪽(세션 · 화면)이 판이 끝나기 전에 그림·소리를 고르는 데만 남겨 둔 칸이다(`battedContact.provisionalOutcomeOf`).
   */
  readonly outcome: AtBatOutcome
  /**
   * ⚠️ **결과를 넘겨받은 호출**(쏜 패턴 없이 결과만 준 시험·옛 호출 — 원본에 없는 길)인가. 서 있으면 판은 결과에 맞춰 고른
   * 패턴(`fixturePatternFor`)으로 돌고, 기록은 넘겨받은 `outcome` 그대로다(`recordedOutcomeOf`). 진행기는 보지 않는다.
   * 실제 타석(쏜 패턴이 있는 판)은 늘 거짓이다.
   */
  readonly outcomeIsGiven?: boolean
  /** 원본 패턴에서 만든 타구 궤적 */
  readonly trajectory: BattedBallTrajectory
  /** 투구 때의 루 상황 */
  readonly bases: BaseState
  /** 투구 때의 아웃 수 */
  readonly outs: number
  /** 수비 9명의 수비 능력치 (칸 순서). 기본 500 */
  readonly defenseAbilities?: readonly (number | null)[]
  /**
   * **수비 팀 보너스** (판 시작 0xb0fb4 b10d0 — `defenseTeamBonusOf`): 모드 1·2·8·9 에서 수비 팀 '집중' 등급.
   * 아홉 칸(칸 0 포함) 송구 속도에 더한다. 안 주면 0(모드 3~7 과 같다)
   */
  readonly defenseTeamBonus?: number
  /**
   * **주자 속도의 팀 등급** (주자 만들기 0xa93ac a9488 — `runnerTeamGradeOf`): 모드 1·2·8 에서 공격 팀 '근성' 등급.
   * 모든 주자(타자주자 포함) 속도에 더한다. 안 주면 0(그 밖의 모드와 같다)
   */
  readonly runnerTeamGrade?: number
  /** 주자들의 주루 능력치. 기본 500 */
  readonly runAbility?: number
  /**
   * **루별 주자 주루** (0 = 타자주자, 1~3 = 그 루에서 출발한 주자). 없는 루는 `runAbility` 다.
   * 원본은 주자마다 제 레코드로 속도를 잡는다 — 타자주자 만들기 0xa93ac 의 a9462 `0xb570c(팀, 3, 타자, 90)` 이
   * 주자+0xa4 에 적고, 루에 선 주자는 제 타석에서 만든 그 칸을 그대로 들고 간다(I-controls 3a).
   */
  readonly runAbilities?: Partial<Record<0 | 1 | 2 | 3, number>>
  /**
   * 이번 투구에 출발한 도루 주자들의 루 — state[0x14 + 루] (`0xa9bd4`). 판이 열릴 때 `0x3d7b8` 이 이 주자들은
   * 다음 루를 목표로 `0xcffa8`[루] + rand(0,9)(2 이하 → 3) 틱, 나머지는 `0xcffb0`[루] 틱 몰아 돌린다.
   * 안 주면 아무도 출발 안 했다.
   */
  readonly stealingFrom?: readonly number[]
  /**
   * 장면 +0xfdc — 이번 투구의 번트 종류(0 = 없음). 서 있으면 도루 안 한 주자 리드가 +3 틱(`0x3d7b8`).
   * 부르는 쪽이 싣는다 — 타자편 `gameFlow.defensePlayInputOf`(타석 화면 넷째 인자) · 투수편 `pitcherGameFlow`(`thrown.buntKind`). 안 주면 0.
   */
  readonly buntKind?: number
  /**
   * **첫 야수가 쥐지 못하는 타구** — 필살타법이 성공한 타구 (0x51800, S13 6절 확정).
   *
   * 원본은 확률 굴림에 성공하면 공 객체(`[경기+0x204]`)의 속성 목록 `+0x5c` 에
   * `0xaf180(목록, 4, 0, −1)` 로 **속성 4 = 필살타법 표시**를 단다(이 속성을 다는 곳은 0x51408 안 51812 · 518b8 뿐 — 송구 공에는
   * 달리지 않는다). 야수는 포구 틱에 그 속성을 보고(0xb41c6 목록.vt24(4)) 펌블 굴림(b4224) 뒤 b4246 에서 속성을 떼고(b425e 목록.vt1c(4))
   * 메시지 `0xbc3`(필살타법 공 맞음 — 송구 받기가 아니다. 보통 공·송구 공을 받는 것은 b42c8 쥐기 0xb2710)만 보낸 뒤 **쥐기(0xb2710)로 가지 않고** 사건(sp+0x24) = 1 이 된다(b4250). 그 `0xbc3` 은
   * 전용 처리기가 없고, 틱 끝 b45a0 의 사건 갈래가 플레이.vt70 = 0xb3148 로 공을 그 야수에게서 튕겨 다시 쏜다 —
   * 다시 쏜 공은 0xa2610 이 속성 목록을 비워 보통 공이라 새 예보의 야수가 줍는다 (`relaunchFromFielder`).
   */
  readonly isUncatchable?: boolean
  /**
   * **state[0x19] — 투구 판정 0.1% 사건** (0x3e04e: 상태 0x12 진입 0x3dfac 가 0x35034 = `모드 ≠ 7 && rand(0, 10000) < cfg+0x2e(10)` 를 적는다).
   * 서 있으면 판 끝 결과 코드 0x9d5bc 가 0(9d5ce)이라 낙구·담장선 틱에 사건 코드가 안 난다. 굴림은 투구 흐름 쪽 자리라
   * 부르는 쪽이 실어 보낸다 — 안 주면 0(지금까지와 같다). 이 사건이 화면에 무엇인지는 미확인(P2 6절).
   */
  readonly specialEvent?: boolean
  /**
   * **state[4] — 이 공을 먹이기 전의 스트라이크 수**. 파울 판에서만 본다: 판 끝 결과 코드 0x9d5bc 의 2스트라이크 번트 파울(11)과
   * 판이 닫힌 뒤 0x35108 → 0xb6b58 의 스트라이크 +1(≤ 1 일 때, `foulStrikesAfter`). 안 주면 0.
   */
  readonly strikes?: number
  readonly maximumTicks?: number
  /**
   * 난수. **주면 원본 확률 굴림이 돈다** — 필살수비(0x66b30/0x66be4) · 펌블(0xb41d0) ·
   * 악송구(0xa1828) · 레이저 송구(0x66a8c). 안 주면 하나도 굴리지 않아 지금까지와 똑같이 결정론이다.
   */
  readonly random?: RandomPort
  /** 수비 9명의 스킬 번호 (칸 순서). 21(초감각)이면 필살수비·레이저 확률 +3%p */
  readonly fielderSkillIds?: readonly (readonly number[])[]
  /** 전역 모드 0x1552d10 — 7(홈런더비)이면 필살수비를 안 굴리고, 4(나리 타자편)면 기준이 절반이다 */
  readonly gameMode?: number
  /**
   * **수비를 CPU 가 맡았는가** — 협살(AI 상태 8)은 `state[0x31 + 수비측] == 1` 일 때만 시작한다
   * (S8 1-4, 확정). 사람이 수비하면 원본에서도 협살이 절대 안 일어난다 — 원본 버그 B-11. 고친 길(`isBugFixed('B-11')`)은
   * 이 값과 상관없이 협살을 건다(사람 수비면 포스로 밀려 가는 주자 0xb1b54 는 빼고).
   *
   * 안 주면 **안 도는 쪽**으로 둔다. 원본은 경기 상태가 늘 답을 알지만 이 진행기는 부르는 쪽이
   * 말해 줘야 알 수 있어서, 모르면 시작하지 않는 쪽이 안전하다.
   */
  readonly defenseIsCpu?: boolean
  /**
   * **공격을 CPU 가 맡았는가** — 자동 주루 제어기를 켜는 조건의 한쪽이다.
   * 원본 `0xae690(x, 설정+0xbd)` 의 앞 항: `경기[0x31 + 경기[9](공격측)] == 1` (확정, 아래 참고).
   *
   * 안 주면 `false`(사람 공격)로 둔다 — 그러면 `runningMode` 혼자가 답을 정한다.
   */
  readonly offenseIsCpu?: boolean
  /**
   * **주루 수동/자동** (환경설정 옵션 +0xbd, 기본 자동). 안 주면 자동이다.
   *
   * 원본 배선(직접 뜬 것, 매 틱 도는 경기 장면 슬롯 2 = `0x524c0` 안):
   * ```
   * 5261c: 설정 = 0x1f1d8([0x1400054])
   * 52628: r1 = 설정+0xbd                         ; 주루 수동(0)/자동(1)
   * 5262e: bl 0xae690([장면+0x214], r1)
   *        ae692~ae6be: r2 = [x+0x174](= 경기) ; 공격측 = 경기[9]
   *                     반환 = (경기[0x31 + 공격측] == 1)  ||  (설정+0xbd != 0)
   * 52638: 그 값이 0 이면 → 플레이+0x111(홈런 코드 8)·+0x129(폴 홈런 코드 12) 를 보고, 종류 7(바운드 2루타 코드 10)이면 그래도 돈다
   * 52660: 0xaf8c0(제어기 = 장면+0x210, 0)        ; = 제어기.vt8 = 0xaf918 자동 추가 진루
   * ```
   * 곧 **"공격이 CPU 거나 설정이 자동이면 자동 진루 제어기를 돌리고, 사람이 공격하면서 설정이
   * 수동이면 아예 안 돌린다"**. 예외 셋(플레이 끝남 +0x111 · +0x129 · 종류 7)은 수동이어도 돈다.
   *
   * ⚠️ `경기+0x24` 는 이 갈림과 **아무 상관이 없다** — 아래 `autoBaserunning` 주석 참고.
   */
  readonly runningMode?: ManualAutoMode
  /**
   * **송구 수동/자동** (환경설정 옵션 +0xf4, **원본 기본 0 = 수동**). 안 주면 수동이다.
   *
   * 원본 배선은 바로 위 주루 갈림(`0xae690`)과 **판박이**다. 같은 경기 장면 슬롯 2
   * (`0x524c0`, 매 틱) 안에서 주루 갈림 스물여섯 바이트 뒤에 붙어 있다 (직접 뜬 것):
   * ```
   * 52690: 설정 = 0x1f1d8([0x1400054])
   * 5269c: r3 = 설정+0xf4 ; r1 = [r3]              ; 송구 수동(0)/자동(1)
   * 526a4: bl 0xae6c8([장면+0x214], r1)
   *        ae6ca~ae6f6: r2 = [x+0x174](= 경기) ; 수비측 = 경기[0xa](부호 있는 바이트)
   *                     반환 = (경기[0x31 + 수비측] == 1)  ||  (설정+0xf4 != 0)
   * 526ac: 그 값이 0 이면 건너뛴다                  ; ★ 주루와 달리 예외가 하나도 없다
   * 526ae: 0xaf8e0(제어기 = 장면+0x210)             ; = 제어기.vt0xc = 0xafa60 CPU 송구 결정
   * ```
   * `0xae6c8` 은 `0xae690` 과 **오프셋 한 글자만 다른 쌍둥이**다 — `경기[9]`(공격측) 자리가
   * `경기[0xa]`(수비측)이고 나머지는 한 명령도 다르지 않다.
   *
   * 곧 **"수비가 CPU 거나 설정이 자동이면 CPU 송구 결정을 돌리고, 사람이 수비하면서 설정이
   * 수동이면 아예 안 돌린다"**.
   *
   * 그러면 사람 수비는 무엇으로 던지나 — **사람이 키를 누를 때만 던진다** (2026-10-06 확정, 직접 뜬 것).
   * 공을 내보내는 호출(플레이.vt58 = 0xb2c90 · vt5c = 0xb2e38)을 전부 따라가면:
   * - `0xafa60`(CPU 송구 결정): 위 슬롯 2 갈림 · 도루 시작 메시지 0x583(0x52222) · 결과 메시지 0xbba(0x51dae, 아래)
   * - 플레이 틱 vt4c `0xb45dc`: b4616 중계 이어 던지기(앞선 송구가 세운 +0x14c 계획) ·
   *   **b4660~b46a8 사람 목표 +0x160**(메시지 0x588 → vt0x60 `0xb3118`) · AI 상태 9(0xb2e38 이 미룬 송구) ·
   *   AI 상태 0xe(견제) — 모두 앞선 송구나 견제에서만 선다
   * - 협살 `0xb3a94`: CPU 수비 전용 (0xb4358)
   * - `0xb1c90`(플레이 vt0x30, 매 틱): **송구 호출이 없다**. 자동 가지(+0x160 = −1)가 고른 루는 0xb203a 뒤
   *   2루 커버/중계 야수 자리 잡기에만 쓰인다(c8649a3).
   * 곧 **사람 수비 + 수동 송구에서 키를 안 누르면 공 쥔 야수는 공을 들고 서 있다**. 예외는 결과 메시지
   * 0xbba 하나다 — 결과 코드 9·13(아웃)이 나면 0x51d40~0x51db4 가 수비 조작이 사람(0x33fe4)이든 CPU(0x3403c)든
   * `아웃 ≤ 2` 일 때 플레이+0x128 = 1 로 세우고 `0xafa60` 을 **한 번** 부른다(이 파일 6c 절).
   *
   * 정정: 예전 해독(S8 4-3 · I-controls 2b)의 "메시지 처리기 `0x509a0` 앞머리가 메시지마다 0xafa60 을 부른다" 는
   * **틀렸다**. 앞머리가 부르는 것은 `[장면+0x214]`(경기 로직, 생성 0xae1d8 · vtable **0xd84cc**)의 vt0xc =
   * **`0xae5f8` = `sub sp ; movs r0,#0 ; add sp ; bx lr` 빈 함수**다. 0xafa60 은 `[장면+0x210]`(제어기,
   * 생성 0xaf20c · vtable 0xd8554, 0x3ea84 가 +0x210 에 넣는다)의 vt0xc 이고 둘은 다른 객체다.
   * (메시지 받는 곳 = 장면+0x70, vt0xc 썽크 0x53138 이 this −= 0x70 뒤 0x509a0 으로 간다.)
   *
   * 배선: 사람이 수비하는 자리(`pitcherGameFlow` · `teamGameFlow` 수비 타석 · 투수편 미션)가
   * 이 칸을 넘기면 된다. 안 넘기면 원본 기본값(수동)이다.
   */
  readonly throwMode?: ManualAutoMode
  /** 사람 조작 (I-controls 0절 상태 0x17 표). 안 주면 전부 자동이다 */
  readonly controls?: DefensePlayControls
  /**
   * **앞 판에서 넘어온 수비 장면 연출 칸** (`defenseScene` — 결과 판 +0x1997~+0x1999 · 연출 단계 · deadly_effect 애니 · 줌).
   * 원본은 경기 장면 객체 칸이라 판마다 안 지워진다. 경기 흐름이 앞 판 결과의 `scene` 을 넘긴다 — 안 주면 경기 첫 판(장면을
   * 막 만든 상태)이다. 진행(아웃 · 진루 · 난수)에는 안 닿고 그림 · 필살송구 아웃 기록(state[0x8b])에만 닿는다.
   */
  readonly scene?: DefenseScene

  // ── 아래 셋은 **그림에만 쓰인다** — 진행(아웃·진루·난수)에는 한 톨도 안 닿는다 ──

  /**
   * 수비 칸별 **마선수 번호 0~4** (마선수가 아닌 칸은 null·undefined). 안 주면 아홉 칸 모두
   * 보통 수비수 그림(`defender.pzx`)이다.
   *
   * 번호는 `0xb63a0(선수)` = 마선수(레코드 `+0xa` 비트6)면 `+0xa & 0x1f`, 아니면 −1 이다.
   * 타자 마선수 다섯의 그림 이름은 표 `0xd3f0c`("ace/defender_medica", 20바이트 간격 — 읽는 함수 0x79a5c · 0x79cbc, R3 7-1)에서 고른다:
   * 0 메디카 · 1 어거지죠 · 2 로제 · 3 크라이져 · 4 킹타이거.
   *
   * **원본 그대로**: 원본은 타자 마선수 그림을 **팀당 첫 한 명만** 적재해 놓고 그리는 쪽
   * (`0x79b48` 의 b 갈래)은 "그 칸 선수가 마선수인가" 만 보므로, 한 팀에 타자 마선수가 둘 이상이면
   * 둘째부터도 첫째의 그림으로 나온다(R3 7-3). 그 버그를 되살리려면 **부르는 쪽이** 마선수인 칸에
   * 전부 같은(첫째의) 번호를 넣어 주면 된다 — 여기서 고쳐 주지 않는다.
   * (`defensePlayView.aceIndexesWithOriginalBug` 가 그 일을 한 번에 해 준다.)
   *
   * 칸 0(투수)은 표가 다르다 — 투수 마선수 그림 `0xd4008`(38장)은 `+17` 을 안 쓴다.
   * 그 갈림은 `pages/defense/lib/defenseView.fielderSpriteOf` 가 칸 0 인지로 이미 처리한다(S12 8-2).
   */
  readonly aceIndexes?: readonly (number | null | undefined)[]
  /** 수비 팀 번호 0~14 — 야수 그림 팔레트 `defender.mpl` (C-1, 15색) */
  readonly defenseTeamIndex?: number
  /** 야수 +0xec — 칸별 선수 레코드(판 시작 뒤 값, `entities/fielding/model/fielderRecords`). 그림이 야수마다 싣는다. 안 주면 싣지 않는다 */
  readonly fielderRecords?: readonly (FielderRecordSeat | null)[]
  /** 공격 팀 번호 0~14 — 주자 그림 팔레트 */
  readonly offenseTeamIndex?: number
  /**
   * 수비 칸별 **이름 판에 적을 선수** (0x43cb0 의 오른쪽 아래 판). 칸 0 은 지금 마운드 투수(이름 + 보직 +0xb & 3),
   * 칸 1~8 은 그 칸 야수(이름 + 수비 코드 +0x1c & 0xf). 안 주면 고리만 그리고 판은 없다.
   */
  readonly fielderPlates?: readonly (HolderPlate | null | undefined)[]
  /**
   * 공격 팀 주자 · 타자의 **마선수 번호** (타자 마선수 0~4) — 주자 그림 0x79d10 이 마선수 그림으로 그린다(`runnerAces` 머리말).
   * 안 주면 모두 보통 주자 그림이다.
   */
  readonly runnerAces?: RunnerAces
  /**
   * 경기 +0x199a — 큰 타구 감상 플래그(0x392ac, 상태 0x13 이 세운다). 수비 화면 공 그리기 0x36dfc 가 서 있는 동안
   * 판 종류 1 · 8 이면 그림마다 큰 타구 파티클을 쏜다. 안 주면 이 판의 타구(결과 코드 · 궤적 폴 틱 · 거리 눈금)로 0x392ac 를 다시 본다
   * — 0x13 과 같은 공이라 같은 값이다.
   */
  readonly bigHitWatch?: boolean
}

/** 0x392ac — 판 입력의 타구로 큰 타구 감상 플래그를 본다 (`bigHitWatch` 를 안 준 판) */
function bigHitWatchOf(input: Pick<DefensePlayInput, 'outcome' | 'trajectory'>): boolean {
  return isBigHitWatch({
    resultCode: contactOfOutcome(input.outcome)?.resultCode ?? null,
    poleTick: input.trajectory.poleTick,
    carryScale: input.trajectory.carryScale ?? 0,
  })
}

/** `defenseAbilitiesOf` 가 받는 수비 한 명 */
export interface DefenseLineupPlayer {
  /**
   * 수비 자리 코드 = 선수 레코드 `+0x1c & 0xf` (1 지명 · 2 포수 · 3 1루 · 4 2루 · 5 3루 ·
   * 6 유격 · 7 1루 쪽 외야 · 8 3루 쪽 외야 · 9 중견). **수비 칸 = 코드 − 1** 이고
   * 칸 0(투수)은 이 표에서 빠진다 (0xb103e~0xb105e · 0xb1048).
   */
  readonly position?: number
  /** 경기용 능력치 칸 2 — 타자 레코드면 수비 (0xb570c(팀, 2, 선수, 90, 1), I-controls 1a) */
  readonly defense: number
}

/**
 * 타순에 선 선수들을 **수비 칸 9개**(0 투수 … 8 중견)의 능력치 배열로 옮긴다.
 *
 * 칸 0(투수)은 판 시작 0xb0fb4 가 **선수를 찾지 않는다**(b1032 — `fielderAbilityOf` 주석). 그래서 송구 속도 g = 2 ·
 * 악송구 보정 8 로 고정이고 송구 쪽은 이 칸의 값을 읽지 않는다. 대신 공수 교대 판 0x3fac4 가 칸 0 의 +0xec 에 **지명타자**
 * (니블 1)를 넣어 펌블 · 레이저 굴림이 그 수비를 본다 — 칸 0 에는 지명타자의 수비를 넣는다(`recordPlayerAbilityOf`). 진행기는 이 값을
 * 장면이 든 +0xec(마지막 교대 판의 레코드, 판이 없었으면 null — `entities/fielding/model/fielderRecords`)로 덮어 넘긴다.
 * (예전 웹은 마운드 투수의 능력치 칸 2(투수 레코드에서는 변화)를 넣었다 — 원본에 없는 길이라 걷었다.)
 *
 * 자리 코드가 없거나 겹치는 칸은 원본 평균대(등급 3 = 500)로 둔다.
 */
export function defenseAbilitiesOf(lineup: readonly DefenseLineupPlayer[]): number[] {
  const abilities = Array.from({ length: FIELDER_COUNT }, () => DEFAULT_ABILITY)
  const filled = Array.from({ length: FIELDER_COUNT }, () => false)
  for (const player of lineup) {
    const code = (player.position ?? 0) & 0xf
    // 칸 0 은 니블 1(지명타자) — 공수 교대 판 0x3fac4 의 고리(3fe28~3fe4c)는 칸 0 도 같은 식으로 찾는다
    const slot = code - 1
    if (slot < 0 || slot >= FIELDER_COUNT) continue
    if (filled[slot]) continue
    abilities[slot] = player.defense
    filled[slot] = true
  }
  return abilities
}

/**
 * 수비 아홉 칸의 **스킬 번호** (`fielderSkillIds`) — 칸을 고르는 법은 `defenseAbilitiesOf` 와 같다(자리 코드 − 1 칸, 겹치면 앞 선수,
 * 칸 0 은 니블 1 = 지명타자). 레이저 굴림 0x66a8c(66ad4~66aee)와 필살수비 0x66b30 · 0x66be4 는 야수 +0xec 레코드에
 * `0xb62b4(선수, 0x15)`(초감각)를 묻는다 — 그 레코드가 이 칸 고르기로 앉은 선수다. 선수가 없는 칸은 빈 목록이다
 * (0x66a8c 는 +0xec 가 비면 굴리지 않는다 — 66aa6).
 */
export function defenseSkillIdsOf(
  lineup: readonly { readonly position?: number; readonly skillIds: readonly number[] }[],
): (readonly number[])[] {
  const skills: (readonly number[])[] = Array.from({ length: FIELDER_COUNT }, () => [])
  const filled = Array.from({ length: FIELDER_COUNT }, () => false)
  for (const player of lineup) {
    const slot = ((player.position ?? 0) & 0xf) - 1
    if (slot < 0 || slot >= FIELDER_COUNT || filled[slot]) continue
    skills[slot] = player.skillIds
    filled[slot] = true
  }
  return skills
}

/**
 * 수비 아홉 칸의 **이름 판 선수** (`fielderPlates`) — 칸을 고르는 법은 `defenseAbilitiesOf` 와 같다
 * (자리 코드 − 1 칸, 겹치면 앞 선수). 칸 0 은 지금 마운드 투수다.
 */
export function defenseFielderPlatesOf(
  lineup: readonly { readonly name: string; readonly position?: number }[],
  pitcher: { readonly name: string; readonly role?: number } | undefined,
): (HolderPlate | null)[] {
  const plates: (HolderPlate | null)[] = Array.from({ length: FIELDER_COUNT }, () => null)
  if (pitcher !== undefined) plates[0] = { name: pitcher.name, pitcherRole: pitcher.role }
  for (const player of lineup) {
    const code = (player.position ?? 0) & 0xf
    const slot = code - 1
    if (slot < 1 || slot >= FIELDER_COUNT) continue
    if (plates[slot] !== null) continue
    plates[slot] = { name: player.name, positionCode: code }
  }
  return plates
}

/** 이번 틱에 눌린 키 한 개 — 경기 장면 `this+0x38` 에 해당한다 */
export interface DefenseKeyPress {
  /** `KeyboardEvent.key` 그대로 (`defenseKeys.ts` 가 원본 키로 옮긴다) */
  readonly key: string
  /**
   * 누르고 있는 중인가. 레이저 확정은 **새로 누른 키만** 받는다
   * (0x4e858 `this+0x6c & 0xf == 0` = 키 반복 계수 0).
   */
  readonly isRepeat?: boolean
  /**
   * 같은 틀에 이 누름 **뒤에** 오는 되풀이 [장면+0x50] — 키 분배 0x498d4 는 사람 조작 객체마다 이 틀의 누름 [+0x40](49a3a~49a52,
   * 표시 0) → 되풀이 [+0x50](49a56~49a76, 표시 [+0x6c]) → 뗌 [+0x54](49a7a~) 차례로 vtable[2](0x536bc)에 보낸다. 앞 키를 누르고
   * 있는 채 새 키를 누른 틀이면 둘 다 0x53420 에 간다(`framePressesOf`)
   */
  readonly thenRepeat?: DefenseKeyPress
}

/** 한 틀의 키를 0x498d4 차례대로 — 누름 [+0x40] → 되풀이 [+0x50] (`DefenseKeyPress.thenRepeat`) */
export function framePressesOf(press: DefenseKeyPress | null): readonly DefenseKeyPress[] {
  if (press === null) return []
  return press.thenRepeat === undefined ? [press] : [press, press.thenRepeat]
}

/**
 * 사람 조작 — 화면이 틱마다 "이번 틱에 눌린 키" 를 넘겨 준다.
 * 원본은 경기 장면이 매 틱 키를 담고 조작 객체 0x536bc 가 상태 0x17 갈래(0x53420)로 가른다.
 */
export interface DefensePlayControls {
  /** 조작 객체 `[+0xc]` — 0 공격(주루) / 1 수비(송구·레이저) */
  readonly side: ControlSide
  /** 이 틱에 눌린 키. 없으면 null */
  keyAt(tick: number): DefenseKeyPress | null
}

export interface DefensePlayResult {
  /** `baseState.advanceRunners` 와 같은 모양 — 그대로 경기 상태에 넣을 수 있다 */
  readonly advance: AdvanceResult
  /** 매 틱의 화면 스냅샷 (`pages/defense` 가 그대로 그린다) */
  readonly ticks: readonly DefensePlayView[]
  /** 공을 쫓은 야수 칸. 잡히지 않는 타구면 "닿기만 한" 야수다 */
  readonly catchFielderSlot: number
  /** 포구 틱. 잡히지 않는 타구면 야수가 공에 닿은 틱이다 */
  readonly catchTick: number
  /** 필살타법 성공으로 아무도 잡지 못한 타구인가 (0x51800) */
  readonly isUncatchable: boolean
  /** 뜬공을 뜬 채로 잡았는가 — 원본 state[0x1f](쥐기의 아웃 판정이 타자주자를 뜬공 아웃으로 죽였다) */
  readonly caughtOnTheFly: boolean
  /**
   * **판 끝 정산 0xa8024 가 타자에게 적는 결과** — 안타 루타 · 홈런(담장 · 그라운드) · 아웃 (`playOutcome`).
   * 타구 판(`runDefensePlay`)만 낸다 — 견제·도루·폭투 판처럼 타석이 아닌 판에는 없다.
   */
  readonly outcome?: AtBatOutcome
  /**
   * **파울로 닫힌 판인가** — 판 끝 결과 코드 7(0x9d5bc 의 0xb68dc 파울 각 갈래)이 선 판. 판 끝 판정 B 0xae3e8 ae568 이 정산 0xa8024 를
   * 건너뛰고(ae5a2 → ae5b6) 상태 0xf(같은 타석 다음 공)로 보낸다 — `outcome` 이 없고, 0x35108 의 0xa975c 가 주자를 판 앞 자리로
   * 되돌리며(웹 `advance` 는 판 앞 루 그대로) 0xb6b58 이 스트라이크 ≤ 1 이면 +1 한다(`foulStrikes`). 파울 각 공이라도 낙구 전에 잡히면
   * 뜬공 아웃(13)이라 파울 판이 아니다.
   */
  readonly foulEnded?: boolean
  /** 파울 판이 닫힌 뒤의 스트라이크 수 — 0xb6b58 (`strikesAfterPlay`). 파울 판이 아니면 없다 */
  readonly foulStrikes?: number
  /**
   * **2스트라이크 번트 파울 아웃으로 닫힌 판인가** — 판 끝 결과 코드 11(0x9d5bc: 파울 각 · state[4] > 1 · 번트)이 선 판.
   * vt44(11) → vt90 머리 b373a 가 타자주자(+0x98)를 끝내고(+0x96) state[6]++ 하며, 메시지 0xbba(11) → 0x51b20 이 아웃 사건
   * 0xd(0xa7d0c)와 아웃 콜 62(조건 없음)를 낸다. 관문 b0db4 가 다음 틱에 닫고 0xae3e8 ae560 이 정산(0xd)한다 — `outcome` 은 아웃이다.
   * 콜을 고르는 쪽(`atBatSounds.inPlayCallSoundIdOf` 의 `buntFoulOut`)이 62 로 고정한다.
   */
  readonly buntFoulOut?: boolean
  /** **번트 타구였나** — state[0x13](= 장면 +0xfdc, 타구 시작 0x511da 가 옮긴다) ≠ 0. 입력 `buntKind` 그대로다 */
  readonly buntBall?: boolean
  /**
   * **희생 [sp+8]** — 정산 a83e2 ~ a8472(`playOutcome.isSacrificeOf`). 정산이 이 칸으로 타수를 빼고(a884c), 번트 타구면
   * a88e0 이 결과비트 B6(0x40)을 켠다(`burstResultBits` 의 `runnersAdvanced`). 파울로 닫힌 판은 정산이 없어 없다
   */
  readonly sacrifice?: boolean
  /**
   * **판 끝에 2·3루에 (타자주자가 아닌) 산 주자가 있나** — 정산 B7 루프 0xa88fc 의 주자 조건 (`scoringBaseRunnerAfterOf`).
   * 파울로 닫힌 판(정산 없음)은 없다
   */
  readonly scoringBaseRunnerAfter?: boolean
  /**
   * **그라운드 홈런 state[0x25]** — 주자 틱 0xaa0a8 이 홈에 막 닿은 주자(+0x8c == 4)가 이번 타자(+0x98)이고 담장 홈런 state[0x1d](코드 8) ·
   * 폴 홈런 state[0xf](코드 12)가 둘 다 0 일 때만 세운다(aa1e2~aa1fe — 바로 득점 · 보류 둘 다). 정산 a84cc~a84e8 이 이때만 미션
   * 그라운드홈런 칸 R+0xcc(사건 4)를 올린다. 담장을 넘긴 홈런은 타자주자가 홈을 돌아도 서지 않는다.
   */
  readonly groundHomeRun?: boolean
  /**
   * **아웃 판정(0xb36d0)이 마지막으로 적은 아웃이 태그였나** — 원본 `state[0x87]`.
   *
   * 아웃 콜을 62("잡아서·태그해서 낸 아웃")로 낼지 20(루에서 잡은 포스 아웃)으로 낼지를
   * 가르는 칸이다 (`play-at-bat/model/atBatSounds.ts` 의 `inPlayCallSoundIdOf`).
   *
   * **"한 번이라도" 가 아니라 "마지막 판정" 이다** — 근거는 `runOutJudgement` 주석에 적었다.
   * 쓰는 자리는 원본 판정을 옮긴 두 곳뿐이다: `runOutJudgement` 와 협살 태그.
   */
  readonly tagOut: boolean
  /** **첫** 송구의 목표 루(사람 키든 CPU 결정이든). −1 이면 안 던졌다 */
  readonly throwBase: number
  /** 첫 송구의 도착 틱. 송구가 없으면 −1 */
  readonly throwArrivalTick: number
  /**
   * **결과 코드 9 의 메시지가 마지막으로 간 판 틱** — 플레이 틱 b43ec~b444c(공 쥔 야수 H 의 목표점이 루 b · 그 루에 선 아웃 아닌 주자 R ·
   * H 가 목표점에 있음(vt18) · H+0x3b(막 닿음) · H+0xe0(쥠) · R 도 목표점(vt18) → [sp+0x38] = 9)에서 9 가 서고, 6d 절 0x9d5bc 와
   * b4540 의 13 에 덮이지 않아 b4562 가 메시지 0xbba(9)를 보낸 틱이다 — 그 메시지의 0x51c14 가 "Safe!" 17 을 낸다(`judgeCall`).
   * 없으면 −1. 화면이 판을 돌리지 않은 판의 콜(`atBatSounds.inPlayCallSoundIdOf`)이 이 칸으로 17 을 가른다.
   * 타구 판만 싣는다 — 주자 판(견제 · 도루 · 폭투)은 콜을 판 결과의 `callSoundId` 로 따로 낸다
   */
  readonly safeCallTick?: number
  /** 보류됐다가 3아웃으로 날아간 득점 수 (state[0]) */
  readonly voidedRuns: number
  /** 펌블(에러)이 났는가 — 0xb41d0 굴림 (`random` 을 줘야 돈다) */
  readonly fumbled: boolean
  /** 악송구가 났는가 — 0xa1828 굴림 */
  readonly errantThrow: boolean
  /** 필살수비 창이 열렸는가 — 0x66b30(점프) / 0x66be4(슬라이딩). 열려도 보통 포구가 되면 안 쓰인다 */
  readonly specialDefense: { readonly jumpUnlocked: boolean; readonly slideUnlocked: boolean }
  /** 사람이 반짝임 창 안에 키를 넣어 레이저 송구가 나갔는가 (플레이+0x1f4) */
  readonly laserThrow: boolean
  /**
   * **state[0x8b] — 정산 0xa8024 가 보는 필살송구 아웃 표시.** 결과 판 0x46844 가 큰 OUT 을 그리며 +0x1999 를 보고 세운다
   * (46922~46932, 레이저 연출 단계 3 뒤 코드 13 결과 판). 판 끝 정산이 이 판 아웃 사건 > 0 이면 기록 36 (`laserThrowOutRecordOf`).
   * 앞 판에서 남은 +0x1998 · +0x1999(`scene`)로도 선다.
   */
  readonly laserOutFlag: boolean
  /** 판이 끝났을 때의 수비 장면 연출 칸 — 다음 판의 입력 `scene` 으로 넘긴다 */
  readonly scene: DefenseScene
  /**
   * 협살(AI 상태 8)이 몇 번 걸렸는가 — 0xb3a94. `defenseIsCpu` 를 줘야 돈다.
   * 진행기를 안 돌린 결과(견제 · 도루 · 폭투 판의 다른 진행기)에는 없다.
   */
  readonly rundowns?: number
  /** 협살로 잡은 아웃 수 */
  readonly rundownOuts?: number
  /**
   * **주자 목록의 운명** — 원본 목록 순서 그대로(`[타자주자?, 1루?, 2루?, 3루?]`, `runnerFates.ts` 머리말).
   * 정산 `0xa8024` 가 읽는 +0x95(득점)·+0x96(처리 끝)을 옮긴 것이라 R+0x128(실점)·R+0x130(출루 허용)을
   * 원본대로 셀 수 있다 (`chargedRunsOfFates` · `baserunnerAllowedOfFates`).
   * 점수판 득점(`advance.runsScored`)과 달리 **3아웃으로 날아간 보류 득점의 주자도 `scored` 다**.
   */
  readonly runnerFates: readonly RunnerFate[]
  /** 사람이 읽을 진행 기록 — 테스트가 "왜 그렇게 됐나" 를 확인할 때 쓴다 */
  readonly log: readonly string[]
}

/**
 * **쏜 패턴 없이 결과만 들고 온 호출**(시험·옛 화면)이 판을 돌릴 결과인가 — 안타·아웃.
 *
 * 실제 타석은 쏜 패턴이 결과 객체에 묶여 와 홈런까지 판을 돈다(`playOutcome.isBattedBallKind`). 패턴 없이 온 홈런은
 * 점수를 타석 쪽 규칙(옛 길)으로 정하고, 재생거리만 `homeRunPlayback.ts` 가 원본 패턴으로 같은 판을 돌려 만든다.
 */
export function isBattedBallInPlay(outcome: AtBatOutcome): boolean {
  return outcome.kind === '안타' || outcome.kind === '아웃'
}

/** 진행기 안에서 **제자리에서 바뀌는** 주자 한 명 */
export interface MutableRunner {
  state: RunnerState
  /** 최소 진루 루 — 포스 사슬이 정한다(타자주자는 1루) (`createPlayRunners`) */
  minimumBase: number
  /**
   * 원본 `+0x84` — 직전의 `+0x7c`(달려가던 루). a07b0 vt48 이 목표를 바꿀 때 옛 +0x7c 를 옮기고, 도착 0xa040c 가
   * `+0x84 = +0x8c = +0x7c` 로 적는다. 판 끝 정산 0xa8024 가 타자주자에게 "1루를 넘봤나" 로 읽는다(`playOutcome`)
   */
  previousTarget: number
  /** 이미 득점 처리를 했는가 */
  counted: boolean
  /**
   * 주자 +0x3b — 마지막 목록 틱(6 절 이동)에서 목표점에 막 닿았다. 주자 틱 0xa01cc(a0364 → 0xbf094 bf0a2)가 목록 틱마다 지우고
   * 이동 0xbf0dc 가 닿은 갱신에서만 세운다. 득점 0xaa0a8(aa12a)은 이것이 선 주자만 센다
   */
  arrivedThisListTick: boolean
}

/**
 * 주자들을 세우면서 **포스 사슬**을 잇는다 — 이 진행기의 포스는 `0xaf918`(자동 진루 제어기)이 아니다.
 *
 * 원본에는 "이 타구는 2루타" 같은 결과 코드가 없다. 타자주자가 2루까지 가면 그게 2루타다.
 * 그래서 원본의 포스 사슬 머리는 **언제나 "타자주자가 1루로 간다"** 한 칸이고,
 * 그 뒤는 루가 이어 차 있는 만큼만 밀린다. 그리고 원본은 **한 루에 산 주자를 둘 놓지 않는다** —
 * "루 b 의 주자" `0xa97a0` 이 `+0x8c`(목표 루) == b 인 주자를 **하나만** 집어 오고,
 * 주루 키의 앞길·뒷길 검사(`0xa99a8` · `0xa9924`, 0xa9b04 에서 부른다)가 겹치는 루로는 못 보낸다 (I 3b).
 *
 * 그래서 **최소 진루 루 = min(홈, max(출발 루, 1 + 목록 번호))** 로 잇는다. 목록은 타자주자(0)부터
 * 앞선 주자 쪽으로 빈 루를 건너뛰며 쌓이므로, 번호 k 는 "타자주자 앞으로 k 번째 주자" 다. 목록은 오름차순이라
 * `출발루[k] ≥ k` 이고, 밀리는 조건 `1 + k > 출발루[k]` 는 `출발루[k] == k`, 곧
 * "1루부터 내 앞까지 빈 루 없이 차 있다" 와 같은 말이다(0xa9f60).
 * (예전 웹은 타석 결과 코드가 준 최소 루 M(2·3루타)을 사슬 머리로 썼다 — 결과를 먼저 정한 웹 다리라 걷었다.)
 *
 * 포스로 밀리는(최소 루가 출발 루보다 큰) 주자만 첫 틱부터 뛴다.
 * 나머지는 루에 붙어 있다가 자동 진루(0xaf918)가 보내 준다 — 그쪽은 **주루 수동이면 안 돈다**.
 */
function createPlayRunners(
  bases: BaseState,
  speedOf: (fromBase: number) => number,
  firstBaseException: FirstBaseException | null = null,
): MutableRunner[] {
  // 포스 사슬 머리 — 타자주자는 1루로 간다 (0xa93ac 가 +0x88 = 1)
  const batterMinimum = 1
  // 0 = 타자주자. 그 뒤는 **뒤 주자 → 앞선 주자** 순서다 (자동 진루가 목록 끝부터 = 앞선 주자부터 본다)
  const fromBases = [0]
  if (bases.first) fromBases.push(1)
  if (bases.second) fromBases.push(2)
  if (bases.third) fromBases.push(3)
  const pushed = firstBaseException === null ? null : pushedRunnersWithFirstBaseException(fromBases, firstBaseException)
  return fromBases.map((fromBase, index) => {
    // 홈보다 더 갈 곳은 없다 — 사슬이 만루 + 3루타처럼 넘치면 전부 홈에서 멈춘다
    const chained = Math.min(HOME_BASE, Math.max(fromBase, batterMinimum + index))
    const minimumBase = pushed === null || index === 0 ? chained : pushed[index] ? fromBase + 1 : fromBase
    const targetBase = minimumBase > fromBase ? fromBase + 1 : fromBase
    return {
      state: createRunner(index, fromBase, speedOf(fromBase), { targetBase, isBatterRunner: index === 0 }),
      minimumBase,
      previousTarget: fromBase,
      counted: false,
      arrivedThisListTick: false,
    }
  })
}

/** `0xa9e44` 의 1루 주자 예외가 걸리는 판 — 2아웃 전 · 잡힐 뜬공(플레이.vt94) · 끝나지 않은 판 */
interface FirstBaseException {
  /** 0xa9bd4 가 출발 표시를 세운 주자의 루 — 그 주자의 +0x7c 는 이미 다음 루다 */
  readonly stealingFrom: readonly number[]
}

/**
 * **1루 주자 예외** — 주자관리.vt1c = `0xa9e44`(a9ed6~a9eea, 직접 뜬 것)를 타자주자 다음 주자부터 그대로 돈다.
 * ```
 * a9ec2  관리.vt10(i) = 0xa9f60(목록 0..i 산 주자 수 > +0x8c) || 아웃 == 2 || 도루 표시  가 아니면 건너뜀
 * a9ed6  +0x8c == 1 && 플레이.vt94() && !플레이+0x111 && 아웃 != 2  → 건너뜀            ; ★ 1루 주자 예외
 * a9eec  앞 주자(목록 i−1).+0x7c ≥ +0x8c  → +0x7c = +0x8c + 1 ; vt48(+0x8c + 1)          ; 밀린다
 * a9ef6  아니면 아웃 == 2 && 종류 == 1 → 같은 목표 / 아니면 건너뜀
 * ```
 * 플레이.vt94 = `0xb1b2c` 는 "가장 이른 포구 틱 +0x11c ≤ 공 낙구 틱" = 잡힐 뜬공이다(인자는 0x46516~0x4653e).
 * 곧 2아웃 전 잡힐 뜬공이면 1루 주자가 밀리지 않고, 그 앞 주자도 "앞 주자 +0x7c ≥ 내 루" 가 안 서서
 * 사슬이 끊긴다. 도루 표시가 선 1루 주자는 +0x7c 가 이미 2(0xa9bd4 → vt48)라 2루 주자는 그대로 밀린다.
 * 앞 주자의 +0x7c: 타자주자 = 1, 건너뛴 주자 = 제 루(vt88 0xa0820 이 +0x7c = +0x8c), 도루 주자 = 다음 루.
 * 이 갈래는 2아웃이 아닐 때만이라 웹의 결과 코드 다리(최소 루 M = 1, 뜬공 아웃)와 겹치는 곳은 이 함수뿐이다.
 */
function pushedRunnersWithFirstBaseException(fromBases: readonly number[], exception: FirstBaseException): boolean[] {
  const pushed = fromBases.map(() => false)
  let previousTarget = 1 // 타자주자 +0x7c
  for (let index = 1; index < fromBases.length; index += 1) {
    const base = fromBases[index]
    const stealing = exception.stealingFrom.includes(base)
    const forced = index + 1 > base // 0xa9f60: 목록 0..i 산 주자 수 > +0x8c
    let target = stealing ? base + 1 : base
    if ((forced || stealing) && base !== 1 && previousTarget >= base) {
      pushed[index] = true
      target = base + 1
    }
    previousTarget = target
  }
  return pushed
}

/**
 * 타구 판(종류 1)의 시작 위치 — `0x46418` 의 주자 고리(0x4657e~0x465aa)가 주자마다 부르는 `0x3d7b8`
 * (`entities/fielding/model/runnerLead`, 9976cb7 에서 직접 뜬 것).
 * - 도루 주자: 목표 = 다음 루(0xa9bd4 가 이미 세움) · `0xcffa8`[루](15·14·14) + rand(0,9)(2 이하 → 3) 틱 · 목표 그대로
 * - 그 밖: 다음 루로 `0xcffb0`[루](6·13·7) 틱(번트 종류가 서 있으면 +3) 간 뒤 목표를 **판 시작 때의 목표**로 되돌린다
 *   — 포스로 밀리는 주자는 다음 루, 아니면 제 루(돌아오는 중)
 * - 타자주자는 칸 0 이 0 틱이라 움직이지 않는다
 *
 * 리드 앞의 목표는 `0x4653e` 주자관리.vt1c = `0xa9e44`(직접 뜬 것)가 세운다 — 타자주자 다음 주자부터:
 * ```
 * a9e8a  도루 표시가 없으면 R.vt88() ; 0xbef1c(R,0) ; +0x98 = +0x94 = 0 ; +0x88 = +0x90 = +0x8c
 * a9ec2  관리.vt10(i)(0xa9f60 포스: 0..i 산 주자 수 > +0x8c) || 아웃 == 2 || 도루 표시 일 때만:
 * a9ed6    +0x8c == 1 && 플레이.vt94() && !플레이+0x111 && 아웃 != 2 → 건너뜀
 * a9eec    앞 주자 +0x7c ≥ +0x8c → +0x7c = +0x8c + 1 ; vt48(+0x8c + 1)        ; 밀린다
 * a9ef6    아니면 아웃 == 2 && 종류(state[0x26]) == 1 → 같은 목표              ; 2아웃이면 친 순간 뛴다
 * ```
 * 웹은 포스 사슬을 `createPlayRunners`(결과 코드 다리)가 세우므로 여기서는 **2아웃 갈래만** 더한다.
 * 1루 주자 예외(a9ed6)는 아웃 != 2 일 때만이라 2아웃 갈래와 안 겹친다 — `createPlayRunners` 가 받는다
 *    (`pushedRunnersWithFirstBaseException`). 인자 둘은 0x46516~0x4653e 가 넘긴다: 플레이.vt94 = `0xb1b2c`
 *    (+0x11c 가장 이른 포구 틱 ≤ 공+0xaa0 낙구 틱 — "뜬공이 잡힐 예정", autoAdvance 의 af98e 와 같은 함수) ·
 *    플레이+0x111(끝남, 판 시작이라 0). 웹은 잡힐 뜬공을 결과 코드(뜬공·직선타 아웃 = `onTheFly`)로 본다.
 * - 도루 표시 없는 주자의 R.vt88(+0x8c) = `0xa0820`: 루 좌표 0xd77d8[b] 에 세우고(0xbef58) +0x7c·+0x80·+0x88·+0x8c·+0x90 = b,
 *   +0x94 = 0, vt10(동작 0). 리드는 루 좌표에서 출발하므로(applyRunnerLead) 웹과 같다.
 * 정정: S8 6-3 의 "0x46418 의 주자 움직임은 0x46664 걷기 루프뿐" 은 이 고리를 놓친 것이다.
 */
function leadRunnersForBattedBall(runners: readonly MutableRunner[], input: DefensePlayInput): void {
  const stealing = input.stealingFrom ?? []
  const twoOuts = input.outs === 2
  for (const runner of runners) {
    const base = runner.state.startBase
    if (runner.state.isBatterRunner || base < 1 || base > 3) continue
    const isStealing = stealing.includes(base)
    // 0xa9bd4 → vt48(0xb6228) — 출발한 주자의 목표 루는 한 루 앞.
    // 0x4653e 주자관리.vt1c(0xa9e44): 2아웃이면 종류 1 에서 모든 주자에게 다음 루(+0x7c = +0x8c + 1 · vt48)
    // — 포스(0xa9f60)·도루가 아니어도 (a9eb4 r6 = 아웃 == 2 → a9efa 종류 1 갈래)
    const started =
      isStealing || (twoOuts && runner.state.targetBase === base)
        ? { ...runner.state, targetBase: stealTargetBaseOf(base) }
        : runner.state
    const lead = runnerLeadOf(started, {
      playKind: BATTED_BALL_PLAY_KIND,
      stealing: isStealing,
      buntKind: input.buntKind,
      random: input.random,
    })
    runner.state = applyRunnerLead(started, lead)
  }
}

/** 타구 판의 플레이 종류 (0x3e11a 이후 상태 0x13 → 0x17) */
const BATTED_BALL_PLAY_KIND = 1

/** 슬롯 2 머리 52546 — [sp+0x14] = 0xae61c(판 종류 ∉ 마스크 0x58c = 2 · 3 · 7 · 8 · 10)가 거짓이면 필살 포구 연출을 안 켠다 */
const DEADLY_FLASH_BLOCKED_PLAY_KINDS: readonly number[] = [2, 3, 7, 8, 10]

/**
 * **한 플레이가 도는 동안 바뀌는 것 전부** — 지금까지 `runDefensePlay` 루프 안의 `let` 변수였던 것들이다.
 *
 * 앞쪽(`input`~`specialDefense`)은 시작할 때 한 번 정해지고 끝까지 안 바뀌는 것,
 * 뒤쪽은 틱마다 바뀌는 것이다.
 *
 * ⚠️ **제자리에서 고친다**: `stepDefensePlay` 는 이 객체를 **그대로 고쳐 같은 객체를 돌려준다**.
 * 주자(`runners`)·기록(`ticks`·`log`)·동작 기억(`previousActions`)은 원래부터 제자리에서 바뀌던 것이라
 * 겉만 불변으로 꾸며 봐야 거짓말이 된다. **지난 상태를 들고 있지 말고 늘 돌려받은 것을 써라.**
 */
export interface DefensePlayState {
  // ── 시작할 때 정해지는 것 ──
  readonly input: DefensePlayInput
  trajectory: BattedBallTrajectory
  readonly abilities: readonly (number | null)[]
  readonly maximumTicks: number
  /** 아무도 잡지 못하는 타구인가 (필살타법 0x51800) */
  uncatchable: boolean
  /** 뜬 채로 잡히는 타구인가 */
  onTheFly: boolean
  /** 공을 쫓는 야수 칸 */
  chaserSlot: number
  /** 포구 지점 — 펌블로 포구 틱이 밀려도 **자리는 그대로다** (원본 그대로) */
  catchPoint: WorldPoint
  /** 루 커버 배정 (0xd85a8 + 0xb1e24) */
  readonly covers: readonly number[]
  readonly defenseIsCpu: boolean
  /** 필살수비 창 — 시작할 때 한 번만 굴린다 (0x66b30 / 0x66be4) */
  readonly specialDefense: { readonly jumpUnlocked: boolean; readonly slideUnlocked: boolean }
  /** 주자들 — **제자리에서 바뀐다** */
  readonly runners: readonly MutableRunner[]
  /** 매 틱 화면 스냅샷 — **제자리에서 쌓인다** */
  readonly ticks: DefensePlayView[]
  /** 진행 기록 — **제자리에서 쌓인다** */
  readonly log: string[]
  /** `actionTick` 을 세는 동작 기억 — **제자리에서 바뀐다** */
  readonly previousActions: ActionMemory

  // ── 틱마다 바뀌는 것 ──
  /** 다음에 돌릴 틱 번호 */
  tick: number
  fielders: readonly FielderState[]
  play: PlayView
  /** 2아웃 보류 득점 state[0] */
  held: HeldRunState
  outs: number
  outsAdded: number
  /** 지금(마지막) 송구의 목표 루 · 도착 틱 · 던진 야수 — 송구가 없었으면 −1 */
  throwBase: number
  throwArrivalTick: number
  throwFromSlot: number
  /** 공이 손을 떠난 틱 — 포구 틱에 던졌으면 포구 틱, 키·아웃 뒤에 던졌으면 그 틱. 송구가 없으면 −1 */
  throwReleaseTick: number
  /** 지금 송구를 받을 야수 (+0x154). 악송구면 −1 — 아무도 못 받는다 */
  throwReceiverSlot: number
  /** 이 판에서 나간 송구 수 — 받은 야수가 이어 던지면 2 이상이 된다 */
  throwCount: number
  /** 첫 송구의 목표 루 · 도착 틱 — 결과(`DefensePlayResult.throwBase`)로 내보낸다 */
  firstThrowBase: number
  firstThrowArrivalTick: number
  /** 결과 코드 9 의 메시지 0xbba 가 마지막으로 간 판 틱 (`DefensePlayResult.safeCallTick`). 없으면 −1 */
  safeCallTick: number
  /** state[0x1f] — 쥐기 0xb2710 의 아웃 판정이 타자주자를 뜬공 아웃(결과 1)으로 죽였다 */
  flyOut: boolean
  /** 판 끝 정산 0xa8024 가 세는 사건 — 6(안타 · 결과 코드 6·10) · 8(홈런 · 8·12)이 났나, 0xd(아웃 · 결과 코드 13) 몇 번 */
  hitEvent: boolean
  homeRunEvent: boolean
  outEvents: number
  /** state[0x25] — 타자주자가 판 안에서 홈을 밟았고 그때 홈런 사건(8 · 12)이 없었다 (0xaa1e2, `DefensePlayResult.groundHomeRun`) */
  groundHomeRun: boolean
  /** 포구 틱 — 펌블이 나면 15틱 뒤로 밀린다 */
  catchTick: number
  fumbled: boolean
  errantThrow: boolean
  /**
   * **경기+0x24** (전역 경기 구조체 `[0x1552d0c]` 의 바이트 한 칸) — "주자가 뛰는 중" 표시다.
   *
   * ⚠️ **자동 주루 스위치가 아니다.** `.text` 를 전부 훑어(오프셋 0x24 바이트 접근 24곳) 확인한
   * 쓰는 곳·읽는 곳 전부:
   *   - 쓰기 `0x3d960`(상태 0xf 진입 = 매 투구 시작) = 0, 같이 경기[0x14+i]·경기[0x90+i] 도 0
   *   - 쓰기 `0x4648a`(상태 0x17 진입 0x46418) = 설정+0xbd
   *   - 쓰기 `0x520b6`(진루 키 0x582) = 0 · `0x52240`(귀루 키 0x584) = 0 · `0x521dc`(도루) = 0
   *   - 쓰기 `0xa9b86`·`0xa9ba8`(0xa9b04 가 주자를 실제로 움직인 순간) = **1** · `0xa9c40`(0xa9bd4) = 1
   *   - **읽기는 딱 둘** — `0x3e0e6` 과 `0x521fa`. 그게 전부다.
   * `0x3e0e6` 은 상태 0x12 진입(공 도착·스윙 판정) 안이고, 하는 일은
   * "경기+0x24 ≠ 0 이고 (아웃 ≤ 1 또는 판정 ≠ 5) 이면 **플레이 종류 5(주자 움직임만) + 상태 0x17**",
   * 곧 **투구가 끝난 뒤 수비 화면을 열지 말지**를 가른다(S8 5-3 의 state[0x24] "도루 중"과 같은 칸).
   * `0x521fa` 는 도루 메시지 처리에서 경기[0x14+루]·경기[0x90+루] 를 세울지 가른다.
   * → **자동 진루 0xaf918 을 막는 곳은 한 군데도 없다.** 그 갈림은 `input.runningMode` 주석의
   *   `0xae690` 이다. 여기서는 원본이 세우고 지우는 칸을 그대로 들고만 있는다(읽는 쪽이 아직 없다 —
   *   웹판에는 "종류 5 로 수비 화면 열기" 가 없다).
   */
  autoBaserunning: boolean
  /** 주자관리+0x31c — 이번 플레이에서 이미 슬라이딩 효과음을 냈다 */
  slidingSoundPlayed: boolean
  /**
   * **방금 돈 틱에서 슬라이딩 효과음 10 을 낸다.** 진행기는 순수 함수라 소리를 못 내므로
   * 틱을 실제로 돌리는 수비 재생(`DefensePlayback`)이 이 칸을 보고 그 틱에 낸다.
   * 사람 키 0x5199c(+0x31c 잠금으로 한 플레이 한 번) · 자동 0x5268c(잠금 없음, 슬라이딩시킨 수 > 0) 둘 다 여기로 온다.
   */
  slidingSoundThisTick: boolean
  /**
   * **방금 돈 틱에서 필살타법 타구에 맞은 야수의 효과음 53 을 낸다.** 틱 끝 b4588 플레이.vt74 = 0xb3420 → 야수.vte4 = 0xa1e60 이
   * 자세 13 · +0xb4 = 15 뒤 a1e82 에서 **즉시 재생** 0x6ea6c(소리, 0x35, −1, 0) 한다(예약이 아니다). 진행기는 소리를 못 내므로
   * 수비 재생(`DefensePlayback`)이 이 칸을 보고 그 틱에 낸다.
   */
  hitStaggerSoundThisTick: boolean
  /**
   * 이번 틱의 메시지 0x13(주자 하나 홈인 — 점수판에 1점) 인자 차례 — 바로 득점 0xaa1b0 은 그 주자 칸(0 = 타자주자),
   * 보류 해제 0xaa39e 는 0x64(100). 수비 장면 득점 점수판(0x51fb8 → 0x52030 홈런 갈래 · 0x52074 보통 갈래)이 본다
   */
  runInsThisTick: readonly number[]
  /**
   * **방금 돈 틱의 소리 차례** — 진행기는 소리를 못 내므로 틱을 돌리는 수비 재생(`DefensePlayback`)이 이 차례대로 낸다.
   * 한 그림의 원본 차례(직접 뜸):
   * 1. 키 처리 0x498d4(52d9e) — OK 슬라이딩 0x585 → 0x518da → 0x5199c 의 10 (`sound`)
   * 2. 그림 머리 0x3f060(52e16) 카메라 3f17e — 메시지 0x13(타자주자) → 0x51fb8 함성 (`runIn`)
   * 3. 슬롯 2 플레이 틱 vt48(525e8) 꼬리 — b4562 결과 메시지 0xbba → 0x51a56 판정 콜(`judgeCall`, `sound`) → b4588 vt74 → 0xa1e60 의 53
   * 4. 슬롯 2 주자관리 vt18 0xaa0a8(525fc) — 바로 득점 aa1b0 · 보류 해제 aa39e 의 메시지 0x13 → 0x51fb8 함성 (`runIn`)
   * 5. 슬롯 2 자동 슬라이딩 0x52670 → 0x5268c 의 10 (`sound`)
   * 6. 건너뛰는 동안 52b26 의 0x3f060 카메라 3f17e (`runIn`) — 그 뒤 슬롯 2 꼬리 52b62 의 깊은 낙구 함성 60 (`deepLanding`)
   * 0xbfbac 는 큐가 아니라 받는 곳 vt+0xc 를 곧바로 부르므로(0xbfb78 bfb9a — 경기 장면 vtable 0xcfa30 +0xc = 0x509a0) 메시지 0x13 · 0xbba 의
   * 소리는 보낸 그 자리에서 난다. 펌블 함성 29 는 그리기 G3(0x4381a) 몫이라 여기 없다 — 화면이 그린 틱마다 낸다.
   */
  tickSounds: readonly DefenseTickSound[]
  /** 경기+0x19ad(반짝임) */
  laserShining: boolean
  /** **그림 전용** 야수 +0xb8(펌블 표시, 칸별) — 펌블 b4280 이 6, 야수 틱 a12da 가 잠금 없을 때 −1 */
  fumbleMarks: number[]
  /** **그림 전용** 야수 +0xc0(송구 실수 표시, 칸별) — 악송구 a1908 · 원바운드 a17fc · 예보 두 번째 패스 b188e 가 4, a12e6 이 −1 */
  throwErrorMarks: number[]
  /** 경기+0x19ae(레이저 확정) */
  laserConfirmed: boolean
  /** 경기+0x19af — 한 플레이에 한 번만 굴린다 */
  laserRolled: boolean
  /** 플레이+0x1f4(레이저 송구가 나갔다) */
  laserThrow: boolean
  /**
   * 플레이+0x1f4 — 레이저 발사 0x400bc 가 vt64(1) 로 세운 칸. 서 있으면 다음 송구 0xb2e38 이 b2f06 에서 레이저(vtb0 0xa222c)로
   * 던지고 vt64(0) 으로 내린다(내야 → 내야 송구 b2ee6 도 내린다).
   */
  laserArmed: boolean
  /**
   * **그림 전용** 장면 +0x1991 — 레이저 발사 0x400bc 가 세우고, 슬롯 2 의 5254c 가 포구 관문 0xb4c9d(동작 시작 틱 − 1 == 공 틱)에서
   * 내린다(그 그림의 필살 포구 켜기도 건너뛴다). 서 있으면 공 그리기 0x37076 이 잔상을 그린다
   */
  laserTrailOn: boolean
  /** **그림 전용** 지금 공 궤적의 t = 0 점(0xa25b1(공, 0)) — 판 시작 · 다시 쏘기 · 송구가 새 궤적을 깔 때마다 바뀐다 */
  ballSegmentStart: WorldPoint
  /** 장면 +0x1993 — 경기 멈춤. 0x400bc 가 세우고 연출 0x4403c 단계 1 · 0x441c4 · 0x44398 끝(그리기)이 내린다 */
  gamePaused: boolean
  /**
   * 수비 장면 연출 칸 (`defenseScene`) — 결과 판 0x46844 · 연출 단계 +0x1992(−1 일 때만 슬롯 2 머리 524c4 가 0x523bc · 0x4e858 ·
   * 0x400bc 를 돈다) · 레이저 0x4403c · 필살 포구 B 0x441c4 · C 0x44398 · 줌 펀치
   */
  scene: DefenseScene
  /** 플레이+0x1f7 — 필살 점프 캐치 동작이 걸렸다(0xd87f4 종류 3, b4178). 예보 vt34(0xb3b38) · B 끝이 내린다 */
  deadlyJumpArmed: boolean
  /** 플레이+0x1f8 — 필살 슬라이딩 캐치 동작이 걸렸다(종류 4, b4198). C · B 끝이 내린다 */
  deadlySlideArmed: boolean
  /** state[0x8b] — 결과 판이 큰 OUT 을 그리며 +0x1999 를 보고 세운다 (46932) */
  laserOutFlag: boolean
  /** 앞 틱 끝 G2 앞의 +0x120 (`PlayGateFrameResult.counterBeforeHead`) — 이 틱 머리에서 멈추면 G2 를 안 부른 것으로 되돌린다 */
  counterBeforeHead: number
  /** 협살 기록칸 P+0x1ec~+0x1f3 (0xb3a04). 대상이 −1 이면 협살 중이 아니다 */
  rundown: RundownPlan
  /** 협살 중 짝에게 던진 공이 닿는 틱. 없으면 −1 */
  rundownThrowArrival: number
  /** 그 공을 받을 야수 칸 */
  rundownThrowTo: number
  rundowns: number
  rundownOuts: number
  /** 원본 `state[0x87]` — 마지막 아웃 판정이 태그였나 (`runOutJudgement` 주석) */
  tagOut: boolean
  /** 플레이+0x126 — 판 시작 vt20(b11fe)이 1, 키스톤 야수가 중계 자리를 잡으면(b22f6) 0 */
  relayFlag: boolean
  /** 송구 계획 [4](+0x150) — 지금 계획이 중계([0] = 1)면 최종 받는 야수, 아니면 −1. 중계맨이 쥐면 b4616 이 그에게 던진다 */
  relayFinalSlot: number
  /** 그 중계의 목표 루 [7](+0x153) */
  relayBase: number
  /** +0x15c — 0xb2e38 이 송구를 미룰 때(AI 9) 적은 받을 야수 */
  deferredThrowReceiver: number
  /** +0x158 — 미룬 송구의 목표 루 */
  deferredThrowBase: number
  /** 플레이 +0x120 — 판 진행 관문 0xb0d28 의 판 끝 세기 (`passPlayGate`) — 한 그림에 서너 번 오른다(`passPlayGateBetweenTicks`) */
  endCounter: number
  /** 판을 닫은 관문 다음 그림의 G1(3f0b8)이 열렸나 — 그 목록 틱 a1330 이 +0xcc 를 하나 더 줄인다(`fielderSlackAtPlayEnd`, r196) */
  closingListTickOpen: boolean
  /**
   * 플레이 +0x13c[칸] — 마지막 예보 0xb12d0 이 아홉 칸에 같게 적은 움직임 허용(`CatchForecast.movable`, r196). 판 시작 예보는
   * vt24(1)이라 참이고, 송구 예보 vt24(0)(b307c)는 악송구 · 원바운드(공+0xaac)거나 두 번째 패스로 갈 때만 참이다
   */
  forecastMovable: boolean
  /**
   * 이 틱 그림의 그리기 쪽 관문(0x46e3c, G3) — HOMERUN 글자가 이것을 본다. 판 시작 전 · 건너뛰기(+0xfe7) 중엔 null.
   * 틱 끝 G2 와 다를 수 있다 — +0x120 세기로 닫히는 판은 G3 이 열리고 그 뒤 G1 · G2 에서 닫힐 수 있다.
   */
  drawGateOpen: boolean | null
  /**
   * 장면 +0xfe7 — 0x17 키 건너뛰기(0x519cc). 서면 판 끝까지(닫힌 뒤 +0x1094 11 번까지) 한 그림 안에서 돈다(52b26~52b40) —
   * 틱 사이 관문이 G1 · G2 둘뿐이다(`passPlayGateBetweenTicks`). 판 시작 0 · 0x35108 이 끝에서 0 으로 둔다.
   */
  fastForward: boolean
  /** state[0xb] — 사건 코드 처리 0xb2bc4 가 마지막으로 받은 결과 코드 */
  lastEventCode: number
  /** 플레이 +0x112 — 공을 쥐었거나 공이 땅에 닿았거나 담장선을 넘었다 (6d 절) */
  ballContacted: boolean
  /** 플레이 +0x110 — 사건 코드 7(파울) */
  foulFlag: boolean
  /** state[0x1c] — 쏜 공의 파울 각 (511b8 0x9d660(a) 의 반대). 표시 패턴으로 바꿔 쏘면 바꾼 각이다 */
  foulAngle: boolean
  /**
   * state[7] — 넓은 페어 각(0x9d640). 0 이면 커버 0xb1c90 이 머리(b1cc6)에서 끝난다(`coverTick` 머리말).
   * 타구 0x511ae = 1 · state[0x19] == 0 이면 0x511ce = 0x9d640(쏜 a) · 사건 7 b2c06 = 0x9d640(공+0x70) · 아웃 꼬리 b3716 = 1
   */
  wideFair: boolean
  /** 플레이 +0x111 — 사건 코드 8(홈런). `PlayView.finished` 는 이 진행기의 판 끝 표시라 따로 든다 */
  homeRunFlag: boolean
  /** 플레이 +0x124 — 사건 코드 10(바운드로 담장을 넘은 2루타) */
  groundRuleFlag: boolean
  /**
   * **플레이 +0x127** — 타구 시작 0x51408 이 패턴 플래그 비트 1(0xb07c8)이면 세우고(0x514e6), 쥐기 0xb2710 이 지운다.
   * 서 있으면 예보 0xb12d0 의 복제(b1416)와 추적야수 AI 1(0xb4afe)이 낙구 틱까지 **낙구 지점**으로 달린다.
   */
  landingChase: boolean
  /**
   * 지금 공의 공+0xaa0 을 판 틱으로 옮긴 값 — AI 1(0xb4afe)이 `aa0 ≥ 공+0x68` 로 본다. 다시 쏘면(0xb3148) 공 칸이 새로
   * 깔리므로 새 궤적의 낙구 틱이다(`trajectory.landingTick` 은 state[0x1e] 처럼 처음 낙구를 지킨다).
   */
  ballLandingTick: number
  /**
   * 지금 공을 깐 판 틱 — 공+0x68(재생 틱)이 0 인 그림. 판 시작 vt18(b27ec → vt24(1) 0xb12d0 의 b12da)이 0 으로 두므로 처음은 0,
   * 송구 0xb2e38(b307c) · 다시 쏘기 0xb3148(b3294)이 그 틱으로 옮긴다(`takeLooseBall`). 그림의 공+0x68 = 판 틱 − 이 값 —
   * 0x3f378(3f3c6)이 그리기 뒤에만 +1 하므로 깐 그림은 0 이고 0x36dfc 36e24 가 공을 안 그린다(`DefenseBall.isPlaybackStart`).
   * 쥔 동안은 +1 이 멈추지만(3f3b2 +0x12c) 쥔 공은 어차피 안 그리고, 놓는 길은 모두 0 으로 다시 둔다.
   */
  ballLaunchTick: number
  /**
   * 플레이 +0x178[칸] — 지금 공의 예보가 적은 다이빙 후보 틱(공 틱, 없으면 1000 — `catchForecast.diveTicks`, r180). 송구 · 다시 쏘기의
   * 예보(`takeLooseBall`)가 새로 채운다 — 첫 점이 표준 배팅 지점이 아니라 모두 1000 이 된다.
   */
  diveTicks: readonly number[]
  /** 플레이 +0x174 — 고르기 0xb3b38 이 적은 포구 틱(공 틱, 웹 판 틱 끝으로 자르기 전 값). AI 고리 b470a 가 `ldrsh` 로 읽는다 */
  diveCatchTick: number
  /**
   * 지금 쫓는 공이 **받을 야수에게 던진 송구공**(공+0xaac == 0 — 보통 · 흔들린 · 레이저 송구)인가. 받는 것도 포구 틱 갈래(1 절)다.
   */
  receivingThrow: boolean
  /**
   * 야수 +0x3b(칸 = 야수 칸) — 마지막 목록 틱(6 절 이동)에서 목표점에 막 닿았다. 결과 코드 9(b4412, 6c 절)가 본다.
   * 이동 0xbf0dc 가 머리에서 지우고 닿은 갱신에서만 세우므로 목록 틱이 안 돈 그림(경기 멈춤)에는 앞 값이 남는다
   */
  fielderArrivals: readonly boolean[]
}

/**
 * 공이 담장 뒤로 사라졌나 — 0x17 공 그리기 0x36dfc 머리(36e2a~36ea4, 직접 뜸):
 * ```
 * 36e2a  r7 = P+0x111(홈런) && 공+0x68 > 공+0xaa0 + 2 && 공+0x68 > 공+0xaa4 + 6
 * 36e5c  r6 = 공+0xaa4 > 0   && 공+0x68 > 공+0xaa0 + 2 && 공+0x68 > 공+0xaa4 + 6
 * 36e86  그린다 = !r7 && 공 그림 있음 && !P+0x12c(쥠) && !r6
 * ```
 * 공+0x68 · aa0 · aa4 는 웹에서 판 틱 · `ballLandingTick` · `trajectory.fenceTick`(다시 쏜 공은 판 틱으로 옮긴 값 — 비교는 같다).
 * aa4 > 0 은 "담장선 넘는 틱이 있다" 로 읽는다(웹은 없으면 −1).
 */
export function isBallBeyondFence(tick: number, landingTick: number, fenceTick: number, homeRunFlag: boolean): boolean {
  return (fenceTick > 0 || homeRunFlag) && tick > landingTick + 2 && tick > fenceTick + 6
}

/**
 * 타구 하나를 **시작 상태**로 세운다 — 포구 예보 · 필살수비 굴림 · 커버 배정까지.
 *
 * ⚠️ 난수는 여기서 **필살수비 굴림(최대 2번)만** 돈다. 펌블·악송구·레이저는 틱 안에서 돈다 —
 * 그 순서와 횟수가 씨앗 결과를 정하므로 자리를 옮기면 안 된다.
 */
export function startDefensePlay(input: DefensePlayInput): DefensePlayState {
  let trajectory = input.trajectory
  const abilities =
    input.defenseAbilities ?? Array.from({ length: 9 }, () => DEFAULT_ABILITY)
  const speedOf = (fromBase: number) =>
    runnerSpeedOf(
      input.runAbilities?.[fromBase as 0 | 1 | 2 | 3] ?? input.runAbility ?? DEFAULT_ABILITY,
      input.runnerTeamGrade ?? 0,
    )
  const maximumTicks = input.maximumTicks ?? DEFAULT_MAXIMUM_TICKS

  let fielders = createFielders(abilities, input.defenseTeamBonus ?? 0)
  // 결과를 넘겨받은 호출(옛 길 · 시험)이 미리 굴려 둔 필살타법 성공. 쏜 공(`contactOfOutcome`)의 필살 스윙은 아래 0x517e6 자리에서 굴린다
  let uncatchable = input.isUncatchable === true

  // ── 포구 예보 ──
  // 원본 예보 0xb12d0 은 틱 구간을 자르지 않고 궤적 끝까지(t = 1 → 공+0x6c − 1) 한 표를 만들고, 0xb3b38 은 낙구 전 포구
  // (우선순위 1~5)가 있으면 그것을, 없으면 6~8 갈래로 **바운드 뒤에 줍는 야수**를 고른다(P2 1a · 2a). 잡힐 뜬공인지는 이 예보가
  // 정한다 — 플레이.vt94 = 0xb1b2c(+0x11c 가장 이른 포구 틱 ≤ 낙구 틱)가 0xa9e44(a9ed6)·0xaf918(af98e)에 넘기는 그 값이다.
  // (예전 웹은 타석 결과 코드가 뜬공·직선타 아웃이면 낙구 전까지만, 그 밖이면 낙구 다음 틱부터 보도록 구간을 잘랐다 —
  // 결과를 먼저 정한 웹 다리였다. 원본처럼 결과는 이 판의 끝 정산이 내므로 걷었다.)
  const window = { from: 0, to: Number.POSITIVE_INFINITY }
  // 플레이 +0x127 — 패턴 플래그 비트 1 (0x514e6). 예보 · 추적야수가 낙구 지점으로 달린다
  const landingChase = trajectory.landingChase === true
  const chase = { chaseToLanding: landingChase }
  let forecast = forecastCatch(trajectory, fielders, window, chase)

  // ── 필살수비 굴림 (메시지 0x11 = 타구가 떠난 순간, I-controls 2c) ──
  // A(점프, +0x1f5) 를 먼저 굴리고 실패했을 때만 B(슬라이딩, +0x1f6). 창을 여는 것뿐이라
  // 보통 포구가 낙구 전에 되면 쓰이지 않는다 (고르기 우선순위 4·5 — P2 3절).
  // 원본은 "이미 고른 추적야수" 의 칸으로 조건을 보므로 여기서도 예보를 한 번 돌린 뒤에 굴리고,
  // 창이 열리면 예보(0xb12d0 = vt24)를 다시 만든다 — 원본도 vt24 를 여러 번 부른다.
  const specialDefense = rollSpecialDefenseFor({
    random: input.random,
    ability: abilities[forecast.choice.slot] ?? DEFAULT_ABILITY,
    skillIds: input.fielderSkillIds?.[forecast.choice.slot],
    gameMode: input.gameMode,
    chaserSlot: forecast.choice.slot,
    buntKind: input.buntKind ?? 0,
  })
  // ── 필살수비가 열리면 표시 패턴으로 바꿔 쏜다 — 5107c 점프 0xb097c(목록 비트 2) · 5112c 슬라이딩 0xb09ac(목록 비트 3) ──
  // 장면 덱(덱을 섞을 때 만든 두 목록)에서 rand(0, 개수) 로 한 장을 골라 쏠 패턴의 (a, b, c) 를 덮는다(`displayPatternOf`).
  // 바꿔 쏜 공의 각이 파울 각이면 511b8 state[0x1c] 도 그 각으로 선다(목록 B 에는 파울 각 패턴이 있다).
  // ⚠️ 쏜 공(`contactOfOutcome`)이나 장면 덱이 없는 호출(시험 · 결과를 넘겨받은 옛 길)은 바꿀 패턴을 몰라 그대로 쏜다(웹 전용)
  const swungContact = contactOfOutcome(input.outcome)
  const sceneDeck = input.random === undefined ? undefined : scenePatternDeckOf(input.random)
  let launchedPattern = swungContact?.pattern
  if (
    (specialDefense.jumpUnlocked || specialDefense.slideUnlocked) &&
    input.random !== undefined &&
    swungContact !== undefined &&
    sceneDeck !== undefined
  ) {
    launchedPattern = displayPatternOf(
      sceneDeck.deck,
      specialDefense.jumpUnlocked ? 'jump' : 'slide',
      swungContact.pattern,
      input.random,
    )
    trajectory = battedBallTrajectory(launchedPattern)
    forecast = forecastCatch(trajectory, fielders, window, chase)
  }
  // ── 쏘기 + 세계 0xbfed0 (메시지 0x11 의 51172~511a4) — 필살수비 굴림(50fe6 · 51012) 뒤다 ──
  // 궤적 계산 안의 굴림은 폴 충돌 0xa2c64 의 rand(−25, 25) 하나뿐이다. 부르는 쪽은 난수 없이 궤적을 깔아 넘기므로
  // 그 굴림이 있던 궤적이면 여기서 난수로 다시 깐다 (굴림이 없던 궤적은 그대로 — 난수를 안 쓴다).
  const rolledTrajectory = trajectoryWithRandom(trajectory, input.random)
  const relaid = rolledTrajectory !== trajectory
  trajectory = rolledTrajectory
  if (relaid) forecast = forecastCatch(trajectory, fielders, window, chase)
  if (specialDefense.jumpUnlocked || specialDefense.slideUnlocked || relaid) {
    forecast = forecastCatch(trajectory, fielders, window, {
      ...chase,
      jumpUnlocked: specialDefense.jumpUnlocked,
      slideUnlocked: specialDefense.slideUnlocked,
    })
  }
  // ── [경기+0xf2c] 공 쏘기 + 세계 0xbfed0 (0x51408 5174c · 517ce) — 판 공과 수평각만 d 다른 공(`earlyPassPatternOf`, 50faa 가
  // 고친 +0xfcc 그대로 + d). 그 공도 점을 깔며 폴에 맞으면 rand(−25, 25) 를 하나 굴린다 — 판 공 굴림 뒤 · 필살타법 굴림 앞.
  // 궤적은 이른 넘김(상태 0x13 0x406e8)만 보고 판은 안 본다 — 여기서는 굴림 차례만 맞춘다. 손을 모르는 결과(시험 · 옛 길)는 건너뛴다
  if (input.random !== undefined && launchedPattern !== undefined && swungContact?.batterHand !== undefined) {
    trajectoryWithRandom(battedBallTrajectory(earlyPassPatternOf(launchedPattern, swungContact.batterHand)), input.random)
  }
  // ── 필살타법 성공 굴림 0x517e6 (0x34c74 · p·10 > rand(0, 1000)) — 메시지 0x11(515c6 → 0x50faa: 필살수비 굴림 · 표시 패턴 ·
  // 51188 쏘기의 폴 굴림) · [경기+0xf2c] 의 폴 굴림 **뒤**다. 515c6 과 517e6 사이(0x392ac · 0x35988 · 0x39304 · 0x34be0 · 0xac758 ·
  // 메시지 0xbc5 진동 · 0x494b4 · 0xae89c)에는 그 밖의 굴림이 없다(호출 그래프). 성공하면 517ec 0xaf180(공+0x5c, 4) — 포구 틱 b4246 이 보고 0xbc3.
  // 예전 웹은 타석 판정 안(방향 · 패턴 바로 뒤)에서 굴려 필살수비 · 폴 굴림보다 앞섰고, "필살타법 타구면 필살수비를 안 굴린다"
  // 를 두었다 — 원본 차례에서는 필살수비를 굴릴 때 성공 여부를 아직 모른다
  if (!uncatchable && swungContact?.specialSwing !== undefined && input.random !== undefined) {
    uncatchable = rollSpecialSwing(swungContact.specialSwing.number, input.random, swungContact.specialSwing.isAceBatter)
  }
  // 잡힐 뜬공인가(vt94) — 고른 포구가 낙구 전(0xb3b38 우선순위 1~5)일 때. 점프·슬라이딩 창이 열려 낙구 전 포구가 생기면
  // 그것도 뜬공이다. 필살타법 타구(공 속성 4 = 필살타법 표시)는 아무도 쥐지 않는다. 실제 뜬공 아웃(state[0x1f])은 쥐는 틱의 0xb36d0 이 낸다
  const onTheFly = !uncatchable && forecast.choice.catchTick <= trajectory.landingTick
  // 0xa9e44 의 1루 주자 예외 (a9ed6) — 2아웃 전 잡힐 뜬공이면 1루 주자는 포스 목표를 안 받는다
  const runners = createPlayRunners(
    input.bases,
    speedOf,
    onTheFly && input.outs !== 2 ? { stealingFrom: input.stealingFrom ?? [] } : null,
  )

  // ── 상태 0x17 진입 0x46418 → 0x3d7b8: 판 시작(vt18) 뒤 주자 목록 차례로 리드 틱을 몰아서 돌린다 ──
  // 필살수비 굴림(메시지 0x11)보다 뒤다. 도루 주자만 rand(0,9) 한 번 — 종류 1 은 그 뒤 도루 표시를 지운다(state[0x14+b] = 0)
  leadRunnersForBattedBall(runners, input)

  const chaserSlot = forecast.choice.slot
  let catchTick = Math.max(0, Math.min(forecast.choice.catchTick, maximumTicks))
  // 추적야수 AI 1(b4aca~b4b5a, 직접 뜬 것): b4b40 0xa25b0(공, +0x174 포구 틱)의 점 → b4b50~b4b5a 0xa100c(야수, x, **0**, z) —
  // 야수 목표는 늘 땅 위다. 포구 틱 다리(6b 절 쥐기)도 이 점에 세운다(r162 — 예전 웹은 높이째 포구 지점이었다)
  const catchPoint = groundPointOf(trajectory.pointAt(catchTick))
  // 시작 목표를 미리 세워 둔다 — 첫 틱부터 쫓는 야수는 공 쪽, 커버 야수는 제 루 쪽을 보고 있어야 한다.
  // 커버는 판 시작 상태로 0xb1c90 을 한 번 돌린 것이다(`runCoverTick` — 매 틱 1d 절이 다시 고른다)
  // 0xb3b38 담장 갈래 — 담장선이 먼저면 고른 야수는 AI 0xb 로 담장 앞 공점(aa4 − 2)에 간다(`fenceChasePoint`)
  fielders = fielders.map((fielder) =>
    fielder.slot === chaserSlot
      ? forecast.fenceChasePoint !== null
        ? // b3e8c AI 0xb · b3e96~b3eba +0x90 만 — 목표(+0x2c)는 AI 고리 b4b5c 가 vt14 로 적는다(1c 절, r214)
          { ...fielder, pickUpPoint: forecast.fenceChasePoint, aiState: AI_STATE.PICK_UP }
        : { ...fielder, target: catchPoint, aiState: AI_STATE.CHASE }
      : // b3f5c — 백업 갈래: 외야 추적야수 곁의 가장 가까운 외야수 AI 0xc (목표는 AI 고리 b4b78 이 고른다, r180)
        fielder.slot === forecast.backupSlot
        ? { ...fielder, aiState: AI_STATE.BACKUP }
        : fielder,
  )
  // state[7] — 0x511ae 가 1 로 세운 뒤 state[0x19](0.1% 사건)가 아니면 0x511ce 가 0x9d640(쏜 a)로 덮는다
  const wideFairAtStart = input.specialEvent === true || launchedPattern === undefined || isWideFairAngle(launchedPattern[0])
  // 판 시작 vt18 종류 1(0xb280a): vt1c · vt20(1)(+0x126 = 1, b11fe) · 추적야수 · vt24 · vt34 · **vt30 = 0xb1c90 한 번**(커버 · 자리 잡기 0xb203a).
  // state[7] == 0(넓은 파울 각)이면 머리에서 끝나 아무것도 안 고른다 — 그때 +0xf0 은 앞 판이 남긴 값이다(`DefenseScene.playCovers`, r171:
  // 종류 1 판 시작 b280a 은 +0xf0 을 안 적고, 열린 vt30 은 b1cdc 에서 기본 표 0xd8764 를 베낀 뒤 고른다)
  const startCovered = runCoverTick({
    context: {
      play: {
        ...initialPlayView(1),
        coverOfBase: [...(input.scene?.playCovers ?? DEFENSE_SCENE_START.playCovers)],
        ballHolderSlot: chaserSlot,
        catchFielderSlot: chaserSlot,
      },
      fielders,
      runners: runners.map((runner) => runner.state),
      currentTick: 0,
      landingTick: trajectory.landingTick,
    },
    ballToFirstSide: catchPoint.x > basePosition(0).x,
    ballStartPoint: trajectory.pointAt(0),
    relayFlag: true,
    gateClosed: !wideFairAtStart,
  })
  const covers = startCovered.play.coverOfBase
  fielders = startCovered.fielders

  let play: PlayView = {
    ...initialPlayView(1),
    // 플레이+0x160 — 판 시작 vt18 0xb27ec(종류 1 → 0xb280a)가 먼저 부르는 vt1c 0xb0edc 의 b0f66~b0f68 이 −1 로 지운다.
    // 앞 판에서 못 쓴 사람 송구 키는 넘어오지 않는다
    manualThrowBase: NONE,
    coverOfBase: covers,
    ballHolderSlot: chaserSlot,
    catchFielderSlot: chaserSlot,
    catchKind: forecast.choice.kind,
    catchTick,
    actionStartTick: forecast.choice.actionStartTick,
    // +0x11c — 예보 표의 가장 이른 포구 틱(없으면 0xffff)
    earliestCatchTick: forecast.earliestCatchTick,
  }

  // ── 0x46766 — 0x17 진입 0x46418 끝: 판 진행 관문 0xb0d28 이 열려 있으면 `0xaf8c0(제어기, 1)` 을 **한 번**, 주루 설정
  //    갈림(0xae690) 없이 부른다. force = 1 이라 달리는 주자(리드 뒤 돌아오는 주자 · 도루 · 포스 · 타자주자)까지 본다.
  //    진루 자리 afa0e 는 vt48(0xb6228(R+0x78)) = +0x8c + 1 — 이미 그 루로 달리는 주자는 목표가 그대로고(+0x84 도 같은 값),
  //    +0x128 = 1 은 결정마다 선다. 굴림 없음.
  play = applyPlayStartAutoAdvance(
    { play, fielders, runners: runners.map((runner) => runner.state), currentTick: 0, landingTick: trajectory.landingTick },
    runners,
  )

  return {
    // 판 시작이 굴린 필살타법 성공(0x517e6)을 입력 칸에 적어 둔다 — 결과의 `isUncatchable` 이 그 값을 낸다
    input: uncatchable === (input.isUncatchable === true) ? input : { ...input, isUncatchable: uncatchable },
    trajectory,
    abilities,
    maximumTicks,
    uncatchable,
    onTheFly,
    chaserSlot,
    catchPoint,
    covers,
    defenseIsCpu: input.defenseIsCpu === true,
    specialDefense,
    runners,
    ticks: [],
    log: [],
    previousActions: new Map<string, { action: number; since: number }>(),

    tick: 0,
    fielders,
    play,
    held: EMPTY_HELD_RUNS,
    outs: input.outs,
    outsAdded: 0,
    throwBase: NONE,
    throwArrivalTick: -1,
    throwFromSlot: NONE,
    throwReleaseTick: -1,
    throwReceiverSlot: NONE,
    throwCount: 0,
    firstThrowBase: NONE,
    firstThrowArrivalTick: -1,
    safeCallTick: -1,
    flyOut: false,
    hitEvent: false,
    homeRunEvent: false,
    outEvents: 0,
    groundHomeRun: false,
    catchTick,
    fumbled: false,
    errantThrow: false,
    autoBaserunning: true,
    slidingSoundPlayed: false,
    slidingSoundThisTick: false,
    hitStaggerSoundThisTick: false,
    runInsThisTick: [],
    tickSounds: [],
    laserShining: false,
    fumbleMarks: Array.from({ length: FIELDER_COUNT }, () => 0),
    throwErrorMarks: Array.from({ length: FIELDER_COUNT }, () => 0),
    laserConfirmed: false,
    laserRolled: false,
    laserThrow: false,
    laserArmed: false,
    laserTrailOn: false,
    ballSegmentStart: input.trajectory.pointAt(0),
    gamePaused: false,
    // 0x17 진입 0x46418 — 결과 판 타이머 −1. 타구 판은 늘 투구(0x10 · 0x11)를 지나 왔다
    scene: enterDefenseScene(input.scene, true),
    deadlyJumpArmed: false,
    deadlySlideArmed: false,
    // state[0x8b] — 타석 시작 0x3b084 · 반 이닝 0x3ac90 의 0xb67d0 이 지운다. 판 안에서 세운 값은 그 판 정산이 쓰고 지운다
    laserOutFlag: false,
    counterBeforeHead: 0,
    rundown: NO_RUNDOWN,
    rundownThrowArrival: -1,
    rundownThrowTo: NONE,
    rundowns: 0,
    rundownOuts: 0,
    tagOut: false,
    relayFlag: startCovered.relayFlag,
    relayFinalSlot: NONE,
    relayBase: NONE,
    deferredThrowReceiver: NONE,
    deferredThrowBase: NONE,
    endCounter: 0,
    closingListTickOpen: false,
    forecastMovable: forecast.movable,
    drawGateOpen: null,
    fastForward: false,
    lastEventCode: 0,
    ballContacted: false,
    foulFlag: false,
    // 511b8 state[0x1c] = 0x9d660(쏜 a) — 쏜 공(쏜 패턴)이 없는 호출(궤적만 받은 시험 · 옛 길)은 페어로 본다
    foulAngle: launchedPattern !== undefined && !isFairAngle(launchedPattern[0]),
    wideFair: wideFairAtStart,
    homeRunFlag: false,
    groundRuleFlag: false,
    landingChase,
    ballLandingTick: trajectory.landingTick,
    ballLaunchTick: 0,
    diveTicks: forecast.diveTicks,
    diveCatchTick: forecast.choice.catchTick,
    receivingThrow: false,
    fielderArrivals: [],
  }
}

/**
 * 더 돌릴 것이 남았는가 — 원본 루프의 `for (tick = 0; tick <= 최대틱; …)` 와 그 안의 `break` 다.
 * 끝 조건(공·송구·타자주자가 다 정리됐고 뛰는 주자가 없다)이 서면 `play.finished` 가 선다.
 */
export function isDefensePlayFinished(state: DefensePlayState): boolean {
  return state.play.finished || state.tick > state.maximumTicks
}

/**
 * **0x519cc — 0x17 키 건너뛰기를 받는가** (직접 뜸):
 * ```
 * 519cc  state[0x1d](사건 8 홈런, 0xb2bd8) ≠ 0 → 51a0a
 * 519d4  플레이 +0x129(사건 12 폴 홈런) ≠ 0 → 51a0a
 * 519e6  state[0xb] == 4 || state[0xb] == 3 → 51a0a ; 아니면 0x523aa(돌아감)
 * 51a0a  0x6e418(소리 멈춤) · +0xfe7 = 1 · +0x1960 = 0(HOMERUN 글자) · +0x1100 = 0(홈런 점수판) · 0x8fc70(홈런 효과 칸 버리기) ·
 *        파티클 +0x57 = 0 · 0x6dee4(파티클 모두 치우기)
 * ```
 * 판이 닫힌 뒤(+0x1094 를 세는 동안)에도 키가 오면 받는다 — 529f0 의 52b26 도 +0xfe7 을 보고 되돌아 돈다.
 *
 * **state[0xb] ∈ {3, 4} 는 볼넷 · 사구의 밀어내기 주루 판**이다 (2026-10-08 직접 뜸):
 * 공 도착 0x3dfac 의 판정 스위치(표 0xcffb4)가 v = 3(볼넷) · 4(사구)면 0x3e1b4 에서 0xb0cb8(플레이, 2)로 판 종류를 2(밀어내기)로 두고
 * 3e1d4~3e1e8 이 메시지 0xbba(v) 를 보낸다(그 처리 51a56 이 state[0xb] 를 v 로 적는다). 판정 A 0xae24c 가 ae344~ae35c 에서
 * `state[0xb]` 3 · 4 를 보고 상태 **0x17** 로 보낸다 — 곧 이 키 갈래는 볼넷 · 사구 뒤 주자가 밀려 가는 판에서 판을 건너뛰는 키다.
 * 밀어내기 판(종류 2)은 이 타구 진행기가 아니라 `walkPlay`(주자 판 진행기)가 미리 돌려 재생한다 — 그래서 이 진행기의 `lastEventCode` 는
 * 3 · 4 가 될 일이 없고, 그 판의 키 건너뛰기는 재생 화면이 `freePassPlay` 로 받는다(`DefensePlayback`).
 */
export function acceptsFastForwardKey(state: Pick<DefensePlayState, 'homeRunFlag' | 'play' | 'lastEventCode'>): boolean {
  return state.homeRunFlag || state.play.suppressed || state.lastEventCode === 3 || state.lastEventCode === 4
}

/**
 * **한 틱만 돌린다** — 원본 경기 루프의 한 갱신(0xc2198)에 해당한다.
 *
 * `key` 는 **이번 틱에 눌린 키**다. `runDefensePlay` 처럼 미리 다 계산하는 쪽은
 * `input.controls.keyAt(tick)` 에서 꺼내 넘기고, 화면(`DefensePlayback`)은 실제 `keydown` 을 넘긴다.
 * 어느 쪽이든 진행기가 보는 것은 똑같다.
 *
 * ⚠️ 상태는 **제자리에서 바뀐다** — 돌려받은 것을 쓰고 지난 것은 버려라.
 */
export function stepDefensePlay(
  state: DefensePlayState,
  key: DefenseKeyPress | null = null,
): DefensePlayState {
  if (isDefensePlayFinished(state)) return state

  const input = state.input
  // 펌블 · 필살타법 타구가 야수에게 맞고 튕기면(0xb3148) 판 도중 새 궤적 · 새 추적야수가 된다 — 그래서 let
  let trajectory = state.trajectory
  const abilities = state.abilities
  const maximumTicks = state.maximumTicks
  let uncatchable = state.uncatchable
  let onTheFly = state.onTheFly
  let chaserSlot = state.chaserSlot
  let catchPoint = state.catchPoint
  const defenseIsCpu = state.defenseIsCpu
  // 0xae690([장면+0x214], 설정+0xbd) — 공격이 CPU 거나 주루 설정이 자동이면 자동 진루 제어기가 돈다.
  // 안 넘기면 원본 기본값(자동)이라 지금까지와 똑같이 논다.
  const autoBaserunningEnabled =
    input.offenseIsCpu === true || (input.runningMode ?? '자동') !== '수동'
  // 0xae6c8([장면+0x214], 설정+0xf4) — 수비가 CPU 거나 송구 설정이 자동이면 CPU 송구 결정
  // 제어기(0xaf8e0 → vt0xc = 0xafa60 → 점수식 0xafb24)가 돈다. 안 넘기면 원본 기본값(수동)이다.
  const cpuThrowEnabled = input.defenseIsCpu === true || (input.throwMode ?? '수동') !== '수동'
  const runners = state.runners
  const ticks = state.ticks
  const log = state.log
  const previousActions = state.previousActions
  const tick = state.tick

  let fielders = state.fielders
  let play = state.play
  let held = state.held
  let outs = state.outs
  let outsAdded = state.outsAdded
  let throwBase = state.throwBase
  let throwArrivalTick = state.throwArrivalTick
  let throwFromSlot = state.throwFromSlot
  let throwReleaseTick = state.throwReleaseTick
  let throwReceiverSlot = state.throwReceiverSlot
  let throwCount = state.throwCount
  let firstThrowBase = state.firstThrowBase
  let firstThrowArrivalTick = state.firstThrowArrivalTick
  let flyOut = state.flyOut
  let hitEvent = state.hitEvent
  let homeRunEvent = state.homeRunEvent
  let outEvents = state.outEvents
  let groundHomeRun = state.groundHomeRun
  let catchTick = state.catchTick
  let fumbled = state.fumbled
  let errantThrow = state.errantThrow
  let autoBaserunning = state.autoBaserunning
  let slidingSoundPlayed = state.slidingSoundPlayed
  let slidingSoundThisTick = false
  let hitStaggerSoundThisTick = false
  const runInsThisTick: number[] = []
  const tickSounds: DefenseTickSound[] = []
  /** 6d 절 b4492 — 아무도 쥐기 전에 공이 이 틱에 처음 땅에 닿았다(+0x113 = 1, 공+0x68 == 공+0xaa0) */
  let landedUncaughtThisTick = false
  let laserShining = state.laserShining
  let fumbleMarks = state.fumbleMarks
  let throwErrorMarks = state.throwErrorMarks
  let laserConfirmed = state.laserConfirmed
  let laserRolled = state.laserRolled
  let laserThrow = state.laserThrow
  let laserArmed = state.laserArmed
  let laserTrailOn = state.laserTrailOn
  let ballSegmentStart = state.ballSegmentStart
  let gamePaused = state.gamePaused
  let scene = state.scene
  let deadlyJumpArmed = state.deadlyJumpArmed
  let deadlySlideArmed = state.deadlySlideArmed
  let laserOutFlag = state.laserOutFlag
  /** 이 틱 머리(그림 F 의 슬롯 2 머리)에서 0x400bc 가 경기를 멈췄는가 */
  let pausedThisTick = false
  /** 이 틱이 멈춘 그림 F+1 인가 — 머리에서 이미 +0x1993 이 서 있다(0x3f060 의 목록 틱 · 슬롯 2 가 통째로 없다) */
  const pausedAtHead = gamePaused
  let rundown = state.rundown
  let rundownThrowArrival = state.rundownThrowArrival
  let rundownThrowTo = state.rundownThrowTo
  let rundowns = state.rundowns
  let rundownOuts = state.rundownOuts
  let tagOut = state.tagOut
  let relayFlag = state.relayFlag
  let relayFinalSlot = state.relayFinalSlot
  let relayBase = state.relayBase
  let deferredThrowReceiver = state.deferredThrowReceiver
  let deferredThrowBase = state.deferredThrowBase
  let endCounter = state.endCounter
  let counterBeforeHead = state.counterBeforeHead
  let drawGateOpen = state.drawGateOpen
  // ── 0x17 키 건너뛰기 — 키 처리 0x53420 이 키마다 끝에 메시지 0x587 → 0x509a0(0x50afe) → 0x519cc (갱신 0x524c0 보다 먼저) ──
  // state[0x1d](홈런) || +0x129(폴 홈런) || state[0xb] ∈ {3, 4} 일 때만 +0xfe7 = 1 — 이 틱부터 한 그림 안에서 판을 끝까지 돈다
  let fastForward = state.fastForward
  if (key !== null && !fastForward && acceptsFastForwardKey(state)) {
    fastForward = true
    log.push(`${tick}틱 키 건너뛰기 (0x519cc +0xfe7)`)
  }
  let lastEventCode = state.lastEventCode
  let ballContacted = state.ballContacted
  let foulFlag = state.foulFlag
  let wideFair = state.wideFair
  let homeRunFlag = state.homeRunFlag
  let groundRuleFlag = state.groundRuleFlag
  let landingChase = state.landingChase
  let ballLandingTick = state.ballLandingTick
  let ballLaunchTick = state.ballLaunchTick
  let diveTicks = state.diveTicks
  let diveCatchTick = state.diveCatchTick
  let receivingThrow = state.receivingThrow
  let fielderArrivals = state.fielderArrivals
  /** sp+0x24 — 이번 틱 포구 틱의 사건(펌블 0xbc2 · 필살타법 표시 공 0xbc3 — 송구 받기는 사건 없이 b42c8 쥐기). 서면 틱 끝 b45a4 가 플레이.vt70 = 0xb3148 */
  let ballEventThisTick = false
  /** sp+0x38 — 포구 틱 b4292 가 세운 결과 코드 9(발밑 루에 주자가 서 있는 포구). 6c 절의 결과 코드가 이어받는다 */
  let catchResultCode = 0

  /**
   * **카메라 0x3f060 의 키 건너뛰기 부수효과 (3f0f0~3f192, 직접 뜸)** — 목록 틱(3f0da) 바로 뒤 카메라에서:
   * ```
   * 3f0b8  G1 이 열렸고(r6 = 1) 0x33c98(0x17) 이면 목록 틱 뒤 카메라:
   * 3f0f0  플레이 +0x111(홈런) || +0x129(폴 홈런) 이고 공.vt18(멈춤)이면 대상 = 주자 0(0xa9565(주자관리, 0)) —
   * 3f164  +0xfe7(건너뛰기) ≠ 0 && 주자 0 +0x7c(목표 루) == 4 && +0x8c(닿은 루) == 4 →
   * 3f17e    +0xfe7 = 0 · 메시지 0x13(인자 0) 곧바로(0xbfbad) → 0x51fb8: 점수 +1(0xb6a9c) · 주자 0 +0x95 = +0x96 = 1 ·
   *          0x357e0 && +0xfe7 == 0 이면 홈런 점수판 갈래(52030)
   * 52b36  +0xfe7 이 내려갔으면 52b26 되풀이를 멈추고 그 그림을 그대로 그린다(52b42 → 그리기)
   * ```
   * 이 카메라는 0x3f060 을 부르는 두 자리에서 돈다 — 그림 머리 52e16(키 처리 0x498d4 52d9e 뒤라 이 그림에 막 누른 건너뛰기도 본다)과
   * 건너뛰는 동안의 52b26(슬롯 2 뒤). **득점 차례(확정)**: 메시지 0x13(타자주자)은 목록 틱 카메라에서 곧바로 가고, 같은 목록 틱에 홈에
   * 닿은 앞 주자의 0x13 은 그 뒤 슬롯 2 의 0xaa0a8(6f 절)이 보낸다 — 타자주자가 먼저다. 0xaa0a8 은 +0x96 이 선 타자주자를 건너뛴다(aa0e6).
   * 이미 0xaa0a8 이 센 타자주자여도 원본은 1점을 또 올린다(0xb6a9c — 원본 그대로, 다만 그때는 보통 0xa990c == 0 이라 G1 이 닫혀 있다).
   * 52b26 에서 풀린 그림은 52b36 → 52b42 로 되풀이를 멈추고 그린 뒤(G3 · G4), 다음 그림 52c50 이 키 0x498d4(52d9e) 다음 **52e16 의
   * 0x3f060 을 갈래 없이** 부르고서야 0x524c0(52e94)의 G2 · 슬롯 2 로 간다(직접 뜸). 곧 목록 틱이 한 번 더 돌아 앞 주자의 +0x3b 를
   * 지우므로 같은 목록 틱에 닿은 앞 주자는 0xaa0a8 이 세지 않는다(원본 버그) — 웹은 9 절 `passFastForwardGates` 가 그 목록 틱을 돌되,
   * **사용자 결정 2026-10-26: 원본 버그를 고침** — 홈에 닿은 앞 주자의 +0x3b 를 남겨 다음 판 틱 0xaa0a8 이 센다.
   */
  const cameraFastForwardRunIn = (): void => {
    const cameraBallStopped =
      play.held || (trajectory.isStoppedAt === undefined ? tick >= trajectory.length - 1 : trajectory.isStoppedAt(tick))
    const firstRunner = runners[0]
    if (
      !fastForward ||
      !(homeRunFlag || play.suppressed) ||
      !cameraBallStopped ||
      firstRunner === undefined ||
      firstRunner.state.targetBase !== 4 ||
      firstRunner.state.startBase !== 4
    ) {
      return
    }
    fastForward = false
    firstRunner.counted = true
    firstRunner.state = { ...firstRunner.state, scored: true }
    held = { ...held, scoreboardRuns: held.scoreboardRuns + 1 }
    runInsThisTick.push(firstRunner.state.index)
    tickSounds.push({ kind: 'runIn', slot: firstRunner.state.index })
    log.push(`${tick}틱 카메라 0x3f060 — 타자주자 홈, 건너뛰기 풀림 (+0xfe7 = 0 · 메시지 0x13)`)
  }
  // 이 그림에 막 누른 건너뛰기 — 그림 머리 52e16 의 0x3f060(목록 틱은 앞 판 틱의 6 절 이동)이 키 처리 뒤라 그 카메라가 벌써 본다.
  // 이 틱이 돈다는 것은 앞 틱 끝 G2 가 열렸다는 것이고 G1 은 G2 보다 먼저 닫히므로 G1 도 열려 있었다. 멈춘 그림은 0x3f060 이 3f0a4 에서 돈다
  if (fastForward && !state.fastForward && !pausedAtHead) cameraFastForwardRunIn()

  const contextAt = (at: number): DefenseContext => ({
    play,
    fielders,
    runners: runners.map((runner) => runner.state),
    currentTick: at,
    landingTick: trajectory.landingTick,
  })

  /**
   * **아웃 판정 0xb36d0 (플레이 vt90) 한 번 돌리기.**
   *
   * 원본이 이 판정을 부르는 자리는 하나가 아니다 — **공을 쥘 때마다**(`0xb2710` 안 `0xb2758`) 한 번,
   * 그리고 플레이 틱 `0xb401c` 안 `0xb43da`("이 플레이의 야수가 공을 쥐고 있으면")에서 **틱마다** 한 번.
   * 그래서 여기서도 세 자리에서 부른다: 야수가 공을 잡았을 때 · 송구가 루에 닿았을 때 · 틱 갱신 뒤.
   * 잡는 순간에도 한 번 도는 것이 중요하다 — 그러지 않으면 "송구가 닿는 그 틱에 루를 밟은 주자" 가
   * 늘 세이프가 되어, 예전의 송구 도착 판정과 아슬아슬한 경우의 답이 달라진다.
   *
   * 원본처럼 **타자주자(0번)도 판정한다** — 1루 포스·태그 아웃과 쥐는 순간의 뜬공 아웃(결과 1)이 모두 여기서 난다.
   * (예전 웹은 타자주자의 운명을 타석 결과 코드가 정한다며 0번을 뺐다 — 결과를 먼저 정한 웹 다리라 걷었다.)
   *
   * ## `tagOut`(원본 `state[0x87]`)은 "한 번이라도" 가 아니라 **"마지막 판정"** 이다 — 직접 뜬 근거
   * ```
   * b36d2: ldr  r3,[r0,#0x28] ; b36d8: adds r3,#0x87 ; b36dc: strb r2(=0),[r3]
   *        → 0xb36d0 은 **부를 때마다 머리에서 state[0x87] = 0** 으로 지우고 시작한다.
   * b3940: cmp r1,#3 ; b394a: ldr r3,[r5,#0x28] ; b394e: adds r3,#0x87 ; b3950: strb r2(=1),[r3]
   *        → 결과가 3(태그)일 때만 1 을 적고 곧바로 아웃 꼬리(0xb36fa)로 빠져 **그 자리에서 돌아온다**.
   * b43cc: 이 플레이의 야수(0xb0c90)가 +0xe0(공 쥠) 이면 b43da 에서 **매 틱** vt90 을 부른다.
   * ```
   * 곧 그 칸은 **직전 0xb36d0 한 번의 결과**만 담는다. 그런데 읽는 자리가 언제인지가 중요하다:
   * ```
   * b4540: ldr r1,[sp,#0x34] ; cmp #0 ; beq …   ; **이번 틱의 vt90 결과**가 0 이 아니면
   * b4546: state[0x1f] 면 플레이+0x12b = 1
   * b4556: movs r4,#0xd ; str r4,[sp,#0x38]     ; **결과 코드 13**
   * b4562: vt44(13) · vt54(13) → 화면 판정 스위치 0x51a94 의 v = 13 갈래
   * 51b3a: ldrb r3,[r2,#0x1f] ≠ 0 → 62 / 51b44: ldrb state[0x87] ≠ 0 → 62 / 아니면 20
   * ```
   * 결과 코드 13 은 **아웃이 난 바로 그 틱의 끝**에서, 같은 틱 안에서 화면 쪽으로 넘어간다.
   * 그러니 0x51b36 이 보는 `state[0x87]` 은 언제나 **그 아웃을 낸 판정의 값**이고,
   * 아웃이 안 난 틱의 지우기(0xb36d8)는 **아무도 읽지 않아 보이지 않는다**.
   *
   * → 그래서 여기서는 **아웃이 적히는 자리에서만** 갈아 끼운다(덮어쓴다). 아웃이 안 난 판정으로
   *   지우지 않는다 — 지워 봐야 원본에서 읽히지 않는 값이고, 웹은 콜을 **플레이 끝에 한 번**만
   *   내므로 지우면 오히려 "그 아웃을 낸 판정" 을 잃는다. 아웃이 여럿이면 **마지막 아웃**이 이긴다.
   *
   * **원본 `state[0x87]` 의 나머지 절반(0xb4312)** — 원본은 결과가 **2(루 아웃)** 이면서 공 가진 야수(F = 0xb0c90)의
   *    `+0x3b`(막 닿음)가 서 있을 때도 이 칸을 세운다. 2026-10 r87 에 그 갈래를 다시 떠 옮겼다(6b 절 `baseOutFold`):
   *    - `+0x3b` 는 야수 vtable `0xd7934` 의 vt30 도 주자와 같은 `0xbf0dc` 라, 갱신 머리에서 지우고(bf0e6) 목표점에
   *      **막 닿은 갱신에서만** 1 이 된다(bf146) — 한 틱짜리 맥박. 웹은 `fielderArrivals` 다. (예전에 vt18(위치 == 목표)로
   *      바꿔 끼웠다가 루에서 기다리던 커버까지 걸려 **땅볼 포스 아웃이 죄다 62 로 뒤집혔다** — 맥박이 아니라서다.)
   *    - 그 갈래 b42e0 은 포구 틱 구역이 아니라 **매 플레이 틱** 지난다 — b4072(vt50 거짓) · b41aa(포구 틱 아님) ·
   *      b4290(메시지 갈래) · 쥐기 b42c8 뒤가 모두 b42ce 로 온다(예전 메모 "포구 틱에만" 은 틀렸다).
   *      `0xa99d8`(아웃 아닌(+0x96 == 0) 주자 중 +0x3b 가 있나) || F+0x3b 면 vt90 을 b42f2 에서 부르고, 결과가 2 이고
   *      F+0x3b 면 1 을 적은 뒤, 협살 중(+0x1f0 ≠ −1)이고 그 주자+0x3b 면 협살을 끝내고(b4336) **b43ec 로 곧장** 간다 —
   *      그 틱엔 협살 시작(b433c~b4378)도 b43da 판정도 없다. 아니면 b433c → (협살 시작 b4374 → b43da) 또는 b43cc(F+0xe0) → b43da.
   *      곧 플레이 틱의 판정은 어느 갈래든 **한 번**이다.
   *    - 들고 뛰어 루에 닿은 야수의 포스 아웃처럼 **F 가 막 닿은 틱에 판정이 루 아웃을 내면** 콜이 62 가 된다. 루에서 기다리던
   *      커버가 송구를 받아 내는 포스 아웃은 쥐기 판정(0xb2758)이 내고 두 번째 판정은 아웃이 없어 0 으로 지워진다(콜 20).
   *    포구 틱에는 vt90 이 두 번 돈다 — 쥐기 안(0xb2758) 한 번, 그 뒤 같은 플레이 틱 0xb401c 의 `b42f2` 또는
   *    `b43de` 한 번(쥐기가 야수+0xe0 = 1 을 세우니 둘 중 하나는 반드시 돈다 — b42c8 → b42ce → b42e0 / b43cc, 직접 뜸).
   *    두 번째도 머리(b36dc)에서 `state[0x87] = 0` 으로 지우므로, **쥐기 판정이 아웃을 내고 두 번째가 태그(3)도 아니고
   *    b4312 갈래도 아니면 결과 코드 13 을 읽는 b4540 시점의 칸은 0** 이다(콜 20). 두 번째 판정은 웹 6b 절이고 같은 그림의
   *    슬롯 2(이동 앞)라 그 차례대로 옮겼다 — 쥐기에서 아웃이 난 틱은 6b 판정 결과로 `tagOut` 을 다시 적는다(`grabOutThisTick`).
   */
  const runOutJudgement = (): void => {
    if (play.finished) return
    // +0x112 — 웹은 쥔 적(everHeld)과 땅·담장선에 닿음(ballContacted)을 따로 든다. 판정은 둘을 합친 원본 칸을 본다
    const judged = judgeOut({ ...contextAt(tick), play: { ...play, everHeld: play.everHeld || ballContacted } })
    judgedKindThisCall = judged.kind
    if (judged.kind === OUT_KIND.NONE) return
    const victim = runners[judged.runnerIndex]
    if (victim === undefined || victim.state.isOut) return
    markOut(victim)
    outs += 1
    outsAdded += 1
    outJudgedThisTick = true
    // 아웃 꼬리 0xb36fa — state[6]++ · **+0x110 = 0**(b3708) · state[0x1c] = 0 · **state[7] = 1**(b3716) · 주자+0x96 = 1 · 0xa9648.
    // +0x110(사건 7 파울)이 내려가면 포구 관문 vt50(0xb2ac8 b2af6) · 커버 b2564 의 파울 갈래(b2592)가 다시 열린다 (r171)
    foulFlag = false
    wideFair = true
    // 0xb394e — state[0x87] = (결과 == 3). 아웃이 적히는 이 자리에서만 갈아 끼운다 (위 주석)
    tagOut = judged.kind === OUT_KIND.TAG
    // 결과 3(태그)이면 원본은 그 자리에서 협살을 끝낸다 (0xb3946 → 0xb26b8)
    if (judged.kind === OUT_KIND.TAG && rundown.runnerIndex === judged.runnerIndex) {
      rundownOuts += 1
      log.push(`${tick}틱 협살 태그 — ${judged.runnerIndex}번 주자 아웃`)
    } else {
      const name = judged.kind === OUT_KIND.FLY ? '뜬공' : judged.kind === OUT_KIND.BASE ? '루' : '태그'
      log.push(`${tick}틱 ${judged.runnerIndex}번 주자 ${name} 아웃 (0xb36d0 결과 ${judged.kind})`)
    }
    if (judged.kind === OUT_KIND.TAG) {
      fielders = endRundown(fielders)
      rundown = NO_RUNDOWN
      rundownThrowArrival = -1
      rundownThrowTo = NONE
    }
    // 0xa9648 — 아웃 뒤 포스 풀기
    const relaxed = releaseForcesAfterOut(runners.map((runner) => runner.state))
    runners.forEach((runner, index) => {
      runner.state = relaxed[index] ?? runner.state
    })
  }

  /** 이번 틱에 0xb36d0 이 아웃을 냈나 — 결과 코드 13 → 메시지 0xbba (6c 절) */
  let outJudgedThisTick = false
  /** 이번 틱 쥐기 0xb2710 안의 판정(0xb2758)이 아웃을 냈나 — 같은 플레이 틱의 두 번째 판정(6b 절)이 state[0x87] 을 다시 적는다 */
  let grabOutThisTick = false
  /** 바로 앞 `runOutJudgement` 한 번의 결과 종류 — 쥐기의 뜬공 아웃(결과 1)을 가른다 */
  let judgedKindThisCall: number = OUT_KIND.NONE

  /**
   * **플레이 vt30 = 0xb1c90 한 번** (`coverTick.runCoverTick`) — vt4c 끝 b4c72(1d 절, 매 틱) · 송구 0xb2e38 꼬리 b3094(예보 vt24(0) ·
   * 고르기 vt34 뒤) · 다시 쏘기 0xb3148 꼬리 b32b0(예보 vt24(1) · 고르기 vt34 뒤). 꼬리 둘은 판 종류(마스크 0x58c)를 안 본다.
   * 머리 관문: (+0x111 || +0x129) && 공+0x68 > 공+0xaa4 · state[7] == 0
   */
  const runCoverOnce = (): void => {
    const covered = runCoverTick({
      context: contextAt(tick),
      ballToFirstSide: catchPoint.x > basePosition(0).x,
      // b1ddc 공.vt68(0) — **지금** 공 궤적의 첫 점: 타구는 0xd8758, 송구 · 다시 쏘기(0xb3148)는 새로 깐 궤적의 첫 점(r162)
      ballStartPoint: ballSegmentStart,
      relayFlag,
      gateClosed: !wideFair || ((homeRunFlag || play.suppressed) && tick - ballLaunchTick > trajectory.fenceTick),
      foulFlag,
    })
    play = covered.play
    fielders = covered.fielders
    relayFlag = covered.relayFlag
  }

  /**
   * **공 가진 야수가 던질 준비가 됐나** — 0xafa60 · b4674 가 보는 `야수.vtC4()` = 0xa20ec
   * (`+0xb0 == 0 && +0xb4 ≤ 0 && +0xc8 ≤ 0`) 와 0xafa60 의 `AI 상태 ∉ {8, 9}`.
   * 쥐기 0xb2710(P, f, 1)이 +0xc8 에 준비 틱(내야 3 · 외야 6)을 넣고, 이 틱 머리(0절)의 야수 틱이 쥔 동안 하나씩 줄인다.
   * 상태 8(협살)은 CPU 수비에만 선다. 자세 워드 +0xb0 · 잠금 +0xb4 도 본다(`fielderPose.isReadyToThrow`, r171) — 포구 동작이
   * 세운 워드가 야수 틱에서 지워질 때까지 기다린다.
   */
  const isHolderReady = (): boolean => {
    const holder = fielders[play.ballHolderSlot]
    return (
      play.held &&
      holder !== undefined &&
      holder.holdingBall &&
      isReadyToThrow(holder) &&
      rundown.runnerIndex === NONE
    )
  }

  /**
   * **송구 0xb2e38**(플레이.vt5c, 인자 받을 야수 C · 특수) — 공 가진 야수가 C 에게 던진다. 던졌거나 미뤘으면(AI 9) 참.
   * 부르는 곳은 루로 보내기 0xb2c90(`sendToBase`)과 중계 이어 던지기 b4616 둘이다. 직접 뜬 것:
   * ```
   * b2e44: 공가진야수.vtC4()(준비, +0xc8 ≤ 0) 가 거짓이면 0
   * b2e6c: +0x154 = C ; +0x134 = +0x130 ; vt8c = 0xb3444 송구 계획 → +0x14c..+0x153 ([0] 중계 [1] 특수 [2] 던지는 야수
   *        [3] 받는 야수(중계면 중계맨) [4] 최종 받는 야수 [5] 1구간 틱 [6] 전체 틱 [7] 목표 루)
   * b2eb2: R = 야수[[3]] ; !R.vt18()(목표점에 없음) && R.vtc0() > [5] → b30a2 미루기:
   * b30a2:   공가진야수 AI == 9 → 0 / 아니면 +0x15c = [3] · +0x158 = [7] · AI 9 · 공가진야수.vt48([7]) ; 1
   * b2ee6: [3] ≤ 5 && [2] ≤ 5 → 플레이.vt64(0)(+0x1f4 레이저 = 0) · [1] = 0      ; 내야 → 내야는 레이저가 없다
   * b2f06: +0x1f4 면 vtb0 = 0xa222c(레이저) 뒤 vt64(0), 아니면 vtac = 0xa1620([1]) — 공은 R 의 목표점(+0x2c)으로
   * b2f80: 공가진야수+0xe0 = 0 ; b3070 +0x12c = 0 ; b307c vt24(0) 포구 예보 ; vt30 = 0xb1c90 ; 1
   * ```
   * 중계([0])면 받는 야수는 중계맨이고, 그가 쥐면(쥐기 0xb2710 — 준비 틱 내야 3) 플레이 틱 b4616 이 [4] 에게 다시 0xb2e38
   * 을 부른다(1a 절). 공은 0xa1620(레이저 0xa222c)이 쏘고 b2f8c 의 세계 0xbfed0 이 깐 뒤 b2f9c 가 점[T − 1] 에 받는 점을
   * 끼워 넣는다(`launchThrow`). 받는 야수 · 받는 틱은 b307c 예보 vt24(0) · 고르기 vt34 가 정하고, 받는 것은 보통 포구 틱
   * 갈래(1 절 — 펌블 굴림 b4228 · 쥐기 0xb2710 · 펌블이면 0xb3148 튕김)다. 원바운드(a17fc)도 같은 공(공+0xaac = 1)이다.
   */
  const throwBall = (
    fromSlot: number,
    coverSlot: number,
    base: number,
    chooser: ThrowChooser,
    cpuSpecial: boolean,
  ): boolean => {
    const holder = fielders[fromSlot]
    const receiverFinal = fielders[coverSlot]
    if (holder === undefined || receiverFinal === undefined) return false
    // vtC4 = 0xa20ec(+0xb0 == 0 && +0xb4 ≤ 0 && +0xc8 ≤ 0). 던지기 0xa1620 은 끝(a1a32)에서 야수+0xb1 = 1 을 세워
    // +0xb0 워드를 0 이 아니게 만든다 — 던진 야수는 그 동작이 끝날 때까지 vtC4 가 거짓이라 다시 못 던진다.
    // 그 잠금은 다음 야수 틱 0xa1284 의 a1406~a141a(`vtc8()` 거짓 → a143e)에서 걸음 없이 풀린다(U-78 — `fielderPose.listTickFielder`).
    // 웹은 공을 안 쥔 야수는 못 던지는 것으로 본다(0xa1620 머리 a165a 도 공 칸 +0xd0 이 비면 0 을 돌려준다).
    if (!holder.holdingBall || !isReadyToThrow(holder)) return false
    // 레이저 송구 — 반짝임 창 안에 새로 누른 키가 들어왔고 공을 쥐었으면 +0x1f4 (0x400bc)
    // b2f06 — 레이저 발사 0x400bc 가 세운 플레이+0x1f4 를 본다(발사는 슬롯 2 머리에서 따로 — 0b 절 끝)
    let laser = laserArmed
    const plan = planThrow({ fielders, fromSlot, finalSlot: coverSlot, base, special: laser || cpuSpecial })
    // b2e92~b2ea0: 계획을 +0x14c.. 에 덮어쓴다 — **미루기 검사(b2eb2) 앞**이라 미뤄도 새 계획이다(r214 — 예전 웹은 던질 때만 적었다).
    // 중계면 [0] = 1 · [4] = 최종 받는 야수 (b4616 이 본다). 레이저 · 특수는 0xb3444 가 중계를 안 끼운다(b3528)
    relayFinalSlot = plan.relayed ? coverSlot : NONE
    relayBase = plan.relayed ? base : NONE
    // b2eb2~b2ee4: 받는 야수(중계면 중계맨)가 목표점에 없고 1구간 틱 안에 못 닿으면 미룬다 (AI 9)
    const receiver = fielders[plan.toSlot]
    if (
      receiver !== undefined &&
      !isSamePoint(receiver.position, receiver.target) &&
      fielderArrivalTicks(receiver) > plan.firstLegTicks
    ) {
      if (holder.aiState === AI_STATE.RECEIVE) return false
      deferredThrowReceiver = plan.toSlot
      deferredThrowBase = plan.base
      const point = basePosition(plan.base)
      fielders = fielders.map((fielder) =>
        fielder.slot === fromSlot
          ? { ...fielder, aiState: AI_STATE.RECEIVE, target: point, targetBase: wrapBase(plan.base) }
          : fielder,
      )
      log.push(
        `${tick}틱 ${fromSlot}번 야수가 ${plan.base}루 송구를 미룬다 — ${plan.toSlot}번 야수가 늦다 (AI 9)` +
          (chooser === 'CPU' ? ' (CPU 결정)' : ''),
      )
      return true
    }
    // b2ee6: 내야수 → 내야수 송구면 레이저 표시를 지운다 (vt64(0))
    if (plan.toSlot <= 5 && fromSlot <= 5) {
      laser = false
      laserArmed = false
    }
    if (laser) laserThrow = true
    // CPU 홈 송구 20% 특수 송구 — 효과는 `cpuSpecialThrowOf` 참고. 레이저는 0xb2e38 이 다른 함수로 던진다(아래)
    const special = !laser && cpuSpecial ? cpuSpecialThrowOf(fielders, fromSlot, coverSlot) : NO_CPU_SPECIAL_THROW
    const relayed = plan.relayed && !laser && !special.special
    let thrown: ThrownBall
    // 공은 송구 계획 [3](중계면 중계맨, b2ea8)의 목표점(+0x2c)으로 쏜다
    const receiverTarget = fielders[plan.toSlot]?.target ?? basePosition(base)
    const ballBody = isBallTrajectory(trajectory) ? trajectory.flight.body : undefined
    if (laser) {
      // b2f06: 플레이+0x1f4(레이저) 면 0xa1620(vtac) 대신 야수 vtb0 = 0xa222c 로 던진다 (직접 뜬 것):
      //   a229c `+0xdc = 2000` 고정 속도 · 0xa1620 과 같은 h · w · φ 산술(0xa279d 중력 배율 · 0xbfab0 · cos) · **난수 굴림 없음**
      //   (0xbfa54 호출이 없다 — 악송구도 흔들림도 없다) · a23ae 공+0xaac = a23ba 공+0xaad = 0 이라 받는 점을 끼워 넣는다.
      //   특수라 0xb3444 가 중계도 안 끼운다(b3528).
      fielders = fielders.map((fielder) =>
        fielder.slot === fromSlot ? { ...fielder, throwSpeed: LASER_THROW_SPEED } : fielder,
      )
      // b2f06 — 레이저로 던진 뒤 vt64(0)
      laserArmed = false
      thrown = launchThrow({
        thrower: fielders[fromSlot],
        target: receiverTarget,
        laser: true,
        ability: fielderAbilityOf(abilities, fromSlot, DEFAULT_ABILITY),
        random: input.random,
        body: ballBody,
      })
    } else {
      // a16dc~a16ec: +0xdc = 특수 ? +0xd8 : +0xd4 — 던질 때 덮어쓰고 그 판 동안 남는다(`FielderState.throwSpeed`)
      fielders = fielders.map((fielder) => (fielder.slot === fromSlot ? thrownWith(fielder, special.special) : fielder))
      // 0xa1620 — 원바운드(a17fc: 특수 && 거리 > 20400)면 rand(0, 2) 한 번으로 φ ± 1 · 공+0xaac = 1 (악송구 · 흔들림 굴림 없음),
      // 아니면 악송구 굴림(a1828, CPU 특수 송구는 다섯째 인자 = 계획 [1] 로 기준 +100) · 악송구면 흔들기 굴림 둘 ·
      // 아니면 긴 송구 흔들림 굴림(a198c) — 그리고 세계 0xbfed0 · 받는 점 끼워 넣기(b2f9c)
      thrown = launchThrow({
        thrower: fielders[fromSlot],
        target: receiverTarget,
        special: special.special,
        bounce: special.bounce,
        ability: fielderAbilityOf(abilities, fromSlot, DEFAULT_ABILITY),
        random: input.random,
        body: ballBody,
      })
    }
    if (thrown.errant) errantThrow = true
    // a1908(악송구) · a17fc(원바운드) — 던진 야수 +0xc0 = 4 (그림 0x438c4 의 "!")
    if (thrown.errant || thrown.bounce) {
      throwErrorMarks = throwErrorMarks.map((value, slot) => (slot === fromSlot ? THROW_ERROR_MARK_TICKS : value))
    }
    const firstReceiver = relayed ? plan.toSlot : coverSlot
    throwBase = base
    throwArrivalTick = -1
    throwFromSlot = fromSlot
    throwReleaseTick = tick
    // 받을 야수는 예보가 고른다(아래) — 2 절의 "받은 야수 손으로 옮기기" 는 더 없다
    throwReceiverSlot = NONE
    throwCount += 1
    // 손을 떠난다 — 받을 야수 · 받는 틱을 다시 세운다 (b2f80 · b3070 · b307c)
    // a1a26~a1a3a(레이저 a240c~a2418) 동작 5 · 야수+0xb1 = 1 — 다음 야수 틱은 vtc8 이 거짓이라 걸음 없이(`canStepNextListTick`)
    // 워드를 지운다(`listTickFielder` — U-78). 그 틱의 예보 복제도 이 칸을 베낀다(`forecastCatch`)
    fielders = fielders.map((fielder) =>
      fielder.slot === fromSlot
        ? withThrowMotion({ ...fielder, holdingBall: false, actionRemainingTicks: 0 })
        : fielder,
    )
    play = {
      ...play,
      held: false,
      catchFielderSlot: firstReceiver === NONE ? play.catchFielderSlot : firstReceiver,
      catchTick: throwArrivalTick,
    }
    {
      // b307c vt24(0) — +0x130 = 던진 야수(t ≤ 4 건너뜀) · 그 복제는 +0xb1(a1a3a)로 첫 복제 틱 하나 더 빠진다 · a = 0 이라 궤적 끝까지
      // 못 줍으면 t = 10 부터 두 번째 패스 · vt34 = 0xb3b38 이 받을(주울) 야수를 AI 1 로. 받는 틱 = 그 포구 틱이다.
      // 보통 · 흔들린 · 레이저 송구는 공+0xaac = 0 이라 움직임허용 없음(복제가 제자리 · n 없음)이고, 던진 야수 · C(+0x154)가
      // 둘 다 내야(칸 ≤ 5)면 +0x1e8 = 1(b305a~b306c) — C 만 낮은 공 · 가슴 높이로 잡는다. 악송구는 움직임허용 모두 · +0x1e8 없음
      takeLooseBall(thrown.ball, forecastOptionsOf(thrown, fromSlot, coverSlot))
      receivingThrow = !thrown.loose
      throwArrivalTick = catchTick
      // b3094 vt30 = 0xb1c90 — 고르기 vt34 뒤의 공 가진 야수(받을 야수)로 커버를 다시 고른다 (r171)
      runCoverOnce()
    }
    if (firstThrowBase === NONE) {
      firstThrowBase = base
      firstThrowArrivalTick = throwArrivalTick
    }
    log.push(
      `${tick}틱 ${base}루로 ${laser ? '레이저 ' : ''}${cpuSpecial ? '특수 ' : ''}송구 — ${throwArrivalTick}틱 도착` +
        (relayed ? ` (${plan.toSlot}번 야수 중계)` : '') +
        (special.bounce ? ' (원바운드)' : '') +
        (thrown.errant
          ? ` (악송구 — ${chaserSlot}번 야수가 줍는다)`
          : thrown.wobbled
            ? ` (흔들린 긴 송구 — ${chaserSlot}번 야수가 받는다)`
            : '') +
        (chooser === 'CPU' ? ' (CPU 결정)' : chooser === '미룬' ? ' (AI 9 미룬 송구)' : chooser === '중계' ? ' (중계 이어 던지기)' : '') +
        ` (${fromSlot}번 야수)`,
    )
    return true
  }

  /**
   * **루로 보내기 0xb2c90**(플레이.vt58, 인자 루·특수) — 성공(1)이면 참. 직접 뜬 것:
   * ```
   * b2cb4: C = +0xf0[루 & 3]
   * b2cc4: C == −1 → 공 가진 야수 AI 상태 6 · vt48(루) = 직접 들고 뛴다 ; 0
   * b2cf0: C.vt68()(목표 루) ≠ 루 → 0
   * b2d14: t_run = 공가진야수.vt1c(루 좌표) ; t_throw = 공가진야수.vtb8(C 목표점) ; t_recv = C.vtc0()
   * b2d64: t_run ≤ max(t_throw, t_recv) → 0xb2a48(P, +0x130, 루) 직접 밟으러 간다 ; 1
   * b2d7e: 거리(공가진야수, C) > 600 이고 C ≠ 자신 → +0x154 = C, vt5c(C, 특수) = 0xb2e38 송구 ;
   * b2df4:   그 결과가 참이고 공가진야수가 커버 상태(0xa0ff4: AI 2~5)도 AI 9 도 아니면 AI 0 ; 그 결과
   *        아니면 아무것도 안 함 ; 0
   * 0xb2a48(P, f, 루): 옛 커버 C(−1 · f 가 아니면) AI 0 ; +0xf0[루] = f ; f.vt48(루) ; f AI 루 + 2
   * ```
   * 실패(0)하면 0xafa60 은 +0x128 을 안 지워 다음 틱에 다시 고른다.
   * AI 0 은 플레이 틱 b476a 가 야수를 시작 자리 0xd86ec 로 걷게 한다(`moveFielder`).
   */
  const sendToBase = (fromSlot: number, base: number, chooser: ThrowChooser, cpuSpecial: boolean): boolean => {
    const holder = fielders[fromSlot]
    if (holder === undefined) return false
    const coverSlot = play.coverOfBase[wrapBase(base)] ?? NONE
    const basePoint = basePosition(base)
    if (coverSlot === NONE) {
      /** 공 든 채 루로 (AI 상태 6 · vt48(루)). 같은 루로 이미 가고 있으면 새로 적지 않는다 — 0xafa60 이 매 틱 다시 고른다 */
      if (holder.aiState === AI_STATE.CARRY && holder.targetBase === base) return false
      fielders = fielders.map((fielder) =>
        fielder.slot === fromSlot
          ? { ...fielder, target: basePoint, targetBase: base, aiState: AI_STATE.CARRY }
          : fielder,
      )
      log.push(`${tick}틱 ${fromSlot}번 야수가 ${base}루로 공을 들고 뛴다 (커버 없음)`)
      return false
    }
    const cover = fielders[coverSlot]
    // b2cf0 C.vt68() = 0xa0b4c — 목표점(+0x2c)이 어느 루 좌표와 같은가(아니면 −1). 칸으로 든 목표 루가 아니라 목표점으로 본다(r180)
    if (cover === undefined || baseAtPoint(cover.target) !== base) return false
    const runTicks = ticksToReach(holder.position, basePoint, holder.speed)
    const throwTicks = throwTicksTo(holder, cover.target)
    const receiveTicks = fielderArrivalTicks(cover)
    if (runTicks <= Math.max(throwTicks, receiveTicks)) {
      // 0xb2a48 — 공 가진 야수가 그 루의 커버가 된다(`claimCoverOfBase`). 옛 커버는 AI 0 만 — 목표 · 목표 루(+0x7c)는 그대로
      // 두고 다음 걸음 전 AI 0 b476a 가 vtcc 면 시작 자리로 고친다(r180 — 예전 웹은 여기서 시작 자리 · 목표 루 −1 로 바로 적었다)
      if (coverSlot !== fromSlot) {
        const claimed = claimCoverOfBase(play, fielders, fromSlot, base)
        play = claimed.play
        fielders = claimed.fielders
        if (runTicks > 0) log.push(`${tick}틱 ${fromSlot}번 야수가 ${base}루를 직접 밟으러 간다`)
      }
      return true
    }
    if (coverSlot === fromSlot || horizontalDistance(holder.position, cover.position) <= MINIMUM_THROW_DISTANCE) {
      return false
    }
    const thrown = throwBall(fromSlot, coverSlot, base, chooser, cpuSpecial)
    if (thrown) {
      // b2df8~b2e14: 던진 야수가 커버(AI 2~5)도 AI 9 도 아니면 AI 0 — 시작 자리로 돌아간다
      fielders = fielders.map((fielder) =>
        fielder.slot === fromSlot && !isCoverState(fielder.aiState) && fielder.aiState !== AI_STATE.RECEIVE
          ? { ...fielder, aiState: AI_STATE.IDLE }
          : fielder,
      )
    }
    return thrown
  }

  /**
   * **판 도중 새로 깐 공을 누가 줍나** — 다시 쏘기(0xb3148 b3294 vt24(1))와 악송구(0xb2e38 b307c vt24(0))가 같은 뒤처리다:
   * 공+0x68 = 0(b12da)이라 새 궤적을 이 틱부터 잇고(`spliceTrajectory`), 예보 0xb12d0 → 고르기 0xb3b38(+0x130 = 고른 야수, AI 1).
   * 필살수비 창(+0x1f5 · +0x1f6)과 +0x127 은 판 내내 남아 있는 플레이 칸이라 이 예보도 본다. 줍는 것은 보통 포구 틱 갈래
   * (펌블 굴림 · 쥐기 0xb2710)다. state[0x1f] 는 다시 쏘기(b323c)만 지운다 — 송구 0xb2e38 은 안 건드린다.
   */
  const takeLooseBall = (
    next: BallTrajectory,
    options: {
      readonly initialChaserSlot: number
      readonly thrownSlot?: number
      readonly secondPass?: { readonly movable: boolean }
      readonly onlySlot?: number
    },
  ): void => {
    receivingThrow = false
    trajectory = spliceTrajectory(trajectory, tick, next)
    ballSegmentStart = next.pointAt(0)
    ballLandingTick = next.landingTick < 0 ? -1 : tick + next.landingTick
    // b12da — 공+0x68 = 0 : 이 그림은 공을 안 그린다(0x36dfc 36e24)
    ballLaunchTick = tick
    const forecast = forecastCatch(next, fielders, { from: 0, to: Number.POSITIVE_INFINITY }, {
      ...options,
      jumpUnlocked: state.specialDefense.jumpUnlocked,
      slideUnlocked: state.specialDefense.slideUnlocked,
      chaseToLanding: landingChase,
    })
    // b1376~b1398 · b189a — 움직임 허용 +0x13c 는 예보마다 다시 적힌다(AI 1 b4af6 이 본다, r196)
    state.forecastMovable = forecast.movable
    // b188a — 송구 예보(a = 0)가 궤적 끝까지 못 줍고 두 번째 패스로 가면 그때의 +0x130(= 던진 야수, b307c 앞)의 +0xc0 = 4
    if (forecast.secondPassStarted && options.thrownSlot !== undefined) {
      const thrower = options.thrownSlot
      throwErrorMarks = throwErrorMarks.map((value, slot) => (slot === thrower ? THROW_ERROR_MARK_TICKS : value))
    }
    // 고르기 vt34 = 0xb3b38 끝의 필살 표시 지우기 — r0 는 b3cb2 에서 0 이고 슬라이딩 갈래(+0x16c = 4, b3d2c)만 1 이다:
    //   b3da4 +0x1f7 = 0 → b3dac r0 == 0 이면 b3db0 +0x1f8 = 0. 점프 갈래(+0x16c = 3)는 b3d16 에서 b3db0 으로 곧장 뛰어
    //   +0x1f7 을 안 지운다. 곧 점프면 +0x1f8 만 · 슬라이딩이면 +0x1f7 만 · 그 밖은 둘 다 지운다(원본 그대로)
    if (forecast.choice.kind !== CATCH_KIND.JUMP) deadlyJumpArmed = false
    if (forecast.choice.kind !== CATCH_KIND.SLIDE) deadlySlideArmed = false
    chaserSlot = forecast.choice.slot
    catchTick = Math.max(tick, Math.min(tick + forecast.choice.catchTick, maximumTicks))
    // b12da~b1334 · b3b38 — 새 공의 +0x178 · +0x174 (첫 점이 표준 배팅 지점이 아니면 다이빙 후보가 없다)
    diveTicks = forecast.diveTicks
    diveCatchTick = forecast.choice.catchTick
    const caughtAt = next.pointAt(catchTick - tick)
    // 추적야수 AI 1(0xb4aca~0xb4b5a)은 포구 틱 점의 (x, 0, z) 로 간다(0xa100c) — 송구공 · 타구 · 다시 쏘기(0xb3148) 모두.
    // 송구는 받는 점 (목표 x, 1000, 목표 z) 에서 받으면 그 루 위에 선다(쥐기 0xb2710 은 야수를 옮기지 않는다)
    catchPoint = groundPointOf(caughtAt)
    fielders = fielders.map((fielder) =>
      fielder.slot === chaserSlot
        ? forecast.fenceChasePoint !== null
          ? // 0xb3b38 담장 갈래 — AI 0xb · +0x90 = 담장 앞 공점(aa4 − 2)의 (x, 0, z). 목표(+0x2c)는 안 적는다 — AI 고리 b4b5c 가
            // vt14(+0x90)로 적는다(1c 절, r214 — 예전 웹은 여기서 목표에 바로 적었다)
            { ...fielder, pickUpPoint: forecast.fenceChasePoint, aiState: AI_STATE.PICK_UP, holdingBall: false }
          : // b3e4e — 이미 AI 0xb 인 야수는 AI 1 로 안 바꾼다(머리의 되돌리기도 1 · 0xc 만 본다).
            // b3e54 는 AI 1 만 걸고 목표(+0x2c)는 안 적는다 — 포구점은 AI 고리 b4aca(1c 절)가 움직임 허용 +0x13c 를 보고 vt14 로 적는다
            // (r201 — 예전 웹은 여기서 포구점을 바로 적어, 슬롯 2 뒤쪽 CPU 송구(526ae)를 받는 야수가 한 틱 일찍 걸었다)
            {
              ...fielder,
              aiState: fielder.aiState === AI_STATE.PICK_UP ? AI_STATE.PICK_UP : AI_STATE.CHASE,
              holdingBall: false,
            }
        : fielder.aiState === AI_STATE.CHASE || fielder.aiState === AI_STATE.BACKUP
          ? // 0xb3b38 머리 b3b7a~b3b9a — AI(+0x84) 1 · 0xc 인 야수는 0xb8dbc(야수+0x80, 0)로 AI 0. 송구(0xb2e38)도 다시 쏘기도
            // 같은 고르기를 부른다 — 다시 쏘기 0xb3148 은 b3294 vt24(1) → b32a4 vt34(= 0xb3b38) → b32ae vt30
            { ...fielder, aiState: AI_STATE.IDLE, holdingBall: false }
          : fielder.holdingBall
            ? { ...fielder, holdingBall: false }
            : fielder,
    )
    // b3f5c — 백업 갈래(`CatchForecast.backupSlot`, r180): 머리 b3b7a 가 AI 1 · 0xc 를 0 으로 내린 뒤 고른다
    if (forecast.backupSlot >= 0) {
      fielders = fielders.map((fielder) =>
        fielder.slot === forecast.backupSlot ? { ...fielder, aiState: AI_STATE.BACKUP } : fielder,
      )
    }
    play = {
      ...play,
      held: false,
      ballHolderSlot: chaserSlot,
      catchFielderSlot: chaserSlot,
      catchKind: forecast.choice.kind,
      catchTick,
      actionStartTick: tick + forecast.choice.actionStartTick,
      earliestCatchTick: forecast.earliestCatchTick === NO_FORECAST_CATCH ? 0xffff : tick + forecast.earliestCatchTick,
    }
  }

  /**
   * **플레이.vt70 = 0xb3148 — 공을 야수에게서 튕겨 다시 쏜다** (직접 뜬 것). 틱 끝 b45a0 이 사건(sp+0x24)이면 부른다.
   * ```
   * b3148 p = 공.vt60(지금 점) ; 속도 = max(p.속도·60/100, 300) · v0 = min(p.수직속도·30/100, 100) · 각 = p.각 + rand(−20, 20)
   * b31c8 f = 0xb0c90(+0x130 공 가진 야수) ; f+0xb4 ≤ 0 && !f+0xbc 면 f.vt10
   * b3200 0xbef58(공, f 위치) · 공.vt44(속도, v0, 각) · 메시지 0x12 → 세계 0xbfed0 (궤적 다시 깔기, 0x51f2e)
   * b323c state[0x1f] = 0 · (파울이면 state[0x1c] 다시) · state[0x20] = aa4 · state[0x80] = ab0 · +0x12c = 0
   * b3294 vt24(1) = 0xb12d0 예보(공+0x68 = 0 — b12da) · vt34 = 0xb3b38 고르기 · vt30 = 0xb1c90 커버
   * ```
   * 무작위 방향으로 튀기는 vt78 = 0xb32e8 은 부르는 곳을 못 찾았다(vtable 0xd8690 외 참조 없음) — 펌블도 이 0xb3148 이다.
   * 다시 쏜 공은 속성 목록 +0x5c 가 0xa2610 에서 비워져 필살타법 표시(비트 4)가 없는 보통 공이다.
   */
  const relaunchFromFielder = (): void => {
    if (trajectory.pointDetailAt === undefined) {
      // 손으로 만든 시험 궤적 — 원본 점 칸이 없어 다시 쏠 수 없다. 공은 그 자리에 둔다
      log.push(`${tick}틱 공 튕김 — 궤적 칸이 없어 다시 쏘지 않는다`)
      return
    }
    const point = trajectory.pointDetailAt(tick)
    const speed = Math.max(Math.trunc((point.speed * 60) / 100), 300)
    const verticalSpeed = Math.min(Math.trunc((point.verticalSpeed * 30) / 100), 100)
    // rand(−20, 20) — 난수가 없으면 굴리지 않고 0 (이 진행기의 규약)
    const turn = input.random === undefined ? 0 : input.random.rand(-20, 20)
    const holder = fielders[chaserSlot]
    // b31c8~b31f0 — f = 0xb0c90(+0x130 공 가진 야수) ; +0xb4 ≤ 0 && +0xbc == 0 이면 f.vt10: 동작 0 · 자세 워드 0 (r171).
    // 펌블한 포구 동작의 워드는 여기서 지워진다. 필살타법 타구에 맞은 야수는 같은 틱 b4588 vt74 의 잠금(+0xb4 = 15)이 먼저라 안 지운다
    fielders = fielders.map((fielder) =>
      fielder.slot === play.ballHolderSlot && fielder.actionLockTicks <= 0 ? withPoseCleared(fielder) : fielder,
    )
    const next = launchTrajectory({
      from: holder.position,
      speed,
      verticalSpeed,
      angle: point.angle + turn,
      random: input.random,
      body: isBallTrajectory(trajectory) ? trajectory.flight.body : undefined,
    })
    uncatchable = false
    // b323c state[0x1f] = 0 — 다시 쏜 공을 줍는 것은 뜬공 포구가 아니다(타자주자는 결과 코드 다리대로 1루 송구 도착에)
    onTheFly = false
    // vt24(1) — 예보는 새 궤적 t = 1 → 끝 · 추적야수(+0x130 = f)는 t ≤ 4 를 건너뛴다. 낙구 구간으로 자르지 않는다.
    // 복제는 진짜 야수를 통째로 베끼므로 필살타법 타구에 맞은 야수의 동작 잠금 +0xb4 = 15(b4594 vt74)도 따라간다 — 그 틱 동안은
    // 판정도 n 도 없다.
    takeLooseBall(next, { initialChaserSlot: chaserSlot })
    // b32b0 vt30 = 0xb1c90 — 새 고르기 뒤 커버 한 번 (r171)
    runCoverOnce()
    log.push(
      `${tick}틱 공 튕김 (0xb3148) — 속도 ${speed} · v0 ${verticalSpeed} · 각 ${point.angle + turn} · ${chaserSlot}번 야수가 ${catchTick}틱에 줍는다`,
    )
  }

  /**
   * **CPU 송구 결정 0xafa60** — 플레이+0x128 이 서 있고 공 가진 야수가 준비됐을 때 점수식 0xafb24 로 루를 고르고
   * (홈이면 20% 특수 굴림), 0xb2c90 이 성공하면 +0x128 = 0. 공 가진 야수가 AI 8(협살)·9(미룬 송구)면 안 고른다.
   */
  const cpuThrowDecision = (): void => {
    if (!play.wantsThrow || !isHolderReady()) return
    if (fielders[play.ballHolderSlot]?.aiState === AI_STATE.RECEIVE) return
    const active = runners.filter((runner) => !runner.state.isOut && !runner.state.scored).length
    const base = chooseThrowTargetBase({ ...contextAt(tick), activeRunnerCount: active, outs })
    if (base === NONE) return
    // afad2: 홈(0)을 골랐을 때**만** rand(0,100) — 0xb2c90 이 실패해도 굴림은 먹는다
    const cpuSpecial =
      base === 0 && input.random !== undefined && isSpecialThrow(base, input.random.rand(0, 100))
    if (sendToBase(play.ballHolderSlot, base, 'CPU', cpuSpecial)) {
      // afafc +0x128 = 0 · afb08 0xb0ea0 — 송구 계획(+0x14c)을 지운다(r214, 직접 뜸). CPU 가 정한 먼 송구는 중계맨이 받아도
      // b4616 이 잇지 않고, 쥐기의 +0x128 로 이 결정이 다시 고른다
      play = { ...play, wantsThrow: false }
      relayFinalSlot = NONE
      relayBase = NONE
    }
  }

  // 아래 묶음은 예전 `for (let tick = 0; …)` 루프의 **몸통 그대로**다.
  // 한 줄도 안 옮기려고 묶음(블록)만 씌워 두었다 — 결과가 한 톨도 달라지면 안 되는 자리다.
  {
    outJudgedThisTick = false

    // ── 0'. 야수 틱 0xa1284 의 준비 틱 줄이기 (직접 뜬 것) ──
    // ```
    // 52c50: 장면 갱신 — 52e16 공용 갱신 0x3f060 → (상태 0x17 이면) 52e94 0x524c0(슬롯 2: 플레이 틱 · 자동 진루 · CPU 송구)
    // 3f0d2: 0x3f060 은 플레이가 돌고 상태 0x17 이면 장면+0x1e4 객체 목록.vt8 = 원소마다 vt0xc — 야수 9명(3e660, new(0xf4)
    //        + 0xa0e08)·주자가 이 목록에 들어 있다(0xc0104)
    // a1312: 야수 vt0xc = 0xa1284: (+0xb4 동작 잠금이 0 일 때) +0xc8 > 0 && +0xe0(공 쥠) 이면 +0xc8 −= 1 (0 아래로 안 감)
    // ```
    // 곧 **야수 틱이 플레이 틱보다 먼저** 돈다 — 포구 틱에 쥐기(0xb2710)가 넣은 준비 틱 R 은 다음 틱부터 줄어
    // 포구 R 틱 뒤에 0 이 된다. 쥔 동안만 줄고, +0xc8 을 넣는 곳은 쥐기(vt88, b27aa·b27be)뿐이다.
    // a12b4: 동작 잠금 +0xb4 > 0 이면 −1 만 하고(0 이 되면 a12c8 +0xbd = 1 · vt10) a12c6/a12d6 에서 끝 — 그 틱은 +0xb8 · +0xc0 ·
    // +0xc8 · +0xcc 줄이기도 이동(a1376 0xbf094)도 없다. 이동을 막는 쪽은 6 절이 그때의 +0xb4 로 본다(그 걸음은 다음 야수 틱 몫)
    // a12c8 의 vt10(0xa124c: 0xbf2b0 목표 = 위치 · +0xa8 · +0xb0~+0xb3 · +0xbc · +0xb4 · +0xe8 = 0) — r176 부터 목표 = 위치도 옮긴다
    // (`fielderPose.withPoseCleared`). 아래 r158 의 "다시 세운다" 는 AI 가 목표를 고치는 칸에서만 맞다 — 쥔 AI 1 야수(b4ae6)는 안 고쳐
    // 포구 동작을 지운 vt10 에서 선다(쥐기가 야수를 옮기지 않게 되며 드러났다). r158 기록: 같은 틱 슬롯 2 0x524c0 의 차례가 vt48 0xb401c(525e8) → vt18(525fc) → vt4c AI 고리 0xb45dc(52612) → 그 끝 vt30 0xb1c90(b4c72)라,
    // 다음 야수 틱 걸음 전에 AI 가 목표를 다시 세운다 — AI 0 b476a(vtcc 면 목표 ≠ 시작 자리 → vt50) · 1 b4aca(0xa100c 포구점) ·
    // 2~5 b47f2 → b482c vt14(루) · 0xb b4b5c vt14(+0x90) · 키스톤 자리 b203a vt14. 맞은 야수는 다시 쏘기의 고르기(b3b38 머리 b3b7a)가
    // AI 1 → 0 으로 내려 이 밖의 상태(6 · 7 · 9 · 0xd · 0xe — 목표를 안 고치는 칸)에 있을 수 없고, 웹 6 절은 AI 상태로 목표를 다시
    // 고르므로 걸음이 같다. 그 사이 목표를 읽는 b1268(H 목표, b1d10)도 AI 고리 뒤다. +0xe8 · +0xbc 는 웹 판에 칸이 없다.
    // 동작 번호 +0xa8 · 프레임 +0xac · 자세 워드 +0xb0 는 r171 부터 든다(`fielderPose` — 지우기 a137a~a1456 도 이 야수 틱이다)
    // 잠긴 야수(+0xb4 > 0)는 6 절 걸음이 없고 vt14 도 목표를 안 받는다 — AI 0xc(백업 b4b78)는 1c 절이 같은 관문으로 고친다(r180).
    // 키스톤 자리 잡기 b203a 의 목표도 vt14 관문(잠금 · vtc8)을 지난다 — AI 0xa 만 관문 없이 건다(`coverTick`, r190 — 예전 웹은 관문 없이
    // 적었다. 표 전체에서 관문에 막힌 호출 5932 번이 결과 · 로그 · 그림 어느 것도 바꾸지 않았다: 막힌 동안은 안 걷고 지우기 vt10 이 목표 =
    // 위치로 되돌려 다음 b203a 가 다시 적는다)
    // 키 건너뛰기가 풀린 그림 다음 그림의 목록 틱(아래 9 절 `extraListTick`)도 같은 몫을 돈다
    const listTickHead = (): void => {
      const lockedThisTick = fielders.map((fielder) => fielder.actionLockTicks > 0)
      // a12da · a12e6 — 잠금이 없는 틱에만 +0xb8 · +0xc0 을 −1 (그림의 "!" 표시만 본다)
      fumbleMarks = fumbleMarks.map((value, slot) => tickMarkCounter(value, lockedThisTick[slot] === true))
      throwErrorMarks = throwErrorMarks.map((value, slot) => tickMarkCounter(value, lockedThisTick[slot] === true))
      // a1286 프레임 +1 · 잠금 · 준비 틱 · 자세 워드 지우기 a137a~a1456 (`fielderPose.listTickFielder`, r171)
      fielders = fielders.map(listTickFielder)
    }
    // 경기 멈춤(+0x1993)이 머리에서 서 있으면 0x3f060 이 3f0a4 에서 돌아가 목록 틱(야수 · 주자)이 없다
    if (!pausedAtHead) listTickHead()

    // ── 0. 사람 조작 (상태 0x17 갈래 0x53420 — I-controls 0·2b·3b절) ──
    // 예전에는 `input.controls?.keyAt(tick)` 로 미리 물어봤다. 이제는 **이번 틱에 눌린 키**를 받는다
    const press = key
    // 한 틀에 누름 · 되풀이가 함께 오면 0x498d4 가 누름 → 되풀이 차례로 0x53420 에 둘 다 보낸다
    const keyControls = input.controls
    for (const keyPress of framePressesOf(press)) {
      if (keyControls === undefined) break
      // 누르고 있어서 되풀이된 키는 귀루 셋이 안 먹는다 — 원본 `[조작+0x1c] & 0xf0`(경기+0x6c 비트 4~7)
      const command = inPlayCommandOf(keyPress.key, keyControls.side, {
        isHoldRepeat: keyPress.isRepeat === true,
      })
      if (command !== null && !play.finished) {
        if (command.kind === '송구') {
          // 메시지 0x588 → 플레이 vt0x60 → 플레이+0x160. 자동 규칙(0xb1c90)보다 늘 앞선다
          play = { ...play, manualThrowBase: command.target }
          log.push(`${tick}틱 사람이 ${command.target}루로 송구 지시`)
        } else if (command.kind === '슬라이딩') {
          // 메시지 0x585 → 0x518da
          const decision = slideOnKey({
            playKind: play.kind,
            // 인플레이 진행기는 페어 타구만 돌린다 — 파울이면 여기까지 오지 않는다
            isFoulBattedBall: false,
            runners: runners.map(slidingRunnerOf),
            isSoundPlaying: false,
            hasPlayedSoundThisPlay: slidingSoundPlayed,
          })
          if (decision.playsSound) {
            slidingSoundPlayed = true
            slidingSoundThisTick = true
            // 키 처리 0x498d4 는 그림 머리 0x3f060(52e16) 카메라보다 먼저다 — 이 틱 소리 차례의 맨 앞
            tickSounds.unshift({ kind: 'sound', soundId: SLIDING_SOUND_EFFECT })
          }
          for (const index of decision.slidRunnerIndexes) {
            const runner = runners[index]
            if (runner.state.sliding) continue
            // 슬라이딩의 이득은 딱 하나, 속도 +40 (0xa0164 · R3 3절)
            runner.state = {
              ...runner.state,
              sliding: true,
              speed: runner.state.speed + SLIDING_SPEED_BONUS,
            }
          }
          if (decision.slidRunnerIndexes.length > 0) {
            log.push(`${tick}틱 슬라이딩 — 주자 ${decision.slidRunnerIndexes.join('·')}`)
          }
        } else {
          // 메시지 0x582(진루) · 0x584(귀루) → 0x5209e / 0x5222a → 0xa9b04 (`entities/fielding/model/baserunningKey`)
          // 0x5209e 는 플레이+0x111(홈런)이면 아무것도 안 하고, 아니면 경기+0x24 = 0 뒤 0xa9b04 — 주자를 움직이면 경기+0x24 = 1 ·
          // 플레이+0x128 = 1. 앞뒤가 서로 밀어내는 것이 **원본 그대로**라 그 순서를 지킨다. 판 종류는 0xae794 가 {1, 4, 5, 9} 만 받는다
          // (사건 6 · 7 · 10 이 판 종류를 바꾼 뒤로는 안 먹는다)
          const keyed = applyBaserunningKey(
            {
              playKind: play.kind,
              homeRunFlag,
              runners: runners.map((runner) => runner.state),
              previousTargets: runners.map((runner) => runner.previousTarget),
            },
            command.kind,
            command.runner,
          )
          if (keyed.handled) autoBaserunning = false
          runners.forEach((runner, index) => {
            runner.state = keyed.runners[index] ?? runner.state
            runner.previousTarget = keyed.previousTargets[index] ?? runner.previousTarget
          })
          if (keyed.succeeded) {
            autoBaserunning = true
            play = { ...play, wantsThrow: true }
            log.push(`${tick}틱 ${command.kind} — 주자 ${keyed.retargeted.map((index) => runners[index]?.state.index).join('·')}`)
          }
        }
      }
    }

    // ── 0b. 레이저 송구 반짝임 창 (0x523bc · 0xb2648 · 0x4e858 — I-controls 2d) ──
    //
    // ⚠️ 굴림(0x66a8c)은 **사람·CPU 를 가리지 않고** 돈다. 0x523bc 를 그대로 읽으면
    //   0x523d6  [this+0x19af] ≠ 0 → 반환        ; 한 플레이 한 번
    //   0x523e0  [this+0x1094] > 0  → 반환
    //   0x523e6  공 가진 야수가 있으면 외야수(0xb8da8 — 칸 6~8)가 아닐 때 반환, 없으면 건너뜀
    //   0x52408  [경기+0x19] ≠ 0 → 반환
    //   0x5242a  창 0xb2648(플레이) 거짓 → 반환
    //   0x5243e  주자 수 0xa9598 == 0 → 반환
    //   0x52456  0x66a8c(…) 굴림 → 떨어져도 0x5248c 에서 `+0x19af = 1`
    //   0x52468  통과하면 `경기[0x31 + 경기[0xa]]` 가 0(사람)이면 `+0x19ad`(반짝임),
    //            아니면(CPU) `+0x19ae`(곧바로 레이저)
    // 즉 **굴림은 갈림 앞**에 있다. 예전 웹판은 `controls.side === '수비'` 로 굴림째 막아
    // CPU 수비 타구에서 난수를 한 번 덜 뽑아 원본과 차례가 어긋났다 — 그 자리를 바로잡는다.
    //
    // 주자 수(0xa9598) 관문은 따로 옮기지 않았다 — 이 진행기의 `runners` 에는 타자주자가 늘
    // 들어 있어 타구 플레이에서는 언제나 참이다.
    // 슬롯 2 머리 524c4: +0x1992 == −1(레이저 연출이 쉴 때)일 때만 0x523bc · 0x4e858 · 0x400bc 를 돈다
    // 0x523e6 의 외야 관문(공 가진 야수 0xb8da8 — 칸 6~8)은 `laserWindowTick` 이 본다(r201 — 예전 웹은 "준비됐는지" 로 읽어 빠뜨렸다)
    if (!uncatchable) {
      const holder = fielders[play.ballHolderSlot]
      const windowTick = laserWindowTick({
        flags: { shining: laserShining, confirmed: laserConfirmed, rolled: laserRolled },
        random: input.random,
        effectStep: scene.effectStep,
        ticksSinceCatch: tick - catchTick,
        hasChosenThrowTarget: play.manualThrowBase !== NONE,
        isBallHeld: play.held,
        holder,
        // 66a94: 공 가진 야수(0xb0c90)+0xec 의 수비 — 투수 칸 0 은 공수 교대 판이 넣은 지명타자(`recordPlayerAbilityOf`)
        holderAbility: recordPlayerAbilityOf(abilities, play.ballHolderSlot, DEFAULT_ABILITY),
        holderSkillIds: input.fielderSkillIds?.[play.ballHolderSlot] ?? [],
        defenseIsCpu,
        press,
      })
      laserShining = windowTick.flags.shining
      laserConfirmed = windowTick.flags.confirmed
      laserRolled = windowTick.flags.rolled
    }

    // ── 0c. 레이저 발사 0x400bc (슬롯 2 머리 524e2) → 경기 멈춤 +0x1993 (직접 뜸) ──
    // ```
    // 400ce  +0x19ae(레이저 확정) · 플레이+0x160 ≠ −1(사람이 고른 송구 목표) · 플레이+0x12c(쥠) · 공 가진 야수(0xb0c90).vtC4(준비)
    // 40100  → +0x1992 = 0(연출 단계) · +0x1991 = +0x1990 = 1 · **+0x1993 = 1** · 플레이 vt64(1)(+0x1f4 = 1)
    // 524e6  +0x1993 이면 슬롯 2 를 통째로 건너뛴다(G2 · 플레이 틱 · 자동 진루 · CPU 송구) — 이 그림부터
    // ```
    // 다음 그림은 0x3f060(3f0a4 — G1 · 목록 틱) · 0x3f378(3f392 — G4) · 슬롯 2 가 모두 건너뛰고, 그리기 0x46c88 만 돈다(0x4403c 단계 ·
    // G3). 연출 0x4403c(그리기 46e08)가 단계 0 에서 +0x1997 · +0x19ad · +0x19ae 를 내리고 단계 1 에서 줌 0xbb39d 와 함께 +0x1993 = 0 —
    // 곧 **발사한 그림의 슬롯 2 와 다음 그림의 갱신 전부**가 빠진다. 송구는 그 뒤 그림의 플레이 틱(사람 목표 b4660)이 +0x1f4 로 던진다.
    // +0x1993 을 세우는 곳은 0x400bc 하나다(0x441c4 · 0x44398 은 내리기만 한다) — 멈춤은 레이저 송구 판에만 선다.
    if (
      canFireLaserNow({
        effectStep: scene.effectStep,
        pausedAtHead,
        confirmed: laserConfirmed,
        hasChosenThrowTarget: play.manualThrowBase !== NONE,
        isBallHeld: play.held,
        holder: fielders[play.ballHolderSlot],
      })
    ) {
      scene = fireLaser(scene)
      gamePaused = true
      laserArmed = true
      laserTrailOn = true
      pausedThisTick = true
      // 앞 틱 끝에서 센 G2(52502)는 524e6 뒤라 원본은 부르지 않았다
      endCounter = state.counterBeforeHead
      log.push(`${tick}틱 레이저 발사 (0x400bc) — 경기 멈춤 +0x1993`)
    }

    // 멈춘 그림은 슬롯 2(포구 · 송구 · 협살 · 자동 진루 · CPU 송구)가 없다 — 그림(5 절)은 그대로 남긴다
    slot2: {
    if (gamePaused) break slot2

    // ── 0d. 필살 포구 연출 켜기 — 슬롯 2 머리 5256c~525dc (관문 G2 52502 가 열리고 판 종류가 마스크 0x58c 밖일 때) ──
    // 플레이+0x1f7 이면 +0x1994(B), 아니고 +0x1f8 이면 +0x1995(C) — 단계가 −1 이면 0. 켜짐 칸은 앞 그림 플레이 틱의 동작 시작이 세웠다
    // 5254c — +0x1991(레이저 잔상) && 0xb4c9d(포구 대기 · 동작 시작 틱 − 1 == 공 틱)면 +0x1991 = 0 · 이 그림의 켜기를 건너뛴다(525de).
    // 0xb4c9c = 플레이 vt50(0xb2ac8 — 아래 포구 관문과 같은 다섯 칸 +0x12c · +0x111 · +0x124 · +0x129 · +0x110 이 모두 0) && 공 틱 == +0x176 − 1
    const catchGateOpen = !play.held && !homeRunFlag && !groundRuleFlag && !play.suppressed && !foulFlag
    if (laserTrailOn && catchGateOpen && tick === play.actionStartTick - 1) {
      laserTrailOn = false
    } else if (!play.finished && !DEADLY_FLASH_BLOCKED_PLAY_KINDS.includes(play.kind)) {
      scene = turnOnDeadlyFlash(scene, { jump: deadlyJumpArmed, slide: deadlySlideArmed })
    }

    // ── 1. 포구 ──
    // 포구 틱 갈래 전체(b4074~b42ce: 동작 시작 · 펌블 굴림 · 필살타법 표시 · 결과 코드 9 · 쥐기)는 플레이 틱 0xb401c 머리
    // b4064 의 플레이.vt50 = 0xb2ac8 이 참일 때만 돈다(직접 뜬 것):
    // ```
    // b2aca +0x12c(쥠) · b2ad8 +0x111(홈런 · 사건 8) · b2ae2 +0x124(바운드 담장 넘김 · 사건 10) · b2aec +0x129(폴 홈런 · 사건 12) ·
    // b2af6 +0x110(파울 · 사건 7) 가 모두 0 일 때만 1 — 하나라도 서면 b4072 b b42ce 로 포구 틱 갈래를 통째로 건너뛴다
    // ```
    // 사건 코드는 같은 틱 뒤쪽 b44f6(6d 절)이 세우므로 담장선 · 낙구 틱에는 그 틱의 포구가 먼저 돈다. 그 뒤로는 아무도
    // 공을 쥐지 않아(펌블 굴림도 없다) 담장을 넘은 공으로 주자를 잡을 수 없다. 예전 웹은 이 관문이 없어 담장선을 넘어 홈런
    // 사건이 선 공을 쫓아간 야수가 쥐고 던져 홈에서 타자주자를 잡았다(원본 표 전체 CPU 수비 130판).
    // 아웃 판정 0xb36d0 의 종류 거르개 0x58d 에 6(홈런 — 0xb2bd8 의 0xb0cb8(6))이 없는 것은 원본 그대로다 — 쥔 야수가 없으니
    // 그 판정은 아무도 죽이지 못한다. 0xb2c58(vt54)도 사건 7 · 12 에만 야수 동작 0xf 를 주고 8 에는 안 준다(그대로 쫓는다)
    // (catchGateOpen 은 위 0d 절에서 셌다 — 그 사이 다섯 칸을 바꾸는 줄이 없다)
    // b4134~b419c — 공 틱이 동작 시작 틱(플레이+0x176)이면 포구 종류(+0x16c)대로 동작을 걸고, 표 0xd87f4 의 종류 3 은
    // 플레이+0x1f7 = 1(필살 점프 캐치) · 종류 4 는 +0x1f8 = 1(필살 슬라이딩 캐치)
    // b40ca~b4130 (그 앞, 매 틱) — 잡을 야수(+0x170)가 서 있고(vt18) 목표점 x · z 가 포구 틱 공 점(0xa25b0(공, +0x174))과 같고
    // +0x174 < 공+0xaa0(낙구 틱) && 포구 종류 0 이면 vt9c 0xa1e44: 동작 0xc · 자세 +0xb2 (뜬공 기다리기 — 그동안 vtcc 가 거짓, r171).
    // 낙구가 없는 공은 +0xaa0 = −1(점 기록 a29f4 가 처음 높이 ≤ 0 에서만 적는다)이고 b4090 은 부호 있는 비교(ldrsh · bge)라
    // +0x174 < −1 이 거짓 — vt9c 를 안 건다(r176 확정, 웹 −1 과 같다)
    if (catchGateOpen) {
      const catcher = fielders[play.catchFielderSlot]
      const ballAtCatch = trajectory.pointAt(catchTick)
      if (
        catcher !== undefined &&
        play.catchKind === CATCH_KIND.LOW &&
        ballLandingTick >= 0 &&
        catchTick < ballLandingTick &&
        isSamePoint(catcher.position, catcher.target) &&
        catcher.target.x === ballAtCatch.x &&
        catcher.target.z === ballAtCatch.z
      ) {
        fielders = fielders.map((fielder) => (fielder.slot === catcher.slot ? withFlyWaitPose(fielder) : fielder))
      }
    }
    if (catchGateOpen && tick === play.actionStartTick) {
      // 표 0xd87f4 — 잡을 야수(+0x170)에게 포구 동작 · 자세 워드(`fielderPose.withCatchMotion`). 워드가 남는 동안 vtC4(던질 준비)가
      // 거짓이라 바운드 전 낮은 공(S+5)·점프(S+15)·슬라이딩(S+12) 포구는 준비 틱 R 보다 늦게 던질 수 있다(r171)
      fielders = fielders.map((fielder) =>
        fielder.slot === play.catchFielderSlot ? withCatchMotion(fielder, play.catchKind) : fielder,
      )
      if (play.catchKind === CATCH_KIND.JUMP) deadlyJumpArmed = true
      if (play.catchKind === CATCH_KIND.SLIDE) deadlySlideArmed = true
    }
    // 필살타법 성공 타구(비트 4)는 야수가 쥐지 않고 지나친다 — 포구 자체를 건너뛴다 (0xaf180·0xbc3)
    if (tick === catchTick && catchGateOpen && uncatchable) {
      // b4228 — 펌블 굴림 rand(0, 10000) 은 필살타법 표시를 보기(b4246) 전에 늘 먹는다
      if (input.random !== undefined) input.random.rand(0, 10_000)
      // 필살타법 타구 — 공 속성 목록 +0x5c 의 비트 4(0xaf180) 때문에 포구 틱 갈래가 쥐기 대신 메시지 0xbc3 · 사건(sp+0x24) = 1
      // (b4250). 그 0xbc3 에는 처리기가 없고, 틱 끝 b45a4 의 사건 갈래가 공을 그 야수에게서 튕겨 다시 쏜다(0xb3148)
      ballEventThisTick = true
      // b4258 sp+0x20 = 그 야수 → 틱 끝 b4588 플레이.vt74 = 0xb3420 → 야수.vte4 = 0xa1e60: 자세 13 · **+0xb4 = 15**(동작 잠금) ·
      // 효과음 53. 펌블(b4274~)은 sp+0x20 을 안 세워 이 잠금이 없다 — 펌블은 +0xb8 = 6(그림 0x4381a 만 읽는 세기)뿐이다.
      // vt74 는 vt70(0xb3148, 다시 쏘기 · 예보)보다 먼저라 새 예보의 복제가 이 잠금을 물려받는다
      fielders = fielders.map((fielder) =>
        fielder.slot === chaserSlot
          ? { ...withAction(fielder, FIELDER_ACTION.HIT_STAGGER), actionLockTicks: HIT_STAGGER_LOCK_TICKS }
          : fielder,
      )
      hitStaggerSoundThisTick = true
      log.push(`${tick}틱 ${chaserSlot}번 야수에게 필살타법 타구가 맞았다 (0xbc3)`)
    }
    if (tick === catchTick && catchGateOpen && !uncatchable && input.random !== undefined) {
      // 펌블 굴림 (0xb41d0) — **움직이는 공을 잡을 때마다** 걸린다(뜬공 직접 포구 포함).
      // 굴러와 멈춘 공을 줍는 것만 빠진다 — 공.vt18 = 0xa27f0(지금 점의 속도·수직 속도 워드 == 0 && 높이 0) 이 0 일 때만.
      // 손으로 만든 시험 궤적(원본 칸 없음)은 마지막 점을 멈춘 점으로 본다.
      const ballIsMoving =
        trajectory.isStoppedAt === undefined ? tick < trajectory.length - 1 : !trajectory.isStoppedAt(tick)
      if (rollFumble(recordPlayerAbilityOf(abilities, chaserSlot, DEFAULT_ABILITY), ballIsMoving, input.random)) {
        fumbled = true
        fumbleMarks = fumbleMarks.map((value, slot) => (slot === chaserSlot ? FUMBLE_MARK_TICKS : value))
        // b4280: 야수+0xb8 = 6(놓침 동작) · 메시지 0xbc2 · 사건(sp+0x24) = 1 — 쥐지 않는다. 틱 끝 b45a4 가 플레이.vt70 = 0xb3148 로
        // 공을 그 야수 자리에서 지금 점의 속도·각으로 다시 쏘고 새 예보로 줍는 야수를 다시 고른다(아래 `relaunchFromFielder`)
        ballEventThisTick = true
        log.push(`${tick}틱 ${chaserSlot}번 야수 펌블 (0xbc2)`)
      }
    }
    if (tick === catchTick && catchGateOpen && !uncatchable && !ballEventThisTick) {
      // b4292 (쥐기 b42c8 **앞**, 직접 뜬 것): b = 야수.vt58()(발밑 루 — 좌표 완전일치) ; b ≠ −1 이고 R = 0xa97a0(b)(아웃 아닌 주자 중
      // 그 루에 마지막으로 닿은 첫 주자)가 있고 R.vt18()(목표점에 있음)이면 결과 코드 sp+0x38 = 9 (b42bc). 모든 포구에 걸린다 —
      // 견제 · 주자 판(pickoffPlay · runnerPlayEngine)과 같은 갈래다. 쥐기 안 vt90 이 아웃을 내면 b4540 이 13 으로 덮는다.
      // 야수 자리는 그림 N 의 목록 틱(앞 판 틱의 6 절 이동)이 옮긴 그대로다 — 쥐기 0xb2710 은 위치를 안 바꾼다(r176)
      const catcher = fielders[chaserSlot]
      const footBase = catcher === undefined ? NONE : baseUnderFoot(catcher)
      if (footBase !== NONE) {
        const standing = runners.find((runner) => !runner.state.isOut && runner.state.startBase === footBase)
        if (standing !== undefined && isAtTarget(standing.state)) {
          catchResultCode = 9
          log.push(`${tick}틱 결과 코드 9 — ${chaserSlot}번 야수가 ${footBase}루 위에서 잡았지만 ${standing.state.index}번 주자가 서 있다 (b4292)`)
        }
      }
      fielders = fielders.map((fielder) =>
        fielder.slot === chaserSlot
          ? {
              // 쥐기 0xb2710(b2710~b2786)은 +0x128 · +0x130 · +0x12c · +0x112 · 야수+0xe0 · +0x127 만 적는다 — 위치(+0x20) · 목표(+0x2c)를
              // 안 바꾼다(r176, 예전 웹은 포구 지점으로 옮겼다). 포구 틱 갈래(b41aa)도 공 틱 == +0x174 만 보고 거리는 안 본다 —
              // 예보(0xb12d0)가 d = 거리 − 220 × n ≤ 반경으로 고른 틱이라 못 닿은 채 쥘 수 있고, 쥔 뒤에는 AI 1(b4ae6 +0xe0)이
              // 목표를 안 고쳐 다음 야수 틱들이 포구 지점으로 마저 걷다가 포구 동작이 지워지는 틱(a143e vt10 — 목표 = 위치)에 선다
              ...fielder,
              holdingBall: true,
              // 잡고 던지기까지의 준비 틱(내야 3 · 외야 6, cfg+0x20/+0x22) 을 동작 남은 틱(+0xc8)에 넣는다.
              // `defenseArrivalTicks` 의 "이미 잡았다" 갈래가 이 칸을 그대로 더한다 (0xaf53e).
              actionRemainingTicks: readyTicksOf(fielder.slot),
            }
          : fielder,
      )
      // 공 쥐기 0xb2710(b2710~b2782, 직접 뜬 것): +0x12c = 1(쥠) → b2758 vt90 = 0xb36d0 아웃 판정 → b2766 +0x112 = 1.
      // 그래서 쥐는 그 판정은 +0x112(아무도 안 쥐었고 · 땅에도 담장선에도 안 닿음)가 0 인 채로 본다 — 타자주자의
      // 뜬공 아웃(0xb3834, 결과 1)은 이 한 번에만 날 수 있다. 결과가 1 이면 b2770 이 0xa9620(리터치) · 0xa95c0 을 부르고
      // state[0x1f] = 1 이다(0xb2774). 악송구 공·튕긴 공을 줍는 쥐기에는 +0x112 가 이미 서 있어 뜬공 아웃이 없다
      play = { ...play, held: true, wantsThrow: true }
      // 쥐기 0xb2710 — +0x127 = 0
      landingChase = false
      log.push(`${tick}틱 ${chaserSlot}번 야수가 잡았다 (종류 ${play.catchKind})`)
      judgedKindThisCall = OUT_KIND.NONE
      runOutJudgement()
      grabOutThisTick = outJudgedThisTick
      const caughtFly = judgedKindThisCall === OUT_KIND.FLY
      play = { ...play, everHeld: true }

      if (caughtFly) {
        // 뜬공 아웃 — 타자주자는 0xb36d0 이 죽였다. 나머지는 리터치(0xa9620) 뒤 태그업 판정을 받는다
        flyOut = true
        const required = requiredBasesOnFlyCatch(runners.map((runner) => runner.state))
        for (let index = 1; index < runners.length; index += 1) {
          const runner = runners[index]
          if (runner.state.isOut) continue
          const back = basePosition(runner.state.pitchBase)
          // **근사**: 리터치는 즉시 성립한 것으로 본다. 원본은 돌아가는 동안 더블아웃이 날 수 있다.
          runner.state = {
            ...runner.state,
            position: back,
            legStart: back,
            startBase: runner.state.pitchBase,
            targetBase: runner.state.pitchBase,
            requiredBase: required[index],
            settled: false,
          }
          // 포스가 풀린다 — 뜬 채로 잡히면 타자주자가 1루에 안 서므로 뒤에서 미는 힘이 사라진다.
          // 원본 0xa9620 이 **모든 주자의 요구 루를 원래 루로** 되돌리는 것과 같은 자리다.
          // (안 되돌리면 리터치한 주자가 곧바로 다시 뛰어 나가 포스 아웃을 당한다)
          runner.minimumBase = runner.state.pitchBase
        }
      }
      // 굴러간 공의 포스 요구 루(0xa95e8)는 쥘 때가 아니라 **공이 땅에 닿은 틱**에 선다 — 6d 절 b44f8~b453c.
      // 쥐기 0xb2710 은 vt90 == 1(뜬공 아웃)일 때만 0xa9620 · 0xa95c0 을 부른다(b2770~b2782).
      ballContacted = true

      // ── 송구는 포구 틱에 고르지 않는다 — 준비 틱(+0xc8)이 다 줄어든 틱(포구 + R)에 그때 상태로 고른다 ──
      // 쥐기 0xb2710(P, f, 1)은 +0x128 = 1 · +0xc8 = R(내야 3 · 외야 6)을 넣을 뿐 송구 호출이 없다. 공을 내보내는 쪽은
      // 둘 다 공 가진 야수의 준비(vtC4 = 0xa20ec, +0xc8 ≤ 0)를 먼저 본다 (직접 뜬 것):
      // ```
      // b4660~b4684: +0x160 ≠ −1 && +0x12c && 공가진야수.vtC4()  → 사람 목표 (1b 절)
      // afa6c~afab8: +0x128 && 공가진야수.vtC4() && +0xe0 && AI ∉ {8,9} && +0xc8 ≤ 0 → 점수식 0xafb24 (4c 절)
      // ```
      // 야수 틱 0xa1284(0' 절)가 플레이 틱보다 먼저 +0xc8 을 줄이므로 포구 c 틱에 넣은 R 은 c + R 틱 머리에서 0 이 되고,
      // 그 틱의 1b · 4c 절이 **그때의 주자·야수 자리**로 고른다(07e80dc · 46d8420 이 옮긴 차례 그대로).
      // 타자주자도 다른 주자처럼 1루 포스(요구 루 1 — 낙구 틱의 0xa95e8)·태그로 0xb36d0 이 죽인다 — 정해 둔 아웃 틱은 없다
    }

    // ── 2. 송구 도착 ──
    // 송구공은 모두 세계 0xbfed0 공이고(`launchThrow`), 받는 야수 · 받는 틱은 송구 0xb2e38 의 예보 vt24(0) · 고르기 vt34 가 정한다.
    // 받는 것은 1 절 포구 틱 갈래(b42c8 쥐기 0xb2710(P, f, 1) — +0x128 · +0x130 · +0x12c · 준비 틱 · vt90)다.
    // 예전 "받은 야수 손으로 옮기기" 근사는 원바운드(a17fc)까지 옮겨 걷었다.
    // 아웃 판정은 원본처럼 0xb36d0(vt90) 하나가 쥘 때 · 틱마다 돌며 포스(2)와 태그(3)를 가른다(6b 절 · `outJudgement.judgeOut`).

    // ── 2b. 협살 (AI 상태 8) ──
    // 원본은 플레이 틱 0xb401c 안 0xb433c~0xb4378 에서, 송구 판정 바로 뒤에 이 갈래를 본다:
    //   `P+0x1f0 == −1 이면 0xb3fa8(가능 검사) → state[0x31+수비측] == 1(CPU) 이면 0xb3a94(시작)`.
    // **사람이 수비하면 협살은 절대 안 일어난다** (S8 1-4).
    //
    // 그 앞 갈래 b42ce~b42ec(직접 뜬 것, 2026-10 r87): F = 야수[P+0x130](0xb0c90) ;
    // `0xa99d8(주자관리)`(아웃 아닌(+0x96 == 0) 주자 중 +0x3b(막 닿음)가 하나라도 있나) || F+0x3b 이면 **b42ee 갈래**를 탄다 —
    // vt90 한 번(b42f2) → 결과 2 && F+0x3b 면 state[0x87] = 1(b4312) → 협살 중(+0x1f0 ≠ −1)이고 그 주자(0xa9564)+0x3b 면
    // 협살 종료 0xb26b8(b4336) → **b43ec 로 곧장** 간다. 곧 그 틱에는 협살 시작 b433c~b4378(0xb3fa8 · 0xb3a94)도,
    // b43cc~b43ea 의 vt90 도 없다. b42ce 는 포구 틱만이 아니라 **매 플레이 틱** 지난다(b4072 · b41aa · b4290 이 모두 b42ce 로 온다).
    // 두 +0x3b 는 그림 N 의 목록 틱(앞 판 틱의 6 절 이동)이 세운 값이다(`arrivedThisListTick` · `fielderArrivals`).
    const arrivalBranch =
      runners.some((runner) => !runner.state.isOut && runner.arrivedThisListTick) ||
      fielderArrivals[play.ballHolderSlot] === true
    // **B-11 고침(bugfixes.json)**: 사람 수비에서도 협살을 건다 — 원본의 `state[0x31 + 수비측] == 1` 관문(0xb4358)을 걷고,
    // 포스로 밀려 가는 주자는 빼낸다(아래 `humanForceSkip`). 사람 수비면 공격은 CPU 라 주자가 되돌지 않아(자동 주루 0xaf918 은 앞으로만)
    // 공 쥔 야수가 늘 주자가 달려오는 루의 커버(`coversBack`)다 — 짝에게 던질 일이 없어 수동 송구 원칙(키 없이 공이 안 나감)과 안 부딪친다.
    const rundownEnabled = defenseIsCpu || isBugFixed('B-11')
    if (rundownEnabled && !play.finished && play.everHeld) {
      // 협살 중 짝에게 던진 공이 닿았다 — 공 쥔 쪽이 바뀐다. 협살이 그사이 풀렸어도 날아간 공은 짝이 받는다
      // (원본 공은 실제 송구공이라 받는 야수의 포구 틱 갈래 b42c8 쥐기 0xb2710 으로 들어간다). 예전에는 풀리는 순간
      // 날아가던 공을 지워 아무도 공을 안 쥔 채 판이 끝났다 — 판 진행 관문의 +0x12c(쥠)를 보게 되며 드러났다.
      if (rundownThrowArrival >= 0 && tick >= rundownThrowArrival) {
        const to = rundownThrowTo
        fielders = fielders.map((fielder) =>
          fielder.slot === to
            ? { ...fielder, holdingBall: true }
            : fielder.holdingBall
              ? { ...fielder, holdingBall: false }
              : fielder,
        )
        play = { ...play, ballHolderSlot: to, held: true }
        rundownThrowArrival = -1
        rundownThrowTo = NONE
      }
      // b42ee 갈래를 탄 틱은 협살 시작 b433c~b4378 을 건너뛴다 (위)
      if (rundown.runnerIndex === NONE && !arrivalBranch) {
        const context = contextAt(tick)
        const target = chooseRundownRunner(context.runners)
        // 원본처럼 타자주자(0번)도 협살 대상이다 — 고르기(0xb398c)가 **뒤 주자부터** 보므로 0번은 다른 주자가 없을 때만
        // 뽑힌다. (예전 웹은 타자주자의 운명을 결과 코드가 정한다며 0번을 뺐다 — 결과를 먼저 정한 웹 다리라 걷었다)
        // B-11 고친 길의 사람 수비는 **포스로 밀려 가는 주자(0xb1b54 — 타자주자 · 앞 주자가 내 루로 오는 주자)를 협살하지 않는다**.
        // 그 주자는 루만 밟으면 잡히는데, 협살 AI 가 루로 가던 공 가진 야수를 주자 쪽으로 돌려 세워 포스 아웃을 놓친다
        // (원본 CPU 수비도 같은 길이 있지만 그쪽은 원본 그대로 둔다)
        const humanForceSkip = !defenseIsCpu && target !== NONE && isForcedRunner(context.play, context.runners, target)
        if (target !== NONE && !humanForceSkip && canStartRundown(context, true)) {
          rundown = buildRundownPlan(context, target)
          rundowns += 1
          // 0xb3a94 b3aec~b3b28 (직접 뜬 것, r176): 두 야수(+0x1ec · +0x1ed)마다 +0xb4(동작 잠금) ≤ 0 일 때만 b3b0c vt10
          // (0xa124c — 목표 = 위치 · 동작 · 자세 워드 0) → b3b20 0xb8dbd(+0x80, 8). 잠긴 야수는 둘 다 건너뛴다(AI 8 이 안 된다)
          fielders = fielders.map((fielder) =>
            (fielder.slot === rundown.backFielder || fielder.slot === rundown.frontFielder) && fielder.actionLockTicks <= 0
              ? { ...withPoseCleared(fielder), aiState: AI_STATE.RUNDOWN }
              : fielder,
          )
          log.push(
            `${tick}틱 협살 시작 — ${rundown.runnerIndex}번 주자 ${rundown.backBase}↔${rundown.frontBase}루 ` +
              `(야수 ${rundown.backFielder}·${rundown.frontFielder})`,
          )
        }
      } else {
        const chased = runners[rundown.runnerIndex]
        let released = true
        if (chased !== undefined && !chased.state.isOut) {
          released = false
          // 공이 짝에게 날아가는 중이면 "공 쪽" 은 짝이 선 자리다 (원본은 공 객체의 목표점 공+0x2c 을 본다)
          const ballTarget =
            rundownThrowArrival >= 0 && rundownThrowTo !== NONE
              ? fielders[rundownThrowTo]?.position ?? catchPoint
              : catchPoint
          for (const slot of [rundown.backFielder, rundown.frontFielder]) {
            if (released) break
            const action = rundownAction({ ...contextAt(tick), plan: rundown, slot, ballTarget })
            if (action.kind === '협살해제') {
              released = true
              break
            }
            const self = fielders[slot]
            if (self === undefined) continue
            if (action.kind === '주자추적') {
              // vt0x4c — 상대의 현재 위치를 그대로 목표로 삼는다
              const to = chased.state.position
              fielders = fielders.map((fielder) =>
                fielder.slot === slot
                  ? { ...fielder, target: to, position: stepToward(fielder.position, to, fielder.speed) }
                  : fielder,
              )
            } else if (action.kind === '짝에게송구') {
              if (rundownThrowArrival < 0) {
                const partner = fielders[action.toSlot]
                if (partner !== undefined) {
                  rundownThrowTo = action.toSlot
                  rundownThrowArrival = tick + Math.max(1, throwTicksToFielder(self, partner))
                  // **공이 손을 떠난다** — 던진 야수는 `야수+0xe0 = 0`, 플레이는 `+0x12c = 0` 이 된다.
                  // 그래서 원본에서 던진 야수는 다음 틱부터 상태 8 의 첫 갈래("아직 포구 전")로 떨어져
                  // **제 송구를 따라 짝 쪽으로 달린다**. 이 줄이 없으면 던진 야수가 제 루에 붙박여
                  // 두 야수가 주자 쪽으로 좁혀 들어오지 않는다.
                  fielders = fielders.map((fielder) =>
                    fielder.slot === slot ? { ...fielder, holdingBall: false } : fielder,
                  )
                  play = { ...play, held: false }
                  log.push(`${tick}틱 협살 송구 ${slot}→${action.toSlot} — ${rundownThrowArrival}틱 도착`)
                }
              }
            } else if (action.kind === '루로' || action.kind === '공쫓기') {
              const to = action.kind === '루로' ? basePosition(action.base) : action.target
              fielders = fielders.map((fielder) =>
                fielder.slot === slot
                  ? { ...fielder, target: to, position: stepToward(fielder.position, to, fielder.speed) }
                  : fielder,
              )
            } else if (action.kind === '대기' && slot !== play.ballHolderSlot) {
              // '대기' — 공 없는 야수(b4aa0~b4aaa: 주자 틱 r > 짝 송구 틱 r0 이고 r ≤ r0 + 4)는 vt10 0xa124c(목표 = 위치 · 동작 ·
              // 자세 워드 0, r176). 공 가진 야수의 '대기'(b4a3a — 안 쥠 +0x12c == 0)는 b4c60 으로 끝나 아무것도 안 한다
              fielders = fielders.map((fielder) => (fielder.slot === slot ? withPoseCleared(fielder) : fielder))
            }

            // ── 태그 아웃 판정 (0xb36d0 결과 3 → 0xb3946 이 협살을 끝낸다) ──
            // 원본은 AI 상태와 무관하게 아웃 판정이 돌아, **공 쥔 야수와 주자의 거리가 499 이하**이고
            // 주자가 루 위가 아니면 아웃이다. 여기서는 협살에 낀 두 야수에 대해서만 본다.
            const afterMove = fielders[slot]
            if (afterMove !== undefined && tagsRunner(afterMove, chased.state)) {
              markOut(chased)
              outs += 1
              outsAdded += 1
              rundownOuts += 1
              // 이것도 0xb36d0 결과 3 이다 — state[0x87] = 1 (0xb394e)
              tagOut = true
              released = true
              log.push(`${tick}틱 협살 태그 — ${rundown.runnerIndex}번 주자 아웃`)
              // 원본은 이 태그를 아웃 판정 0xb36d0(결과 3)이 낸다 — 아웃 꼬리 0xb36fa(+0x110 = 0 · 0xa9648 포스 풀기)를 지나고,
              // 같은 틱 b4540 이 "이번 틱 vt90 결과" 로 결과 코드 13 을 세워 0x51d40 이 0xafa60 을 한 번 부른다(6c 절, 사람 수비 ·
              // 수동 송구에서도). 예전 웹은 이 자리에서 아웃만 적어 13 이 안 서고 이어 던지기가 없었다 (r272 — `runOutJudgement` 와 맞춤)
              {
                outJudgedThisTick = true
                foulFlag = false
                wideFair = true
                const relaxed = releaseForcesAfterOut(runners.map((runner) => runner.state))
                runners.forEach((runner, index) => {
                  runner.state = relaxed[index] ?? runner.state
                })
              }
            }
          }
        }
        if (released) {
          // 협살 종료 0xb26b8 — 기록칸을 지우고 상태 8 인 야수를 전부 상태 0 으로 되돌린다
          // 날아가던 짝 송구(rundownThrowArrival)는 지우지 않는다 — 위에서 받는다
          fielders = endRundown(fielders)
          rundown = NO_RUNDOWN
        }
      }
    }

    // ── 6b. 아웃 판정 0xb36d0 — 플레이 틱 b43cc~b43ea: 이 플레이의 야수(0xb0c90)가 +0xe0(쥠) 이면 매 틱 vt90 (직접 뜬 것) ──
    // 플레이 틱 0xb401c 안에서 포구 틱 갈래(b4074~b42ce · 1 절) → 협살 b433c~b4378(2b 절) 바로 뒤다. 그림 N 의 슬롯 2 라 주자 · 야수
    // 자리는 그림 N 의 목록 틱(앞 판 틱의 6 절 이동)이 옮긴 그대로다 — 웹도 이 판 틱의 6 절 이동 **앞**에서 본다.
    // (예전 웹은 6b~6e 를 6 절 이동 뒤에 두어 판정이 한 목록 틱 늦은 자리를 봤다 — 옛 근사를 걷었다)
    // 판정은 갈래마다 **한 번**이다(직접 뜬 것): b42ee 갈래(2b 절 머리의 `arrivalBranch`)는 b42f2 에서, 아니면 협살 시작 b4374 뒤
    // b43da 에서(F+0xe0 안 보고), 그도 아니면 b43cc 의 F+0xe0(쥠) 일 때 b43da 에서. `judgeOut` 은 공을 안 쥐었으면(+0x12c)
    // 어떤 아웃도 안 내므로 F+0xe0 거르개는 따로 두지 않는다. "협살 중이면 판정을 건너뛴다" 는 옛 메모는 틀렸다 —
    // 건너뛰는 것은 b42ee 갈래에서의 협살 시작(2b)이고 판정 자체는 b42f2 에서 돈다.
    judgedKindThisCall = OUT_KIND.NONE
    const outsBeforeSecondJudgement = outsAdded
    runOutJudgement()
    const holderJustArrived = fielderArrivals[play.ballHolderSlot] === true
    // b36dc — 이 판정도 머리에서 state[0x87] = 0 으로 지우고 태그(3)일 때만 1 을 적는다. 쥐기 판정이 낸 아웃의 결과 코드 13 은
    // b4540 에서 이 값을 읽는다 (위 `runOutJudgement` 주석)
    // b4300~b4314 — b42ee 갈래에서는 결과 2(루 아웃)이고 F+0x3b 면 state[0x87] = 1 을 덧적는다 (b43da 갈래에는 없다)
    const baseOutFold = arrivalBranch && holderJustArrived && judgedKindThisCall === OUT_KIND.BASE
    if (grabOutThisTick) tagOut = judgedKindThisCall === OUT_KIND.TAG || baseOutFold
    else if (baseOutFold && outsAdded > outsBeforeSecondJudgement) tagOut = true
    // b4316~b4336 — b42ee 갈래: 협살 중(+0x1f0 ≠ −1)이고 그 주자(0xa9564(+0x1f0))+0x3b(막 닿음)면 협살 종료 0xb26b8
    if (arrivalBranch && rundown.runnerIndex !== NONE && runners[rundown.runnerIndex]?.arrivedThisListTick === true) {
      fielders = endRundown(fielders)
      rundown = NO_RUNDOWN
      log.push(`${tick}틱 협살 종료 — 쫓던 주자가 루에 닿았다 (b4336)`)
    }

    // ── 6c. 결과 코드 9·13 — 틱 끝의 CPU 송구 결정, **사람 수비·수동 송구에서도 돈다** (직접 뜬 것) ──
    // ```
    // b43ec: H = 공 가진 야수 ; b = H.vt68()(목표점이 루 b 인가) ≠ −1 이고
    // b4400:   R = 0xa97a0(b) = 아웃 아닌 주자 중 +0x8c(마지막으로 닿은 루) == b 인 첫 주자가 있고
    // b4412:   H.vt18()(목표점에 있음) && H+0x3b(막 닿음) && H+0xe0(쥠) && R.vt18()(주자도 목표점) → 결과 코드 9
    // b4540: 이번 틱 vt90 결과 ≠ 0 → 결과 코드 13 (b4556, 9 를 덮는다)
    // b4562: 코드 ≠ 0 → vt44 · vt54 · 메시지 0xbba(코드) (b457c, 0xbfbac = 곧바로 부른다)
    // 51a56: 화면 0xbba 처리 → 점프표 0xd0488[코드 − 1] → 0x51d40
    // 51d40: 결과 코드 ∈ {9, 13} 이면
    // 51d4e:   0x3403c(수비 조작 객체 +0x10 == 1, CPU) || 0x33fe4(== 0, 사람) 면 통과 — 사람·CPU 모두
    //          (그 밖의 종류 2 조작만 설정+0xf4 를 본다)
    // 51d7a:   0x33c98(경기 상태 ∈ 6·0x17·…) && 아웃 state[6] ≤ 2 이면
    // 51da8:     플레이+0x128 = 1 ; 0xaf8e0(제어기) = vt0xc = 0xafa60 CPU 송구 결정 (한 번)
    // ```
    // 0xafa60 은 공 가진 야수가 준비(vtC4)돼 있어야 던진다 — 포구 틱의 뜬공 아웃은 준비 틱이 남아 안 던진다.
    // 코드 9 는 "공 든 야수가 루에 막 닿았는데 주자가 이미 서 있다(세이프)" — 들고 뛰기(AI 6)·직접 밟기(0xb2a48)로
    // 루에 닿는 틱에만 선다. H+0x3b 는 그림 N 의 목록 틱(앞 판 틱의 6 절 이동)에서 막 닿았나다(`fielderArrivals`).
    // 그 뒤 b444e~b453c 가 **공이 처음 땅에 닿거나 담장선을 넘는 틱**에 결과 코드를 판 끝 판정 0x9d5bc 로 덮고(아래 6d),
    // b4540 이 이번 틱 vt90 결과가 있으면 13 으로 다시 덮는다.
    // 받은 야수가 다시 던지는 병살 송구도 이 길이다 — 다만 송구를 받는 틱의 아웃은 쥐기가 준비 틱을 막 넣어
    // 그 자리 0xafa60 이 못 던지고, 사람 수비·수동 송구에서는 그 뒤 0xafa60 을 부르는 곳이 없어 이어 던지지 않는다.
    // (CPU 송구가 도는 쪽은 4c 절이 준비가 끝난 틱에 던진다.)
    let resultCode = catchResultCode
    if (!outJudgedThisTick && !play.finished && play.held) {
      const holder = fielders[play.ballHolderSlot]
      const holderBase = holder === undefined ? NONE : baseAtPoint(holder.target)
      if (holder !== undefined && holderBase !== NONE) {
        const standing = runners.find((runner) => !runner.state.isOut && runner.state.startBase === holderBase)
        if (
          standing !== undefined &&
          isSamePoint(holder.position, holder.target) &&
          fielderArrivals[holder.slot] === true &&
          holder.holdingBall &&
          isAtTarget(standing.state)
        ) {
          resultCode = 9
          log.push(`${tick}틱 결과 코드 9 — ${holder.slot}번 야수가 ${holderBase}루에 닿았지만 ${standing.state.index}번 주자가 서 있다`)
        }
      }
    }
    // ── 6d. 공이 처음 땅에 닿거나 담장선을 넘는 틱 — 플레이 틱 b444e~b453c (직접 뜬 것) ──
    // ```
    // b444e  +0x112 ≠ 0 → b4540 (아래를 건너뜀)
    // b445a  +0x114 ≠ 0 && 이번 틱 사건 없음 → b4540     ; +0x114 는 +0x112 와 함께만 서서 실제로는 안 닿는 갈래
    // b446c  공+0x68 == 공+0xaa4(담장선) && 사건 없음 → +0x110(파울) == 0 이면 +0x112 = +0x114 = +0x115 = 1
    // b4492  아니고 공+0x68 == 공+0xaa0(낙구) && 사건 없음 → +0x112 = 1 · +0x113 = 1 · state[0x1e] = 1 · 소리 0x51c
    // b44be  사건(sp+0x24 = 포구 틱의 필살타법 표시 공 0xbc3 · 펌블 0xbc2)이 있고 +0x112 == 0 → state[0x1b] = 1
    // b44d6  (+0x112 || +0x114) && 사건 없음 → 결과 코드 = 0x9d5bc(state)          ; ★ b44f6
    // b44f8  +0x112 || +0x114 || 사건 → +0x12b == 0 이면 (0xb68dc 파울 ? 0xa9620 리터치 : 0xa95e8 포스) ; 0xa95c0(+0x94 = 1)
    // b4540  이번 틱 vt90 결과 ≠ 0 → (state[0x1f] 면 +0x12b = 1) 결과 코드 = 13
    // b4562  코드 ≠ 0 → vt44 = 0xb2bc4(코드) · vt54 = 0xb2c58(코드) · 메시지 0xbba(코드)
    // ```
    // +0x112 를 세우는 곳은 쥐기 0xb2710(b2766) · 담장 b4486 · 낙구 b44a2 셋뿐이고 지우는 곳은 판 시작 0xb0edc 뿐이다.
    // 그래서 0x9d5bc 는 **판에 많아야 한 번** — 아무도 쥐기 전에 공이 떨어지거나 담장선을 넘는 그 틱에만 돈다.
    // (예전 미해결 메모의 "첫 포구 뒤 매 틱 0x9d5bc" 는 b4454 의 `+0x112 ≠ 0 → b4540` 을 놓친 것이었다.)
    // 굴러간 공의 포스(0xa95e8)도 이때 선다 — 웹은 예전에 포구 틱에 세웠다.
    // 사건(sp+0x24 = 펌블 0xbc2 · 필살타법 타구 0xbc3)이 있는 틱은 결과 코드를 안 내고(b44d6) 포스만 세운다(b44f8).
    // 그 공은 틱 끝 0xb3148 이 다시 쏘아 새 궤적의 낙구 틱에 다시 이 절을 지난다.
    // 공+0xaa4 는 **담장(또는 파울 관중석) 위로 넘는** 충돌 첫 틱이다(0x9f7e8 의 +0x29/+0x2a → 0xa2bf0). 높이 ≤ 1999 에서
    // 담장 면에 맞은 공은 공+0xaa8(`wallTick`)로 따로 적혀 state[0x20] 이 안 선다. state[0x20] · [0x80] 은 타구 시작 511ea · 511f4 가
    // 미리 깐 궤적의 aa4 · ab0 를 통째로 옮긴 값이라, 낙구 틱의 0x9d5bc 도 아직 오지 않은 담장 넘김을 본다(원본 그대로).
    const overFenceTick = trajectory.fenceTick
    if (!ballContacted && ballEventThisTick) {
      // b44f8 — 사건만으로도 +0x12b == 0 이면 포스(0xa95e8, 파울이면 0xa9620) · 0xa95c0. 결과 코드(b44d6)는 없다
      const required = requiredBasesOnBounce(runners.map((runner) => runner.state))
      runners.forEach((runner, index) => {
        runner.state = { ...runner.state, requiredBase: required[index] }
      })
    } else if (!ballContacted) {
      let landedNow = false
      if (tick === overFenceTick && !foulFlag) {
        ballContacted = true
      } else if (tick === trajectory.landingTick) {
        ballContacted = true
        landedNow = true
        // b4492 — +0x112 = +0x113 = 1 (낙구 틱에 아무도 안 쥐었다). 슬롯 2 꼬리 52b62 의 함성 60 이 이 칸을 본다
        landedUncaughtThisTick = true
      }
      if (ballContacted) {
        const endState: PlayEndState = {
          flyOut: false,
          specialEvent: input.specialEvent === true,
          // state[0x1c] — 쏜 공의 파울 각 (511b8)
          foulAngle: state.foulAngle,
          // 스트라이크는 파울 갈래(코드 11)에서만 본다
          strikes: input.strikes ?? 0,
          buntKind: input.buntKind ?? 0,
          poleTick: trajectory.poleTick,
          fenceTick: overFenceTick,
          ballTouched: landedNow,
        }
        resultCode = playEndResultCode(endState)
        log.push(`${tick}틱 ${landedNow ? '낙구' : '담장선'} — 판 끝 결과 코드 ${resultCode} (0x9d5bc)`)
        // b4510~b453c: 파울이면 0xa9620(리터치), 아니면 0xa95e8(포스) · 0xa95c0
        const required = isFoulEnded(endState)
          ? requiredBasesOnFlyCatch(runners.map((runner) => runner.state))
          : requiredBasesOnBounce(runners.map((runner) => runner.state))
        runners.forEach((runner, index) => {
          runner.state = { ...runner.state, requiredBase: required[index] }
        })
      }
    }
    if (outJudgedThisTick) resultCode = 13
    // b4562 vt44 = 0xb2bc4 — 모든 코드를 state[0xb] 에 적고 표 0xd87a0 대로 칸을 세운다
    if (resultCode !== 0) {
      lastEventCode = resultCode
      // 51a56 — 메시지 0xbba(코드): 결과 판 타이머 10 · 코드 · 공 가진 야수(플레이+0x130)
      scene = { ...scene, popup: postJudgeMessage(scene.popup, resultCode, play.ballHolderSlot) }
      // 메시지 0xbba → 표 0xd0488: 6·10 → 0x51d32·0x51d24 → 0xa5ffc 사건 6 · 8·12 → 0x51c82 → 0xa5fec 사건 8 ·
      // 13 → 0x51b36 … 0x51bf2 → 0xa7d0c 사건 0xd. 판 끝 정산 0xa8024 가 이 사건들로 타자 결과를 낸다(`playOutcome`)
      if (resultCode === 6 || resultCode === 10) hitEvent = true
      if (resultCode === 8 || resultCode === 12) homeRunEvent = true
      // 11 도 메시지 0xbba → 표 0xd0488[10] = 0x51b20 이 0xa7d0c(사건 0xd)를 부른다 (2스트라이크 번트 파울 아웃)
      if (resultCode === 13 || resultCode === BUNT_FOUL_OUT_RESULT_CODE) outEvents += 1
      const effect = eventCodeEffectOf(resultCode)
      if (effect.foulFlag) {
        foulFlag = true
        // b2bfa~b2c06 state[7] = 0x9d640(공+0x70) — 공+0x70 은 쏘기(a288a) · 폴(a2c70) · 벽(a2cca)이 적는 각이라 미리 깐 궤적의
        // 마지막 점 각이다. 원본 각 칸이 없는 손으로 만든 궤적은 쏜 값 그대로 둔다
        if (isBallTrajectory(trajectory) && trajectory.length > 0) {
          wideFair = isWideFairOriginalAngle(trajectory.pointDetailAt(trajectory.length - 1).angle)
        }
      }
      if (effect.homeRunFlag) homeRunFlag = true
      if (effect.groundRuleFlag) groundRuleFlag = true
      if (effect.poleHomeRunFlag) play = { ...play, suppressed: true }
      if (effect.playKind >= 0) play = { ...play, kind: effect.playKind }
      if (effect.judgeOut) {
        // b2c18 vt90 = 0xb36d0 — 종류 마스크(b36e8) 뒤 b3728~b375a: state[0xb] == 11 이고 주자 0 이 이번 타자(+0x98)면
        // +0x96 = 1 · state[6]++ (2스트라이크 번트 파울 아웃). 그 뒤 보통 판정을 그대로 돈다
        const batterRunner = runners[0]
        if (
          resultCode === BUNT_FOUL_OUT_RESULT_CODE &&
          batterRunner !== undefined &&
          batterRunner.state.isBatterRunner &&
          !batterRunner.state.isOut
        ) {
          markOut(batterRunner)
          outs += 1
          outsAdded += 1
          log.push(`${tick}틱 타자주자 아웃 — 2스트라이크 번트 파울 (0xb36d0 b373a)`)
        }
        runOutJudgement()
      }
      // b4568 vt54 = 0xb2c58(코드) — 사건 7(파울) · 12(폴 홈런)이면 야수 0~8 을 0xb8dbc(+0x80, 0xf)로 AI 0xf(시작 자리로 돌아가기).
      // +0x84 만 고친다(목표 · 목표 루 · 잠금은 그대로). 다른 코드는 0 을 돌려주고 아무것도 안 한다 (직접 뜬 것, r190)
      if (resultCode === 7 || resultCode === 12) {
        fielders = fielders.map((fielder) => ({ ...fielder, aiState: AI_STATE.RETURN }))
        log.push(`${tick}틱 사건 ${resultCode} — 야수 9명 AI 0xf (0xb2c58)`)
      }
    }
    // b4562 의 메시지 0xbba → 0x51a56 → 표 0xd0488 — 콜은 판 끝이 아니라 결과 코드가 선 **이 틱**에 곧바로 난다(`judgeCall`).
    // 13 의 0x51b36 은 state[0x1f](`flyOut` — 쥐기 0xb2774) · state[0x87](`tagOut` — 그 아웃을 낸 판정)을 이 자리 값으로 본다
    if (resultCode !== 0) {
      const call = judgeCallSoundIdOf(resultCode, { caughtOnTheFly: flyOut, tagOut })
      if (call !== null) tickSounds.push({ kind: 'sound', soundId: call })
      // 9 → 0x51c14 "Safe!" 17 — 그 틱을 결과에 싣는다(화면이 돌리지 않은 판의 콜, `safeCallTick`)
      if (resultCode === 9) state.safeCallTick = tick
    }
    // b4588 — 플레이.vt74 = 0xb3420 → 야수.vte4 = 0xa1e60 a1e82 즉시 재생 53. 0xbba 메시지(b457c~b4584) 바로 뒤다
    if (hitStaggerSoundThisTick) tickSounds.push({ kind: 'sound', soundId: HIT_STAGGER_SOUND_EFFECT })
    // 0x51d40 — 결과 코드 9·13 일 때만 `아웃 ≤ 2` 면 +0x128 = 1 · 0xafa60 한 번
    if ((resultCode === 9 || resultCode === 13) && outs <= 2 && !play.finished && !uncatchable) {
      play = { ...play, wantsThrow: true }
      cpuThrowDecision()
    }

    // ── 6e. 틱 끝 b45a0 — 사건이 있었으면 플레이.vt70 = 0xb3148: 공을 그 야수에게서 튕겨 다시 쏜다 ──
    // 다시 쏘기는 플레이 틱 꼬리라 이 그림 그리기(5 절 스냅샷)보다 먼저다 — 깐 그림은 공+0x68 = 0 이라 공을 안 그린다(0x36dfc 36e24)
    if (ballEventThisTick) relaunchFromFielder()

    // ── 6f. 득점 — 주자 관리 vt18 `0xaa0a8`(슬롯 2 525fc — 플레이 틱 vt48 525e8 바로 뒤 · vt4c 52612 앞, 직접 뜬 것) ──
    // 0xaa0a8 은 **i = 주자 수 − 1 부터 0 까지 내림차순**(aa0ce · aa342 `subs` / `bmi`)으로 +0x96(끝) 이 아니고(aa0e6)
    // `+0x3b(막 도착) && +0x8c == 4`(aa12a~aa140) 인 주자를 득점으로 세고 바로 득점이면 aa1b0 메시지 0x13(인자 i)을 곧바로(0xbfbad) 보낸다.
    // +0x3b 는 그림 N 의 목록 틱(앞 판 틱의 6 절 이동)에서 홈에 막 닿은 주자다(`arrivedThisListTick`) — 주자 틱 0xa01cc 가 a0364 의
    // 0xbf094(bf0a2)에서 **매 목록 틱 머리에 지우므로** 그 바로 뒤 슬롯 2 에서 못 센 주자는 다시 세지 않는다(관문 G2 가 닫힌 그림 529f0 ·
    // 레이저 멈춤 524e6 은 0xaa0a8 을 안 부른다 — 원본 그대로). 같은 목록 틱에 들어온 타자주자(0)는 맨 뒤다.
    // 아웃 판정(6b)이 같은 그림의 앞이라 2아웃 보류(state[0])는 그 아웃까지 센 아웃 수로 가른다.
    // state[0x1e](공이 땅에 닿았다) — 쥐기 0xb2710 · 낙구 b44a2 가 세운다. 둘 다 같은 플레이 틱(1 절 · 6d 절)이라 이 그림 값이다
    const ballOnGround = play.everHeld || tick >= trajectory.landingTick
    for (let index = runners.length - 1; index >= 0; index -= 1) {
      const runner = runners[index]!
      if (runner.state.isOut || runner.state.scored || !runner.arrivedThisListTick || !isAtTarget(runner.state)) continue
      // 홈을 밟았다 — 2아웃 보류 규칙(state[0])을 태운다
      if (wrapBase(runner.state.targetBase) === 0 && runner.state.targetBase !== 0 && !runner.counted) {
        runner.counted = true
        runner.state = { ...runner.state, scored: true }
        const scoredBefore = held.scoreboardRuns
        held = onRunnerReachesHome(held, {
          outs,
          ballOnGround,
          batterRunner: runners[0].state,
          scoringRunnerIsBatterRunner: runner.state.index === 0,
        })
        // 바로 득점 0xaa1b0 — 메시지 0x13(주자 칸)
        if (held.scoreboardRuns > scoredBefore) {
          runInsThisTick.push(runner.state.index)
          tickSounds.push({ kind: 'runIn', slot: runner.state.index })
        }
        // aa1de~aa1fe — 홈에 닿은 주자가 이번 타자(+0x98)이고 담장 · 폴 홈런 사건이 없으면 state[0x25] = 1 (그라운드 홈런)
        if (runner.state.isBatterRunner && !homeRunEvent) groundHomeRun = true
        log.push(`${tick}틱 ${runner.state.index}번 주자 홈 — 보류 ${held.heldRuns} / 득점 ${held.scoreboardRuns}`)
      }
    }

    // ── 6g. 보류 득점 풀기 (0xaa34c — 0xaa0a8 주자 고리가 끝나면 aa0d8 에서 곧바로 오는 꼬리) ──
    // aa364 의 "진행 중인 주자" 도 0xaa05c 다 — +0x94(요구 루) 항까지 본다
    const stillActive = someRunnerStillActive(
      runners.map((runner) => runner.state),
      isAtTarget,
    )
    const scoredBeforeRelease = held.scoreboardRuns
    held = releaseHeldRuns(held, {
      outs,
      ballOnGround,
      batterRunner: runners[0].state,
      someRunnerStillActive: stillActive,
    })
    // 보류 해제 0xaa39e — 푼 수만큼 메시지 0x13(0x64)
    for (let run = scoredBeforeRelease; run < held.scoreboardRuns; run += 1) {
      runInsThisTick.push(RELEASED_RUN_SLOT)
      tickSounds.push({ kind: 'runIn', slot: RELEASED_RUN_SLOT })
    }

    // 1a~1c 는 플레이 vt4c = 0xb45dc 다 — 슬롯 2 의 52612 라 플레이 틱 vt48(0xb401c, 525e8) · 득점 0xaa0a8(525fc) 뒤에 돈다
    // (vtable 0xd8618: +0x48 = 0xb401d · +0x4c = 0xb45dd — 직접 뜸). 예전 웹은 포구(1 절) 바로 뒤에 두었다.
    // 슬롯 2 의 52602~52614 — [sp+0x14] = 0xae61c(판 종류 ∉ 마스크 0x58c {2, 3, 7, 8, 10})일 때만 vt4c 를 부른다. 한 번 세어
    // 1a~1d 모두에 건다(r171 — 예전 웹은 1d 만 보았다. 바운드 2루타 7 · 폴 홈런 10 이 된 판은 중계 · 사람 목표 · AI 9 도 없다)
    const vt4cOpen = !VT4C_BLOCKED_PLAY_KINDS.includes(play.kind)
    // ── 1a. 중계 이어 던지기 — 플레이 틱 vt4c(0xb45dc) 머리 b45ee~b465e (직접 뜬 것) ──
    // ```
    // b45f0: +0x12c(쥠) 이면
    // b4608:   [4](+0x150) ≠ +0x130(공 가진 야수) && [0](+0x14c 중계) 이면 vt5c([4], 0) = 0xb2e38 ; 참이면 메시지 0xbc6 → b4660
    // b4638: (쥠이 0 인 틱(b45f4 beq)도, 위 두 조건이 깨진 틱(b460a · b4614)도 여기로 온다 — 쥠 갈래 밖)
    //        [4] == +0x130 이면 [0] = 0 · +0x117 = 0
    // ```
    // 중계맨은 쥐기(0xb2710)가 넣은 준비 틱(내야 3)이 끝난 틱에 던진다 — 0xb2e38 머리의 vtC4 가 그때까지 0 을 돌려준다.
    // 0xb2c90 을 거치지 않으므로 들고 뛰기·직접 밟기 관문도, 던진 뒤 AI 0 도 없다.
    // 지우기(b4638)는 쥠과 상관없다(r225 — 예전 웹은 쥠 갈래 안에 두었다). +0x130 은 고르기 0xb3b38 이 송구 때 받을 야수로
    // 옮기므로, 최종 받는 야수에게 공이 날아가는 중(안 쥔 틱)에 이미 계획이 지워진다. vt5c 가 거짓(준비 전)이면 b4624 → b4660
    // 이라 지우지 않는다 — [4] ≠ +0x130 이라 어차피 지울 일이 없다.
    if (vt4cOpen && !play.finished && !uncatchable) {
      const holderSlot = play.ballHolderSlot
      if (play.held && relayFinalSlot !== NONE && relayFinalSlot !== holderSlot) {
        throwBall(holderSlot, relayFinalSlot, relayBase, '중계', false)
      } else if (relayFinalSlot === holderSlot) {
        relayFinalSlot = NONE
        relayBase = NONE
      }
    }

    // ── 1b. 포구 뒤에 사람이 고른 목표 — 플레이 틱 vt4c(0xb45dc) 의 b4660~b46a8 (직접 뜬 것) ──
    // ```
    // b4660: +0x160 ≠ −1 && +0x12c(쥠) && 공가진야수.vtC4()(준비) 이면
    // b4686:   공가진야수.vt58()(발밑 루) ≠ +0x160 이면 플레이.vt58(+0x160, 0) = 0xb2c90   ; 루로 보내기
    // b46a4:   +0x160 = −1
    // ```
    // 포구 전에 고른 키든 뒤에 고른 키든 같다 — 공 가진 야수(받은 야수 포함)의 준비가 끝난 틱(포구 + R)부터 그 루로
    // 보낸다. 발밑 루(좌표 완전일치)가 그 루면 보내지 않는다. 어느 쪽이든 본 뒤에는 +0x160 = −1 이다.
    if (
      vt4cOpen &&
      !play.finished &&
      !uncatchable &&
      play.manualThrowBase !== NONE &&
      tick > catchTick &&
      isHolderReady()
    ) {
      const manual = play.manualThrowBase
      const holderSlot = play.ballHolderSlot
      if (!isSamePoint(fielders[holderSlot].position, basePosition(manual))) {
        sendToBase(holderSlot, manual, '사람', false)
      }
      play = { ...play, manualThrowBase: NONE }
    }

    // ── 1c. AI 9 — 0xb2e38 이 미룬 송구 (vt4c 야수 고리의 분기표 0xd8808[9] = b4838, 직접 뜬 것) ──
    // ```
    // b4838: R = 야수[+0x15c] ; t1 = R.vtc0() ; H = 공 가진 야수 ; t2 = H.vtb8(0xd86b0[+0x158])
    // b488c: t1 > t2 → 이번 틱은 기다린다
    // b4892: 아니면 플레이.vt58(+0x158, 0) = 0xb2c90 ; 참이면 b48ac 이 야수 AI 0
    // ```
    // 미룰 때 공 가진 야수는 vt48(루)로 그 루를 향해 걷는다(`moveFielder`). 특수 인자는 0 으로 다시 보낸다.
    // AI 2~5 (같은 고리의 분기표 0xd8808[2..5] = b47f2, 직접 뜬 것, r176): +0x3b(앞 목록 틱에 목표점에 막 닿음) && vtcc 면
    // b4814 0xb2a48(P, 칸, 루) — 그 루의 커버 칸(+0xf0)이 다른 야수면 그 야수를 AI 0 으로 내리고 이 야수가 커버가 된다
    // (`claimCoverOfBase`). 그 뒤 b4818~b482e vt14(루 좌표)는 6 절 걸음이 한다. 고리는 칸 차례라 AI 9 와 섞어 돈다
    if (vt4cOpen && !play.finished) {
      for (let slot = 0; slot < fielders.length; slot += 1) {
        // b46c2~b475a 다이빙 검사 — 분기 앞에서 칸마다 (`diveCheckOf`, r180)
        const dive = diveCheckOf({
          fielder: fielders[slot],
          diveTick: diveTicks[slot] ?? DIVE_TICK_NONE,
          catchTick: diveCatchTick,
          // 공+0x68 — 쥔 동안은 0x3f378(3f3aa)이 안 올려 쥔 틱(첫 포구 = +0x174)에 머문다
          ballTick: (play.held ? Math.min(tick, catchTick) : tick) - ballLaunchTick,
          coverNeeded: (base) => needsCover(contextAt(tick), base),
          ballPointAt: (at) => trajectory.pointAt(ballLaunchTick + at),
        })
        if (dive !== null) {
          const before = fielders[slot]
          fielders = fielders.map((fielder) => (fielder.slot === slot ? dive.fielder : fielder))
          logDiveCheck(log, tick, slot, before, dive)
          // 분기는 옛 상태로 한다(b475c 의 r5) — AI 0xd 가 된 칸은 분기 없이 다음 칸(b4c5c)
          if (dive.skipDispatch) continue
        }
        const self = fielders[slot]
        if (self === undefined) continue
        const dispatchState = dive?.dispatchState ?? self.aiState
        // AI 0 b476a — vtcc 면 목표가 시작 자리 0xd86ec[칸] 와 다를 때 vt50(= vt14)로 그 자리로 (r180 — 예전 웹은 6 절 걸음에서 골랐다).
        // 고리 안이라 같은 틱 끝 b4c72 의 커버 다시 고르기(0xb1c90)가 고친 목표를 보고, 고리 뒤에 AI 0 이 된 야수(커버 다시 고르기
        // b1d38 · b2540, CPU 송구 526ae 의 b2e14, 뒤 칸의 커버 가져가기 b2a7e)와 다이빙 검사가 AI 0 으로 내린 칸(분기는 옛 상태)은
        // 다음 목록 틱에 옛 목표로 한 걸음 더 가고 다음 고리에서 돌아선다. vt4c 가 안 도는 틱(판 종류 마스크 · 관문 G2)은 아무도 안 고친다
        if (dispatchState === AI_STATE.IDLE && isFreeToRetarget(self)) {
          const home = FIELDER_START_POSITIONS[slot]
          if (home !== undefined && !isSamePoint(self.target, home)) {
            fielders = fielders.map((fielder) => (fielder.slot === slot ? { ...fielder, target: home } : fielder))
          }
        }
        // AI 1 b4aca~b4b5a — vtcc(b4ad2) · +0xe0 == 0(b4ae6) · 움직임 허용 +0x13c[칸](b4af6)이면 +0x127 && 낙구 틱 ≥ 공+0x68 은
        // 낙구점, 아니면 포구 틱(+0x174) 점의 (x, 0, z) 로 0xa100c(= vt14). 고리 안이라 같은 틱 끝 b4c72 의 커버 다시 고르기가
        // 고친 목표를 본다 (r190 — 예전 웹은 6 절 걸음에서 골랐다). 쥐기 전(포구 틱 갈래가 앞선 1 절에서 쥔다)만 고친다.
        // +0x13c 는 마지막 예보가 적은 값이다(`forecastMovable`, r196 — 보통 송구를 받는 야수는 안 고친다)
        if (
          dispatchState === AI_STATE.CHASE &&
          slot === chaserSlot &&
          tick < catchTick &&
          state.forecastMovable &&
          isFreeToRetarget(self)
        ) {
          const landingPoint = trajectory.pointAt(ballLandingTick)
          const chaseTarget =
            landingChase && ballLandingTick >= tick ? { x: landingPoint.x, y: 0, z: landingPoint.z } : catchPoint
          if (!isSamePoint(self.target, chaseTarget)) {
            fielders = fielders.map((fielder) => (fielder.slot === slot ? { ...fielder, target: chaseTarget } : fielder))
          }
        }
        // AI 0xc b4b78 — 공 가진 야수(+0x130)의 목표 T 에서 2000 뒤(`backupPointOf`)로 vt14(잠금 +0xb4 ≤ 0 · vtc8 일 때만, r180)
        if (dispatchState === AI_STATE.BACKUP) {
          const backup = backupPointOf(fielders[play.ballHolderSlot]?.target ?? self.target, self.position)
          if (backup !== null && self.actionLockTicks <= 0 && isFreeToStep(self)) {
            fielders = fielders.map((fielder) => (fielder.slot === slot ? { ...fielder, target: backup } : fielder))
          }
        }
        // AI 0xf b4c2a~b4c5c — 시작 자리 0xd86ec[+0x88] 로 vt14(잠금 +0xb4 ≤ 0 · vtc8 — +0xcc ≤ 0 일 때만 받는다) 뒤 vt8c(5) =
        // 0xa0ee0: +0xcc = 5. 다음 목록 틱 a1330 이 4 로 줄여도 vtc8 이 거짓이라 걸음(a1346)이 없고 a143e 지우기가 vt10 으로 목표 = 위치,
        // 이 고리가 다시 5 를 적는다 — 사건 7 · 12 를 받은 틱 뒤로 야수는 그 자리에 선다(원본 그대로, r190)
        if (dispatchState === AI_STATE.RETURN) {
          fielders = fielders.map((fielder) => (fielder.slot === slot ? withReturnToStartTick(fielder) : fielder))
        }
        // AI 0xb b4b5c — +0x90 을 [sp+0x40] 에 베껴 b482e 에서 **조건 없이** vt14(+0x90) 뒤 다음 칸(b4c60). vt14 = 0xa14c8 관문(잠금
        // +0xb4 ≤ 0 · vtc8)이 막으면 목표는 그대로다. 공 쥠 +0xe0 은 안 본다 — 쥐었어도 담장 앞으로 걷는다 (r214 — 예전 웹은 고르기에서
        // 목표에 바로 적고 vt10 지우기가 목표를 안 건드리게 해 두었다)
        if (dispatchState === AI_STATE.PICK_UP) {
          const point = self.pickUpPoint
          if (point !== undefined && acceptsTargetVt14(self) && !isSamePoint(self.target, point)) {
            fielders = fielders.map((fielder) => (fielder.slot === slot ? { ...fielder, target: point } : fielder))
          }
          continue
        }
        if (isCoverState(dispatchState)) {
          const base = dispatchState - AI_STATE.COVER_HOME
          if (fielderArrivals[slot] === true && isFreeToRetarget(self)) {
            const claimed = claimCoverOfBase(play, fielders, slot, base)
            if (claimed.play !== play) log.push(`${tick}틱 ${slot}번 야수가 ${base}루 커버를 가져간다 (b4814 0xb2a48)`)
            play = claimed.play
            fielders = claimed.fielders
          }
          // b4818~b482e — 조건 없이 vt14(0xd86b0[루]) — 관문(잠금 +0xb4 · vtc8)이 막으면 목표는 그대로(r201)
          fielders = withCoverBaseTarget(fielders, slot, base)
          continue
        }
        if (deferredThrowReceiver === NONE) continue
        if (self.aiState !== AI_STATE.RECEIVE) continue
        const receiver = fielders[deferredThrowReceiver]
        const holder = fielders[play.ballHolderSlot]
        if (receiver === undefined || holder === undefined) continue
        if (fielderArrivalTicks(receiver) > throwTicksTo(holder, basePosition(deferredThrowBase))) continue
        if (sendToBase(play.ballHolderSlot, deferredThrowBase, '미룬', false)) {
          fielders = fielders.map((fielder) =>
            fielder.slot === slot
              ? { ...fielder, aiState: AI_STATE.IDLE }
              : fielder,
          )
        }
      }
    }

    // ── 1d. vt4c 의 끝 b4c72 — 플레이 vt30 = 0xb1c90: 커버(+0xf0) 다시 고르기 · 키스톤 자리 잡기 0xb203a (`runCoverTick`) ──
    // 슬롯 2 의 vt4c(52612)는 자동 진루(52660) · CPU 송구(526ae)보다 앞이고, 판 종류가 마스크 0x58c {2, 3, 7, 8, 10} 이면
    // 안 돈다(52602 — 바운드 2루타 7 · 폴 홈런 10 이 된 판). 머리 관문: (+0x111 || +0x129) && 공+0x68 > 공+0xaa4 · state[7] == 0
    if (vt4cOpen && !play.finished) runCoverOnce()

    // ── 4. 자동 추가 진루 (0xaf918) ──
    // 슬롯 2 의 52660 은 `0xaf8c0(제어기, 0)` — **force = 0** 이다(r1 = 0). 그래서 af950 에서 멈춘 주자(vt18 참 — 루에 서
    // 있거나 태그업으로 기다리는 주자)만 보고 달리는 중인 주자는 건너뛴다. force = 1 은 판 시작 0x46766 한 번뿐이다
    // (`startDefensePlay` 끝).
    //
    // **언제 도는가** — 원본 0x5261c~0x52668 (매 틱, 경기 장면 슬롯 2) 을 그대로 옮긴다:
    //   0xae690 = (공격측이 CPU) || (설정+0xbd ≠ 0 = 자동) 이 참이면 돈다.
    //   거짓이어도 플레이+0x111(홈런)·플레이+0x129(폴 홈런)·종류 7(바운드 2루타)이면 그래도 돈다.
    // 곧 **사람이 공격하면서 주루 설정이 수동이면 자동 진루가 통째로 안 돈다.**
    //
    // 정정: 예전 줄은 `경기+0x24`(autoBaserunning)로 이 판단을 막았는데 **원본에는 그런 게이트가
    //    없다** — 0x24 를 읽는 곳은 0x3e0e6·0x521fa 둘뿐이고 둘 다 자동 진루와 무관하다
    //    (위 `autoBaserunning` 칸 주석). 그래서 그 항을 뺐다.
    // +0x111 · +0x129 는 판 끝 결과 코드 8(홈런) · 12(폴 홈런)가 사건 코드 처리 0xb2bc4 에서 세운다(6d 절) — 서면
    // `autoAdvanceDecisions` 가 틱 비교 없이 한 루씩 보낸다. 종류 7 은 코드 10(바운드로 담장을 넘은 2루타)의 0xb0cb8(7)이다.
    if (!play.finished && (autoBaserunningEnabled || homeRunFlag || play.suppressed || play.kind === 7)) {
      // `autoAdvanceDecisions` 의 `play.finished` 칸이 원본 +0x111 이다 — 이 진행기의 판 끝 표시가 아니라 홈런 칸을 넣는다
      const decisions = autoAdvanceDecisions({
        ...contextAt(tick),
        play: { ...play, finished: homeRunFlag },
        force: false,
        // 앞길 검사 0xa9924 의 방향 판정 0x9fe80 이 보는 +0x84
        previousTargetOf: (index) => runners.find((runner) => runner.state.index === index)?.previousTarget ?? NONE,
      })
      for (const decision of decisions) {
        const runner = runners[decision.runnerIndex]
        if (runner === undefined) continue
        // afa0e 는 죽은 주자(+0x96 — 아웃·득점)에게도 +0x128 = 1 을 세운다. 죽은 주자는 주자 틱이 안 옮기므로 목표만 그대로 둔다
        if (runner.state.isOut || runner.state.scored) {
          play = { ...play, wantsThrow: true }
          continue
        }
        if (decision.toBase > HOME_BASE) continue
        // force = 0 이라 결정은 멈춘 주자(= 제 목표 루에 선 주자)에게만 난다 — 예전 `force: true` + "목표 루에 닿아 있을 때만"
        // 근사와 같은 걸러냄이 이제 원본 인자에서 나온다
        // 타자주자도 다른 주자와 똑같이 보낸다 — 원본엔 결과 코드가 정한 루가 없다(타자주자가 선 루가 곧 루타다,
        // 판 끝 정산 0xa8024). 예전 웹은 타석 결과 코드의 루에서 타자주자를 세웠다 — 결과를 먼저 정한 웹 다리라 걷었다
        startLeg(runner, decision.toBase)
        // afa0e: 한 루 더 보내면 플레이+0x128 = 1 — CPU 송구 결정이 다시 고른다
        play = { ...play, wantsThrow: true }
      }
    }

    // ── 4b. 자동 슬라이딩 (0x52670 → 0xaf8fc → 제어기 vt10 = 0xb030c) ──
    // 원본은 경기 장면 슬롯 2 에서 자동 진루(0x52660) **바로 뒤**, CPU 송구 결정(0x526ae) 앞에 매 틱 돈다.
    // 사람/CPU·주루 설정 갈림이 없다. 슬라이딩시킨 주자가 하나라도 있으면 그 자리에서 효과음 10
    // (0x5267e `ble` → 0x5268c request(10)) — 사람 키와 달리 +0x31c 잠금도, 소리 재생 중 검사도 없다.
    //
    // 원본 그대로: 0xb030c 는 `주자+0x7c == 계획[+0xf]` 를 **mod 4 없이** 견준다(b0368~b036c).
    // 홈으로 가는 주자의 목표 루는 4(루 표 [4] = 홈 사본)이고 송구 목표 홈은 0 이라 **홈 송구로는 자동
    // 슬라이딩이 걸리지 않는다.** 고친 길(`bugfixes.json` B-57)은 `autoSlideRunnerIndexes` 가 주자 목표 4 를 0 으로 읽는다.
    //
    // **근사**: 원본 T = 계획[5](1구간 틱) − 공+0x68 이다. 웹은 송구 도착 틱 하나만 들고 있어
    // `송구 도착 틱 − 지금 틱` 을 쓴다(중계 송구면 원본은 첫 구간만 본다). "공.vt18() 거짓" 은
    // 송구가 날아가는 중으로 읽었다(R3 3-3). 메시지 처리기 0x519a4 의 같은 호출은 웹에 메시지 큐가 없어 뺐다.
    if (!play.finished) {
      const slid = autoSlideRunnerIndexes({
        isThrowInFlight: throwArrivalTick >= 0 && tick < throwArrivalTick,
        throwTargetBase: throwArrivalTick >= 0 && tick < throwArrivalTick ? throwBase : NONE,
        throwArrivalTicks: throwArrivalTick - tick,
        runners: runners.map(slidingRunnerOf),
      })
      for (const index of slid) {
        const runner = runners[index]
        runner.state = {
          ...runner.state,
          sliding: true,
          speed: runner.state.speed + SLIDING_SPEED_BONUS,
        }
      }
      if (slid.length > 0) {
        slidingSoundThisTick = true
        tickSounds.push({ kind: 'sound', soundId: SLIDING_SOUND_EFFECT })
        log.push(`${tick}틱 자동 슬라이딩 — 주자 ${slid.join('·')}`)
      }
    }

    // ── 4c. CPU 송구 결정 0xafa60 (슬롯 2 의 526ae, 자동 슬라이딩 바로 뒤 · 매 틱) ──
    // `0xae6c8` = 수비 CPU || 송구 설정 자동 일 때만 돈다(`input.throwMode` 주석). 0xafa60 은 +0x128 이 서 있고
    // 공 가진 야수가 준비(vtC4)됐을 때만 고른다 — +0x128 은 쥐기(받은 송구 포함)·자동 진루(afa0e)·결과 메시지
    // 0xbba 가 세우고 0xb2c90 성공이 지운다. 그래서 받은 야수는 준비 틱이 다 지난 틱에 **이어 던진다**(병살 송구),
    // 점수식이 −1 이면 다음 틱에 다시 고른다.
    if (cpuThrowEnabled && !play.finished && !uncatchable && tick > catchTick) {
      cpuThrowDecision()
    }

    }

    // ── 5. 화면 스냅샷 ──
    /**
     * 판 틱 `at` 의 그림. 5 절은 이 틱이고, 판이 G2 에서만 닫힌 그림(`closingListFrame` — 8 절 뒤)은 다음 틱 자리에서 한 번 더 찍는다.
     */
    const snapshotAt = (at: number, fieldersNow: readonly FielderState[], frozenCamera: boolean): DefensePlayView =>
      viewStateOf({
        tick: at,
        ball: ballPointAt({
          tick: at,
          trajectory,
          catchTick,
          fielders: fieldersNow,
          holderSlot: play.ballHolderSlot,
          held: play.held,
          throwBase,
          throwArrivalTick,
          throwFromSlot,
          throwReleaseTick,
          throwReceiverSlot,
          uncatchable,
        }),
        ballIsFlying:
          uncatchable
            ? at < trajectory.landingTick
            : at < catchTick || (throwArrivalTick >= 0 && at < throwArrivalTick),
        // 카메라 0x3f060 — 홈런(+0x111) · 폴 홈런(+0x129) 판에서 공.vt18(멈춤)이면 타자주자를 본다.
        // 멈춤은 관문 파울 갈래와 같은 읽기(지금 점의 속도 0)다. 홈런 판엔 쥔 공이 없다 — +0x111 · +0x129 는 아무도 쥐기 전(+0x112 == 0)의
        // 0x9d5bc 만 세우고, 선 뒤엔 포구 관문 b2af6 이 쥐기를 막는다 (U-115)
        ballStopped: trajectory.isStoppedAt === undefined ? at >= trajectory.length - 1 : trajectory.isStoppedAt(at),
        homeRunFlag,
        poleHomeRunFlag: play.suppressed,
        // 공 그리기 0x36dfc — 쥔 공(+0x12c)과 담장 뒤로 사라진 공은 공 · 그림자를 안 그린다
        ballHeld: play.held,
        ballBeyondFence: isBallBeyondFence(at, ballLandingTick, trajectory.fenceTick, homeRunFlag),
        // 공+0x68 — 0 이면 0x36dfc 36e24 가 공 · 그림자를 건너뛴다(판 첫 그림 · 송구 · 다시 쏜 그림)
        ballPlaybackTick: at - ballLaunchTick,
        // 머리에서 경기 멈춤(+0x1993)이 서 있던 그림(레이저 발사 다음 그림) — 0x3f060 이 3f0a4 에서 돌아가 카메라가 안 움직인다
        cameraFrozen: frozenCamera,
        fielders: fieldersNow,
        runners: runners.map((runner) => runner.state),
        catchKind: at >= play.actionStartTick && at <= catchTick ? play.catchKind : null,
        chaserSlot,
        throwingSlot:
          throwArrivalTick >= 0 && at >= throwReleaseTick && at < throwReleaseTick + 3 ? throwFromSlot : NONE,
        throwBase,
        previousActions,
        // ── 그림에만 쓰이는 것들 ──
        // 번쩍임(deadly_effect B·C)은 넘길 것이 없다 — 켜짐 칸 플레이+0x1f7·+0x1f8 을 세우는 것이
        // 포구 동작 분기표 0xd87f4 의 종류 3(점프)·4(슬라이딩)라 `catchKind` 로 이미 정해진다
        // (P2 2b, 확정). `defensePlayView.flashOf` 주석 참고.
        // 레이저 송구 반짝임(경기+0x19ad) — 0x43406~0x4342c 의 세 조건을 여기서 본다:
        // 공 쥔 야수(플레이+0x130) · 반짝임 켜짐 · deadly_effect A(+0x1990)가 안 돎.
        // A 는 **그리지 않는 줌 펀치**라 웹판에 상태 자체가 없다(R2 2절) — 셋째 조건은 늘 참으로 둔다(근사).
        laserShiningSlot: laserShining && play.held ? play.ballHolderSlot : NONE,
        // 공 가진 야수 고리 0x43cb0 — 경기+0x19ac · +0x130 · 공격 주체 · +0x19ad.
        // +0x19ac 는 쥐기 0xb2710 의 메시지 0x15(0x51872)만 세우고 0x17 진입이 지운다 = 이 판에 한 번이라도 쥐었나(`everHeld`).
        // +0x130 은 쥐기뿐 아니라 고르기 0xb3b38(b3e40)도 적는다 — 송구가 나가면 받을 야수로 바로 옮는다(`ballHolderSlot`)
        holderMark: holderMarkOf({
          grabbed: play.everHeld,
          holderSlot: play.ballHolderSlot,
          offenseIsCpu: input.offenseIsCpu === true,
          isShining: laserShining,
        }),
        holderPlate: input.fielderPlates?.[play.ballHolderSlot] ?? null,
        fumbleTicks: fumbleMarks,
        throwErrorTicks: throwErrorMarks,
        // 레이저 잔상 0x37076 — +0x1991 동안 지금 공 궤적의 t = 0 점에서 공까지
        laserTrailFrom: laserTrailOn ? ballSegmentStart : null,
        // 공 그리기 0x36dfc 의 큰 타구 · 튐 파티클 — 진행기 쪽 조건 (`ballParticleFactsOf`).
        // 튐은 공을 **궤적에서 읽어 그리는 틱**(`ballPointAt` 의 앞 두 갈래 — 잡히기 전 · 못 잡는 공 · 끼워 넣은 송구 · 튕긴 공)에만 본다.
        // ⚠️ `ballPointAt` 이 근사(낮은 포물선)로 그리는 송구 틱은 손을 떠나는 틱에 높이 투영이 0 → 0 아님이 되어 거짓 튐이 생기므로
        // 안 본다(그 틱의 원본 튐은 미확인)
        ballParticles: ballParticleFactsOf({
          ballTick: tick,
          at: tick,
          trajectory,
          onTrajectory: uncatchable || tick < catchTick,
          bigHitWatch: input.bigHitWatch ?? bigHitWatchOf(input),
          playKind: play.kind,
          resultCode: contactOfOutcome(input.outcome)?.resultCode ?? null,
        }),
        runnerAceIndexes: runnerAceIndexesOf(input.runnerAces, input.bases),
        runnerAceSprite: loadedRunnerAceOf(input.runnerAces, input.bases),
        previousTargetOf: (index) => runners.find((runner) => runner.state.index === index)?.previousTarget ?? NONE,
        aceIndexes: input.aceIndexes,
        defenseTeamIndex: input.defenseTeamIndex,
        fielderRecords: input.fielderRecords,
        offenseTeamIndex: input.offenseTeamIndex,
      })
    ticks.push(snapshotAt(tick, fielders, pausedAtHead))

    // ── 5b. 수비 화면 그리기 0x46c88 의 연출 몫 — 결과 판 0x46844(46de4) → 레이저 0x4403c(46e08) → 필살 포구 B 0x441c4(46e0e) ·
    //       C 0x44398(46e14) → 줌 펀치 0xbb84c(46e24). 셋은 연출 단계 +0x1992 를 함께 쓴다 (`defenseScene`) ──
    // 그림 N 의 그리기라 다음 그림의 목록 틱(6 절 이동) 앞 자리 — 공 가진 야수 자리도 이 그림의 자리다(예전 웹은 이동 뒤 자리를 봤다).
    // 원본은 그리기마다 돈다(판 진행 관문을 안 본다 — 46de4~46e24 앞에 관문 갈래가 없다). 그래서 G2 만 닫힌 그림(10 절)도 한 번 더 부른다.
    /** 마지막 스냅샷 그림에 이 그림의 연출을 한 번 돌려 얹는다 */
    const drawSceneEffects = (): void => {
      const holderView = ticks[ticks.length - 1]?.fielders.find((fielder) => fielder.slot === play.ballHolderSlot)
      const drawn = drawDefenseScene(scene, {
        holderSlot: play.ballHolderSlot,
        holder: fielders[play.ballHolderSlot]?.position,
        holderAction: holderView?.action,
      })
      scene = drawn.scene
      // 46932 — 큰 OUT 첫 그림이 +0x1999 를 보고 state[0x8b] = 1
      if (drawn.recordsLaserOut) laserOutFlag = true
      // 4412e — 레이저 단계 0: +0x19ad · +0x19ae = 0
      if (drawn.laserStepZero) {
        laserConfirmed = false
        laserShining = false
      }
      if (drawn.unpaused) gamePaused = false
      // 44330 · 44564 — B · C 끝: 플레이+0x1f4 = +0x1f8 = +0x1f7 = 0
      if (drawn.flashEnded) {
        laserArmed = false
        deadlyJumpArmed = false
        deadlySlideArmed = false
      }
      if (drawn.zoom !== null || drawn.bigOut !== null || drawn.judgeText !== null || drawn.flash !== null) {
        const view = ticks[ticks.length - 1]
        if (view !== undefined) {
          ticks[ticks.length - 1] = {
            ...view,
            ...(drawn.zoom === null ? {} : { zoom: drawn.zoom }),
            ...(drawn.bigOut === null ? {} : { bigOut: drawn.bigOut }),
            ...(drawn.judgeText === null ? {} : { judgeText: drawn.judgeText }),
            ...(drawn.flash === null ? {} : { flash: drawn.flash }),
          }
        }
      }
    }
    drawSceneEffects()

    // 관문 G3 · G4 · G1 은 다음 그림의 목록 틱(6 절 이동) 앞 주자를 본다 (`playGate.gateRunnerViewsOf`)
    const runnersBeforeListTick = runners.map((runner) => runner.state)
    // ── 6. 한 틱 움직이기 ── (키 건너뛰기가 풀린 그림 다음 그림의 목록 틱 — 9 절 `extraListTick` — 도 같은 이동이다)
    const listTickMove = (): void => {
    const beforeMove = fielders
    // 추적야수 AI 1(0xb4afe)의 목표(+0x127 && 낙구 틱 ≥ 공+0x68 이면 낙구 지점, 아니면 포구 지점)는 AI 고리 1c 절이 고쳤다(r190)
    fielders = fielders.map((fielder) =>
      // 이 걸음은 원본의 **다음** 야수 틱 0xa1284 몫이다(0x3f060 목록 틱이 슬롯 2 플레이 틱보다 먼저 — 9 · 10 절).
      // 그 틱은 a12b4 에서 +0xb4 > 0 이면 −1 만 하고 a12c6/a12d6 에서 끝나 a1376 이동(0xbf094)까지 못 간다 — 곧 막는 값은
      // **지금(이 틱 플레이 갈래 뒤)의 +0xb4** 다. 머리 0' 절의 `lockedThisTick` 은 원본 이 틱 몫이라 한 틱 이르다(r155):
      // 포구 틱 b4588 vt74 가 +0xb4 = 15 를 세운 그 틱의 걸음부터 15번을 막고, 잠금이 0 이 된 틱(머리 1 → 0)의 걸음은 걷는다
      fielder.actionLockTicks > 0
        ? fielder
        : moveFielder(fielder, {
            chaserSlot,
            tick,
            catchTick,
            // a1346~a1376 — 그 야수 틱의 이동 관문: 0xa0f7c(+0xb0 바이트 == 0 || 프레임 ∈ {1, 2}) && vtc8(+0xb1 · +0xcc) (r171).
            // 점프 · 가슴 높이 포구 동작은 프레임 1 · 2 만 걷고, 던진 야수(+0xb1)는 한 번 쉰다. 목표는 AI 가 그대로 고른다
            canStep: canStepNextListTick(fielder),
          }),
    )
    // 야수+0x3b — 이번 갱신에 목표점에 막 닿았나 (0xbf0dc: 머리에서 지우고 닿은 갱신에서만 1). 다음 판 틱 6c 절이 본다
    fielderArrivals = fielders.map(
      (fielder, slot) =>
        !isSamePoint(beforeMove[slot]?.position ?? fielder.position, fielder.target) &&
        isSamePoint(fielder.position, fielder.target),
    )
    for (const runner of runners) {
      // 주자+0x3b — 주자 틱 0xa01cc 의 a0364 0xbf094 가 머리(bf0a2)에서 지우고, 목표점에 없을 때만 부르는 이동 0xbf0dc 가
      // 막 닿은 갱신에서만 1 로 세운다. 다음 판 틱의 득점 0xaa0a8(6f 절)이 본다
      runner.arrivedThisListTick = false
      if (runner.state.isOut || runner.state.scored) continue
      // 주자 틱 0xa01cc 의 요구 루 갈래 a028c (`requiredBasePinOf`) — 자동 진루(4절)가 리터치 주자를 다음 루로 보내도
      // 요구 루에 닿아 풀리기(0xa040c) 전에는 되돌려 세운다. 판 진행 관문 0xb0d28 의 0xaa05c 가 +0x94 를 보므로
      // 이것이 없으면 요구 루를 못 푼 주자가 판을 끝없이 잡아 둔다.
      const pinned = requiredBasePinOf(runner.state)
      if (pinned !== runner.state.targetBase) {
        runner.state = { ...runner.state, legStart: runner.state.position, targetBase: pinned, settled: false }
      }
      const target = basePosition(runner.state.targetBase)
      const wasAtTarget = isAtTarget(runner.state)
      runner.state = {
        ...runner.state,
        position: stepToward(runner.state.position, target, runner.state.speed),
      }
      if (!isAtTarget(runner.state)) continue
      if (!wasAtTarget) runner.arrivedThisListTick = true
      // 0xa040c 도착 — **+0x8c = +0x7c**(닿은 루를 "마지막으로 닿은 루" 로 굳힌다).
      // 그 뒤 `+0x94 && +0x8c == +0x88` 이면 `+0x88 = -1, +0x94 = 0` 으로 요구 루가 풀린다.
      const touched = runner.state.targetBase
      runner.state = {
        ...runner.state,
        settled: true,
        startBase: touched,
        requiredBase:
          runner.state.requiredBase !== NONE && runner.state.requiredBase === touched
            ? NONE
            : runner.state.requiredBase,
      }
      // 0xa040c 는 +0x84 = +0x8c = +0x7c 로 적는다
      runner.previousTarget = touched
      // 포스로 밀린 루까지는 반드시 간다 (포스 사슬의 최소 루). 한 루씩 이어 달린다
      if (runner.state.targetBase < runner.minimumBase) {
        startLeg(runner, runner.state.targetBase + 1)
        continue
      }
    }
    }
    // 6~7 절은 다음 그림의 목록 틱(0x3f060)과 플레이 틱 꼬리다 — 이 틱에 멈췄으면 다음 그림도 멈춰 있어 없다
    if (!pausedThisTick) listTickMove()

    // ── 8. 판 진행 관문 0xb0d28 — 이 틱 그리기 0x46e3c(G3) · 0x3f378(G4, 안 쥐었을 때) · 다음 틱 0x3f060(G1) · 슬롯 2 머리 52502(G2) ──
    // (전문은 `entities/fielding/model/playGate.ts` — `passPlayGateBetweenTicks`). 부를 때마다 +0x120 이 오르므로 주자가 다 서고
    // (+0x94 까지) 누가 공을 쥔 채 관문을 51 번 지나면(그림마다 3 번 — 17 틱) 닫힌다. 그동안에도 자동 진루 · CPU 송구가 돈다.
    // 3아웃(b0dbe) · 사건 코드 11(b0db4)이면 곧바로 닫힌다. 악송구는 예보 vt24(0)가 고른 야수가 포구 틱 갈래로 주워 쥔다(`takeLooseBall`).
    /**
     * **키 건너뛰기 되풀이의 관문 (52b26~52b40 · 그 뒤 그림, 직접 뜸)** — 건너뛰는 동안 한 그림 안의 차례는
     * ```
     * 52b32  0x3f060: G1(3f0b8) → 열렸으면 목록 틱 → 카메라 3f164 (타자주자 홈이면 +0xfe7 = 0 · 메시지 0x13)
     * 52b36  +0xfe7 이 서 있으면 524f8 → G2(52502) → 슬롯 2 … → 52b26 되풀이
     *        풀렸으면 52b42 → 그리기 0x46c88(G3 0x46e3c) → 0x3f378(G4, 쥐지 않았을 때)
     * 52e16  다음 그림 머리 0x3f060 — G1 → 목록 틱 **한 번 더**(주자 +0x3b 를 머리에서 지운다) → 0x524c0 의 G2 → 슬롯 2
     * ```
     * 그래서 풀린 틱은 G1 · 목록 틱 · 카메라 뒤에 G3 · G4 · G1 · 목록 틱이 더 돌고서야 G2 다. 웹 판 틱은 6 절 이동 하나가 목록 틱 하나라
     * 풀린 그림 다음 그림의 목록 틱을 여기서 한 번 더 돈다(`listTickHead` — 앞 목록 틱의 야수 준비 틱 몫 · `listTickMove`). 같은 목록 틱에
     * 타자주자와 함께 홈에 닿은 앞 주자는 원본에서 그 목록 틱이 +0x3b 를 지워 다음 슬롯 2 의 0xaa0a8 이 세지 않는다(원본 버그) —
     * **사용자 결정 2026-10-26: 원본 버그를 고침** — 웹은 그 앞 주자의 +0x3b 를 남겨 센다.
     */
    const passFastForwardGates = (
      input: PlayGateInput,
      views: { readonly frame: readonly RunnerState[]; readonly head: readonly RunnerState[] },
      runnerInputOf: (views: readonly RunnerState[]) => Partial<PlayGateInput>,
    ): PlayGateFrameResult => {
      let counter = input.endCounter
      const call = (override: Partial<PlayGateInput>): boolean => {
        const result = passPlayGate({ ...input, ...override, endCounter: counter })
        counter = result.endCounter
        return result.open
      }
      // G1 — 52b32 의 0x3f060 (6 절 이동 앞 주자)
      let listTickOpen = call(runnerInputOf(views.frame))
      if (listTickOpen) cameraFastForwardRunIn()
      let drawOpen: boolean | null = null
      if (!fastForward) {
        // 풀린 그림의 그리기 — 목록 틱 · 카메라(타자주자 득점) 뒤 주자를 본다
        const drawn = runnerInputOf(runners.map((runner) => runner.state))
        drawOpen = call(drawn)
        if (!play.held) call(drawn)
        // 다음 그림 머리 52e16 의 0x3f060 — G1 이 열렸으면 목록 틱 한 번 더
        listTickOpen = call(drawn)
        if (listTickOpen) {
          // **사용자 결정 2026-10-26: 원본 버그를 고침.** 원본은 이 목록 틱 머리 0xbf094(bf0a2)가 +0x3b 를 지워, 타자주자와 같은
          // 목록 틱에 홈을 밟은 앞 주자를 0xaa0a8 이 못 센다(1점이 빠지고 +0x96 이 안 서 관문이 늘 열려 판이 안 끝난다 — r247).
          // 웹은 그 앞 주자의 +0x3b 를 이 목록 틱 뒤에도 남겨, 다음 판 틱 6f 절의 0xaa0a8 이 (타자주자 다음 차례로) 센다.
          // 카메라가 푸는 것은 홈런(+0x111 · +0x129)뿐이라 이 갈래도 홈런에만 선다
          const homeArrivals = runners.filter(
            (runner) =>
              runner.arrivedThisListTick &&
              !runner.counted &&
              !runner.state.isOut &&
              !runner.state.scored &&
              runner.state.targetBase === 4 &&
              isAtTarget(runner.state),
          )
          listTickHead()
          listTickMove()
          for (const runner of homeArrivals) runner.arrivedThisListTick = true
        }
      }
      const counterBeforeHead = counter
      const headOpen = call(runnerInputOf(fastForward ? views.head : runners.map((runner) => runner.state)))
      return { open: headOpen, endCounter: counter, drawOpen, counterBeforeHead, listTickOpen }
    }
    const gateRunners = gateRunnerViewsOf(runnersBeforeListTick, runners.map((runner) => runner.state))
    const gateInput: PlayGateInput = {
        foulFlag,
        // 파울 갈래(b0d2c)만 본다 — 멈춤 · 담장선 넘은 뒤 떨어지는 틱 · 홈 뒤(z > 32599, −315 < 각 < −225)
        foulBall: foulFlag
          ? {
              // 공.vt18 = 0xa27f0 = 지금 점(공+0x68)의 속도 · 수직 속도 워드 == 0 && (공+0x24(높이) == 0 || 공+0x20 == 공+0x2c).
              // 공+0x20 · +0x2c 는 세계 0xbfed0 이 멈출 때(vt18 참)까지 돌린 마지막 물리 상태이고 재생 중엔 아무도 안 고친다
              // (공은 장면 +0x1e4 목록에 없다 — 3e5e0 new(0xac8) 뒤 0xc0104 를 안 부름) → 뒷 조건은 늘 참, 멈춤 = 지금 점의 속도 0.
              // 쥔 공은 0x3f378 3f3aa 가 +0x12c 이면 +0x68 을 안 올려 쥔 틱의 점에 머문다 — 쥐었다고 멈춘 공이 아니다.
              // 이 갈래(+0x110)에는 쥔 공이 오지 않는다: 쥐기 0xb2710 b2760 이 +0x112 = 1 을 세워 0x9d5bc(코드 7)가 안 돌고(b444e),
              // +0x110 이 서면 포구 관문 b2af6 이 쥐기를 막는다 (U-115)
              stopped: trajectory.isStoppedAt === undefined ? tick >= trajectory.length - 1 : trajectory.isStoppedAt(tick),
              currentTick: tick,
              landingTick: trajectory.landingTick,
              fenceTick: trajectory.fenceTick,
              z: trajectory.pointAt(tick).z,
              angle: trajectory.pointDetailAt?.(tick).angle ?? 0,
            }
          : undefined,
        lastEventCode,
        outs,
        // 0xaa05c · 0xa990c — G3 · G4 · G1 은 6 절 이동 · 득점 앞 주자를 본다(G2 는 아래 `headInput`)
        someRunnerActive: someRunnerStillActive(gateRunners.frame, isAtTarget),
        homeRunDerby: false,
        homeRunFlag,
        poleHomeRunFlag: play.suppressed,
        liveRunnerCount: liveRunnerCountOf(gateRunners.frame),
        ballHeld: play.held,
        groundRuleFlag,
        endCounter,
    }
    // G2(슬롯 2 머리 52502) — 목록 틱(6 절 이동) 뒤 · 득점 0xaa0a8(G2 뒤) 앞
    const runnerGateInputOf = (views: readonly RunnerState[]): Partial<PlayGateInput> => ({
      someRunnerActive: someRunnerStillActive(views, isAtTarget),
      liveRunnerCount: liveRunnerCountOf(views),
    })
    const gate =
      fastForward && !gamePaused
        ? passFastForwardGates(gateInput, gateRunners, runnerGateInputOf)
        : passPlayGateBetweenTicks(gateInput, fastForward, gamePaused, runnerGateInputOf(gateRunners.head))
    endCounter = gate.endCounter
    counterBeforeHead = gate.counterBeforeHead
    drawGateOpen = gate.drawOpen
    if (!gate.open) play = { ...play, finished: true }
    // 닫힌 그림 다음의 G1 — 열렸으면 목록 틱 a1330 이 +0xcc 를 하나 더 줄인다(`fielderSlackAtPlayEnd`, r196)
    if (!gate.open) state.closingListTickOpen = gate.listTickOpen === true

    // 키 건너뛰기 되풀이 52b26~52b40 동안은 그리기 · 0x3f378 이 없어 공+0x68 이 안 오른다(0xa2594 를 부르는 곳은 0x3f378 3f3c6 하나) —
    // 다음 판 틱도 이 틱의 공 점을 본다. 풀린 그림은 그리고 0x3f378(G4)을 지나 다음 판 틱은 한 칸 나아간 점이다(쥐었으면 3f3aa 가 안 올린다 —
    // 쥔 공은 진행기가 야수 손에 둔다)
    if (fastForward && !gamePaused) {
      trajectory = holdTrajectoryAt(trajectory, tick + 1)
      if (ballLandingTick > tick) ballLandingTick += 1
      if (catchTick > tick) catchTick += 1
    }
    // ── 9b. 슬롯 2 꼬리 52b62~52bb2 — 깊은 낙구 함성 60 (직접 뜸) ──
    // 52b26 건너뛰기 되풀이가 끝난 뒤(+0xfe7 == 0) 한 번: 공+0xaa0(낙구 틱) ≠ −1 && == 공+0x68 && 공+0xac4(깊은 페어 낙구) &&
    // ¬0x357e0(결과 코드 24~26) && 플레이+0x113(b4492 — 낙구 틱에 아무도 안 쥐었다) → 즉시 60. 결과 코드(0x357e0)는 화면이 본다.
    // 공+0xac4 = 낙구점이 홈에서 10274 넘게 · 각이 페어(P2 2절) — 웹은 이 궤적의 낙구 거리와 쏜 공의 파울 각(state[0x1c])으로 본다
    // (예전 판 끝 `atBatSounds.deepHitCheerSoundIdOf` 와 같은 근사). 건너뛰는 채로 끝난 틱은 52b40 이 524f8 로 돌아가 이 꼬리가 없다
    if (landedUncaughtThisTick && !fastForward && !state.foulAngle && carryDistanceOf(trajectory) > DEEP_LANDING_DISTANCE) {
      tickSounds.push({ kind: 'deepLanding' })
    }

    // ── 10. G2 만 닫힌 그림 — 원본은 그 그림도 그린다 (`DefenseViewState.closingListFrame`) ──
    // G3 · G4 · G1 이 열리고 G2(52502)에서 닫히면(쥔 채 다 선 판의 +0x120 세기는 목록 틱 뒤 주자부터 세어 G2 에서 51 이 되기 쉽다)
    // 다음 그림은 0x3f060 의 목록 틱(6 절 이동 + 야수 준비 틱 줄이기 a1312) · 카메라를 돌고 슬롯 2 는 529f0 으로 빠진 채 그려진다.
    // 공+0x68 은 그 앞 0x3f378(G4)이 이미 올렸으므로 다음 틱 점이다. 건너뛰는 동안(+0xfe7)은 그리지 않는다.
    // 그 그림의 연출(결과 판 0x46844 · 레이저 0x4403c · 필살 포구 B · C · 줌 펀치 0xbb84c)도 그리기 0x46c88(46de4~46e24)가 관문을 안 보고
    // 한 번 더 돌린다(직접 뜸) — 결과 판 타이머가 한 칸 더 줄고 줌 · 큰 OUT 이 한 걸음 나아간다. 예전 웹은 앞 그림 칸을 그대로 베꼈다.
    // ⚠️ 그 뒤 닫힌 갱신(529f0, +0x1094 셈)의 그리기 연출은 이 진행기 밖이다 — 재생기(`DefensePlayback`)가 마지막 그림을 그대로 둔다
    if (!gate.open && gate.listTickOpen === true && !fastForward) {
      const listTickFielders = fielders.map(listTickFielder)
      ticks.push({ ...snapshotAt(tick + 1, listTickFielders, false), closingListFrame: true })
      drawSceneEffects()
    }
  }

  // ── 한 틱치를 상태에 되돌려 넣는다 ──
  state.fielders = fielders
  state.play = play
  state.held = held
  state.outs = outs
  state.outsAdded = outsAdded
  state.throwBase = throwBase
  state.throwArrivalTick = throwArrivalTick
  state.throwFromSlot = throwFromSlot
  state.throwReleaseTick = throwReleaseTick
  state.throwReceiverSlot = throwReceiverSlot
  state.fumbleMarks = fumbleMarks
  state.throwErrorMarks = throwErrorMarks
  state.receivingThrow = receivingThrow
  state.fielderArrivals = fielderArrivals
  state.throwCount = throwCount
  state.firstThrowBase = firstThrowBase
  state.firstThrowArrivalTick = firstThrowArrivalTick
  state.flyOut = flyOut
  state.hitEvent = hitEvent
  state.homeRunEvent = homeRunEvent
  state.outEvents = outEvents
  state.groundHomeRun = groundHomeRun
  state.catchTick = catchTick
  state.trajectory = trajectory
  state.uncatchable = uncatchable
  state.onTheFly = onTheFly
  state.chaserSlot = chaserSlot
  state.catchPoint = catchPoint
  state.fumbled = fumbled
  state.errantThrow = errantThrow
  state.autoBaserunning = autoBaserunning
  state.slidingSoundPlayed = slidingSoundPlayed
  state.slidingSoundThisTick = slidingSoundThisTick
  state.hitStaggerSoundThisTick = hitStaggerSoundThisTick
  state.runInsThisTick = runInsThisTick
  state.tickSounds = tickSounds
  state.laserShining = laserShining
  state.laserConfirmed = laserConfirmed
  state.laserRolled = laserRolled
  state.laserThrow = laserThrow
  state.laserArmed = laserArmed
  state.laserTrailOn = laserTrailOn
  state.ballSegmentStart = ballSegmentStart
  state.gamePaused = gamePaused
  state.scene = scene
  state.deadlyJumpArmed = deadlyJumpArmed
  state.deadlySlideArmed = deadlySlideArmed
  state.laserOutFlag = laserOutFlag
  state.counterBeforeHead = counterBeforeHead
  state.rundown = rundown
  state.rundownThrowArrival = rundownThrowArrival
  state.rundownThrowTo = rundownThrowTo
  state.rundowns = rundowns
  state.rundownOuts = rundownOuts
  state.tagOut = tagOut
  state.relayFlag = relayFlag
  state.relayFinalSlot = relayFinalSlot
  state.relayBase = relayBase
  state.deferredThrowReceiver = deferredThrowReceiver
  state.deferredThrowBase = deferredThrowBase
  state.endCounter = endCounter
  state.drawGateOpen = drawGateOpen
  state.fastForward = fastForward
  state.lastEventCode = lastEventCode
  state.ballContacted = ballContacted
  state.foulFlag = foulFlag
  state.wideFair = wideFair
  state.homeRunFlag = homeRunFlag
  state.groundRuleFlag = groundRuleFlag
  state.landingChase = landingChase
  state.ballLandingTick = ballLandingTick
  state.ballLaunchTick = ballLaunchTick
  state.diveTicks = diveTicks
  state.diveCatchTick = diveCatchTick
  state.tick = tick + 1
  return state
}

/**
 * 다 돈 상태에서 결과를 뽑는다 — 원본 루프가 끝난 뒤의 마무리다.
 *
 * **득점 = 점수판에 올라간 득점(`held.scoreboardRuns`) 그대로** — 원본은 판 뒤에 득점을 지우지 않는다 (직접 뜸):
 * - 바로 득점(0xaa1b0 메시지 0x13 → 0x51fb8 → 0xa5c34)은 그 자리에서 팀+0x27c+8(총점)·+4 를 +1 하고 이벤트 0xf 를 넣는다.
 * *   팀+0x27c 칸을 줄이는 코드는 없다(`movs #0x9f; lsls #2` 쓰임 44곳 — 0xa5c34·0xa5e14 의 +1 말고는 다른 객체·초기화).
 * - 3아웃이 막는 것은 `state[0]` 보류분뿐이다 — 해제 꼬리 0xaa388 `state[6] > 2 → return`, 다음 판 0xb67d0 이 지운다.
 * - 판 끝 판정 0xae3e8: 아웃 > 2 면 ae554 → 0x18 로 정산 0xa8024(ae5b2)를 부를 뿐 점수판은 안 건드린다.
 * 곧 아웃 ≤ 1 때 · 공이 안 닿았을 때 · 타자주자가 살아 뛰던 때 바로 올린 득점은 뒤에 타자주자가 죽어 3아웃이 돼도 남는다
 * (원본 그대로 — 야구 규칙과 다를 수 있다).
 *
 * 예전 웹은 S2 2-5 의 "타석 단위 엔진에 옮길 때의 같은 결과 규칙"(3아웃 · 땅볼 · 타자주자 아웃이면 득점 0)을 여기에 한 번 더
 * 걸었다. 그 규칙은 보류 개념이 없던 타석 단위 엔진을 위한 근사였고, 이 진행기는 보류·해제를 틱 단위로 원본대로 돌리므로 뺐다.
 * `voidedRuns` 는 3아웃으로 끝내 안 풀린 보류분(`state[0]`)이다.
 */
export function defensePlayResultOf(state: DefensePlayState): DefensePlayResult {
  const held = state.held
  const runners = state.runners
  const runsScored = held.scoreboardRuns
  // 파울로 닫힌 판 — 0xae3e8 ae568 이 정산을 건너뛰고 0x35108 이 0xa975c(주자를 판 앞 자리로) · 0xb6b58(스트라이크) 를 부른다
  const foulEnded = state.foulFlag && !state.flyOut
  // 정산 0xa8024 가 보는 판 끝 값 — 타자 결과(a8192~a88d4)와 희생 [sp+8](a83e2)이 같은 값을 본다
  const settleInput: PlayOutcomeInput = {
    runners: runners.map((runner) => runner.state),
    previousTargets: runners.map((runner) => runner.previousTarget),
    hitEvent: state.hitEvent,
    homeRunEvent: state.homeRunEvent,
    flyOut: state.flyOut,
    outEvents: state.outEvents,
    runsScored,
    outsAfter: state.outs,
  }

  return {
    advance: foulEnded
      ? { bases: state.input.bases, runsScored: 0, outsAdded: state.outsAdded }
      : {
          bases: basesOf(runners),
          runsScored,
          outsAdded: state.outsAdded,
        },
    ...(foulEnded ? { foulEnded: true, foulStrikes: strikesAfterPlay(state.input.strikes ?? 0, FOUL_RESULT_CODE) } : {}),
    ...(state.lastEventCode === BUNT_FOUL_OUT_RESULT_CODE ? { buntFoulOut: true } : {}),
    ticks: state.ticks,
    catchFielderSlot: state.chaserSlot,
    catchTick: state.catchTick,
    // 필살타법으로 친 타구였나 — 첫 야수에게 맞고 튕긴 뒤로는 보통 공이 되지만(0xa2610 이 +0x5c 를 비운다) 결과는 친 공의 표시다
    isUncatchable: state.input.isUncatchable === true,
    caughtOnTheFly: state.flyOut,
    outcome: foulEnded ? undefined : settledBatterOutcomeOf(settleInput),
    ...((state.input.buntKind ?? 0) !== 0 ? { buntBall: true } : {}),
    ...(!foulEnded && isSacrificeOf(settleInput) ? { sacrifice: true } : {}),
    ...(!foulEnded && scoringBaseRunnerAfterOf(runners.map((runner) => runner.state)) ? { scoringBaseRunnerAfter: true } : {}),
    ...(!foulEnded && state.groundHomeRun ? { groundHomeRun: true } : {}),
    tagOut: state.tagOut,
    throwBase: state.firstThrowBase,
    throwArrivalTick: state.firstThrowArrivalTick,
    safeCallTick: state.safeCallTick,
    voidedRuns: held.heldRuns,
    fumbled: state.fumbled,
    errantThrow: state.errantThrow,
    specialDefense: state.specialDefense,
    laserThrow: state.laserThrow,
    laserOutFlag: state.laserOutFlag,
    // 플레이 객체 +0xf0 은 다음 판으로 남는다(`DefenseScene.playCovers`). 야수 +0xcc 도 — 파울 판(AI 0xf)의 4~5 를 다음 vt20(0) 판이
    // 들고 연다(`DefenseScene.fielderSlack`, r196). 이 판은 vt20(1)(b2818)이라 0 으로 열었다
    scene: {
      ...state.scene,
      playCovers: state.play.coverOfBase,
      fielderSlack: fielderSlackAtPlayEnd(state.fielders, state.closingListTickOpen),
      // 판이 끝난 그대로의 플레이 · 야수 — 다음 도루 키 0x583 의 0xafa60 이 본다(`DefenseScene.playEnd`, r201)
      playEnd: playEndStateOf(state.play, state.fielders, state.closingListTickOpen),
    },
    rundowns: state.rundowns,
    rundownOuts: state.rundownOuts,
    // 진행기 주자 배열이 곧 원본 목록 순서다 — 0 = 타자주자, 그 뒤 찬 루 오름차순 (`createPlayRunners`)
    runnerFates: runners.map((runner) => runnerFateOf(runner.state)),
    log: state.log,
  }
}

/**
 * 타구 하나를 **끝까지 미리 돌려** 결과를 내준다 — 스테퍼를 다 돌리는 **얇은 껍데기**다.
 *
 * 사람이 실시간으로 치는 화면은 이것을 쓰지 않고 `startDefensePlay`·`stepDefensePlay` 를 직접 돌린다.
 * 여기서는 조작이 있으면 `keyAt(tick)` 으로 "그 틱에 눌렸을 키" 를 미리 물어 넘긴다.
 */
export function runDefensePlay(input: DefensePlayInput): DefensePlayResult {
  let state = startDefensePlay(input)
  while (!isDefensePlayFinished(state)) {
    state = stepDefensePlay(state, input.controls?.keyAt(state.tick) ?? null)
  }
  return defensePlayResultOf(state)
}

/**
 * **판 앞의 예측 결과** — 같은 입력을 **굴림 없이 · 키 없이** 끝까지 돌려 본 판 끝 정산 결과다. 난수를 한 톨도 안 쓴다.
 *
 * ⚠️ 웹 전용 값이다 — 원본에는 판 앞의 결과가 없다. 세션·화면이 판이 끝나기 전에 고르는 그림·소리·배너(진행기 입력의
 * `outcome` 칸)를 실제 판에 가깝게 맞추려고만 쓴다. 기록·진루는 언제나 **실제로 돈 판**의 `DefensePlayResult.outcome` 이다
 * (펌블 · 악송구 · 필살수비 · 폴 굴림 · 사람 키가 결과를 바꿀 수 있다 — 사람 수동 송구는 키가 없으면 안 던진 판이다).
 */
export function predictedOutcomeOf(input: DefensePlayInput): AtBatOutcome {
  const played = runDefensePlay({ ...input, random: undefined, controls: undefined })
  return played.outcome ?? input.outcome
}

/**
 * 입력의 임시 결과 칸(`outcome`)을 판 앞 예측(`predictedOutcomeOf`)으로 바꿔 끼운다.
 * 결과를 넘겨받은 호출(`outcomeIsGiven`)은 넘겨받은 결과를 그대로 둔다.
 */
export function withPredictedOutcome(input: DefensePlayInput): DefensePlayInput {
  if (input.outcomeIsGiven === true) return input
  // 쏜 공(필살 스윙 재료 · 쏜 패턴)은 판 시작이 임시 결과 칸에서 되찾는다 — 갈아 끼운 칸에도 묶어 둔다
  return { ...input, outcome: carryContact(input.outcome, { ...predictedOutcomeOf(input) }) }
}

/**
 * **기록할 타석 결과** — 판 끝 정산(0xa8024)이 낸 결과(`DefensePlayResult.outcome`).
 * ⚠️ 결과를 넘겨받은 호출(`outcomeIsGiven` — 시험·옛 호출, 원본에 없는 길)만 넘겨받은 결과를 그대로 적는다.
 */
export function recordedOutcomeOf(input: DefensePlayInput, result: DefensePlayResult): AtBatOutcome {
  if (input.outcomeIsGiven === true) return input.outcome
  return result.outcome ?? input.outcome
}

/** 판 끝 결과 코드 7 — 파울 (0x9d5bc 의 0xb68dc 갈래) */
const FOUL_RESULT_CODE = 7
/** 판 끝 결과 코드 11 — 2스트라이크 번트 파울 아웃 (0x9d5bc 9d5fa) */
const BUNT_FOUL_OUT_RESULT_CODE = 11

/** 예보 표가 비었을 때의 가장 이른 포구 틱 (플레이 +0x11c 초기값 0xffff — `forecastCatch`) */
const NO_FORECAST_CATCH = 0xffff
/** 0xb2c90: 받는 야수까지 이 거리 이하면 던지지 않는다 */
const MINIMUM_THROW_DISTANCE = 600

interface SpecialDefenseRollInput {
  readonly random?: RandomPort
  readonly ability: number
  readonly skillIds?: readonly number[]
  readonly gameMode?: number
  readonly chaserSlot: number
  /** state[0x13] — 번트 종류 (0 = 스윙) */
  readonly buntKind: number
}

/**
 * 필살수비 굴림의 관문 (0x50faa 가지, I-controls 2c — 직접 뜬 것):
 * ```
 * 50fba  [장면+0x1104](모드) == 7 → 굴림 없음
 * 50fc0  0x36140(장면) ≠ 0 → 굴림 없음
 * 50fc8  (s8)state[0x13](번트 종류) ≠ 0 → 굴림 없음          ; 번트 타구는 필살수비를 안 굴린다
 * 50fda  장면+0xfe8 == 0 이면 A 0x50930 · 아직 0 이면 B 0x508c0
 * ```
 * 0x50930 · 0x508c0 안에서 공 쫓는 야수가 투수(0)·포수(1)면 굴리지 않는다. 나머지 조건(경기+0x19·0x1e, 담장 판정 0x36140)은
 * 이 진행기가 도는 시점에 이미 참이다(페어 인플레이 타구만 돌린다).
 */
function rollSpecialDefenseFor(input: SpecialDefenseRollInput): {
  readonly jumpUnlocked: boolean
  readonly slideUnlocked: boolean
} {
  const 닫힘 = { jumpUnlocked: false, slideUnlocked: false }
  if (input.random === undefined) return 닫힘
  if (input.gameMode === HOME_RUN_DERBY_MODE) return 닫힘
  if (input.buntKind !== 0) return 닫힘
  if (input.chaserSlot === 0 || input.chaserSlot === 1) return 닫힘
  return rollSpecialDefense(input.ability, input.random, {
    hasSixthSense: input.skillIds?.includes(SIXTH_SENSE_SKILL_ID) === true,
    isBatterCareerMode: input.gameMode === BATTER_CAREER_MODE,
  })
}

/** 주자 한 명을 슬라이딩 판정(0xa9690)이 보는 모양으로 옮긴다 */
function slidingRunnerOf(runner: MutableRunner): SlidingRunner {
  const target = basePosition(runner.state.targetBase)
  return {
    progressPercent: progressPercent(runner.state.legStart, runner.state.position, target),
    isOut: runner.state.isOut,
    // 아웃돼 걸어 나가는 연출(+0xba)은 이 진행기에 없다 — 죽은 주자는 그 자리에서 사라진다
    isLeavingField: false,
    isSliding: runner.state.sliding,
    targetBase: runner.state.targetBase,
    ticksToArrive: ticksToReach(runner.state.position, target, runner.state.speed),
  }
}

/** 패턴에서 궤적까지 한 번에 만들어 돌린다 — 부르는 쪽이 편하게 */
export function runDefensePlayForPattern(
  input: Omit<DefensePlayInput, 'trajectory'> & { readonly pattern: BattedBallPattern },
): DefensePlayResult {
  return runDefensePlay({ ...input, trajectory: battedBallTrajectory(input.pattern) })
}

// ── 잡다한 도우미들 ──

const wrapBase = (base: number) => ((base % 4) + 4) % 4

/** 누가 고른 송구인가 — 기록 줄에만 쓰인다 */
type ThrowChooser = '사람' | 'CPU' | '미룬' | '중계'

/** 0xa0ff4 — AI 상태가 루 커버(2~5)인가 */
function isCoverState(aiState: number): boolean {
  return aiState >= AI_STATE.COVER_HOME && aiState <= AI_STATE.COVER_THIRD
}

function isAtTarget(runner: RunnerState): boolean {
  return isSamePoint(runner.position, basePosition(runner.targetBase))
}

function markOut(runner: MutableRunner): void {
  runner.state = { ...runner.state, isOut: true, settled: true }
}

/**
 * **판 시작의 자동 진루 `0xaf8c0(제어기, 1)`** (0x46766, 0x46418 의 리드 고리 0x3d7b8 뒤). 결정마다 플레이+0x128 = 1 (afa0e) ·
 * 목표가 바뀌는 주자만 새 구간을 연다(vt48 a07b0 은 같은 목표면 +0x84 = 옛 +0x7c 로 같은 값을 적을 뿐이다).
 * ⚠️ 이 줄의 `startLeg` 는 출발 루(+0x8c)를 옛 목표로 적는다 — 목표가 바뀌는 주자는 멈춰 섰거나(+0x7c == +0x8c) 리드 뒤
 * 제 루로 돌아오는 중(+0x7c == +0x8c)이라 같은 값이다.
 */
function applyPlayStartAutoAdvance(context: DefenseContext, runners: readonly MutableRunner[]): PlayView {
  let play = context.play
  const decisions = autoAdvanceDecisions({
    ...context,
    force: true,
    previousTargetOf: (index) => runners.find((runner) => runner.state.index === index)?.previousTarget ?? NONE,
  })
  for (const decision of decisions) {
    play = { ...play, wantsThrow: true }
    const runner = runners.find((candidate) => candidate.state.index === decision.runnerIndex)
    if (runner === undefined || decision.toBase === runner.state.targetBase) continue
    startLeg(runner, decision.toBase)
  }
  return play
}

/** 다음 구간 시작 — 출발점(+0x14)과 출발 루(+0x7c)를 새로 잡아야 진행률·협살 계산이 맞는다 */
function startLeg(runner: MutableRunner, toBase: number): void {
  // a07b0 vt48 — 새 목표가 지금 +0x7c 와 다르면 +0x84 = 옛 +0x7c
  if (runner.state.targetBase !== toBase) runner.previousTarget = runner.state.targetBase
  runner.state = {
    ...runner.state,
    legStart: runner.state.position,
    startBase: runner.state.targetBase,
    targetBase: toBase,
    settled: false,
  }
}

/**
 * 판이 닫힌 뒤의 루 — 원본은 판 끝에 주자를 따로 앉히지 않는다. 점수판(0x373d0 의 0x37664)·도루·다음 판 모두
 * "루 b 의 주자" `0xa97a0` = **아웃(+0x96)이 아니고 마지막으로 닿은 루 `+0x8c` == b** 인 주자로 루를 본다(직접 뜸).
 * 관문이 닫히면(52502 의 0xb0d28 거짓 → 529f0) 주자 틱이 더 안 돌고, 0x17 끝 0x35108 은 파울(7)일 때만 0xa975c 로 되돌리며,
 * 주자 목록 정리 0xa9c68(주자관리 vt, 표 0xd8328)도 아웃 아닌 주자를 `+0x90 = +0x8c` 로 당겨 담을 뿐 — 그래서
 * **가던 중인 주자는 떠난 루에 남는다**(다음 판 시작 0xa9e44 도 vt88(+0x8c)로 그 루에 다시 앉힌다).
 * 보통 판은 관문 0xb0d28 이 모두 닿을 때까지 기다려 +0x8c == +0x7c 라 같고, 다음 틱에 닫는 사건 11(b0db4 — 2스트라이크 번트 파울)에서
 * 갈린다(3아웃 b0dbe 도 곧바로 닫지만 이닝이 끝난다).
 */
function basesOf(runners: readonly MutableRunner[]): BaseState {
  let bases = EMPTY_BASES
  for (const runner of runners) {
    if (runner.state.isOut || runner.state.scored) continue
    const base = wrapBase(runner.state.startBase)
    if (base === 1) bases = { ...bases, first: true }
    if (base === 2) bases = { ...bases, second: true }
    if (base === 3) bases = { ...bases, third: true }
  }
  return bases
}

interface FielderMoveInput {
  readonly chaserSlot: number
  readonly tick: number
  readonly catchTick: number
  /** 다음 야수 틱의 이동 관문(`canStepNextListTick`) — 거짓이면 목표만 고르고 제자리 */
  readonly canStep: boolean
}

/**
 * 야수 한 틱 — AI 상태가 세운 목표점으로 걷는다.
 * - AI 6(들고 뛰기) · 9(미룬 송구, b30d0 vt48(루)) · 0xa(키스톤 자리) — 세워 둔 목표점으로
 * - AI 2~5(루 커버) — 그 루 좌표로 (b2564 가 커버 야수에게 vt14(루) · AI 루 + 2 를 준다 — `assignCoversForTick`)
 * - 쫓는 야수는 포구 전까지 포구 지점으로(AI 1 — 목표는 AI 고리 b4aca 가 고친다, r190)
 * - AI 0xf(시작 자리로) — AI 고리 b4c2a 가 고친 목표로. vt8c(5)의 +0xcc 가 이동 관문을 닫아 실제로는 제자리다(r190)
 * - AI 0 — 그 목표로 걷는다. 시작 자리 고치기(b476a: vtcc 면 목표점이 시작 자리 0xd86ec 와 다를 때 vt50 = vt14)는 AI 고리(1c 절)가
 *   한다 — 던진 뒤(b2e14 · b48ac)·커버를 내준 뒤(b1d38 · b2540)·커버를 빼앗긴 뒤(b2a7e) AI 0 이 된 야수가 다음 고리에서 돌아선다 (r180)
 */
function moveFielder(fielder: FielderState, input: FielderMoveInput): FielderState {
  // 협살(상태 8) 중인 야수는 분기표가 0xb48b6 으로 가므로 커버 이동을 하지 않는다 — 2b 절이 이미 옮겼다
  if (fielder.aiState === AI_STATE.RUNDOWN) return fielder
  const walk = (target: WorldPoint): FielderState =>
    isSamePoint(fielder.position, target) || !input.canStep
      ? { ...fielder, target }
      : { ...fielder, target, position: stepToward(fielder.position, target, fielder.speed) }
  if (
    fielder.aiState === AI_STATE.CARRY ||
    fielder.aiState === AI_STATE.RECEIVE ||
    // AI 0xd(다이빙) — 분기표 0xd8808[0xd] = b4c60 아무것도 안 함. 다이빙 검사(`diveCheckOf`)가 세운 공점(n)으로 걷는다
    fielder.aiState === AI_STATE.DIVE ||
    // AI 0xc(백업) — AI 고리 b4b78 이 고친 목표로
    fielder.aiState === AI_STATE.BACKUP ||
    // AI 0xf(시작 자리로) — AI 고리 b4c2a 가 고친 목표로. +0xcc(vt8c(5))가 서 있는 동안은 관문이 닫혀 제자리다
    fielder.aiState === AI_STATE.RETURN ||
    (fielder.aiState === AI_STATE.BUSY && fielder.slot !== input.chaserSlot)
  ) {
    return walk(fielder.target)
  }
  // AI 2~5(루 커버) — b4818~b482e 의 vt14(루 좌표)는 AI 고리(1c 절)가 관문(잠금 · vtc8)을 거쳐 적는다. 걸음 a1376 은 목표(+0x2c)로만 간다
  // (r201 — 예전 웹은 여기서 목표를 안 보고 루 좌표로 걸어 vt14 관문이 이 진행기에서는 안 걸렸다)
  if (isCoverState(fielder.aiState)) return walk(fielder.target)
  // AI 0xb(0xb4b5c) — 0xb3b38 담장 갈래가 세운 목표 +0x90(담장 앞)으로. **공을 쥐었어도 걷는다** (직접 뜬 것):
  // 분기 앞 b46c4~b46ec 은 상태 0 · 0xa · 0xd · 커버(2~5)만 다이빙 검사로 보내고 0xb 는 곧장 분기표 0xd8808[0xb] = b4b5c 로 간다.
  // b4b5c 는 +0x90 을 [sp+0x40] 에 베끼고 r4 = 야수 vt14 로 b482e 에 가며, b482e 는 조건 없이 vt14(야수, x, y, z) 를 부르고
  // b4c60(다음 야수)로 끝난다. vt14 = 0xa14c8 이 보는 것은 동작 잠금 +0xb4 ≤ 0 · vtc8(0xa2118 = +0xb1(던진 뒤 잠금) == 0 &&
  // +0xcc ≤ 0) · 목표가 바뀌었나(0xbc0f4)뿐 — 공 쥠 +0xe0 은 어디에도 없다(다른 AI 상태의 vt14 와 같은 관문이라 웹 `walk` 처럼 본다)
  if (fielder.aiState === AI_STATE.PICK_UP) return walk(fielder.target)
  // AI 1 b4aca · AI 0 b476a 는 vtcc(0xa2138 — 자세 워드 0 · +0xb4 ≤ 0 · +0xcc ≤ 0)가 거짓이면 목표를 안 고친다(b4ad6 · b477a → b4c60) —
  // 포구 동작 중(워드가 선) 야수는 앞서 세운 목표로 걷는다 (r171). 둘 다 AI 고리(1c 절)가 고친다(r180 · r190)
  if (fielder.slot === input.chaserSlot) {
    if (input.tick < input.catchTick) {
      // 목표는 AI 고리(1c 절)의 AI 1 b4aca 가 고쳤다(r190) — 걸음 a1376 은 그 목표로 간다
      return { ...walk(fielder.target), aiState: AI_STATE.CHASE }
    }
    // 쥔 AI 1 야수 — b4ae6(+0xe0)에서 목표를 안 고치고 끝나지만, 야수 틱의 걸음 a1376(0xbf094)은 AI · 공 쥠을 안 보고 목표로 간다(r176)
    if (fielder.aiState !== AI_STATE.IDLE && fielder.holdingBall) return walk(fielder.target)
    if (fielder.aiState !== AI_STATE.IDLE) return fielder
  }
  // AI 0 — 시작 자리 고치기(b476a)는 AI 고리(1c 절)가 한다. 걸음은 그 목표로
  if (fielder.aiState === AI_STATE.IDLE) return walk(fielder.target)
  return fielder
}

interface BallPointInput {
  readonly tick: number
  readonly trajectory: BattedBallTrajectory
  readonly catchTick: number
  readonly fielders: readonly FielderState[]
  /** 공 가진(마지막으로 쥔) 야수 P+0x130 */
  readonly holderSlot: number
  /** 지금 누가 쥐고 있나 P+0x12c */
  readonly held: boolean
  readonly throwBase: number
  readonly throwArrivalTick: number
  readonly throwFromSlot: number
  /** 공이 손을 떠난 틱 */
  readonly throwReleaseTick: number
  /** 이 송구를 받을 야수 — 중계 1구간이면 중계맨. 악송구면 −1 */
  readonly throwReceiverSlot: number
  /** 아무도 잡지 않는 타구인가 — 그러면 공은 끝까지 궤적 위에 있다 */
  readonly uncatchable: boolean
}

/** 이번 틱에 공이 어디 있나 — 포구 전에는 궤적, 송구 중에는 송구선 위, 그 밖에는 쥔 야수 손 */
function ballPointAt(input: BallPointInput): WorldPoint {
  if (input.uncatchable) return input.trajectory.pointAt(input.tick)
  if (input.tick < input.catchTick) return input.trajectory.pointAt(input.tick)
  const holder = input.fielders[input.holderSlot] ?? input.fielders[0]
  const flying =
    input.throwArrivalTick >= 0 &&
    input.throwBase !== NONE &&
    input.tick >= input.throwReleaseTick &&
    input.tick < input.throwArrivalTick
  if (!flying) {
    // 받은 야수가 없는 송구(악송구)는 루 자리에 떨어진 것으로 그린다 (근사)
    if (!input.held && input.throwArrivalTick >= 0 && input.throwBase !== NONE) return basePosition(input.throwBase)
    return holder.position
  }

  const from = input.fielders[input.throwFromSlot]?.position ?? holder.position
  // 공은 받을 야수의 목표점(+0x2c)으로 간다 (b2f52) — 중계 1구간이면 중계맨 자리, 악송구면 루 자리(근사)
  const to = input.fielders[input.throwReceiverSlot]?.target ?? basePosition(input.throwBase)
  const whole = input.throwArrivalTick - input.throwReleaseTick
  if (whole <= 0) return to
  const done = input.tick - input.throwReleaseTick
  return {
    x: from.x + Math.trunc(((to.x - from.x) * done) / whole),
    // 송구는 낮은 포물선으로 본다 (근사) — 화면이 공 크기를 고를 때만 쓴다
    y: Math.trunc((1200 * done * (whole - done)) / (whole * whole)),
    z: from.z + Math.trunc(((to.z - from.z) * done) / whole),
  }
}

/** CPU 홈 특수 송구가 0xa1620 에 무엇을 넘기는가 (`cpuSpecialThrowOf`) */
interface CpuSpecialThrow {
  /** 계획 [1] — 0xa1620 다섯째 인자. 거짓이면 특수 굴림이 아무 효과도 없다 */
  readonly special: true
  /** 거리 상한(20400)을 넘어 원바운드로 던진다 — 악송구 굴림을 건너뛴다 */
  readonly bounce: boolean
  /** 송구 속도 +0xdc 를 +0xd8(= +0xd4 × 130%)로 바꿔 끼운 던지는 야수 (`thrownWith`) */
  readonly thrower: FielderState
}

const NO_CPU_SPECIAL_THROW = { special: false, bounce: false } as const

/**
 * **CPU 홈 송구 20% 특수 송구의 효과** — `0xafa60` 이 굴린 특수 값이 어디까지 내려가는가 (직접 뜬 것).
 *
 * ```
 * afad2: b == 0 이면 r6 = (rand(0,100) ≤ 19)          ; 0xbfa54, 홈이 아니면 굴림 없음
 * afae6: 플레이.vt58(b, r6)                            ; = 0xb2c90
 * b2c9e: [sp+0x1c] = 특수
 * b2cc4: C = +0xf0[b] ; C == −1 → 공 가진 야수가 직접 들고 뛴다(특수 버려짐)
 * b2de8: 플레이.vt5c(C, [sp+0x1c])                      ; = 0xb2e38
 * b2e78: 플레이.vt8c(결과, 플레이, 던지는야수, C, 특수)   ; = 0xb3444 송구 계획 → +0x14c..+0x153
 * b3528: 외야수(칸>5) && 특수 → 중계 안 함
 * b368a: [1] = 외야수(+0x88 > 5) && 특수 && 송구틱(vtb8) > 0x11
 * b2f06: +0x1f4(사람 레이저) == 0 이면 던지는야수.vtac(받는야수 +0x2c 목표점, [+0x14d] = [1])  ; = 0xa1620
 * a165c: 특수 → 야수+0xe8 = 4
 * a16be: 특수 && 거리 > cfg(17000)×120/100 → 거리 = 상한, 원바운드 표시
 * a16dc: +0xdc(송구 속도) = 특수 ? +0xd8 : +0xd4      ; 0xa0fc4: +0xd8 = +0xd4 × 130 / 100
 * a17fc: 원바운드면 +0xc0 = 4, 각도 ±1 (0xbfaa0 = rand(0,2)) → **악송구 굴림 건너뜀**
 * a1828: 아니면 악송구 굴림 기준 = +0xe4 + 특수×100 + 100 (`rollThrowError`)
 * ```
 * 곧 **"레이저급 속도"는 맞다** — 다만 계획 [1] 을 거치므로 **외야수가, 중계 없이, 17틱 넘게 걸리는
 * 홈 송구**일 때만 효과가 난다. 내야수의 홈 송구는 20% 를 맞혀도 아무 차이가 없다(굴림만 먹는다).
 *
 * 원본은 0xb2c90 이 실패하면(직접 뛰는 게 빠름·거리 ≤ 600) 다음 틱에 `0xafa60` 이 다시 돌아 또 굴린다 —
 * 웹도 준비가 끝난 틱부터 4c 절이 매 틱 다시 고르므로 같다.
 * 원바운드 거리는 웹 관례대로 수평 거리로 잰다(원본 0xbf9f1 은 던지는 쪽 높이 1000 을 넣는다).
 */
export function cpuSpecialThrowOf(
  fielders: readonly FielderState[],
  throwerSlot: number,
  receiverSlot: number,
): CpuSpecialThrow | typeof NO_CPU_SPECIAL_THROW {
  if (receiverSlot === NONE) return NO_CPU_SPECIAL_THROW
  const plan = planThrow({ fielders, fromSlot: throwerSlot, finalSlot: receiverSlot, base: 0, special: true })
  if (!plan.special) return NO_CPU_SPECIAL_THROW
  const holder = fielders[throwerSlot]
  return {
    special: true,
    bounce: horizontalDistance(holder.position, fielders[receiverSlot].target) > BOUNCE_THROW_DISTANCE,
    thrower: thrownWith(holder, true),
  }
}

/** 0xa100c(야수, x, 0, z) — 추적야수 AI 1 의 목표는 포구 틱 공 점의 높이를 버린 땅 위 점이다 (b4b50~b4b5a) */
function groundPointOf(point: WorldPoint): WorldPoint {
  return { x: point.x, y: 0, z: point.z }
}
