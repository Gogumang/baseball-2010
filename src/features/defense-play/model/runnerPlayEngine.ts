import type { RandomPort } from '@/shared/api/random/randomPort'
import { randomIntegerBelow } from '@/shared/lib/random/originalRandom'
import { autoSlideRunnerIndexes, SLIDING_SPEED_BONUS, type SlidingRunner } from '@/entities/defense-controls/model/sliding'
import {
  autoAdvanceDecisions,
  clearsRequirement,
  requiredBasePinOf,
  requiredBasesOnBounce,
} from '@/entities/fielding/model/autoAdvance'
import type { BattedBallTrajectory } from '@/entities/fielding/model/catchPrediction'
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
import { liveRunnerCountOf, passPlayGateBetweenTicks, someRunnerStillActive } from '@/entities/fielding/model/playGate'
import { planThrow, readyTicksOf, thrownWith, throwTicksTo } from '@/entities/fielding/model/throwPlan'
import { chooseThrowTargetBase, isSpecialThrow } from '@/entities/fielding/model/throwTargetBase'
import { EMPTY_BASES, type BaseState } from '@/entities/game/model/baseState'
import type { ManualAutoMode } from '@/entities/settings/model/gameSettings'
import { viewStateOf, type ActionMemory, type DefensePlayView } from '@/features/defense-play/model/defensePlayView'
import { drawDefenseScene, enterDefenseScene, type DefenseScene } from '@/features/defense-play/model/defenseScene'
import { postJudgeMessage } from '@/features/defense-play/model/laserPresentation'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import { cpuSpecialThrowOf } from '@/features/defense-play/model/runDefensePlay'
import { runnerFateOf } from '@/features/defense-play/model/runnerFates'
import {
  bounceOffFielder,
  chaseLooseBall,
  initialLooseBallChase,
  type LooseBallChase as ChasedBall,
} from '@/features/defense-play/model/looseBallChase'
import { forecastOptionsOf, launchThrow } from '@/features/defense-play/model/throwLaunch'

/**
 * **주자 판 진행기** — 타구가 없는 수비 판(플레이 종류 5 도루 · 9 폭투·포일)을 틱 단위로 돈다.
 *
 * 견제(`pickoffPlay`)와 같은 까닭으로 타구 진행기 `runDefensePlay` 와 따로 둔다 — 그쪽은
 * "목록 0번 = 결과 코드가 운명을 정한 타자주자" 를 전제로 짜여 있다. 이 판에는 결과 코드가 없고,
 * 모든 주자의 운명을 원본 판정(0xb36d0 · 0xb4292)이 정한다.
 *
 * ## 한 틱의 차례 (원본 장면 갱신 0x52c50 = 공용 갱신 0x3f060(야수·주자 틱) → 슬롯 2 0x524c0)
 * 0. 야수 틱 0xa1284 — 공 쥔 야수의 준비 틱 +0xc8 −= 1
 * 1. 포구 틱 갈래 0xb401c — 쫓는 공(종류 9 의 폭투 · 포일 공 · 송구공 · 튕긴 공)을 고른 야수가 포구 틱에: 펌블 굴림 b4224
 *    (늘 먹는다) → 움직이는 공이면 펌블(0xbc2 · 틱 끝 0xb3148 튕김) / 아니면 b4292 결과 9 검사 · 쥐기 0xb2710(P, f, 1) · vt90
 *    · 낙구 틱에 포스 요구 루 0xa95e8 (P2 2b: 0xb4510~0xb453c)
 * 3b. 사람 목표 +0x160 — 플레이 틱 vt4c 의 b4660~b46a8: 쥠 && 준비면 루로 보내기 `0xb2c90`, 그리고 −1
 * 4. 자동 추가 진루 0xaf918 (`0xae690` 갈림, 진루시키면 +0x128 = 1) · 자동 슬라이딩 0xb030c
 * 4c. CPU 송구 결정 `0xafa60 → 0xafb24` — `0xae6c8`(수비 CPU || 송구 자동)일 때 매 틱, +0x128 && 준비일 때만 고르고
 *    0xb2c90 이 성공하면 +0x128 = 0. 받은 야수도 준비 틱이 지나면 이어 던진다.
 *    사람 수비·수동 송구에서 키가 없으면 **던지지 않는다** — 0xb1c90 의 자동 가지에는 송구 호출이 없다.
 * 5. 그림 · 6. 움직이기 · 7. 아웃 판정 0xb36d0 → 아웃이 났으면 결과 메시지 0xbba 의 CPU 송구 결정 한 번
 *    (0x51d40~0x51db4, 사람 수비에서도) · 8. 2아웃 보류 득점 풀기 0xaa34c · 9. 판 진행 관문 0xb0d28
 *
 * ## 송구 — 타구 진행기와 같은 원본 길
 * 0xb2e38 → 0xa1620(악송구 · 긴 송구 흔들림 · 원바운드 갈래) · 세계 0xbfed0 · 받는 점 끼워 넣기 b2f9c(`launchThrow`) →
 * 예보 vt24(0) · 고르기 vt34(`chaseLooseBall`) — 받는 것도 줍는 것도 1 절 포구 틱 갈래다.
 *
 * ## 근사 (지어내지 않은 자리 — 견제 진행기와 같다)
 * - ⚠️ 움직이기·아웃 판정(5~7)은 원본에서 야수·주자 틱(0절 자리) 안이다 — 웹은 슬롯 2 뒤로 두었다(타구 진행기와 같다).
 *   그래서 고른 야수는 포구 틱에 포구 지점(x, 0, z)으로 옮겨 쥔다(타구 진행기와 같은 다리).
 * - ⚠️ 중계 이어 던지기(b4616)는 이 판에 없다 — 중계맨이 받으면 쥐기의 +0x128 로 CPU 송구 결정이 다시 고른다.
 * - 자동 추가 진루는 결과 코드가 선 뒤에도 판이 닫힐 때까지 매 틱 묻는다 — +0x111 은 "끝" 이 아니라 홈런 코드 8 이다
 *   (`playGate`). 판은 0xb0d28 대로 주자가 다 서고 공을 쥔 채 관문을 51 번 지나면(그림마다 3 번 — 17틱) 닫힌다.
 * - 사람 주루 키(0x582·0x584)·슬라이딩 키(0x585)·레이저(0x400bc)는 받지 않는다 — 미리 끝까지 돌려 재생만 한다.
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
export type RunnerPlayResultCode = (typeof RUNNER_PLAY_RESULT)[keyof typeof RUNNER_PLAY_RESULT]

/** (종류 9) 공을 쫓아 줍는 갈래 */
export interface LooseBallChase {
  readonly trajectory: BattedBallTrajectory
  /** 쫓는 야수 (+0x170) */
  readonly slot: number
  /** 포구 틱 (+0x174) */
  readonly catchTick: number
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
  /**
   * 사람이 고른 송구 목표 루 (+0x160). 판이 열릴 때 이미 골라 둔 키로 본다 —
   * 원본은 그 키로 한 번 던지면 `+0x160 = −1` 로 지운다(b46a8). 그래서 **첫 송구에만** 쓴다.
   */
  readonly manualThrowBase?: number
  readonly offenseIsCpu?: boolean
  readonly runningMode?: ManualAutoMode
  readonly maximumTicks?: number
  readonly aceIndexes?: readonly (number | null | undefined)[]
  readonly defenseTeamIndex?: number
  readonly offenseTeamIndex?: number
  /** 앞 판에서 넘어온 수비 장면 연출 칸 (`DefensePlayInput.scene`) — 이 판들(밀어내기 · 도루 · 폭투)은 투구 뒤라 +0x1997 · 애니가 되감겨 있다 */
  readonly scene?: DefenseScene
}

export interface RunnerPlayEngineResult extends DefensePlayResult {
  readonly kind: number
  /** 9 세이프 · 13 아웃 · null(결과 코드 없이 끝남 — 송구가 없었거나 악송구) */
  readonly resultCode: RunnerPlayResultCode | null
}

interface PlayRunner {
  state: RunnerState
  counted: boolean
}

/** 날아가는 송구 — 던진 야수 · 목표 루 · 손을 떠난 틱 (받는 틱 · 받는 야수는 쫓는 공 `LooseBallChase`) */
interface ThrowInFlight {
  readonly from: number
  readonly base: number
  readonly releaseTick: number
}

export function runRunnerPlay(input: RunnerPlayEngineInput): RunnerPlayEngineResult {
  const abilities = input.abilities
  const maximumTicks = input.maximumTicks ?? DEFAULT_MAXIMUM_TICKS
  const autoBaserunningEnabled = input.offenseIsCpu === true || (input.runningMode ?? '자동') !== '수동'
  const cpuThrowEnabled = input.defenseIsCpu === true || (input.throwMode ?? '수동') !== '수동'
  const manualThrowBase = input.manualThrowBase ?? NONE
  const log: string[] = []
  const ticks: DefensePlayView[] = []
  const previousActions: ActionMemory = new Map<string, { action: number; since: number }>()

  let fielders = input.fielders
  let play: PlayView = { ...input.play, manualThrowBase }
  const runners: PlayRunner[] = input.runners.map((state) => ({ state, counted: false }))
  let outs = input.outs
  let outsAdded = 0
  let held: HeldRunState = EMPTY_HELD_RUNS
  let ballOnGround = input.ballOnGround
  let tagOut = false
  let resultCode: RunnerPlayResultCode | null = null
  /** 쫓는 공 — 종류 9 의 폭투 · 포일 공(0xb284a), 송구공(b307c), 튕긴 공(0xb3148). 쥐면 null */
  let chase: ChasedBall | null =
    input.chase === undefined ? null : initialLooseBallChase(input.chase.trajectory, input.chase.slot, input.chase.catchTick)
  /** 처음 공을 쥔 틱 (종류 9) */
  let firstCatchTick = -1
  let fumbled = false
  let errantThrow = false
  let firstThrowBase = NONE
  let firstThrowArrival = -1
  /** 지금 날아가는 송구 — 자동 슬라이딩 · 그림이 본다 */
  // (닫힘 안에서 바뀌어 흐름 좁히기가 못 따라간다 — 넓은 꼴로 둔다)
  let flight = null as ThrowInFlight | null
  /** 공 객체 칸 — 다음 쏘기가 이어 받는다 */
  let ballBody = chase?.body
  /** sp+0x24 — 이번 틱 포구 틱의 사건(펌블 0xbc2). 서면 틱 끝 b45a4 가 0xb3148 */
  let ballEventThisTick = false
  /** 사람 목표 +0x160 이 아직 안 쓰였나 — 공 가진 야수가 준비되면 한 번 보고 −1 (b46a4) */
  let manualPending = manualThrowBase !== NONE
  /** 이번 틱에 0xb36d0 이 아웃을 냈나 — 결과 코드 13 → 메시지 0xbba */
  let outJudgedThisTick = false
  /** 이번 틱 플레이 틱이 보낼 결과 메시지 0xbba 의 코드 — 포구 b4292 의 9 를 b4540 의 13 이 덮는다(b4562 에서 한 번) */
  let tickMessageCode = 0
  /** 수비 장면 연출 칸 — 0x17 진입 0x46418 이 결과 판 타이머를 −1 로 (`defenseScene`) */
  let scene = enterDefenseScene(input.scene, true)
  /** state[0x8b] — 결과 판 큰 OUT 이 +0x1999 를 보고 세운다 */
  let laserOutFlag = false
  /** 플레이 +0x120 — 판 진행 관문 0xb0d28 의 판 끝 세기 */
  let endCounter = 0
  /** +0x15c · +0x158 — 0xb2e38 이 미룬 송구(AI 9)의 받을 야수 · 목표 루 */
  let deferredThrowReceiver = NONE
  let deferredThrowBase = NONE

  const runnerStates = () => runners.map((runner) => runner.state)
  /** 공 쥔 야수 vtC4 = 0xa20ec — +0xc8(준비 틱)이 다 줄었나. 쥐기 0xb2710(P, f, 1)이 넣고 야수 틱 0xa1284 가 줄인다 */
  const isHolderReady = (): boolean => {
    const holder = fielders[play.ballHolderSlot]
    return play.held && holder !== undefined && holder.holdingBall && holder.actionRemainingTicks <= 0
  }
  const batterRunnerOf = () => (runners[0]?.state.isBatterRunner === true ? runners[0].state : undefined)
  const contextAt = (tick: number): DefenseContext => ({
    play,
    fielders,
    runners: runnerStates(),
    currentTick: tick,
    landingTick: input.chase?.trajectory.landingTick ?? 0,
  })

  /** 0xb36d0 한 번 — 원본처럼 모든 주자를 본다(타자주자 제외 없음) */
  const runOutJudgement = (tick: number): void => {
    if (play.finished) return
    const judged = judgeOut(contextAt(tick))
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
    // 0xb2710: +0x128 = 1 · +0x130 = f · +0x12c = 1 · +0x112 = 1 · state[0x1e] = 1
    play = { ...play, ballHolderSlot: slot, held: true, everHeld: true, wantsThrow: true }
    ballOnGround = true
    runOutJudgement(tick)
  }

  /**
   * 루로 보내기 0xb2c90(P, 루, 특수) — 성공(1)이면 참 (`runDefensePlay` 의 `sendToBase` 와 같은 갈래).
   * 커버 없음 → 공 가진 야수가 들고 뛴다(0) · 커버 목표 루 ≠ 루(0) · 직접 밟는 게 빠름(1) · 600 이하 · 자기 자신(0) ·
   * 그 밖에는 송구 0xb2e38 → 0xa1620(악송구 굴림 0xa1828)(1).
   */
  const sendToBase = (tick: number, base: number, byHuman: boolean | '미룬', cpuSpecial: boolean): boolean => {
    const holderSlot = play.ballHolderSlot
    const holder = fielders[holderSlot]
    if (holder === undefined) return false
    const coverSlot = play.coverOfBase[wrapBase(base)] ?? NONE
    const basePoint = basePosition(base)
    if (coverSlot === NONE) {
      // 커버가 없으면 공 가진 야수가 직접 들고 뛴다 (상태 6, vt48(루))
      fielders = fielders.map((fielder) =>
        fielder.slot === holderSlot ? { ...fielder, target: basePoint, targetBase: base } : fielder,
      )
      log.push(`${tick}틱 ${holderSlot}번 야수가 ${base}루로 공을 들고 뛴다 (커버 없음)`)
      return false
    }
    const cover = fielders[coverSlot]
    if (cover.targetBase !== base) return false
    const runTicks = ticksToReach(holder.position, basePoint, holder.speed)
    const throwTicks = throwTicksTo(holder, cover.target)
    const receiveTicks = fielderArrivalTicks(cover)
    if (runTicks <= Math.max(throwTicks, receiveTicks)) {
      // 직접 밟으러 간다 (0xb2a48) — 커버가 자기 자신인 홈 도루의 포수도 이 갈래다
      fielders = fielders.map((fielder) =>
        fielder.slot === holderSlot ? { ...fielder, target: basePoint, targetBase: base } : fielder,
      )
      log.push(`${tick}틱 ${holderSlot}번 야수가 ${base}루를 직접 밟으러 간다`)
      return true
    }
    if (coverSlot === holderSlot || horizontalDistance(holder.position, cover.position) <= MINIMUM_THROW_DISTANCE) {
      return false
    }

    // ── 송구 0xb2e38 → 0xa1620 (악송구 굴림 0xa1828) ──
    // b2e44: vtC4(준비) — 던진 야수는 0xa1620 끝의 +0xb1 잠금으로 못 던진다(공을 안 쥔 야수는 못 던지는 것으로 본다,
    // `runDefensePlay` 의 throwBall 과 같은 근사)
    if (!holder.holdingBall || holder.actionRemainingTicks > 0) return false
    // b2eb2~b30d6: 받는 야수가 목표점에 없고 1구간 틱(계획 [5]) 안에 못 닿으면 미룬다 — AI 9 · vt48(루)
    const plan = planThrow({ fielders, fromSlot: holderSlot, finalSlot: coverSlot, base, special: cpuSpecial })
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
          ? { ...fielder, aiState: AI_STATE.RECEIVE, target: basePosition(plan.base), targetBase: wrapBase(plan.base) }
          : fielder,
      )
      log.push(`${tick}틱 ${holderSlot}번 야수가 ${plan.base}루 송구를 미룬다 — ${plan.toSlot}번 야수가 늦다 (AI 9)`)
      return true
    }
    const special = cpuSpecial ? cpuSpecialThrowOf(fielders, holderSlot, coverSlot) : null
    const isSpecial = special !== null && special.special
    // a16dc~a16ec: +0xdc = 특수 ? +0xd8 : +0xd4 — 던질 때 덮어쓰고 그 판 동안 남는다
    fielders = fielders.map((fielder) => (fielder.slot === holderSlot ? thrownWith(fielder, isSpecial) : fielder))
    // 0xa1620 — 원바운드(a17fc) · 악송구(a1828) · 긴 송구 흔들림(a198c) 갈래와 세계 0xbfed0 · 받는 점 끼워 넣기(b2f9c).
    // 공은 계획 [3](중계면 중계맨)의 목표점으로 간다(b2f52)
    const thrown = launchThrow({
      thrower: fielders[holderSlot],
      target: fielders[plan.toSlot]?.target ?? basePosition(base),
      special: isSpecial,
      bounce: isSpecial && special.bounce,
      ability: abilities[holderSlot] ?? DEFAULT_ABILITY,
      random: input.random,
      body: ballBody,
    })
    if (thrown.errant) errantThrow = true
    // b307c vt24(0) · vt34 — 받을(주울) 야수 · 포구 틱. 예보는 던진 야수가 손을 떠나기 전 칸으로 본다(b2f80 뒤지만 위치 · 목표는 같다)
    takeLooseBall(chaseLooseBall(thrown.ball, tick, fielders, forecastOptionsOf(thrown, holderSlot, coverSlot), maximumTicks))
    flight = { from: holderSlot, base, releaseTick: tick }
    if (firstThrowBase === NONE) {
      firstThrowBase = base
      firstThrowArrival = chase?.catchTick ?? tick
    }
    // 던지면 손을 떠난다(b2f80 · b3070) — 준비 틱(+0xc8)도 썼다.
    // 0xb2c90 b2df8~b2e14: 던진 야수가 커버(AI 2~5)도 AI 9 도 아니면 AI 0 — 시작 자리 0xd86ec 로 돌아간다(b476a)
    fielders = fielders.map((fielder) => {
      if (fielder.slot !== holderSlot) return fielder
      const released = { ...fielder, holdingBall: false, actionRemainingTicks: 0 }
      const keeps =
        (fielder.aiState >= AI_STATE.COVER_HOME && fielder.aiState <= AI_STATE.COVER_THIRD) ||
        fielder.aiState === AI_STATE.RECEIVE
      return keeps
        ? released
        : { ...released, aiState: AI_STATE.IDLE, target: FIELDER_START_POSITIONS[holderSlot] ?? fielder.target, targetBase: NONE }
    })
    log.push(
      `${tick}틱 ${holderSlot}번 야수가 ${base}루로 송구 — ${chase?.catchTick ?? tick}틱 도착` +
        (cpuSpecial ? ' (특수)' : '') +
        (thrown.bounce ? ' (원바운드)' : '') +
        (thrown.errant ? ' (악송구)' : thrown.wobbled ? ' (흔들린 긴 송구)' : '') +
        (chase !== null && chase.slot !== coverSlot ? ` (${chase.slot}번 야수가 줍는다)` : '') +
        (byHuman === '미룬' ? ' (AI 9 미룬 송구)' : byHuman ? '' : ' (CPU 결정)'),
    )
    return true
  }

  /**
   * 새로 깐 공을 쫓게 한다 — 고르기 0xb3b38: AI 1 · 0xc 인 야수는 AI 0 으로, 고른 야수(+0x130)는 AI 1 · 목표 = 포구 지점(x, 0, z).
   * 공은 아무도 안 쥔다(b2f80 · b3070 · 0xb3148).
   */
  const takeLooseBall = (next: ChasedBall): void => {
    chase = next
    ballBody = next.body
    fielders = fielders.map((fielder) =>
      fielder.slot === next.slot
        ? { ...fielder, target: next.catchPoint, aiState: AI_STATE.CHASE, holdingBall: false }
        : fielder.aiState === AI_STATE.CHASE || fielder.aiState === AI_STATE.BACKUP
          ? { ...fielder, aiState: AI_STATE.IDLE, holdingBall: false }
          : fielder.holdingBall
            ? { ...fielder, holdingBall: false }
            : fielder,
    )
    play = { ...play, held: false, ballHolderSlot: next.slot, catchFielderSlot: next.slot, catchTick: next.catchTick }
  }

  /**
   * CPU 송구 결정 0xafa60 — +0x128 이 서 있고 공 가진 야수가 준비(vtC4)됐을 때만 점수식 0xafb24 로 고른다.
   * 홈이면 20% 특수 굴림(`afad2`, 0xb2c90 이 실패해도 먹는다), 0xb2c90 이 성공하면 +0x128 = 0.
   */
  const cpuThrowDecision = (tick: number): void => {
    if (!play.wantsThrow || !isHolderReady()) return
    // afa6c~afab8: 공 가진 야수가 AI 8 · 9 면 안 고른다
    if (fielders[play.ballHolderSlot]?.aiState === AI_STATE.RECEIVE) return
    const active = runners.filter((runner) => !runner.state.isOut && !runner.state.scored).length
    const base = chooseThrowTargetBase({ ...contextAt(tick), activeRunnerCount: active, outs })
    if (base === NONE) return
    const cpuSpecial =
      base === 0 && input.random !== undefined && isSpecialThrow(base, randomIntegerBelow(input.random, 0, 100))
    if (sendToBase(tick, base, false, cpuSpecial)) play = { ...play, wantsThrow: false }
  }

  for (let tick = 0; tick <= maximumTicks && !play.finished; tick += 1) {
    outJudgedThisTick = false
    tickMessageCode = 0
    // ── 0. 야수 틱 0xa1284 — 공용 갱신 0x3f060 이 슬롯 2(0x524c0)보다 먼저 돈다. 쥔 동안 +0xc8 −= 1 (타구 진행기 0' 절) ──
    fielders = fielders.map((fielder) =>
      fielder.holdingBall && fielder.actionRemainingTicks > 0
        ? { ...fielder, actionRemainingTicks: fielder.actionRemainingTicks - 1 }
        : fielder,
    )
    ballEventThisTick = false
    // ── 1. 포구 틱 갈래 0xb401c — 쫓는 공을 고른 야수가 포구 틱(+0x174)에 ──
    // ```
    // b4224  r4 = 펌블표[등급] > rand(0, 10000)       ; 늘 먹는다
    // b4236  멈춤 = 공.vt18() ; r4 && !멈춤 → 야수+0xb8 = 6 · 메시지 0xbc2 · 사건 sp+0x24 = 1 (쥐지 않음)
    // b4292  아니면 b = 야수.vt58()(발밑 루) ; b ≠ −1 && 0xa97a0(b)(그 루에 마지막으로 닿은 산 주자).vt18() → 결과 코드 9
    // b42c8  쥐기 0xb2710(P, f, 1) — +0x128 · +0x130 · +0x12c · +0x112 · 준비 틱(내야 3 · 외야 6) · vt90
    // ```
    const current = chase
    if (current !== null && !play.held && tick === current.catchTick) {
      const ballIsMoving =
        current.trajectory.isStoppedAt === undefined
          ? tick < current.trajectory.length - 1
          : !current.trajectory.isStoppedAt(tick)
      if (input.random !== undefined && rollFumble(abilities[current.slot] ?? DEFAULT_ABILITY, ballIsMoving, input.random)) {
        fumbled = true
        ballEventThisTick = true
        log.push(`${tick}틱 ${current.slot}번 야수 펌블 (0xbc2)`)
      } else {
        chase = null
        flight = null
        if (firstCatchTick < 0) firstCatchTick = tick
        // 웹 다리: 야수 이동이 슬롯 2 뒤라 포구 틱에 포구 지점(AI 1 목표)으로 옮겨 쥔다
        fielders = fielders.map((fielder) =>
          fielder.slot === current.slot ? { ...fielder, position: current.catchPoint, target: current.catchPoint } : fielder,
        )
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
    // 낙구 0xb4492~0xb453c — +0x112(쥐었거나 땅에 닿음)가 아직이면 state[0x1e] = 1 · 포스 요구 루 0xa95e8.
    // 사건(펌블)만 있는 틱도 b44f8 이 포스를 세운다
    if (!ballOnGround && chase !== null && (tick === chase.trajectory.landingTick || ballEventThisTick)) {
      if (!ballEventThisTick) ballOnGround = true
      const required = requiredBasesOnBounce(runnerStates())
      runners.forEach((runner, index) => {
        runner.state = { ...runner.state, requiredBase: required[index] ?? runner.state.requiredBase }
      })
    }

    // ── 3b. 사람 목표 +0x160 — 플레이 틱 vt4c 의 b4660~b46a8: 쥠 && 준비(vtC4) 이면 발밑 루가 아닐 때 vt58, 그리고 −1 ──
    if (!play.finished && manualPending && isHolderReady()) {
      manualPending = false
      play = { ...play, manualThrowBase: NONE }
      if (!isSamePoint(fielders[play.ballHolderSlot].position, basePosition(manualThrowBase))) {
        sendToBase(tick, manualThrowBase, true, false)
      }
    }

    // ── 3c. AI 9 — 미룬 송구 (b4838): 받을 야수.vtc0() ≤ 공 가진 야수.vtb8(루 좌표) 가 되면 0xb2c90(루, 0), 참이면 AI 0 ──
    if (!play.finished && deferredThrowReceiver !== NONE) {
      for (let slot = 0; slot < fielders.length; slot += 1) {
        if (fielders[slot]?.aiState !== AI_STATE.RECEIVE) continue
        const receiver = fielders[deferredThrowReceiver]
        const holder = fielders[play.ballHolderSlot]
        if (receiver === undefined || holder === undefined) continue
        if (fielderArrivalTicks(receiver) > throwTicksTo(holder, basePosition(deferredThrowBase))) continue
        if (sendToBase(tick, deferredThrowBase, '미룬', false)) {
          fielders = fielders.map((fielder) =>
            fielder.slot === slot
              ? { ...fielder, aiState: AI_STATE.IDLE, target: FIELDER_START_POSITIONS[slot] ?? fielder.target, targetBase: NONE }
              : fielder,
          )
        }
      }
    }

    // ── 4. 자동 추가 진루 0xaf918 · 자동 슬라이딩 0xb030c ──
    // 결과 코드(9·13)가 선 뒤에도 돈다 — 슬롯 2 의 52660 은 판 진행 관문 0xb0d28 이 열려 있으면 매 틱 부르고 결과 코드를 안 본다
    if (!play.finished && autoBaserunningEnabled) {
      const decisions = autoAdvanceDecisions({ ...contextAt(tick), force: true })
      for (const decision of decisions) {
        const runner = runners.find((candidate) => candidate.state.index === decision.runnerIndex)
        if (runner === undefined || runner.state.isOut || runner.state.scored) continue
        if (decision.toBase > HOME_BASE) continue
        // 타구 진행기와 같은 근사 — 목표 루에 닿아 있을 때만 묻는다
        if (!isAtTarget(runner.state)) continue
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
    }

    // ── 4c. CPU 송구 결정 0xafa60 (슬롯 2 의 526ae, 매 틱 — `0xae6c8` = 수비 CPU || 송구 설정 자동) ──
    if (!play.finished && cpuThrowEnabled) cpuThrowDecision(tick)

    // ── 5. 그림 ──
    ticks.push(
      viewStateOf({
        tick,
        ball:
          chase !== null
            ? chase.trajectory.pointAt(tick)
            : (input.restingBall ?? fielders[play.ballHolderSlot]?.position ?? basePosition(0)),
        ballIsFlying: chase !== null,
        fielders,
        runners: runnerStates(),
        catchKind: null,
        chaserSlot: chase?.slot ?? play.ballHolderSlot,
        throwingSlot: flight !== null && tick < flight.releaseTick + 3 ? flight.from : NONE,
        throwBase: flight?.base ?? NONE,
        previousActions,
        aceIndexes: input.aceIndexes,
        defenseTeamIndex: input.defenseTeamIndex,
        offenseTeamIndex: input.offenseTeamIndex,
      }),
    )

    // ── 6. 움직이기 ──
    const chasing = chase
    fielders = fielders.map((fielder) => {
      // AI 1(0xb4aca~0xb4afe) — 고른 야수는 쥐기 전까지 포구 지점(x, 0, z)으로
      if (chasing !== null && fielder.slot === chasing.slot) {
        const goal = chasing.catchPoint
        return { ...fielder, target: goal, position: stepToward(fielder.position, goal, fielder.speed) }
      }
      if (isSamePoint(fielder.position, fielder.target)) return fielder
      return { ...fielder, position: stepToward(fielder.position, fielder.target, fielder.speed) }
    })
    for (const runner of runners) {
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
      // 0xa040c 도착 — +0x8c = +0x7c, 요구 루를 밟았으면 푼다
      const touched = runner.state.targetBase
      runner.state = {
        ...runner.state,
        settled: true,
        startBase: touched,
        requiredBase: clearsRequirement({ ...runner.state, settled: true, startBase: touched })
          ? NONE
          : runner.state.requiredBase,
      }
      if (wrapBase(touched) === 0 && touched !== 0 && !runner.counted) {
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
    }

    // ── 7. 틱 갱신 뒤 아웃 판정 (0xb43da) ──
    runOutJudgement(tick)

    // ── 7b. 아웃이 난 틱 끝 — 결과 메시지 0xbba(13) → 0x51d40~0x51db4 → 0xafa60 한 번 ──
    // 수비 조작이 사람이든 CPU 든 `아웃 ≤ 2` 면 플레이+0x128 = 1 로 세우고 CPU 송구 결정을 부른다
    // (`runDefensePlay` 의 6c 절에 근거). 공 쥔 야수가 준비(vtC4)돼 있어야 던진다 — 송구를 받는 틱의 아웃은
    // 쥐기가 준비 틱을 막 넣어 못 던진다.
    if (outJudgedThisTick && outs <= 2 && !play.finished) {
      play = { ...play, wantsThrow: true }
      cpuThrowDecision(tick)
    }

    // ── 결과 메시지 0xbba(b4562) → 51a56 결과 판 칸 · 그리고 이 그림의 수비 화면 그리기 0x46c88 의 연출 몫 (`defenseScene`) ──
    if (outJudgedThisTick) tickMessageCode = 13
    if (tickMessageCode !== 0) scene = { ...scene, popup: postJudgeMessage(scene.popup, tickMessageCode, play.ballHolderSlot) }
    {
      const view = ticks[ticks.length - 1]
      const drawn = drawDefenseScene(scene, {
        holderSlot: play.ballHolderSlot,
        holder: fielders[play.ballHolderSlot]?.position,
        holderAction: view?.fielders.find((fielder) => fielder.slot === play.ballHolderSlot)?.action,
      })
      scene = drawn.scene
      if (drawn.recordsLaserOut) laserOutFlag = true
      // ⚠️ 이 판은 레이저 발사 · 경기 멈춤(+0x1993)을 안 옮겼다 — 앞 판에서 이어진 연출이 내리는 칸(unpaused · flashEnded)은 볼 것이 없다
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

    // ── 7c. 틱 끝 b45a0 — 사건(펌블)이 있었으면 플레이.vt70 = 0xb3148: 공을 그 야수에게서 튕겨 다시 쏘고 vt24(1) · vt34 ──
    const fumbledBall = chase
    if (ballEventThisTick && fumbledBall !== null && !play.finished) {
      const holder = fielders[fumbledBall.slot]
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

    // ── 8. 보류 득점 풀기 (0xaa34c) — aa364 의 "진행 중인 주자" 도 0xaa05c(+0x94 항까지) ──
    const stillActive = someRunnerStillActive(runnerStates(), isAtTarget)
    held = releaseHeldRuns(held, {
      outs,
      ballOnGround,
      batterRunner: batterRunnerOf(),
      someRunnerStillActive: stillActive,
    })

    // ── 9. 판 진행 관문 0xb0d28 (`playGate.passPlayGateBetweenTicks`) — 이 틱 그리기 G3 · 0x3f378 G4 · 다음 틱 0x3f060 G1 · 슬롯 2 머리 G2 ──
    // 3아웃 · 처리 안 끝난 주자 · 아무도 안 쥠(종류 9 의 줍기 전 · 송구 중) → 이어 감, 공을 쥔 채 관문 51 번(+0x120 — 그림마다 3 번, 17 틱) → 닫음.
    // state[0xb] 는 이 판의 결과 코드(9 · 13)다. 낙구·담장 결과 코드(b44f6)는 이 판에 타구가 없어 안 선다.
    const gate = passPlayGateBetweenTicks({
      foulFlag: false,
      lastEventCode: resultCode ?? 0,
      outs,
      someRunnerActive: stillActive,
      homeRunDerby: false,
      homeRunFlag: false,
      poleHomeRunFlag: false,
      liveRunnerCount: liveRunnerCountOf(runnerStates()),
      ballHeld: play.held,
      groundRuleFlag: false,
      endCounter,
    })
    endCounter = gate.endCounter
    if (!gate.open) play = { ...play, finished: true }
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
    laserThrow: false,
    laserOutFlag,
    scene,
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

/** 슬라이딩 판정(0xa9690)이 보는 모양 — 타구 진행기 `slidingRunnerOf` 와 같다 */
function slidingRunnerOf(runner: RunnerState): SlidingRunner {
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
