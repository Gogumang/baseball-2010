import { ballParticleFactsOf } from '@/features/defense-play/model/ballParticleFacts'
import { judgeCallSoundIdOf } from '@/features/defense-play/model/judgeCall'
import type { RandomPort } from '@/shared/api/random/randomPort'
import {
  autoSlideRunnerIndexes,
  slideOnKey,
  SLIDING_SOUND_EFFECT,
  SLIDING_SPEED_BONUS,
  type SlidingRunner,
} from '@/entities/defense-controls/model/sliding'
import { applyBaserunningKey } from '@/entities/fielding/model/baserunningKey'
import { previousTargetAfterLead } from '@/entities/fielding/model/runnerLead'
import {
  autoAdvanceDecisions,
  clearsRequirement,
  requiredBasePinOf,
  requiredBasesOnBounce,
} from '@/entities/fielding/model/autoAdvance'
import { backupPointOf, CATCH_KIND, type BattedBallTrajectory } from '@/entities/fielding/model/catchPrediction'
import { rollFumble } from '@/entities/fielding/model/fieldingErrors'
import {
  basePosition,
  FIELDER_START_POSITIONS,
  horizontalDistance,
  isSamePoint,
  progressPercent,
  stepToward,
  ticksToReach,
  type WorldPoint,
} from '@/entities/fielding/model/fieldGeometry'
import {
  AI_STATE,
  fielderAbilityOf,
  recordPlayerAbilityOf,
  fielderArrivalTicks,
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
import { baseUnderFoot, judgeOut, OUT_KIND, releaseForcesAfterOut } from '@/entities/fielding/model/outJudgement'
import { baseAtPoint, claimCoverOfBase, needsCover, withCoverBaseTarget } from '@/entities/fielding/model/coverAssignment'
import { DIVE_TICK_NONE } from '@/features/defense-play/model/catchForecast'
import { diveCheckOf, logDiveCheck } from '@/features/defense-play/model/diveCheck'
import {
  acceptsTargetVt14,
  canStepNextListTick,
  fielderSlackAtPlayEnd,
  isFreeToRetarget,
  isFreeToStep,
  isReadyToThrow,
  listTickFielder,
  withCatchMotion,
  withFlyWaitPose,
  withPoseCleared,
  withThrowMotion,
} from '@/entities/fielding/model/fielderPose'
import {
  gateRunnerViewsOf,
  liveRunnerCountOf,
  passPlayGateBetweenTicks,
  someRunnerStillActive,
} from '@/entities/fielding/model/playGate'
import { LASER_THROW_SPEED, planThrow, readyTicksOf, thrownWith, throwTicksTo } from '@/entities/fielding/model/throwPlan'
import { chooseThrowTargetBase, isSpecialThrow } from '@/entities/fielding/model/throwTargetBase'
import { EMPTY_BASES, type BaseState } from '@/entities/game/model/baseState'
import type { ManualAutoMode } from '@/entities/settings/model/gameSettings'
import {
  holderMarkOf,
  viewStateOf,
  type ActionMemory,
  type DefensePlayView,
  type HolderPlate,
} from '@/features/defense-play/model/defensePlayView'
import {
  FUMBLE_MARK_TICKS,
  THROW_ERROR_MARK_TICKS,
  tickMarkCounter,
} from '@/features/defense-play/model/playerEffects'
import { drawDefenseScene, enterDefenseScene, fireLaser, playEndStateOf, type DefenseScene } from '@/features/defense-play/model/defenseScene'
import { canFireLaserNow, laserWindowTick, NO_LASER_FLAGS, type LaserFlags } from '@/features/defense-play/model/laserTick'
import { postJudgeMessage } from '@/features/defense-play/model/laserPresentation'
import type { DefenseKeyPress, DefensePlayControls, DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import { inPlayCommandOf } from '@/entities/defense-controls/model/defenseKeys'
import { cpuSpecialThrowOf, framePressesOf } from '@/features/defense-play/model/runDefensePlay'
import { runnerFateOf } from '@/features/defense-play/model/runnerFates'
import {
  bounceOffFielder,
  chaseLooseBall,
  initialLooseBallChase,
  type LooseBallChase as ChasedBall,
} from '@/features/defense-play/model/looseBallChase'
import { forecastOptionsOf, launchThrow } from '@/features/defense-play/model/throwLaunch'
import {
  CATCHER_BALL_POINT,
  PITCHER_BALL_POINT,
  runCoverTick,
  runnerPlayBallInput,
  type CurrentBallPath,
} from '@/features/defense-play/model/coverTick'

/**
 * **주자 판 진행기** — 타구가 없는 수비 판(플레이 종류 5 도루 · 9 폭투·포일)을 틱 단위로 돈다.
 *
 * 견제(`pickoffPlay`)와 같은 까닭으로 타구 진행기 `runDefensePlay` 와 따로 둔다 — 그쪽은
 * "목록 0번 = 결과 코드가 운명을 정한 타자주자" 를 전제로 짜여 있다. 이 판에는 결과 코드가 없고,
 * 모든 주자의 운명을 원본 판정(0xb36d0 · 0xb4292)이 정한다.
 *
 * ## 한 틱의 차례 (원본 장면 갱신 0x52c50 = 공용 갱신 0x3f060(야수·주자 틱) → 슬롯 2 0x524c0 → 그리기 0x46c88)
 * 웹 판 틱 N = 그림 N 의 슬롯 2(0~4c 절) · 그림 N 그리기(5 · 5b 절) · 그림 N+1 의 목록 틱(6 절 이동)이다(`playGate` 머리글).
 * 0. 야수 틱 0xa1284 — 공 쥔 야수의 준비 틱 +0xc8 −= 1
 * 1. 포구 틱 갈래 0xb401c(플레이 vt48) — 쫓는 공(종류 9 의 폭투 · 포일 공 · 송구공 · 튕긴 공)을 고른 야수가 포구 틱에: 펌블 굴림 b4224
 *    (늘 먹는다) → 움직이는 공이면 펌블(0xbc2 · 틱 끝 0xb3148 튕김) / 아니면 b4292 결과 9 검사 · 쥐기 0xb2710(P, f, 1) · vt90
 * 2. 같은 플레이 틱의 꼬리 — 아웃 판정 b43da → 낙구 틱 포스 요구 루 0xa95e8(b444e~b453c) → 결과 메시지 0xbba(b4562 — 13 이면
 *    0x51d40~0x51db4 가 사람 수비에서도 CPU 송구 결정 한 번) → 튕김 0xb3148(b45a0) → 득점 0xaa0a8 · 보류 풀기 0xaa34c(525fc)
 * 3a. 중계 이어 던지기 — 플레이 vt4c 0xb45dc 머리 b4616: 계획 +0x14c 가 중계고 중계맨이 쥐었으면 최종 받는 야수에게 0xb2e38
 * 3b. 사람 목표 +0x160 — 플레이 vt4c 0xb45dc(52612)의 b4660~b46a8: 쥠 && 준비면 루로 보내기 `0xb2c90`, 그리고 −1 · 3c. AI 9
 * 3d. vt4c 끝 b4c72 — 플레이 vt30 = 0xb1c90: 커버(+0xf0) 다시 고르기 · 키스톤 자리 0xb203a (`coverTick.runCoverTick`, r162).
 *    송구 0xb2e38 꼬리 b3094 도 같은 것을 한 번 부른다(`sendToBase`)
 * 4. 자동 추가 진루 0xaf918 (`0xae690` 갈림, 진루시키면 +0x128 = 1) · 자동 슬라이딩 0xb030c
 * 4c. CPU 송구 결정 `0xafa60 → 0xafb24` — `0xae6c8`(수비 CPU || 송구 자동)일 때 매 틱, +0x128 && 준비일 때만 고르고
 *    0xb2c90 이 성공하면 +0x128 = 0. 받은 야수도 준비 틱이 지나면 이어 던진다.
 *    사람 수비·수동 송구에서 키가 없으면 **던지지 않는다** — 0xb1c90 의 자동 가지에는 송구 호출이 없다.
 * 5. 그림 · 5b. 연출 0x46c88 · 6. 움직이기(다음 그림 목록 틱 — 주자 +0x3b) · 9. 판 진행 관문 0xb0d28
 *
 * ## 송구 — 타구 진행기와 같은 원본 길
 * 0xb2e38 → 0xa1620(악송구 · 긴 송구 흔들림 · 원바운드 갈래) · 세계 0xbfed0 · 받는 점 끼워 넣기 b2f9c(`launchThrow`) →
 * 예보 vt24(0) · 고르기 vt34(`chaseLooseBall`) — 받는 것도 줍는 것도 1 절 포구 틱 갈래다.
 *
 * ## 근사 (지어내지 않은 자리 — 견제 진행기와 같다)
 * - 움직이기(6 절)는 다음 그림의 목록 틱(0x3f060)이라 슬롯 2 뒤에 둔다. 아웃 판정 · 득점은 원본처럼 슬롯 2(이동 앞)다.
 *   쥐기 0xb2710 은 야수를 옮기지 않는다(r176 — 예전 웹은 포구 지점으로 옮겨 쥐었다). 받는 포구 · 줍는 포구도 b4134 의 포구 동작 ·
 *   자세 워드(`fielderPose`)를 건다. ⚠️ AI 고리(b46ae~)는 AI 0 의 시작 자리 되돌리기 · AI 2~5 의 b4814 · AI 9 만 옮겼다.
 * - 중계 이어 던지기 b4616 (3a 절, r214): 0xb2e38 이 적은 송구 계획 +0x14c 가 중계면 중계맨이 쥔 뒤 준비 틱이 지난 틱에 최종 받는
 *   야수에게 던진다. CPU 송구 결정 0xafa60 은 성공하면 계획을 지우므로(afb08 0xb0ea0) CPU 가 정한 송구는 중계맨이 받아도 이 길이
 *   아니라 쥐기의 +0x128 로 CPU 송구 결정이 다시 고른다 — 사람 목표 · 미룬 송구(AI 9)의 0xb2c90 이 낸 중계만 잇는다.
 * - 자동 추가 진루는 결과 코드가 선 뒤에도 판이 닫힐 때까지 매 틱 묻는다 — +0x111 은 "끝" 이 아니라 홈런 코드 8 이다
 *   (`playGate`). 판은 0xb0d28 대로 주자가 다 서고 공을 쥔 채 관문을 51 번 지나면(그림마다 3 번 — 17틱) 닫힌다.
 * - 레이저 송구(0x523bc 굴림 · 0x4e858 반짝임 · 0x400bc 발사 · 경기 멈춤 +0x1993 · b2f06 레이저 송구)는 타구 진행기와 같은
 *   구조로 옮겼다(`laserTick`, r201). 굴림은 공 가진 야수가 외야수일 때만(523e6) 돌아 이 판에서는 송구 · 튕긴 공을 외야수가 쫓을 때만 선다.
 *   ⚠️ 공 가진 야수가 없는 밀어내기 판(+0x130 = −1)의 굴림은 미해결이라 안 굴린다(`laserTick` 주석).
 *
 * ## 사람 공격 키 (2026-10-16 직접 뜸 — `entities/fielding/model/baserunningKey`)
 * 상태 0x17 키 0x53420 은 조작 [+0xc] == 0(사람 공격)이면 판 종류를 안 보고 주루 0x5331c(0x582 진루 · 0x584 귀루) 뒤 OK → 0x585
 * (슬라이딩)를 보낸다. 0x582 · 0x584 → 0x5209e · 0x5222a → 0xa9b04 는 판 종류 {1, 4, 5, 9}(0xae794)에서만 주자를 움직여 도루 ·
 * 폭투 판은 받고 밀어내기(종류 2)는 안 받는다. 성공하면 플레이+0x128 = 1(CPU 송구 결정을 다시 부른다). 슬라이딩 0x518da 는 종류 2 · 3 만
 * 막는다(`slideOnKey`). 굴림 없음.
 */

/** 진행기가 이 틱을 넘기면 끊는다 — 우리 쪽 안전망 (타구 진행기 240 과 같다) */
const DEFAULT_MAXIMUM_TICKS = 240
/** 능력치를 안 주면 쓰는 값 — 원본 평균대(등급 3) */
const DEFAULT_ABILITY = 500
const HOME_BASE = 4
/** 0xb2c90: 받는 야수까지 이 거리 이하면 던지지 않는다 */
const MINIMUM_THROW_DISTANCE = 600

/** 결과 코드 — 9 세이프(0xb4292) · 13 아웃(0xb4556) */
export const RUNNER_PLAY_RESULT = { SAFE: 9, OUT: 13 } as const
/** 송구를 고른 쪽 — 사람 키(참) · CPU 결정(거짓) · AI 9 미룬 송구 · 중계 이어 던지기(b4616) */
type ThrowChooser = boolean | '미룬' | '중계'

export type RunnerPlayResultCode = (typeof RUNNER_PLAY_RESULT)[keyof typeof RUNNER_PLAY_RESULT]

/** (종류 9) 공을 쫓아 줍는 갈래 */
export interface LooseBallChase {
  readonly trajectory: BattedBallTrajectory
  /** 쫓는 야수 (+0x170) */
  readonly slot: number
  /** 포구 틱 (+0x174) */
  readonly catchTick: number
  /** 예보의 다이빙 후보 틱 +0x178[칸] (`catchForecast.diveTicks`) — 다이빙 검사 b46e2 가 본다 */
  readonly diveTicks?: readonly number[]
  /** 고르기가 적은 +0x174 그대로(판 끝으로 자르기 전) */
  readonly forecastCatchTick?: number
}

export interface RunnerPlayEngineInput {
  readonly kind: number
  /** 시작 야수 — 목표·커버가 이미 세워진 것 */
  readonly fielders: readonly FielderState[]
  /** 시작 플레이 칸 — 커버(+0xf0)·공 쥔 야수(+0x130)·쥠(+0x12c)·+0x112 */
  readonly play: PlayView
  /** 시작 주자 — 원본 목록 순서 */
  readonly runners: readonly RunnerState[]
  readonly abilities: readonly number[]
  readonly outs: number
  /** state[0x1e] 시작 값 — 공이 땅에 닿았거나 잡혔음 */
  readonly ballOnGround: boolean
  /** 플레이 +0x126 — 판 시작 vt20(b11fe)이 1 로 세우고 판 시작 0xb1c90 의 0xb203a 가 중계 자리를 잡으면 0. 안 주면 1 */
  readonly relayFlag?: boolean
  /** 없으면 처음부터 `play.ballHolderSlot` 이 쥐고 있다 */
  readonly chase?: LooseBallChase
  /**
   * 아무도 손에 안 쥔 채 땅에 놓인 공의 자리 — 종류 2(밀어내기)는 0xa276c 가 공 첫 점을 0xd7c24(투수판)에 두고 쥐기를 안 부른다.
   * 없으면 공은 공 가진 야수(+0x130) 자리에 그린다.
   */
  readonly restingBall?: WorldPoint
  readonly random?: RandomPort
  readonly defenseIsCpu?: boolean
  readonly throwMode?: ManualAutoMode
  /** 수비 9명의 스킬 번호 (칸 순서) — 레이저 굴림 0x66a8c 의 초감각(21) +3%p (`DefensePlayInput.fielderSkillIds`). 안 주면 없음 */
  readonly fielderSkillIds?: readonly (readonly number[])[]
  /**
   * 판이 열릴 때의 사람 송구 목표 루 (플레이+0x160, 시험용). 안 주면 −1 — 0x17 진입 0x46418 의 판 시작 vt18 0xb27ec 가
   * 종류 2·3(0xb288c) · 5(0xb2950) · 9(0xb284a) 모두 vt1c 0xb0edc 를 먼저 부르고 그 b0f66~b0f68 이 +0x160 = −1 을 적으므로
   * 앞 판의 키는 넘어오지 않는다. 그 키로 한 번 던지면 −1 로 지운다(b46a8).
   */
  readonly manualThrowBase?: number
  /**
   * 사람 조작 — 이 판 동안 틱마다 눌린 키(`runDefensePlay` 와 같은 꼴). 상태 0x17 키 0x53420 은 판 종류를 안 가린다 —
   * 사람이 수비면 0x533c8 이 메시지 0x588(목표 루) → 0x51890 → 플레이 vt60 → +0x160. 안 주면 키가 없다.
   * 사람이 공격(`side: '공격'`)이면 같은 키가 주루 0x5331c(0x582 진루 · 0x584 귀루) · OK 슬라이딩 0x585 다.
   */
  readonly controls?: DefensePlayControls
  readonly offenseIsCpu?: boolean
  readonly runningMode?: ManualAutoMode
  readonly maximumTicks?: number
  readonly aceIndexes?: readonly (number | null | undefined)[]
  readonly defenseTeamIndex?: number
  readonly offenseTeamIndex?: number
  /** 앞 판에서 넘어온 수비 장면 연출 칸 (`DefensePlayInput.scene`) — 이 판들(밀어내기 · 도루 · 폭투)은 투구 뒤라 +0x1997 · 애니가 되감겨 있다 */
  readonly scene?: DefenseScene
  /** 수비 칸별 이름 판 선수 (0x43cb0 — `DefensePlayInput.fielderPlates`). 안 주면 고리만 그린다 */
  readonly fielderPlates?: readonly (HolderPlate | null | undefined)[]
  /** 주자 칸(`RunnerState.index`) → 마선수 번호 (`runnerAces.runnerAceIndexesOf`). 안 주면 아무도 마선수가 아니다 */
  readonly runnerAceIndexes?: readonly (number | null)[]
  /** 타석 교대 0x483a0 이 실은 주자 마선수 그림 번호 (`runnerAces.loadedRunnerAceOf`) */
  readonly runnerAceSprite?: number | null
  /**
   * 경기 +0xfd4 — 이 판이 열릴 때 남아 있던 스윙 판정 결과 코드(`sceneResultCode`). 튐 파티클(0x37022 ∉ {9,10,11}) ·
   * 홈런성(0x357e0, 24~26)이 본다. 모르면(헛스윙의 정해지지 않은 값 · 안 줌) null — 두 조건 모두 거르지 않는다
   */
  readonly sceneResultCode?: number | null
  /**
   * 판이 열릴 때의 야수 +0xb8(펌블 표시, 칸별). 폭투 · 포일 판정 0x3e062(0x3e08c~0x3e092)가 **포수 +0xb8 = 6** 을 적고
   * 0x17 로 간다 — 첫 그림 앞 야수 틱(a12da)이 하나 줄여 첫 그림은 5 다(`passedBallPlay`). 안 주면 0
   */
  readonly fumbleMarks?: readonly number[]
  /**
   * **판을 안 열고 CPU 송구 결정 0xafa60 한 번만** — 도루 키 0x583 의 52222(`stealPlay.stealStartThrowDecision`). 판 시작 자동 진루
   * 0x46766 도 틱도 없이, 앞 판이 끝난 그대로의 플레이 · 야수(`fielders` · `play`)로 0xafa60 → 0xb2c90 → 0xb2e38 을 돌리고 끝낸다.
   * 결과의 `scene.playEnd` 가 그 뒤 상태다(+0x128 · 쥠 · 던진 야수)
   */
  readonly throwDecisionOnly?: boolean
}

export interface RunnerPlayEngineResult extends DefensePlayResult {
  readonly kind: number
  /** 9 세이프 · 13 아웃 · null(결과 코드 없이 끝남 — 송구가 없었거나 악송구) */
  readonly resultCode: RunnerPlayResultCode | null
}

interface PlayRunner {
  state: RunnerState
  counted: boolean
  /** 주자 +0x3b — 마지막 목록 틱(6 절 이동)에서 목표 루에 막 닿았다. 득점 0xaa0a8(aa12a)이 본다 */
  arrivedThisListTick: boolean
  /**
   * 주자 +0x84 — 직전 목표 루. vt88(0xa0820, 루에 세우기)과 도착 0xa040c 가 +0x8c 로, vt48(0xa07b0)이 목표가 바뀔 때 옛 +0x7c 로 적는다.
   * 사람 진루 키의 앞길 검사(0xa9924 → 방향 판정 0x9fe80)가 본다
   */
  previousTarget: number
}

/** 날아가는 송구 — 던진 야수 · 목표 루 · 손을 떠난 틱 (받는 틱 · 받는 야수는 쫓는 공 `LooseBallChase`) */
interface ThrowInFlight {
  readonly from: number
  readonly base: number
  readonly releaseTick: number
}

/**
 * 판을 한 틱씩 돌리는 손잡이 — 화면이 실시간으로 키를 넣을 때 쓴다(`DefensePlayback` 의 주자 판 갈래).
 * `step(키)` 한 번 = 그 틱 하나(키는 그 틱 머리에 먹인다). 다 돌면 `result()`.
 */
export interface RunnerPlayStepper {
  /** 다음에 돌 틱 */
  readonly tick: number
  readonly finished: boolean
  /** 지금까지 그린 그림 */
  readonly ticks: readonly DefensePlayView[]
  /**
   * 방금 돈 틱에서 슬라이딩 효과음 10 을 낸다 — 사람 슬라이딩 키 0x518da 의 0x5199c(+0x31c 잠금으로 한 판 한 번) · 자동 슬라이딩
   * 0x5268c(잠금 없음). 진행기는 소리를 못 내므로 화면이 이 칸을 보고 그 틱에 낸다(`runDefensePlay` 의 같은 칸)
   */
  readonly slidingSoundThisTick: boolean
  /**
   * 방금 돈 틱에 낸 소리 — 낸 차례대로. 사람 슬라이딩 키(틱 머리) → 결과 메시지 0xbba 의 판정 콜(플레이 틱 b4562 →
   * 0xbfbac → 0xbfb78 이 받는 곳 vt+0xc 를 곧바로 부른다 → 0x51a56 → 표 0xd0488: 9 → 0x51c14(17) · 13 → 0x51b36(62/20)) →
   * 자동 슬라이딩 0x5268c(슬롯 2 의 vt48 플레이 틱 0x525e8 뒤). 화면은 이것을 그 틱에 차례로 낸다 (`runnerPlayCallSoundIdOf`)
   */
  readonly soundsThisTick: readonly number[]
  step(press: DefenseKeyPress | null): void
  result(): RunnerPlayEngineResult
}

/** 진행기가 틱마다 적는 소리 칸 — 슬라이딩 10 이 났나 · 그 틱에 낸 소리(차례대로) */
export interface RunnerPlayTickSound {
  slidingThisTick: boolean
  thisTick: number[]
}

/**
 * **판 안의 판정 콜** — 플레이 틱 꼬리 b4562 가 결과 코드(포구 b4292 의 9 · b4540 의 13)를 메시지 0xbba 로 보내면
 * (0xbfbac → 0xbfb78 이 받는 곳의 vt+0xc 를 곧바로 부른다 — 큐가 아니다) 0x51a56 이 판정 스위치 0xd0488 로 가른다
 * (`judgeCall.judgeCallSoundIdOf` — 타구 판과 같은 길):
 * - 9 → 0x51c14: 플레이 +0x118(종류)이 4 · 5 면 다른 검사 없이 17(51c1e~51c24 → 51c38). 그 밖(종류 9)은 소리 객체
 *   `[[0x1400058]+5]`(PHONEMODEL 조회가 되면 0x6e852 가 늘 1 로 쓰는 기기 예외 바이트)가 서 있으면 17, 아니면 `+0x14`(물린 소리 파일
 *   버퍼)가 0 일 때만 17 — 실기에서는 +5 가 1 이라 종류 9 도 늘 17 이다(`judgeCall.SAFE_CALL_SOUND` 주석).
 * - 13 → 0x51b36: state[0x1f](바운드 없이 잡은 아웃) 또는 state[0x87](그 아웃을 낸 판정이 태그)이면 62, 아니면 20.
 *   주자 판에는 타구가 없어 state[0x1f] 는 안 선다 — 그 틱의 태그 칸(`tagOut`)만 본다.
 * 소리는 play 0x6ea6c(…, −1, 0) — 51b18 → 51c54. 판 결과 칸은 첫 번째만 적지만 메시지는 그 틱마다 가므로 콜도 그 틱마다 난다.
 */
export function runnerPlayCallSoundIdOf(messageCode: number, tagOut: boolean): number | null {
  return judgeCallSoundIdOf(messageCode, { caughtOnTheFly: false, tagOut })
}

export function startRunnerPlay(input: RunnerPlayEngineInput): RunnerPlayStepper {
  const ticks: DefensePlayView[] = []
  const sound: RunnerPlayTickSound = { slidingThisTick: false, thisTick: [] }
  const steps = runnerPlaySteps(input, ticks, sound)
  let current = steps.next(null)
  return {
    get slidingSoundThisTick() {
      return sound.slidingThisTick
    },
    get soundsThisTick() {
      return sound.thisTick
    },
    get tick() {
      return current.done === true ? ticks.length : current.value
    },
    get finished() {
      return current.done === true
    },
    ticks,
    step(press) {
      if (current.done === true) return
      current = steps.next(press)
    },
    result() {
      if (current.done !== true) throw new Error('주자 판이 아직 안 끝났다')
      return current.value
    },
  }
}

/** 판 하나를 끝까지 돌린다 — 키는 `controls.keyAt(틱)` 으로 묻는다 */
export function runRunnerPlay(input: RunnerPlayEngineInput): RunnerPlayEngineResult {
  const stepper = startRunnerPlay(input)
  while (!stepper.finished) stepper.step(input.controls?.keyAt(stepper.tick) ?? null)
  return stepper.result()
}

/** 슬롯 2 의 0x52602 — [sp+0x14] = 0xae61c(판 종류 ∉ 마스크 0x58c = 2 · 3 · 7 · 8 · 10)가 참일 때만 플레이 vt4c 0xb45dc 를 부른다 */
const VT4C_BLOCKED_PLAY_KINDS: readonly number[] = [2, 3, 7, 8, 10]

function* runnerPlaySteps(
  input: RunnerPlayEngineInput,
  ticks: DefensePlayView[],
  sound: RunnerPlayTickSound = { slidingThisTick: false, thisTick: [] },
): Generator<number, RunnerPlayEngineResult, DefenseKeyPress | null> {
  const abilities = input.abilities
  const maximumTicks = input.maximumTicks ?? DEFAULT_MAXIMUM_TICKS
  const autoBaserunningEnabled = input.offenseIsCpu === true || (input.runningMode ?? '자동') !== '수동'
  const cpuThrowEnabled = input.defenseIsCpu === true || (input.throwMode ?? '수동') !== '수동'
  /** 플레이+0x160 — 사람이 고른 송구 목표 (키 메시지 0x588 이 쓰고 b46a8 이 −1) */
  let manualThrowBase = input.manualThrowBase ?? NONE
  /** 플레이 vt4c 0xb45dc(사람 목표 b4660 · AI 9 b4838)가 도는 판인가 */
  const vt4cRuns = !VT4C_BLOCKED_PLAY_KINDS.includes(input.kind)
  const log: string[] = []
  const previousActions: ActionMemory = new Map<string, { action: number; since: number }>()

  let fielders = input.fielders
  let play: PlayView = { ...input.play, manualThrowBase }
  // +0x84 — 판을 연 0x3d7b8 의 vt48 두 번 뒤 값(`previousTargetAfterLead`)
  const runners: PlayRunner[] = input.runners.map((state) => ({
    state,
    counted: false,
    arrivedThisListTick: false,
    previousTarget: previousTargetAfterLead(state),
  }))
  /** 주자관리+0x31c — 사람 슬라이딩 키의 효과음 잠금(한 판 한 번). 0x17 진입 0xa9fd0 이 지운다 */
  let slidingSoundPlayed = false
  let outs = input.outs
  let outsAdded = 0
  let held: HeldRunState = EMPTY_HELD_RUNS
  let ballOnGround = input.ballOnGround
  let tagOut = false
  let resultCode: RunnerPlayResultCode | null = null
  /** 쫓는 공 — 종류 9 의 폭투 · 포일 공(0xb284a), 송구공(b307c), 튕긴 공(0xb3148). 쥐면 null */
  let chase: ChasedBall | null =
    input.chase === undefined
      ? null
      : initialLooseBallChase(input.chase.trajectory, input.chase.slot, input.chase.catchTick, input.chase)
  /**
   * 다이빙 검사(`diveCheck`, r180)가 보는 지금 공 — +0x178 · +0x174 · 공+0x68 의 0 틱 · 쥔 틱(쥔 동안 0x3f378 이 공+0x68 을 안 올린다).
   * 첫 점이 표준 배팅 지점인 폭투 · 포일 공(0xb284a)만 후보가 있다 — 송구 · 튕긴 공은 새 예보가 모두 1000 으로 채운다
   */
  let diveBall = {
    ticks: chase?.diveTicks ?? [],
    catchTick: chase?.forecastCatchTick ?? chase?.catchTick ?? 0,
    launchTick: chase?.startTick ?? 0,
    trajectory: chase?.trajectory ?? null,
    heldAt: -1,
  }
  /** 처음 공을 쥔 틱 (종류 9) */
  let firstCatchTick = -1
  let fumbled = false
  let errantThrow = false
  let firstThrowBase = NONE
  let firstThrowArrival = -1
  /** 지금 날아가는 송구 — 자동 슬라이딩 · 그림이 본다 */
  // (닫힘 안에서 바뀌어 흐름 좁히기가 못 따라간다 — 넓은 꼴로 둔다)
  let flight = null as ThrowInFlight | null
  /** 야수 +0x3b — 마지막 목록 틱(6 절 이동)에서 목표점에 막 닿았다 (0xbf0dc). AI 2~5 b47f2 가 본다 */
  let fielderArrivals: boolean[] = fielders.map(() => false)
  /** 공 객체 칸 — 다음 쏘기가 이어 받는다 */
  let ballBody = chase?.body
  /** 지금 공 궤적(공.vt68(0) · 공.vt60 이 읽는 점들) — 폭투 공 · 송구 · 튕김이 새로 깐다. 없으면 0xa276c 의 점 하나 */
  let ballPath: CurrentBallPath | null = chase === null ? null : { trajectory: chase.trajectory, startTick: chase.startTick }
  /** 0xa276c — 종류 5 는 포수 자리 0xd7c30, 그 밖은 투수판 0xd7c24 (밀어내기 종류 2 는 `restingBall` 로 받는다) */
  const placedBallPoint = input.restingBall ?? (input.kind === 5 ? CATCHER_BALL_POINT : PITCHER_BALL_POINT)
  /** 플레이 +0x126 — 판 시작 vt20(b11fe)이 1. 0xb203a 가 중계 자리를 잡으면 0 */
  let relayFlag = input.relayFlag ?? true
  /** sp+0x24 — 이번 틱 포구 틱의 사건(펌블 0xbc2). 서면 틱 끝 b45a4 가 0xb3148 */
  let ballEventThisTick = false
  /** 이번 틱에 0xb36d0 이 아웃을 냈나 — 결과 코드 13 → 메시지 0xbba */
  let outJudgedThisTick = false
  /** 이번 틱 플레이 틱이 보낼 결과 메시지 0xbba 의 코드 — 포구 b4292 의 9 를 b4540 의 13 이 덮는다(b4562 에서 한 번) */
  let tickMessageCode = 0
  /** 수비 장면 연출 칸 — 0x17 진입 0x46418 이 결과 판 타이머를 −1 로 (`defenseScene`) */
  let scene = enterDefenseScene(input.scene, true)
  /** state[0x8b] — 결과 판 큰 OUT 이 +0x1999 를 보고 세운다 */
  let laserOutFlag = false
  /** 경기+0x19ad · +0x19ae · +0x19af — 레이저 반짝임 · 확정 · 굴림 마침 (`laserTick`, r201) */
  let laserFlags: LaserFlags = NO_LASER_FLAGS
  /** 플레이+0x1f4 — 레이저 발사 0x400bc 가 세우고 다음 송구 b2f06 이 레이저(vtb0 0xa222c)로 던진 뒤 내린다 */
  let laserArmed = false
  /** 레이저로 던졌다 (판 결과 `laserThrow`) */
  let laserThrow = false
  /** **그림 전용** 장면 +0x1991 — 레이저 잔상. 0x400bc 가 세우고 5254c 가 포구 관문(동작 시작 틱 − 1)에서 내린다 */
  let laserTrailOn = false
  /** 장면 +0x1993 — 경기 멈춤. 0x400bc 가 세우고 연출 0x4403c 단계 1 이 내린다 */
  let gamePaused = false
  /** 앞 틱 끝 G2 앞의 +0x120 — 이 틱 머리에서 멈추면 G2 를 안 부른 것으로 되돌린다 */
  let counterBeforeHead = 0
  /** 플레이 +0x120 — 판 진행 관문 0xb0d28 의 판 끝 세기 */
  let endCounter = 0
  /** 판을 닫은 관문 다음 그림의 G1 이 열렸나 (`fielderSlackAtPlayEnd`) */
  let closingListTickOpen = false
  /** +0x15c · +0x158 — 0xb2e38 이 미룬 송구(AI 9)의 받을 야수 · 목표 루 */
  let deferredThrowReceiver = NONE
  let deferredThrowBase = NONE
  /**
   * 송구 계획 +0x14c [4](+0x150) — 계획이 중계([0] = 1)면 최종 받는 야수, 아니면 −1 · [7](+0x153) 그 목표 루. 0xb2e38 이 덮어쓰고
   * 0xb0ea0 이 지운다(판 시작 vt1c b0f48 · CPU 송구 결정 0xafa60 성공 뒤 afb08). 중계맨이 쥐면 플레이 틱 b4616 이 [4] 에게 던진다
   */
  let relayFinalSlot = NONE
  let relayBase = NONE
  /**
   * **그림 전용** 경기+0x19ac — 쥐기 0xb2710 의 메시지 0x15(0x51872)가 세우고 0x17 진입 0x467de 가 내린다. 도루 판의 포수 ·
   * 판 시작 쥐기(b29d4 의 0xb2710)는 0x17 진입 0x46418 안에서 0x467de 보다 앞이라 지워진다 — 판 동안 새로 쥘 때 선다
   */
  let grabbed = false
  /** **그림 전용** 야수 +0xb8(펌블 표시) · +0xc0(송구 실수 표시) — `runDefensePlay` 와 같은 칸 */
  let fumbleMarks: number[] = Array.from({ length: fielders.length }, (_, slot) => input.fumbleMarks?.[slot] ?? 0)
  let throwErrorMarks: number[] = Array.from({ length: fielders.length }, () => 0)
  const markSlot = (marks: number[], slot: number, value: number) =>
    marks.map((current, index) => (index === slot ? value : current))

  const runnerStates = () => runners.map((runner) => runner.state)
  /**
   * 공 쥔 야수 vtC4 = 0xa20ec — 자세 워드(+0xb0~+0xb3) 0 · 잠금 +0xb4 ≤ 0 · +0xc8(준비 틱) ≤ 0. 준비 틱은 쥐기 0xb2710(P, f, 1)이 넣고
   * 야수 틱 0xa1284 가 줄인다. 받는 포구의 자세 워드도 여기서 막는다(r176 — 타구 진행기와 같은 `fielderPose`)
   */
  const isHolderReady = (): boolean => {
    const holder = fielders[play.ballHolderSlot]
    return play.held && holder !== undefined && holder.holdingBall && isReadyToThrow(holder)
  }
  const batterRunnerOf = () => (runners[0]?.state.isBatterRunner === true ? runners[0].state : undefined)
  const contextAt = (tick: number): DefenseContext => ({
    play,
    fielders,
    runners: runnerStates(),
    currentTick: tick,
    landingTick: input.chase?.trajectory.landingTick ?? 0,
  })
  /** 플레이 vt30 = 0xb1c90 한 번 (`coverTick.runCoverTick`) — vt4c 끝 b4c72(매 틱) · 송구 꼬리 b3094 */
  const coverTick = (tick: number): void => {
    const covered = runCoverTick({
      context: contextAt(tick),
      ...runnerPlayBallInput(ballPath, placedBallPoint, tick),
      relayFlag,
    })
    play = covered.play
    fielders = covered.fielders
    relayFlag = covered.relayFlag
  }

  /** 0xb36d0 한 번 — 원본처럼 모든 주자를 본다(타자주자 제외 없음) */
  /** 바로 앞 0xb36d0 한 번의 결과 — 같은 플레이 틱의 두 번째 판정이 state[0x87] 을 다시 적는다(타구 진행기 `grabOutThisTick`) */
  let lastJudgedKind: number = OUT_KIND.NONE
  const runOutJudgement = (tick: number): void => {
    if (play.finished) return
    const judged = judgeOut(contextAt(tick))
    lastJudgedKind = judged.kind
    if (judged.kind === OUT_KIND.NONE) return
    const victim = runners[judged.runnerIndex]
    if (victim === undefined || victim.state.isOut) return
    victim.state = { ...victim.state, isOut: true, settled: true }
    outs += 1
    outsAdded += 1
    outJudgedThisTick = true
    // state[0x87] — 마지막 판정이 태그였나 (0xb36d0 꼬리)
    tagOut = judged.kind === OUT_KIND.TAG
    resultCode = RUNNER_PLAY_RESULT.OUT
    log.push(`${tick}틱 ${victim.state.index}번 주자 아웃 (0xb36d0 결과 ${judged.kind})`)
    const relaxed = releaseForcesAfterOut(runnerStates())
    runners.forEach((runner, index) => {
      runner.state = relaxed[index] ?? runner.state
    })
  }

  /** 공 쥐기 0xb2710 — 쥔 야수 +0xe0 = 1, P+0x130 = 야수, +0x12c = 1, state[0x1e] = 1, 그리고 vt90(0xb36d0) */
  const grab = (tick: number, slot: number, extra: Partial<FielderState> = {}): void => {
    fielders = fielders.map((fielder) =>
      fielder.slot === slot
        ? { ...fielder, ...extra, holdingBall: true }
        : fielder.holdingBall
          ? { ...fielder, holdingBall: false }
          : fielder,
    )
    // 0xb2710: +0x128 = 1 · +0x130 = f · +0x12c = 1 · +0x112 = 1 · state[0x1e] = 1 · 메시지 0x15 → 경기+0x19ac = 1
    play = { ...play, ballHolderSlot: slot, held: true, everHeld: true, wantsThrow: true }
    grabbed = true
    ballOnGround = true
    runOutJudgement(tick)
  }

  /**
   * 루로 보내기 0xb2c90(P, 루, 특수) — 성공(1)이면 참 (`runDefensePlay` 의 `sendToBase` 와 같은 갈래).
   * 커버 없음 → 공 가진 야수가 들고 뛴다(0) · 커버 목표 루 ≠ 루(0) · 직접 밟는 게 빠름(1) · 600 이하 · 자기 자신(0) ·
   * 그 밖에는 송구 0xb2e38 → 0xa1620(악송구 굴림 0xa1828)(1).
   */
  const sendToBase = (tick: number, base: number, byHuman: ThrowChooser, cpuSpecial: boolean): boolean => {
    const holderSlot = play.ballHolderSlot
    const holder = fielders[holderSlot]
    if (holder === undefined) return false
    const coverSlot = play.coverOfBase[wrapBase(base)] ?? NONE
    const basePoint = basePosition(base)
    if (coverSlot === NONE) {
      // 커버가 없으면 공 가진 야수가 직접 들고 뛴다 (b2cc4 — 상태 6 · vt48(루)). AI 6 은 분기표가 아무것도 안 해(b4c60) 6 절 걸음의
      // AI 0 시작 자리 고치기를 안 탄다 (r180 — 예전 웹은 AI 를 안 바꿔 AI 0 인 공 가진 야수가 시작 자리로 되돌아갔다)
      fielders = fielders.map((fielder) =>
        // vt48 0xa0a18 → vt14 — 관문(잠금 · vtc8)이 막으면 목표는 그대로(`acceptsTargetVt14`, r196)
        fielder.slot === holderSlot
          ? acceptsTargetVt14(fielder)
            ? { ...fielder, target: basePoint, targetBase: base, aiState: AI_STATE.CARRY }
            : { ...fielder, aiState: AI_STATE.CARRY }
          : fielder,
      )
      log.push(`${tick}틱 ${holderSlot}번 야수가 ${base}루로 공을 들고 뛴다 (커버 없음)`)
      return false
    }
    const cover = fielders[coverSlot]
    // b2cf0 C.vt68() = 0xa0b4c — 목표점(+0x2c)이 어느 루 좌표와 같은가(아니면 −1). 칸으로 든 목표 루가 아니라 목표점으로 본다(r180)
    if (baseAtPoint(cover.target) !== base) return false
    const runTicks = ticksToReach(holder.position, basePoint, holder.speed)
    const throwTicks = throwTicksTo(holder, cover.target)
    const receiveTicks = fielderArrivalTicks(cover)
    if (runTicks <= Math.max(throwTicks, receiveTicks)) {
      // 직접 밟으러 간다 (0xb2a48(P, +0x130, 루) — `claimCoverOfBase`, r180): 옛 커버 C 는 AI 0 만(목표 · 목표 루 그대로) ·
      // +0xf0[루] = 공 가진 야수 · vt48(루) · AI 루 + 2. 커버가 자기 자신이면(홈 도루의 포수) b2a6e 에서 아무것도 안 한다 —
      // 예전 웹은 커버를 안 바꾸고 공 가진 야수의 목표만 루로 적었다
      if (coverSlot !== holderSlot) {
        const claimed = claimCoverOfBase(play, fielders, holderSlot, base)
        play = claimed.play
        fielders = claimed.fielders
        log.push(`${tick}틱 ${holderSlot}번 야수가 ${base}루를 직접 밟으러 간다`)
      }
      return true
    }
    if (coverSlot === holderSlot || horizontalDistance(holder.position, cover.position) <= MINIMUM_THROW_DISTANCE) {
      return false
    }
    // b2d7e~b2dea: 거리(공가진야수, C) 0xbf9f0 > 600(b2dbe~b2dc8) · C ≠ +0x130(b2dd4) 관문(바로 위 `MINIMUM_THROW_DISTANCE`) 뒤
    //   +0x154 = C(b2dde) · vt5c(C, 특수) = 0xb2e38(b2de4~b2dea)
    if (!throwBall(tick, coverSlot, base, byHuman, cpuSpecial)) return false
    // 그다음 0xb2c90 b2df8~b2e14: 던진 야수가 커버(0xa0ff4 — AI 2~5)도 AI 9 도 아니면 0xb8dbc(…, 0) — 시작 자리 0xd86ec 로(b476a).
    // 미룬 송구(b30a2)는 던질 야수가 AI 9 라 그대로다
    fielders = fielders.map((fielder) => {
      if (fielder.slot !== holderSlot) return fielder
      const keeps =
        (fielder.aiState >= AI_STATE.COVER_HOME && fielder.aiState <= AI_STATE.COVER_THIRD) ||
        fielder.aiState === AI_STATE.RECEIVE
      if (keeps) return fielder
      return { ...fielder, aiState: AI_STATE.IDLE }
    })
    return true
  }

  /**
   * **송구 0xb2e38**(플레이.vt5c, 인자 받을 야수 C · 특수) — 공 가진 야수가 C 에게 던진다. 던졌거나 미뤘으면(AI 9) 참.
   * 부르는 곳은 루로 보내기 0xb2c90(`sendToBase`)과 중계 이어 던지기 b4616 둘이다(`runDefensePlay` 의 throwBall 과 같은 갈래).
   * b2e6c~b2ea0 이 송구 계획 0xb3444 를 +0x14c..+0x153 에 **미루기 검사(b2eb2) 앞에서** 적는다 — 미뤄도 계획은 새것이다.
   */
  const throwBall = (
    tick: number,
    coverSlot: number,
    base: number,
    byHuman: ThrowChooser,
    cpuSpecial: boolean,
  ): boolean => {
    const holderSlot = play.ballHolderSlot
    const holder = fielders[holderSlot]
    if (holder === undefined) return false
    // ── 송구 0xb2e38 → 0xa1620 (악송구 굴림 0xa1828) ──
    // b2e44: vtC4(준비) — 던진 야수는 0xa1620 끝의 +0xb1 잠금으로 못 던진다(공을 안 쥔 야수는 못 던지는 것으로 본다,
    // `runDefensePlay` 의 throwBall 과 같은 근사)
    if (!holder.holdingBall || !isReadyToThrow(holder)) return false
    // b2eb2~b30d6: 받는 야수가 목표점에 없고 1구간 틱(계획 [5]) 안에 못 닿으면 미룬다 — AI 9 · vt48(루)
    // b2f06 — 레이저 발사 0x400bc 가 세운 플레이+0x1f4 를 본다. 레이저는 특수라 계획 0xb3444 가 중계를 안 끼운다(b3528)
    let laser = laserArmed
    const plan = planThrow({ fielders, fromSlot: holderSlot, finalSlot: coverSlot, base, special: laser || cpuSpecial })
    // b2e92~b2ea0: 계획을 +0x14c.. 에 덮어쓴다 — 중계면 [0] = 1 · [4] = 최종 받는 야수 · [7] = 목표 루 (b4616 이 본다)
    relayFinalSlot = plan.relayed ? coverSlot : NONE
    relayBase = plan.relayed ? base : NONE
    const receiver = fielders[plan.toSlot]
    if (
      receiver !== undefined &&
      !isSamePoint(receiver.position, receiver.target) &&
      fielderArrivalTicks(receiver) > plan.firstLegTicks
    ) {
      if (holder.aiState === AI_STATE.RECEIVE) return false
      deferredThrowReceiver = plan.toSlot
      deferredThrowBase = plan.base
      fielders = fielders.map((fielder) =>
        fielder.slot === holderSlot
          ? // b30d0 vt48(루) → vt14 — 관문이 막으면 목표는 그대로(r196)
            acceptsTargetVt14(fielder)
            ? { ...fielder, aiState: AI_STATE.RECEIVE, target: basePosition(plan.base), targetBase: wrapBase(plan.base) }
            : { ...fielder, aiState: AI_STATE.RECEIVE }
          : fielder,
      )
      log.push(`${tick}틱 ${holderSlot}번 야수가 ${plan.base}루 송구를 미룬다 — ${plan.toSlot}번 야수가 늦다 (AI 9)`)
      return true
    }
    // b2ee6: 내야수 → 내야수 송구면 레이저 표시를 지운다 (vt64(0))
    if (plan.toSlot <= 5 && holderSlot <= 5) {
      laser = false
      laserArmed = false
    }
    if (laser) laserThrow = true
    const special = !laser && cpuSpecial ? cpuSpecialThrowOf(fielders, holderSlot, coverSlot) : null
    const isSpecial = special !== null && special.special
    // a16dc~a16ec: +0xdc = 특수 ? +0xd8 : +0xd4 — 던질 때 덮어쓰고 그 판 동안 남는다. 레이저(0xa222c a229c)는 +0xdc = 2000 고정
    fielders = fielders.map((fielder) =>
      fielder.slot === holderSlot
        ? laser
          ? { ...fielder, throwSpeed: LASER_THROW_SPEED }
          : thrownWith(fielder, isSpecial)
        : fielder,
    )
    // b2f06 — 레이저로 던진 뒤 vt64(0)
    if (laser) laserArmed = false
    // 0xa1620 — 원바운드(a17fc) · 악송구(a1828) · 긴 송구 흔들림(a198c) 갈래와 세계 0xbfed0 · 받는 점 끼워 넣기(b2f9c).
    // 레이저 0xa222c 는 난수 굴림이 없다(악송구 · 흔들림 없음). 공은 계획 [3](중계면 중계맨)의 목표점으로 간다(b2f52)
    const thrown = launchThrow({
      thrower: fielders[holderSlot],
      target: fielders[plan.toSlot]?.target ?? basePosition(base),
      special: isSpecial,
      bounce: isSpecial && special.bounce,
      laser,
      ability: fielderAbilityOf(abilities, holderSlot, DEFAULT_ABILITY),
      random: input.random,
      body: ballBody,
    })
    if (thrown.errant) errantThrow = true
    // a1908(악송구) · a17fc(원바운드) — 던진 야수 +0xc0 = 4 (그림 0x438c4 의 "!")
    if (thrown.errant || thrown.bounce) throwErrorMarks = markSlot(throwErrorMarks, holderSlot, THROW_ERROR_MARK_TICKS)
    // b307c vt24(0) · vt34 — 받을(주울) 야수 · 포구 틱. 예보는 던진 야수가 손을 떠나기 전 칸으로 본다(b2f80 뒤지만 위치 · 목표는 같다)
    takeLooseBall(chaseLooseBall(thrown.ball, tick, fielders, forecastOptionsOf(thrown, holderSlot, coverSlot), maximumTicks))
    // b188a — 송구 예보가 두 번째 패스로 가면 그때의 +0x130(던진 야수 — b307c 앞)의 +0xc0 = 4
    if (chase?.secondPassStarted === true) throwErrorMarks = markSlot(throwErrorMarks, holderSlot, THROW_ERROR_MARK_TICKS)
    flight = { from: holderSlot, base, releaseTick: tick }
    if (firstThrowBase === NONE) {
      firstThrowBase = base
      firstThrowArrival = chase?.catchTick ?? tick
    }
    // 던지면 손을 떠난다(b2f80 · b3070) — 준비 틱(+0xc8)도 썼다. 던지기 0xa1620 끝 a1a26~a1a3a 가 동작 5 · +0xb1 = 1(r176) —
    // 다음 야수 틱이 걸음 없이(vtc8 거짓) a143e 에서 지우고 vt10(목표 = 위치)
    fielders = fielders.map((fielder) =>
      fielder.slot === holderSlot ? withThrowMotion({ ...fielder, holdingBall: false, actionRemainingTicks: 0 }) : fielder,
    )
    // b3094 vt30 = 0xb1c90 한 번 — 고르기 vt34 가 공 가진 야수(+0x130)를 받을 야수로 바꾸고 AI 1 을 0 으로 내린 뒤라(b3b7a)
    // 커버를 그 상태로 다시 고른다. 던진 야수가 커버 표에 남으면 b2564 가 vt14(그 루) · AI 루 + 2 — 공을 쥐고 AI 1 이던 도루 판
    // 포수도 여기서 홈 커버로 돌아간다(`stealPlay` 머리말)
    coverTick(tick)
    log.push(
      `${tick}틱 ${holderSlot}번 야수가 ${base}루로 ${laser ? '레이저 ' : ''}송구 — ${chase?.catchTick ?? tick}틱 도착` +
        (cpuSpecial ? ' (특수)' : '') +
        (plan.relayed ? ` (${plan.toSlot}번 야수 중계)` : '') +
        (thrown.bounce ? ' (원바운드)' : '') +
        (thrown.errant ? ' (악송구)' : thrown.wobbled ? ' (흔들린 긴 송구)' : '') +
        (chase !== null && chase.slot !== plan.toSlot ? ` (${chase.slot}번 야수가 줍는다)` : '') +
        (byHuman === '미룬'
          ? ' (AI 9 미룬 송구)'
          : byHuman === '중계'
            ? ' (중계 이어 던지기)'
            : byHuman
              ? ''
              : ' (CPU 결정)'),
    )
    return true
  }

  /**
   * 새로 깐 공을 쫓게 한다 — 고르기 0xb3b38: AI 1 · 0xc 인 야수는 AI 0 으로, 고른 야수(+0x130)는 AI 1(목표는 AI 고리 b4aca 몫).
   * 공은 아무도 안 쥔다(b2f80 · b3070 · 0xb3148).
   */
  const takeLooseBall = (next: ChasedBall): void => {
    chase = next
    diveBall = {
      ticks: next.diveTicks ?? [],
      catchTick: next.forecastCatchTick ?? next.catchTick - next.startTick,
      launchTick: next.startTick,
      trajectory: next.trajectory,
      heldAt: -1,
    }
    ballBody = next.body
    ballPath = { trajectory: next.trajectory, startTick: next.startTick }
    fielders = fielders.map((fielder) =>
      fielder.slot === next.slot
        ? // b3e54 — AI 1 만 걸고 목표(+0x2c)는 안 적는다. 포구점은 AI 고리 b4aca 가 움직임 허용 +0x13c 를 보고 적는다(r201 —
          // 예전 웹은 여기서 바로 적어, 슬롯 2 뒤쪽 CPU 송구(526ae)를 받는 야수가 한 틱 일찍 걸었다)
          { ...fielder, aiState: AI_STATE.CHASE, holdingBall: false }
        : fielder.aiState === AI_STATE.CHASE || fielder.aiState === AI_STATE.BACKUP
          ? { ...fielder, aiState: AI_STATE.IDLE, holdingBall: false }
          : fielder.holdingBall
            ? { ...fielder, holdingBall: false }
            : fielder,
    )
    // b3f5c — 백업 갈래(`CatchForecast.backupSlot`, r180): 머리 b3b7a 가 AI 1 · 0xc 를 0 으로 내린 뒤 고른다
    const backupSlot = next.backupSlot ?? -1
    if (backupSlot >= 0) {
      fielders = fielders.map((fielder) => (fielder.slot === backupSlot ? { ...fielder, aiState: AI_STATE.BACKUP } : fielder))
    }
    play = {
      ...play,
      held: false,
      ballHolderSlot: next.slot,
      catchFielderSlot: next.slot,
      catchTick: next.catchTick,
      // 고르기 0xb3b38 — +0x16c 포구 종류 · +0x176 동작 시작 틱 (b4134 가 본다, r176)
      catchKind: next.kind ?? play.catchKind,
      actionStartTick: next.actionStartTick ?? play.actionStartTick,
    }
  }

  /**
   * CPU 송구 결정 0xafa60 — +0x128 이 서 있고 공 가진 야수가 준비(vtC4)됐을 때만 점수식 0xafb24 로 고른다.
   * 홈이면 20% 특수 굴림(`afad2`, 0xb2c90 이 실패해도 먹는다), 0xb2c90 이 성공하면 +0x128 = 0.
   */
  const cpuThrowDecision = (tick: number): void => {
    if (!play.wantsThrow || !isHolderReady()) return
    // afa6c~afab8: 공 가진 야수가 AI 8(협살) · 9 면 안 고른다 — 이 판들은 협살이 없지만 0x583 의 한 번(`throwDecisionOnly`)은 앞 판
    // (타구 판)의 야수를 본다
    const holderAi = fielders[play.ballHolderSlot]?.aiState
    if (holderAi === AI_STATE.RECEIVE || holderAi === AI_STATE.RUNDOWN) return
    const active = runners.filter((runner) => !runner.state.isOut && !runner.state.scored).length
    const base = chooseThrowTargetBase({ ...contextAt(tick), activeRunnerCount: active, outs })
    if (base === NONE) return
    const cpuSpecial =
      base === 0 && input.random !== undefined && isSpecialThrow(base, input.random.rand(0, 100))
    if (sendToBase(tick, base, false, cpuSpecial)) {
      // afafc +0x128 = 0 · afb08 0xb0ea0 — 계획(+0x14c)을 지운다: CPU 가 정한 송구는 중계맨이 받아도 b4616 이 안 잇고,
      // 쥐기의 +0x128 로 이 결정이 다시 고른다
      play = { ...play, wantsThrow: false }
      relayFinalSlot = NONE
      relayBase = NONE
    }
  }

  // ── 0x46766 — 0x17 진입 0x46418 끝: 판 진행 관문 0xb0d28 이 열려 있으면 `0xaf8c0(제어기, 1)` 을 **한 번**, 주루 설정
  //    갈림(0xae690) 없이 부른다(타구 진행기 `applyPlayStartAutoAdvance` 와 같은 자리). force = 1 이라 리드 뒤 달리는 주자까지 본다.
  //    결정마다 +0x128 = 1(afa0e), 목표가 바뀌는 주자만 새 구간(vt48 은 같은 목표면 그대로). 굴림 없음.
  // 도루 키 0x583 의 0xafa60 한 번 — 판을 안 연다(`throwDecisionOnly`)
  if (input.throwDecisionOnly === true) cpuThrowDecision(0)
  for (const decision of input.throwDecisionOnly === true ? [] : autoAdvanceDecisions({ ...contextAt(0), force: true })) {
    play = { ...play, wantsThrow: true }
    const runner = runners.find((candidate) => candidate.state.index === decision.runnerIndex)
    if (runner === undefined || decision.toBase === runner.state.targetBase) continue
    startLeg(runner, decision.toBase)
    log.push(`판 시작 ${runner.state.index}번 주자 자동 진루 → ${decision.toBase}루`)
  }

  for (let tick = 0; input.throwDecisionOnly !== true && tick <= maximumTicks && !play.finished; tick += 1) {
    const press = yield tick
    sound.slidingThisTick = false
    sound.thisTick = []
    outJudgedThisTick = false
    tickMessageCode = 0
    /** 이 틱이 멈춘 그림인가 — 머리에서 이미 +0x1993 이 서 있다(0x3f060 의 목록 틱 · 슬롯 2 가 통째로 없다, 타구 진행기와 같다) */
    const pausedAtHead = gamePaused
    /** 이 틱 머리(슬롯 2 머리)에서 0x400bc 가 경기를 멈췄는가 */
    let pausedThisTick = false
    // ── 0. 야수 틱 0xa1284 — 공용 갱신 0x3f060 이 슬롯 2(0x524c0)보다 먼저 돈다. 쥔 동안 +0xc8 −= 1 (타구 진행기 0' 절) ──
    // 경기 멈춤(+0x1993)이 머리에서 서 있으면 0x3f060 이 3f0a4 에서 돌아가 목록 틱이 없다
    if (!pausedAtHead) {
      // a12da · a12e6 — 동작 잠금(+0xb4)이 없는 틱에만 +0xb8 · +0xc0 을 −1 (그림의 "!" 만 본다)
      fumbleMarks = fumbleMarks.map((value, slot) => tickMarkCounter(value, (fielders[slot]?.actionLockTicks ?? 0) > 0))
      throwErrorMarks = throwErrorMarks.map((value, slot) => tickMarkCounter(value, (fielders[slot]?.actionLockTicks ?? 0) > 0))
      // a1286 프레임 +1 · 잠금 · 준비 틱 · 자세 워드 지우기 a137a~a1456(vt10 — 목표 = 위치) (`fielderPose.listTickFielder`, r176)
      fielders = fielders.map(listTickFielder)
    }
    ballEventThisTick = false
    // ── 0b. 사람 조작 — 상태 0x17 키 0x53420: 수비면 0x533c8 → 메시지 0x588(목표 루) → 0x51890 → 플레이 vt60 0xb3118 → +0x160.
    //        판 종류를 안 가린다. 키 반복(누르고 있기)도 0x536bc 가 0x17 갈래로 보낸다 ──
    // 한 틀에 누름 · 되풀이가 함께 오면 0x498d4 가 누름 → 되풀이 차례로 둘 다 0x53420 에 보낸다(`framePressesOf`)
    for (const keyPress of input.controls?.side === '수비' ? framePressesOf(press) : []) {
      if (play.finished) break
      const command = inPlayCommandOf(keyPress.key, '수비', { isHoldRepeat: keyPress.isRepeat === true })
      if (command !== null && command.kind === '송구') {
        manualThrowBase = command.target
        play = { ...play, manualThrowBase }
        log.push(`${tick}틱 사람이 ${command.target}루로 송구 지시`)
      }
    }
    // ── 0c. 사람 조작 — 공격이면 0x53420 이 주루 0x5331c(0x582 진루 · 0x584 귀루) · OK 0x585(슬라이딩) ──
    // 한 틀에 누름 · 되풀이가 함께 오면 0x498d4 가 누름 → 되풀이 차례로 둘 다 0x53420 에 보낸다(`framePressesOf`)
    for (const keyPress of input.controls?.side === '공격' ? framePressesOf(press) : []) {
      if (play.finished) break
      const command = inPlayCommandOf(keyPress.key, '공격', { isHoldRepeat: keyPress.isRepeat === true })
      if (command?.kind === '슬라이딩') {
        // 0x518da — 종류 2 · 3 · 파울(이 판엔 타구가 없다) · 걸어 나가는 주자(이 진행기에 +0xba 연출이 없다) 뒤 0xa96ec 로 슬라이딩,
        // 그 뒤에야 소리 재생 중 · +0x31c 잠금을 본다
        const decision = slideOnKey({
          playKind: input.kind,
          isFoulBattedBall: false,
          runners: runners.map((runner) => slidingRunnerOf(runner.state)),
          isSoundPlaying: false,
          hasPlayedSoundThisPlay: slidingSoundPlayed,
        })
        if (decision.playsSound) {
          slidingSoundPlayed = true
          sound.slidingThisTick = true
          sound.thisTick.push(SLIDING_SOUND_EFFECT)
        }
        for (const index of decision.slidRunnerIndexes) {
          const runner = runners[index]
          if (runner === undefined || runner.state.sliding) continue
          // 0xa04d0: +0xb8 = 1 · vt44(6) — 0xa0164 가 속도 = vt64() + 40
          runner.state = { ...runner.state, sliding: true, speed: runner.state.speed + SLIDING_SPEED_BONUS }
        }
        if (decision.slidRunnerIndexes.length > 0) log.push(`${tick}틱 슬라이딩 — 주자 ${decision.slidRunnerIndexes.join('·')}`)
      } else if (command?.kind === '진루' || command?.kind === '귀루') {
        // 0x5209e / 0x5222a → 0xa9b04 — 성공하면 플레이+0x128 = 1
        const keyed = applyBaserunningKey(
          {
            playKind: input.kind,
            // 플레이 +0x111(홈런 사건 8) — 타구가 없는 이 판에서는 서지 않는다
            homeRunFlag: false,
            runners: runnerStates(),
            previousTargets: runners.map((runner) => runner.previousTarget),
          },
          command.kind,
          command.runner,
        )
        runners.forEach((runner, index) => {
          runner.state = keyed.runners[index] ?? runner.state
          runner.previousTarget = keyed.previousTargets[index] ?? runner.previousTarget
        })
        if (keyed.succeeded) {
          play = { ...play, wantsThrow: true }
          log.push(
            `${tick}틱 ${command.kind} 키 — 주자 ${keyed.retargeted.map((index) => runners[index]?.state.index).join('·')}`,
          )
        }
      }
    }
    // ── 0d. 레이저 송구 — 슬롯 2 머리 524c4(+0x1992 == −1)의 0x523bc 굴림 · 0x4e858 반짝임 · 0x400bc 발사 (`laserTick`, r201) ──
    // 판 종류를 안 가린다 — 타구 진행기 0b · 0c 절과 같은 차례다. 굴림은 공 가진 야수(+0x130)가 외야수일 때만(523e6) 돌아, 이 판에서는
    // 송구 · 튕긴 공을 외야수가 쫓을 때만 선다. 창(0xb2648)은 마지막 고르기 0xb3b38 의 포구 틱(+0x174) 기준 −10 ~ +8 틱
    {
      const holder = fielders[play.ballHolderSlot]
      laserFlags = laserWindowTick({
        flags: laserFlags,
        random: input.random,
        effectStep: scene.effectStep,
        ticksSinceCatch: tick - (chase?.catchTick ?? play.catchTick),
        hasChosenThrowTarget: manualThrowBase !== NONE,
        isBallHeld: play.held,
        holder,
        holderAbility: recordPlayerAbilityOf(abilities, play.ballHolderSlot, DEFAULT_ABILITY),
        holderSkillIds: input.fielderSkillIds?.[play.ballHolderSlot] ?? [],
        defenseIsCpu: input.defenseIsCpu === true,
        press,
      }).flags
      if (
        canFireLaserNow({
          effectStep: scene.effectStep,
          pausedAtHead,
          confirmed: laserFlags.confirmed,
          hasChosenThrowTarget: manualThrowBase !== NONE,
          isBallHeld: play.held,
          holder,
        })
      ) {
        scene = fireLaser(scene)
        gamePaused = true
        laserArmed = true
        laserTrailOn = true
        pausedThisTick = true
        // 앞 틱 끝에서 센 G2(52502)는 524e6 뒤라 원본은 부르지 않았다
        endCounter = counterBeforeHead
        log.push(`${tick}틱 레이저 발사 (0x400bc) — 경기 멈춤 +0x1993`)
      }
    }

    // 멈춘 그림은 슬롯 2(포구 · 판정 · 득점 · AI · 자동 진루 · CPU 송구)가 없다 — 그림(5 절)은 그대로 남긴다
    slot2: {
    if (gamePaused) break slot2
    // 5254c — +0x1991(레이저 잔상) && 포구 관문(아무도 안 쥠) && 동작 시작 틱 − 1 == 공 틱이면 +0x1991 = 0
    if (laserTrailOn && !play.held && tick === play.actionStartTick - 1) laserTrailOn = false

    // ── 1. 포구 틱 갈래 0xb401c — 쫓는 공을 고른 야수가 포구 틱(+0x174)에 ──
    // ```
    // b4224  r4 = 펌블표[등급] > rand(0, 10000)       ; 늘 먹는다
    // b4236  멈춤 = 공.vt18() ; r4 && !멈춤 → 야수+0xb8 = 6 · 메시지 0xbc2 · 사건 sp+0x24 = 1 (쥐지 않음)
    // b4292  아니면 b = 야수.vt58()(발밑 루) ; b ≠ −1 && 0xa97a0(b)(그 루에 마지막으로 닿은 산 주자).vt18() → 결과 코드 9
    // b42c8  쥐기 0xb2710(P, f, 1) — +0x128 · +0x130 · +0x12c · +0x112 · 준비 틱(내야 3 · 외야 6) · vt90
    // ```
    // b40ca~b419c (포구 틱 갈래 앞, 매 틱 — 관문 b4062 vt50: +0x12c(쥠) 등이 0 일 때). 받는 송구 · 줍는 공도 타구와 같은 갈래다(r176):
    // 잡을 야수(+0x170)가 서 있고 목표점 x · z 가 포구 틱 공 점과 같고 +0x174 < 공+0xaa0 && 종류 0 이면 vt9c(뜬공 기다리기),
    // 공 틱이 동작 시작 틱(+0x176)이면 표 0xd87f4[+0x16c] 로 포구 동작 · 자세 워드(`fielderPose.withCatchMotion`). 종류 · 시작 틱은
    // 고르기 0xb3b38 이 송구 0xb2e38 의 b307c · 다시 쏘기 b32a4 · 판 시작 b2878 에서 적는다(`takeLooseBall` · 판 시작 칸)
    if (chase !== null && !play.held) {
      const catcher = fielders[play.catchFielderSlot]
      const ballAtCatch = chase.trajectory.pointAt(chase.catchTick)
      const landing = chase.trajectory.landingTick
      if (
        catcher !== undefined &&
        play.catchKind === CATCH_KIND.LOW &&
        chase.catchTick < landing &&
        isSamePoint(catcher.position, catcher.target) &&
        catcher.target.x === ballAtCatch.x &&
        catcher.target.z === ballAtCatch.z
      ) {
        fielders = fielders.map((fielder) => (fielder.slot === catcher.slot ? withFlyWaitPose(fielder) : fielder))
      }
      if (tick === play.actionStartTick) {
        fielders = fielders.map((fielder) =>
          fielder.slot === play.catchFielderSlot ? withCatchMotion(fielder, play.catchKind) : fielder,
        )
      }
    }
    const current = chase
    if (current !== null && !play.held && tick === current.catchTick) {
      const ballIsMoving =
        current.trajectory.isStoppedAt === undefined
          ? tick < current.trajectory.length - 1
          : !current.trajectory.isStoppedAt(tick)
      if (input.random !== undefined && rollFumble(recordPlayerAbilityOf(abilities, current.slot, DEFAULT_ABILITY), ballIsMoving, input.random)) {
        fumbled = true
        ballEventThisTick = true
        // b4280 — 야수 +0xb8 = 6
        fumbleMarks = markSlot(fumbleMarks, current.slot, FUMBLE_MARK_TICKS)
        log.push(`${tick}틱 ${current.slot}번 야수 펌블 (0xbc2)`)
      } else {
        chase = null
        flight = null
        diveBall = { ...diveBall, heldAt: tick }
        if (ballPath !== null) ballPath = { ...ballPath, heldAt: tick }
        if (firstCatchTick < 0) firstCatchTick = tick
        // 쥐기 0xb2710 은 위치 · 목표를 안 바꾼다(r176 — 예전 웹은 포구 지점으로 옮겨 쥐었다). 야수 자리는 그림 N 의 목록 틱(앞 판 틱
        // 6 절 이동)이 옮긴 그대로라 발밑 루(vt58)도 그 자리로 본다
        const footBase = baseUnderFoot(fielders[current.slot])
        const onBase =
          footBase === NONE
            ? undefined
            : runners.find((runner) => !runner.state.isOut && wrapBase(runner.state.startBase) === footBase)
        grab(tick, current.slot, { actionRemainingTicks: readyTicksOf(current.slot) })
        log.push(`${tick}틱 ${current.slot}번 야수가 공을 쥐었다`)
        // b4292 — 발밑 루에 산 주자가 서 있는 포구는 결과 코드 9 (판 결과 칸은 첫 번째만 적지만 메시지는 포구마다 간다)
        if (onBase !== undefined && isAtTarget(onBase.state)) tickMessageCode = 9
        if (resultCode === null && onBase !== undefined && isAtTarget(onBase.state)) {
          resultCode = RUNNER_PLAY_RESULT.SAFE
          log.push(`${tick}틱 ${footBase}루 세이프 (결과 9)`)
        }
      }
    }
    // ── 2. 아웃 판정 0xb36d0 — 플레이 틱 b43cc~b43ea (포구 갈래 뒤 · 같은 그림의 슬롯 2 — 6 절 이동 앞) ──
    // 그림 N 의 플레이 틱이라 주자 · 야수 자리는 그림 N 의 목록 틱(앞 판 틱의 6 절 이동)이 옮긴 그대로다(타구 진행기 6b 절과 같다)
    // 쥐기 판정(0xb2758)이 이 틱에 아웃을 냈으면 같은 플레이 틱의 두 번째 판정(b42f2 · b43de)이 머리 b36dc 에서 state[0x87] 을
    // 지우고 태그(3)일 때만 다시 세운다 — 결과 코드 13 은 b4540 에서 그 값을 읽는다(타구 진행기 6b 절)
    // b42ce~b4314 (타구 진행기 2b · 6b 절, r201): 아웃 아닌 주자 중 +0x3b(막 닿음)가 있거나(0xa99d8) 공 가진 야수 F+0x3b 면 b42ee 갈래 —
    // 판정 b42f2 한 번 뒤 결과 2(루 아웃)이고 F+0x3b 면 state[0x87] = 1(b4312) — 포스 아웃도 콜 62 다. 아니면 b43cc~b43ea 판정 한 번
    const arrivalBranch =
      runners.some((runner) => !runner.state.isOut && runner.arrivedThisListTick) ||
      fielderArrivals[play.ballHolderSlot] === true
    const grabbedOut = outJudgedThisTick
    const outsBeforeSecondJudgement = outsAdded
    lastJudgedKind = OUT_KIND.NONE
    runOutJudgement(tick)
    const baseOutFold =
      arrivalBranch && fielderArrivals[play.ballHolderSlot] === true && lastJudgedKind === OUT_KIND.BASE
    if (grabbedOut) tagOut = lastJudgedKind === OUT_KIND.TAG || baseOutFold
    else if (baseOutFold && outsAdded > outsBeforeSecondJudgement) tagOut = true

    // 낙구 0xb4492~0xb453c — 아웃 판정 b43da · 결과 9 b43ec 뒤(b444e~) — +0x112(쥐었거나 땅에 닿음)가 아직이면 state[0x1e] = 1 · 포스 요구 루 0xa95e8.
    // 사건(펌블)만 있는 틱도 b44f8 이 포스를 세운다
    if (!ballOnGround && chase !== null && (tick === chase.trajectory.landingTick || ballEventThisTick)) {
      if (!ballEventThisTick) ballOnGround = true
      const required = requiredBasesOnBounce(runnerStates())
      runners.forEach((runner, index) => {
        runner.state = { ...runner.state, requiredBase: required[index] ?? runner.state.requiredBase }
      })
    }

    // ── 2b. 결과 메시지 0xbba(b4562) → 51a56 결과 판 칸 — 포구 b4292 의 9 를 b4540 의 13 이 덮는다. 공 가진 야수는 이 자리 값 ──
    if (outJudgedThisTick) tickMessageCode = 13
    if (tickMessageCode !== 0) {
      scene = { ...scene, popup: postJudgeMessage(scene.popup, tickMessageCode, play.ballHolderSlot) }
      // 같은 메시지의 판정 스위치가 그 자리에서 콜을 낸다 (`runnerPlayCallSoundIdOf`)
      const call = runnerPlayCallSoundIdOf(tickMessageCode, tagOut)
      if (call !== null) sound.thisTick.push(call)
    }

    // ── 2c. 아웃이 난 틱 — 같은 메시지의 0x51d40~0x51db4 → 0xafa60 한 번 ──
    // 수비 조작이 사람이든 CPU 든 `아웃 ≤ 2` 면 플레이+0x128 = 1 로 세우고 CPU 송구 결정을 부른다
    // (`runDefensePlay` 의 6c 절에 근거). 공 쥔 야수가 준비(vtC4)돼 있어야 던진다 — 송구를 받는 틱의 아웃은
    // 쥐기가 준비 틱을 막 넣어 못 던진다.
    if (outJudgedThisTick && outs <= 2 && !play.finished) {
      play = { ...play, wantsThrow: true }
      cpuThrowDecision(tick)
    }

    // ── 2d. 플레이 틱 꼬리 b45a0 — 사건(펌블)이 있었으면 플레이.vt70 = 0xb3148: 공을 그 야수에게서 튕겨 다시 쏘고 vt24(1) · vt34 ──
    // 이 그림 그리기(5 절)보다 먼저라 깐 그림은 공+0x68 = 0 으로 공을 안 그린다(36e24)
    const fumbledBall = chase
    if (ballEventThisTick && fumbledBall !== null && !play.finished) {
      const holder = fielders[fumbledBall.slot]
      // b31c8~b31f0 — 공 가진 야수(+0x130)가 +0xb4 ≤ 0 이면 vt10(동작 · 자세 워드 0 · 목표 = 위치, r176)
      fielders = fielders.map((fielder) =>
        fielder.slot === play.ballHolderSlot && fielder.actionLockTicks <= 0 ? withPoseCleared(fielder) : fielder,
      )
      const bounced = bounceOffFielder(fumbledBall, tick, holder.position, input.random)
      if (bounced !== null) {
        takeLooseBall(chaseLooseBall(bounced.ball, tick, fielders, { initialChaserSlot: fumbledBall.slot }, maximumTicks))
        flight = null
        log.push(
          `${tick}틱 공 튕김 (0xb3148) — 속도 ${bounced.speed} · v0 ${bounced.verticalSpeed} · 각 ${bounced.angle} · ` +
            `${chase?.slot ?? NONE}번 야수가 ${chase?.catchTick ?? tick}틱에 줍는다`,
        )
      }
    }

    // ── 2e. 득점 0xaa0a8 (슬롯 2 525fc — 플레이 틱 뒤 · vt4c 앞): 내림차순으로 +0x3b(목록 틱에 막 닿음) && +0x8c == 4 인 주자 ──
    // +0x3b 는 그림 N 의 목록 틱(앞 판 틱 6 절 이동)에서만 선다 — 관문 G2 가 닫힌 그림은 0xaa0a8 을 안 부른다(타구 진행기 6f 절)
    for (let index = runners.length - 1; index >= 0; index -= 1) {
      const runner = runners[index]!
      if (runner.state.isOut || runner.state.scored || runner.counted || !runner.arrivedThisListTick) continue
      const touched = runner.state.startBase
      if (wrapBase(touched) !== 0 || touched === 0) continue
      runner.counted = true
      runner.state = { ...runner.state, scored: true }
      held = onRunnerReachesHome(held, {
        outs,
        ballOnGround,
        batterRunner: batterRunnerOf(),
        scoringRunnerIsBatterRunner: runner.state.isBatterRunner,
      })
      log.push(`${tick}틱 ${runner.state.index}번 주자 홈 — 보류 ${held.heldRuns} / 득점 ${held.scoreboardRuns}`)
    }

    // ── 2f. 보류 득점 풀기 (0xaa34c — 0xaa0a8 꼬리) — aa364 의 "진행 중인 주자" 도 0xaa05c(+0x94 항까지) ──
    held = releaseHeldRuns(held, {
      outs,
      ballOnGround,
      batterRunner: batterRunnerOf(),
      someRunnerStillActive: someRunnerStillActive(runnerStates(), isAtTarget),
    })

    // 3a · 3b · 3c 는 플레이 vt4c 0xb45dc 다 — 슬롯 2 52612 라 플레이 틱(vt48) · 득점 0xaa0a8 뒤에 돈다
    // ── 3a. 중계 이어 던지기 — vt4c 머리 b45ee~b465e (직접 뜬 것, `runDefensePlay` 1a 절과 같다) ──
    // ```
    // b45f0: +0x12c(쥠) 이면
    // b4608:   [4](+0x150) ≠ +0x130(공 가진 야수) && [0](+0x14c 중계) 이면 vt5c([4], 0) = 0xb2e38 ; 참이면 메시지 0xbc6
    // b4638: (쥠이 0 인 틱(b45f4 beq)도, 위 두 조건이 깨진 틱(b460a · b4614)도 여기로 온다 — 쥠 갈래 밖)
    //        [4] == +0x130 이면 [0] = 0 · +0x117 = 0
    // ```
    // 중계맨은 쥐기(0xb2710)가 넣은 준비 틱(내야 3)이 끝난 틱에 던진다 — 0xb2e38 머리의 vtC4 가 그때까지 0 을 돌려준다.
    // 0xb2c90 을 거치지 않으므로 들고 뛰기 · 직접 밟기 관문도, 던진 뒤 AI 0 도 없다. CPU 송구 결정이 던진 공은 계획이 지워져
    // 여기를 안 탄다(4c 절) — 사람 목표(3b) · 미룬 송구(3c)의 0xb2c90 이 낸 중계만 남는다
    if (!play.finished && vt4cRuns) {
      const holderSlot = play.ballHolderSlot
      if (play.held && relayFinalSlot !== NONE && relayFinalSlot !== holderSlot) {
        throwBall(tick, relayFinalSlot, relayBase, '중계', false)
      } else if (relayFinalSlot === holderSlot) {
        relayFinalSlot = NONE
        relayBase = NONE
      }
    }
    // ── 3b. 사람 목표 +0x160 — 플레이 틱 vt4c 의 b4660~b46a8: 쥠 && 준비(vtC4) 이면 발밑 루가 아닐 때 vt58, 그리고 −1 ──
    // vt4c 는 판 종류가 마스크 0x58c 밖일 때만 돈다(0x52602) — 밀어내기(종류 2)는 키가 +0x160 만 적고 안 던진다(다음 판 시작 vt1c 가 지운다)
    if (!play.finished && vt4cRuns && manualThrowBase !== NONE && isHolderReady()) {
      const target = manualThrowBase
      manualThrowBase = NONE
      play = { ...play, manualThrowBase: NONE }
      if (!isSamePoint(fielders[play.ballHolderSlot].position, basePosition(target))) {
        sendToBase(tick, target, true, false)
      }
    }

    // ── 3c. AI 9 — 미룬 송구 (b4838, 같은 vt4c): 받을 야수.vtc0() ≤ 공 가진 야수.vtb8(루 좌표) 가 되면 0xb2c90(루, 0), 참이면 AI 0 ──
    // AI 2~5(b47f2, 같은 고리 — 칸 차례로 AI 9 와 섞어 돈다, r176): +0x3b && vtcc 면 0xb2a48(P, 칸, 루) (`claimCoverOfBase`)
    if (!play.finished && vt4cRuns) {
      for (let slot = 0; slot < fielders.length; slot += 1) {
        // b46c2~b475a 다이빙 검사 — 분기 앞에서 칸마다 (`diveCheckOf`, r180)
        const diveTrajectory = diveBall.trajectory
        const dive =
          diveTrajectory === null
            ? null
            : diveCheckOf({
                fielder: fielders[slot],
                diveTick: diveBall.ticks[slot] ?? DIVE_TICK_NONE,
                catchTick: diveBall.catchTick,
                // 공+0x68 — 쥔 동안은 쥔 틱에 머문다(0x3f378 3f3aa)
                ballTick: (play.held && diveBall.heldAt >= 0 ? diveBall.heldAt : tick) - diveBall.launchTick,
                coverNeeded: (base) => needsCover(contextAt(tick), base),
                ballPointAt: (at) => diveTrajectory.pointAt(diveBall.launchTick + at),
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
        // AI 0 b476a — vtcc 면 목표가 시작 자리 0xd86ec[칸] 와 다를 때 vt50(= vt14)로 그 자리로. 고리 안이라 같은 틱 끝 b4c72 의
        // 커버 다시 고르기(0xb1c90)가 고친 목표를 본다 — 고리 뒤에 AI 0 이 된 야수는 다음 고리에서 돌아선다 (r180, `runDefensePlay` 1c 절)
        if (dispatchState === AI_STATE.IDLE && isFreeToRetarget(self)) {
          const home = FIELDER_START_POSITIONS[slot]
          if (home !== undefined && !isSamePoint(self.target, home)) {
            fielders = fielders.map((fielder) => (fielder.slot === slot ? { ...fielder, target: home } : fielder))
          }
        }
        // AI 1 b4aca~b4b5a — vtcc 이고 쥐지 않았으면(+0xe0, b4ae6) 포구 지점(x, 0, z)으로 0xa100c(= vt14). 고리 안이라 같은 틱 끝
        // b4c72 의 커버 다시 고르기가 고친 목표를 본다 (r190 — 예전 웹은 6 절 걸음에서 골랐다). 쥐면 `chase` 가 비어 안 고친다.
        // b4af6 — 움직임 허용 +0x13c[칸](마지막 예보가 적은 값, `LooseBallChase.movable`)이 0 이면 안 고친다: 보통 송구(a = 0 ·
        // 공+0xaac == 0)를 받는 야수는 두 번째 패스가 아니면 고르기 0xb3b38 이 준 목표 그대로다(r196)
        const chased = chase
        if (
          dispatchState === AI_STATE.CHASE &&
          chased !== null &&
          chased.slot === slot &&
          chased.movable !== false &&
          isFreeToRetarget(self) &&
          !isSamePoint(self.target, chased.catchPoint)
        ) {
          fielders = fielders.map((fielder) => (fielder.slot === slot ? { ...fielder, target: chased.catchPoint } : fielder))
        }
        // AI 0xc b4b78 — 공 가진 야수(+0x130)의 목표 T 에서 2000 뒤(`backupPointOf`)로 vt14(잠금 +0xb4 ≤ 0 · vtc8 일 때만, r180)
        if (dispatchState === AI_STATE.BACKUP) {
          const backup = backupPointOf(fielders[play.ballHolderSlot]?.target ?? self.target, self.position)
          if (backup !== null && self.actionLockTicks <= 0 && isFreeToStep(self)) {
            fielders = fielders.map((fielder) => (fielder.slot === slot ? { ...fielder, target: backup } : fielder))
          }
        }
        if (dispatchState >= AI_STATE.COVER_HOME && dispatchState <= AI_STATE.COVER_THIRD) {
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
        if (sendToBase(tick, deferredThrowBase, '미룬', false)) {
          fielders = fielders.map((fielder) =>
            fielder.slot === slot
              ? { ...fielder, aiState: AI_STATE.IDLE }
              : fielder,
          )
        }
      }
    }

    // ── 3d. vt4c 의 끝 b4c72 — 플레이 vt30 = 0xb1c90: 커버(+0xf0) 다시 고르기 · 키스톤 자리 잡기 0xb203a (`runCoverTick`) ──
    // 야수 AI 고리(b46ae~b4c6a) 뒤 조건 없이 부른다 — vt4c 가 도는 판(종류 4 · 5 · 9)이면 매 틱. 밀어내기(종류 2)는 vt4c 가 안 돈다
    if (!play.finished && vt4cRuns) coverTick(tick)

    // ── 4. 자동 추가 진루 0xaf918 · 자동 슬라이딩 0xb030c ──
    // 결과 코드(9·13)가 선 뒤에도 돈다 — 슬롯 2 의 52660 은 판 진행 관문 0xb0d28 이 열려 있으면 매 틱 부르고 결과 코드를 안 본다
    if (!play.finished && autoBaserunningEnabled) {
      // 52660 `0xaf8c0(제어기, 0)` — force = 0: 멈춘 주자(제 목표 루에 선 주자)만 본다. force = 1 은 판 시작 0x46766 한 번
      const decisions = autoAdvanceDecisions({ ...contextAt(tick), force: false })
      for (const decision of decisions) {
        const runner = runners.find((candidate) => candidate.state.index === decision.runnerIndex)
        if (runner === undefined) continue
        // afa0e 는 죽은 주자(+0x96 — 아웃·득점)에게도 +0x128 = 1 을 세운다. 죽은 주자는 주자 틱이 안 옮기므로 목표만 그대로 둔다
        if (runner.state.isOut || runner.state.scored) {
          play = { ...play, wantsThrow: true }
          continue
        }
        if (decision.toBase > HOME_BASE) continue
        startLeg(runner, decision.toBase)
        // afa0e: 한 루 더 보내면 플레이+0x128 = 1
        play = { ...play, wantsThrow: true }
        log.push(`${tick}틱 ${runner.state.index}번 주자 자동 진루 → ${decision.toBase}루`)
      }
    }
    if (!play.finished) {
      const throwing = flight !== null && chase !== null && tick < chase.catchTick
      const slid = autoSlideRunnerIndexes({
        isThrowInFlight: throwing,
        throwTargetBase: throwing && flight !== null ? flight.base : NONE,
        throwArrivalTicks: flight !== null && chase !== null ? chase.catchTick - tick : -1,
        runners: runners.map((runner) => slidingRunnerOf(runner.state)),
      })
      for (const index of slid) {
        const runner = runners[index]
        if (runner === undefined) continue
        runner.state = { ...runner.state, sliding: true, speed: runner.state.speed + SLIDING_SPEED_BONUS }
        log.push(`${tick}틱 ${runner.state.index}번 주자 자동 슬라이딩`)
      }
      // 0x52670 — 슬라이딩시킨 수 > 0 이면 그 자리에서 효과음 10 (0x5268c, 잠금 없음)
      if (slid.length > 0) {
        sound.slidingThisTick = true
        sound.thisTick.push(SLIDING_SOUND_EFFECT)
      }
    }

    // ── 4c. CPU 송구 결정 0xafa60 (슬롯 2 의 526ae, 매 틱 — `0xae6c8` = 수비 CPU || 송구 설정 자동) ──
    if (!play.finished && cpuThrowEnabled) cpuThrowDecision(tick)
    }

    // ── 5. 그림 ──
    /** 판 틱 `at` 의 그림 — 판이 G2 에서만 닫힌 그림(`closingListFrame`)은 다음 틱 자리로 한 번 더 찍는다 */
    const snapshotAt = (at: number, fieldersNow: readonly FielderState[]): DefensePlayView =>
      viewStateOf({
        tick: at,
        // 슬라이딩 먼지 방향 0x9ff40 의 0x9fe80 이 보는 +0x84
        previousTargetOf: (index) => runners.find((runner) => runner.state.index === index)?.previousTarget ?? NONE,
        ball:
          chase !== null
            ? chase.trajectory.pointAt(at)
            : (input.restingBall ?? fielders[play.ballHolderSlot]?.position ?? basePosition(0)),
        ballIsFlying: chase !== null,
        // 공 그리기 0x36dfc(36e90) — 쥔 공(+0x12c)은 공 · 그림자를 안 그린다
        ballHeld: play.held,
        // 공+0x68 — 판 시작 · 송구 · 다시 쏘기가 0 으로 둔 그림은 0x36dfc 36e24 가 공 · 그림자를 건너뛴다
        ballPlaybackTick: at - (chase?.startTick ?? 0),
        fielders: fieldersNow,
        runners: runnerStates(),
        catchKind: null,
        chaserSlot: chase?.slot ?? play.ballHolderSlot,
        throwingSlot: flight !== null && at < flight.releaseTick + 3 ? flight.from : NONE,
        throwBase: flight?.base ?? NONE,
        previousActions,
        // 머리에서 경기 멈춤(+0x1993)이 서 있던 그림 — 0x3f060 이 3f0a4 에서 돌아가 카메라가 안 움직인다
        cameraFrozen: pausedAtHead,
        // 레이저 반짝임(경기+0x19ad) — 공 쥔 야수(+0x130) · 반짝임 켜짐 (타구 진행기와 같은 근사)
        laserShiningSlot: laserFlags.shining && play.held ? play.ballHolderSlot : NONE,
        // 레이저 잔상 0x37076 — +0x1991 동안 지금 공 궤적의 t = 0 점에서 공까지
        laserTrailFrom: laserTrailOn && ballPath !== null ? ballPath.trajectory.pointAt(ballPath.startTick) : null,
        // 공 가진 야수 고리 0x43cb0 — 경기+0x19ac · +0x130 · 공격 주체 · +0x19ad
        holderMark: holderMarkOf({
          grabbed,
          holderSlot: play.ballHolderSlot,
          offenseIsCpu: input.offenseIsCpu === true,
          isShining: laserFlags.shining,
        }),
        holderPlate: input.fielderPlates?.[play.ballHolderSlot] ?? null,
        fumbleTicks: fumbleMarks,
        throwErrorTicks: throwErrorMarks,
        // 공 그리기 0x36dfc 의 튐 파티클 — 0x46c88 이 판 종류를 안 보고 늘 부른다(`ballParticleFactsOf`). 큰 타구 갈래는 판 종류 ∈ {1, 8} 이라 없다.
        // 공은 송구 · 다시 쏘기 · 폭투가 깐 궤적(세계 0xbfed0)을 판 틱으로 읽는다. 쥔 공 · 쫓는 공이 없는 그림은 안 쏜다.
        // +0xfd4(결과 코드)는 스윙 판정 51308 이 적고 0x11 진입이 공마다 지우는 칸이라 이 판이 열린 때의 값 그대로다(`sceneResultCode`)
        ballParticles:
          chase === null || play.held
            ? null
            : ballParticleFactsOf({
                ballTick: at - chase.startTick,
                at,
                trajectory: chase.trajectory,
                onTrajectory: true,
                bigHitWatch: false,
                playKind: input.kind,
                resultCode: input.sceneResultCode ?? null,
              }),
        runnerAceIndexes: input.runnerAceIndexes,
        runnerAceSprite: input.runnerAceSprite ?? null,
        sceneResultCode: input.sceneResultCode ?? null,
        aceIndexes: input.aceIndexes,
        defenseTeamIndex: input.defenseTeamIndex,
        offenseTeamIndex: input.offenseTeamIndex,
      })
    // 이 판 틱에 낸 소리(차례대로)를 그림에 싣는다 — 미리 돌린 판을 재생만 하는 화면(`DefensePlayback` 의 재생 갈래)이 그 틱에 낸다
    const tickView = snapshotAt(tick, fielders)
    ticks.push(sound.thisTick.length > 0 ? { ...tickView, tickSoundIds: [...sound.thisTick] } : tickView)
    // ── 5b. 이 그림의 수비 화면 그리기 0x46c88 의 연출 몫 (`defenseScene`) — 관문을 안 보고 그리기마다 돈다(46de4~46e24) ──
    const drawSceneEffects = (): void => {
      const view = ticks[ticks.length - 1]
      const drawn = drawDefenseScene(scene, {
        holderSlot: play.ballHolderSlot,
        holder: fielders[play.ballHolderSlot]?.position,
        holderAction: view?.fielders.find((fielder) => fielder.slot === play.ballHolderSlot)?.action,
      })
      scene = drawn.scene
      if (drawn.recordsLaserOut) laserOutFlag = true
      // 4412e — 레이저 단계 0: +0x19ad · +0x19ae = 0
      if (drawn.laserStepZero) laserFlags = { ...laserFlags, shining: false, confirmed: false }
      // 레이저 단계 1 — +0x1993 = 0
      if (drawn.unpaused) gamePaused = false
      // 44330 · 44564 — B · C 끝: 플레이+0x1f4 = 0
      if (drawn.flashEnded) laserArmed = false
      if (view !== undefined && (drawn.zoom !== null || drawn.bigOut !== null || drawn.judgeText !== null || drawn.flash !== null)) {
        ticks[ticks.length - 1] = {
          ...view,
          ...(drawn.zoom === null ? {} : { zoom: drawn.zoom }),
          ...(drawn.bigOut === null ? {} : { bigOut: drawn.bigOut }),
          ...(drawn.judgeText === null ? {} : { judgeText: drawn.judgeText }),
          ...(drawn.flash === null ? {} : { flash: drawn.flash }),
        }
      }
    }
    drawSceneEffects()
    // 관문 G3 · G4 · G1 은 다음 그림의 목록 틱(아래 이동) 앞 주자를 본다 (`playGate.gateRunnerViewsOf`)
    const runnersBeforeListTick = runnerStates()

    // 6 절은 다음 그림의 목록 틱(0x3f060)이다 — 이 틱에 멈췄으면 다음 그림도 멈춰 있어 없다(타구 진행기 nextFrame 과 같다)
    nextFrame: {
    if (pausedThisTick) break nextFrame
    // ── 6. 움직이기 ──
    const beforeMove = fielders
    fielders = fielders.map((fielder) => {
      // 목표: AI 1(b4aca 포구 지점 · r190) · AI 0(b476a 시작 자리 · r180)은 AI 고리가 고쳤다 — 여기서는 그 목표로 걷는다
      const target = fielder.target
      // 걸음: 다음 야수 틱의 이동 관문 a1346~a1376 — 0xa0f7c(+0xb0 바이트면 프레임 1 · 2 만) && vtc8(+0xb1 — 던진 뒤 한 틱) &&
      // +0xb4 ≤ 0 (`canStepNextListTick`). 걸음 a1376(0xbf094)은 AI · 공 쥠을 안 본다 — 쥔 야수도 목표로 마저 걷는다
      if (isSamePoint(fielder.position, target) || !canStepNextListTick(fielder)) return { ...fielder, target }
      return { ...fielder, target, position: stepToward(fielder.position, target, fielder.speed) }
    })
    // 야수 +0x3b — 이번 갱신에 목표점에 막 닿았나 (0xbf0dc). 다음 판 틱 3c 절 AI 2~5(b47f2)가 본다
    fielderArrivals = fielders.map(
      (fielder, slot) =>
        !isSamePoint(beforeMove[slot]?.position ?? fielder.position, fielder.target) && isSamePoint(fielder.position, fielder.target),
    )
    for (const runner of runners) {
      // 주자 +0x3b — 목록 틱마다 지우고(0xbf094 bf0a2) 막 닿은 갱신에서만 세운다. 다음 판 틱 2e 절 득점이 본다
      runner.arrivedThisListTick = false
      if (runner.state.isOut || runner.state.scored) continue
      // 주자 틱 a028c — 요구 루를 밟아 풀리기 전에는 그 너머로 못 간다 (`requiredBasePinOf`)
      const pinned = requiredBasePinOf(runner.state)
      if (pinned !== runner.state.targetBase) {
        runner.state = { ...runner.state, legStart: runner.state.position, targetBase: pinned, settled: false }
      }
      runner.state = {
        ...runner.state,
        position: stepToward(runner.state.position, basePosition(runner.state.targetBase), runner.state.speed),
      }
      if (!isAtTarget(runner.state) || runner.state.settled) continue
      // 0xa040c 도착 — +0x84 = +0x8c = +0x7c, 요구 루를 밟았으면 푼다
      const touched = runner.state.targetBase
      runner.previousTarget = touched
      runner.state = {
        ...runner.state,
        settled: true,
        startBase: touched,
        requiredBase: clearsRequirement({ ...runner.state, settled: true, startBase: touched })
          ? NONE
          : runner.state.requiredBase,
      }
      runner.arrivedThisListTick = true
    }
    }

    // ── 9. 판 진행 관문 0xb0d28 (`playGate.passPlayGateBetweenTicks`) — 이 틱 그리기 G3 · 0x3f378 G4 · 다음 틱 0x3f060 G1 · 슬롯 2 머리 G2 ──
    // 3아웃 · 처리 안 끝난 주자 · 아무도 안 쥠(종류 9 의 줍기 전 · 송구 중) → 이어 감, 공을 쥔 채 관문 51 번(+0x120 — 그림마다 3 번, 17 틱) → 닫음.
    // state[0xb] 는 이 판의 결과 코드(9 · 13)다. 낙구·담장 결과 코드(b44f6)는 이 판에 타구가 없어 안 선다.
    const gateRunners = gateRunnerViewsOf(runnersBeforeListTick, runnerStates())
    const gate = passPlayGateBetweenTicks(
      {
        foulFlag: false,
        lastEventCode: resultCode ?? 0,
        outs,
        someRunnerActive: someRunnerStillActive(gateRunners.frame, isAtTarget),
        homeRunDerby: false,
        homeRunFlag: false,
        poleHomeRunFlag: false,
        liveRunnerCount: liveRunnerCountOf(gateRunners.frame),
        ballHeld: play.held,
        groundRuleFlag: false,
        endCounter,
      },
      false,
      // 경기 멈춤(+0x1993) — 그리기 G3 뒤 0x3f378 · 0x3f060 · 슬롯 2 머리가 모두 건너뛴다
      gamePaused,
      // G2(슬롯 2 머리 52502) — 목록 틱(이동) 뒤 · 득점 0xaa0a8 앞
      {
        someRunnerActive: someRunnerStillActive(gateRunners.head, isAtTarget),
        liveRunnerCount: liveRunnerCountOf(gateRunners.head),
      },
    )
    endCounter = gate.endCounter
    counterBeforeHead = gate.counterBeforeHead
    if (!gate.open) play = { ...play, finished: true }
    // 닫힌 그림 다음의 G1 — 열렸으면 목록 틱 a1330 이 +0xcc 를 하나 더 줄인다(`fielderSlackAtPlayEnd`, r196)
    if (!gate.open) closingListTickOpen = gate.listTickOpen === true
    // G2 만 닫힌 그림 — 다음 그림의 목록 틱(이동 · 야수 준비 틱 줄이기)과 카메라는 돌고 슬롯 2 는 빠진 채 그려진다
    // (`DefenseViewState.closingListFrame`, 타구 진행기 10 절과 같다)
    if (!gate.open && gate.listTickOpen === true) {
      const listTickFielders = fielders.map(listTickFielder)
      ticks.push({ ...snapshotAt(tick + 1, listTickFielders), closingListFrame: true })
      // 그 그림도 그리기 0x46c88 이 관문을 안 보고 연출을 한 번 더 돌린다(타구 진행기 10 절)
      drawSceneEffects()
    }
  }

  const voidedRuns = outs > 2 ? held.heldRuns : 0
  return {
    kind: input.kind,
    resultCode,
    advance: { bases: basesOf(runners), runsScored: held.scoreboardRuns, outsAdded },
    ticks,
    catchFielderSlot: input.chase?.slot ?? input.play.ballHolderSlot,
    catchTick: input.chase !== undefined ? firstCatchTick : 0,
    isUncatchable: false,
    caughtOnTheFly: false,
    tagOut,
    throwBase: firstThrowBase,
    throwArrivalTick: firstThrowArrival,
    voidedRuns,
    fumbled,
    errantThrow,
    specialDefense: { jumpUnlocked: false, slideUnlocked: false },
    laserThrow,
    laserOutFlag,
    // 플레이 객체 +0xf0 은 다음 판으로 남는다(`DefenseScene.playCovers`, r171)
    // 야수 +0xcc 도 다음 판으로 남는다 — vt20(0) 판이 들고 연다(`DefenseScene.fielderSlack`, r196)
    // 판이 끝난 그대로의 플레이 · 야수 — 다음 도루 키 0x583 의 0xafa60 이 본다(`DefenseScene.playEnd`, r201)
    scene: {
      ...scene,
      playCovers: play.coverOfBase,
      fielderSlack: fielderSlackAtPlayEnd(fielders, closingListTickOpen),
      playEnd: playEndStateOf(play, fielders, closingListTickOpen),
    },
    rundowns: 0,
    rundownOuts: 0,
    runnerFates: runners.map((runner) => runnerFateOf(runner.state)),
    log,
  }
}

const wrapBase = (base: number) => ((base % 4) + 4) % 4

function isAtTarget(runner: RunnerState): boolean {
  return isSamePoint(runner.position, basePosition(runner.targetBase))
}

/** 다음 구간 시작 — 출발점(+0x14)과 닿은 루(+0x8c)를 새로 잡는다 (타구 진행기 `startLeg` 와 같다) */
function startLeg(runner: PlayRunner, toBase: number): void {
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

function basesOf(runners: readonly PlayRunner[]): BaseState {
  let bases = EMPTY_BASES
  for (const runner of runners) {
    if (runner.state.isOut || runner.state.scored) continue
    const base = wrapBase(runner.state.targetBase)
    if (base === 1) bases = { ...bases, first: true }
    if (base === 2) bases = { ...bases, second: true }
    if (base === 3) bases = { ...bases, third: true }
  }
  return bases
}

/** 슬라이딩 판정(0xa9690)이 보는 모양 — 타구 진행기 `slidingRunnerOf` 와 같다 (견제 진행기도 쓴다) */
export function slidingRunnerOf(runner: RunnerState): SlidingRunner {
  const target = basePosition(runner.targetBase)
  return {
    progressPercent: progressPercent(runner.legStart, runner.position, target),
    isOut: runner.isOut,
    isLeavingField: false,
    isSliding: runner.sliding,
    targetBase: runner.targetBase,
    ticksToArrive: ticksToReach(runner.position, target, runner.speed),
  }
}
