import type { RandomPort } from '@/shared/api/random/randomPort'
import { randomIntegerBelow } from '@/shared/lib/random/originalRandom'
import { autoSlideRunnerIndexes, SLIDING_SPEED_BONUS, type SlidingRunner } from '@/entities/defense-controls/model/sliding'
import {
  autoAdvanceDecisions,
  clearsRequirement,
  requiredBasesOnBounce,
} from '@/entities/fielding/model/autoAdvance'
import type { BattedBallTrajectory } from '@/entities/fielding/model/catchPrediction'
import {
  MINIMUM_THROW_SPEED,
  NO_THROW_ERROR,
  rollFumble,
  rollThrowError,
} from '@/entities/fielding/model/fieldingErrors'
import {
  basePosition,
  horizontalDistance,
  isSamePoint,
  progressPercent,
  stepToward,
  ticksToReach,
  type WorldPoint,
} from '@/entities/fielding/model/fieldGeometry'
import {
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
import { judgeOut, OUT_KIND, releaseForcesAfterOut } from '@/entities/fielding/model/outJudgement'
import { defenseArrivalTicks } from '@/entities/fielding/model/throwArrival'
import { effectiveThrowSpeedOf, readyTicksOf, throwTicksTo } from '@/entities/fielding/model/throwPlan'
import { chooseThrowTargetBase, isSpecialThrow } from '@/entities/fielding/model/throwTargetBase'
import { EMPTY_BASES, type BaseState } from '@/entities/game/model/baseState'
import type { ManualAutoMode } from '@/entities/settings/model/gameSettings'
import { viewStateOf, type ActionMemory, type DefensePlayView } from '@/features/defense-play/model/defensePlayView'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import { cpuSpecialThrowOf, specialThrowArrivalTicks } from '@/features/defense-play/model/runDefensePlay'
import { runnerFateOf } from '@/features/defense-play/model/runnerFates'

/**
 * **주자 판 진행기** — 타구가 없는 수비 판(플레이 종류 5 도루 · 9 폭투·포일)을 틱 단위로 돈다.
 *
 * 견제(`pickoffPlay`)와 같은 까닭으로 타구 진행기 `runDefensePlay` 와 따로 둔다 — 그쪽은
 * "목록 0번 = 결과 코드가 운명을 정한 타자주자" 를 전제로 짜여 있다. 이 판에는 결과 코드가 없고,
 * 모든 주자의 운명을 원본 판정(0xb36d0 · 0xb4292)이 정한다.
 *
 * ## 한 틱의 차례 (원본 경기 장면 슬롯 2 = 0x524c0 · 플레이 틱 — 견제 진행기와 같은 근사 순서)
 * 1. (종류 9) 쫓는 야수가 포구 틱에 공을 쥔다 — 펌블 굴림 0xb41d0 → 공 쥐기 0xb2710(P, f, 1)
 *    · 낙구 틱에 포스 요구 루 0xa95e8 (P2 2b: 0xb4510~0xb453c)
 * 2. 공 쥔 야수의 송구 판단 — 사람 목표 +0x160(플레이 틱 0xb45dc 의 b4660~b46a8, 쓰고 나면 −1) 또는 CPU 송구
 *    결정 `0xafa60 → 0xafb24` (`0xae6c8` 갈림, `runDefensePlay` 의 `throwMode` 주석) → 루로 보내기 `0xb2c90`.
 *    사람 수비·수동 송구에서 키가 없으면 **던지지 않는다** — 0xb1c90 의 자동 가지에는 송구 호출이 없다.
 * 3. 송구 도착 = 받는 야수가 루 위에서 쥔다(0xb2710) → 아웃 판정 0xb36d0 → 결과 9(0xb4292)
 * 4. 자동 추가 진루 0xaf918 (`0xae690` 갈림) · 자동 슬라이딩 0xb030c
 * 5. 그림 · 6. 움직이기 · 7. 아웃 판정 0xb36d0 → 아웃이 났으면 결과 메시지 0xbba 의 CPU 송구 결정 한 번
 *    (0x51d40~0x51db4, 사람 수비에서도) · 8. 2아웃 보류 득점 풀기 0xaa34c · 9. 끝났나
 *
 * ## 근사 (지어내지 않은 자리 — 견제 진행기와 같다)
 * - ⚠️ 송구 도착 틱은 `defenseArrivalTicks`(0xaf284) 근사다 — 원본은 궤적 물리(0xb401c, 해독 금지 구역).
 *   커버가 루를 밟기 전에 공이 닿으면 커버가 루를 밟는 틱까지 포구를 미룬다 (`pickoffPlay` 와 같다).
 * - ⚠️ 송구 판단은 **새로 공을 쥔 야수마다 한 번** 한다. 원본 0xb1c90 은 매 틱 돈다 — 웹 타구 진행기와 같은 근사.
 * - ⚠️ 악송구 뒤 공 경로·주자 반응은 미해결 — "그 송구는 아무도 못 받는다" 로 둔다(타구 진행기와 같다).
 * - ⚠️ 자동 추가 진루는 결과 코드가 서기 전까지만 묻는다 (`pickoffPlay` 와 같다 — 끝 표시 +0x111 을
 *   세우는 자리를 안 읽어서, 결과가 선 뒤 주자가 더 뛰는지 알 수 없다).
 * - 사람 주루 키(0x582·0x584)·슬라이딩 키(0x585)·레이저(0x400bc)는 받지 않는다 — 미리 끝까지 돌려 재생만 한다.
 */

/** 진행기가 이 틱을 넘기면 끊는다 — 우리 쪽 안전망 (타구 진행기 240 과 같다) */
const DEFAULT_MAXIMUM_TICKS = 240
/** 능력치를 안 주면 쓰는 값 — 원본 평균대(등급 3) */
const DEFAULT_ABILITY = 500
const HOME_BASE = 4
/** 펌블 뒤 동작 잠금 틱 — 야수+0xb4 = 15 (타구 진행기 `FUMBLE_LOCK_TICKS` 와 같다) */
const FUMBLE_LOCK_TICKS = 15
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

interface ThrowInFlight {
  readonly from: number
  readonly base: number
  readonly releaseTick: number
  readonly arrivalTick: number
  /** 받을 야수. 악송구면 −1 */
  readonly receiver: number
}

export function runRunnerPlay(input: RunnerPlayEngineInput): RunnerPlayEngineResult {
  const abilities = input.abilities
  const maximumTicks = input.maximumTicks ?? DEFAULT_MAXIMUM_TICKS
  const autoBaserunningEnabled = input.offenseIsCpu === true || (input.runningMode ?? '자동') !== '수동'
  const cpuThrowEnabled = input.defenseIsCpu === true || (input.throwMode ?? '수동') !== '수동'
  const manualThrowBase = input.manualThrowBase ?? NONE
  const chase = input.chase
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
  let catchTick = chase?.catchTick ?? 0
  let caught = chase === undefined
  let fumbled = false
  let errantThrow = false
  let firstThrowBase = NONE
  let firstThrowArrival = -1
  const throwState: { flight: ThrowInFlight | null } = { flight: null }
  /** 송구 판단을 이미 한 야수 — 새로 공을 쥔 야수만 다시 본다 (근사, 머리말) */
  let decidedHolder = NONE
  /** 사람 목표 +0x160 이 아직 안 쓰였나 — 쓰면 −1 (b46a8) */
  let manualPending = manualThrowBase !== NONE
  /** 공 쥔 야수가 준비되는 틱 — 쥐기 0xb2710(P, f, 1)이 +0xc8 에 넣은 준비 틱이 다 지나는 때 */
  let holderReadyTick = 0
  /** 이번 틱에 0xb36d0 이 아웃을 냈나 — 결과 코드 13 → 메시지 0xbba */
  let outJudgedThisTick = false
  /** 악송구로 공이 빠졌다 — 더는 아무도 쥐지 않는다 (근사) */
  let ballLost = false

  const runnerStates = () => runners.map((runner) => runner.state)
  const batterRunnerOf = () => (runners[0]?.state.isBatterRunner === true ? runners[0].state : undefined)
  const contextAt = (tick: number): DefenseContext => ({
    play,
    fielders,
    runners: runnerStates(),
    currentTick: tick,
    landingTick: chase?.trajectory.landingTick ?? 0,
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
    play = { ...play, ballHolderSlot: slot, held: true, everHeld: true }
    ballOnGround = true
    holderReadyTick = tick + (extra.actionRemainingTicks ?? fielders[slot]?.actionRemainingTicks ?? 0)
    runOutJudgement(tick)
  }

  /**
   * 송구 판단 — 사람 목표 +0x160(b4660, 한 번 쓰면 −1) 또는 0xafa60→0xafb24, 그리고 루로 보내기 0xb2c90.
   * `forceCpu` 는 결과 메시지 0xbba 가 부르는 0xafa60 한 번(사람 수동 송구에서도 돈다).
   * 사람 수비·수동 송구에서 키가 없으면 아무것도 안 한다 — 0xb1c90 자동 가지에는 송구 호출이 없다(c8649a3).
   */
  const decideThrow = (tick: number, forceCpu = false): void => {
    const holderSlot = play.ballHolderSlot
    const holder = fielders[holderSlot]
    if (holder === undefined) return
    decidedHolder = holderSlot
    const active = runners.filter((runner) => !runner.state.isOut && !runner.state.scored).length
    const byHuman = !forceCpu && manualPending
    if (byHuman) manualPending = false
    const base = byHuman
      ? manualThrowBase
      : forceCpu || cpuThrowEnabled
        ? chooseThrowTargetBase({ ...contextAt(tick), activeRunnerCount: active, outs })
        : NONE
    if (base === NONE) return
    // CPU 홈 송구 20% 특수 송구 (0xafa60 `afad2`) — 점수식이 홈을 골랐을 때만 한 번 굴린다
    const cpuSpecial =
      !byHuman &&
      base === 0 &&
      input.random !== undefined &&
      isSpecialThrow(base, randomIntegerBelow(input.random, 0, 100))

    // ── 0xb2c90(P, 루, 특수) ──
    const coverSlot = play.coverOfBase[wrapBase(base)] ?? NONE
    const basePoint = basePosition(base)
    if (coverSlot === NONE) {
      // 커버가 없으면 공 가진 야수가 직접 들고 뛴다 (상태 6, vt48(루))
      fielders = fielders.map((fielder) =>
        fielder.slot === holderSlot ? { ...fielder, target: basePoint, targetBase: base } : fielder,
      )
      log.push(`${tick}틱 ${holderSlot}번 야수가 ${base}루로 공을 들고 뛴다 (커버 없음)`)
      return
    }
    const cover = fielders[coverSlot]
    if (cover.targetBase !== base) return
    const runTicks = ticksToReach(holder.position, basePoint, holder.speed)
    const throwTicks = throwTicksTo(holder, cover.target)
    const receiveTicks = fielderArrivalTicks(cover)
    if (runTicks <= Math.max(throwTicks, receiveTicks)) {
      // 직접 밟으러 간다 (0xb2a48) — 커버가 자기 자신인 홈 도루의 포수도 이 갈래다
      fielders = fielders.map((fielder) =>
        fielder.slot === holderSlot ? { ...fielder, target: basePoint, targetBase: base } : fielder,
      )
      log.push(`${tick}틱 ${holderSlot}번 야수가 ${base}루를 직접 밟으러 간다`)
      return
    }
    if (coverSlot === holderSlot || horizontalDistance(holder.position, cover.position) <= MINIMUM_THROW_DISTANCE) {
      return
    }

    // ── 송구 0xb2e38 → 0xa1620 (악송구 굴림 0xa1828) ──
    const special = cpuSpecial ? cpuSpecialThrowOf(fielders, holderSlot, coverSlot) : null
    const bounce = special !== null && special.special && special.bounce
    if (bounce && input.random !== undefined) randomIntegerBelow(input.random, 0, 2)
    const error =
      input.random === undefined || bounce
        ? NO_THROW_ERROR
        : rollThrowError(abilities[holderSlot] ?? DEFAULT_ABILITY, special?.special === true, input.random)
    const thrower = special !== null && special.special ? special.thrower : holder
    let arrival =
      special !== null && special.special
        ? specialThrowArrivalTicks(contextAt(tick), base, thrower)
        : defenseArrivalTicks(contextAt(tick), base)
    if (error.errant) {
      const speed = effectiveThrowSpeedOf(thrower)
      const errant = Math.max(MINIMUM_THROW_SPEED, speed + error.speedDelta)
      arrival = Math.max(1, Math.trunc((arrival * speed) / errant))
    }
    if (error.errant) errantThrow = true
    throwState.flight = {
      from: holderSlot,
      base,
      releaseTick: tick,
      arrivalTick: tick + Math.max(1, arrival),
      receiver: error.errant ? NONE : coverSlot,
    }
    if (firstThrowBase === NONE) {
      firstThrowBase = base
      firstThrowArrival = throwState.flight.arrivalTick
    }
    // 던지면 손을 떠난다 — 준비 틱(+0xc8)도 썼다
    fielders = fielders.map((fielder) =>
      fielder.slot === holderSlot ? { ...fielder, holdingBall: false, actionRemainingTicks: 0 } : fielder,
    )
    play = { ...play, held: false, wantsThrow: true }
    log.push(
      `${tick}틱 ${holderSlot}번 야수가 ${base}루로 송구 — ${throwState.flight.arrivalTick}틱 도착` +
        (cpuSpecial ? ' (특수)' : '') +
        (error.errant ? ' (악송구)' : ''),
    )
  }

  for (let tick = 0; tick <= maximumTicks && !play.finished; tick += 1) {
    outJudgedThisTick = false
    // ── 1. (종류 9) 포구 ──
    if (chase !== undefined && !caught && tick === catchTick) {
      const ballIsMoving = tick < chase.trajectory.length - 1
      if (
        !fumbled &&
        input.random !== undefined &&
        rollFumble(abilities[chase.slot] ?? DEFAULT_ABILITY, ballIsMoving, input.random)
      ) {
        // 펌블 (0xb41d0) — 타구 진행기와 같은 근사: 같은 자리에서 15틱 뒤 다시 줍는다
        fumbled = true
        catchTick = Math.min(tick + FUMBLE_LOCK_TICKS, maximumTicks)
        log.push(`${tick}틱 ${chase.slot}번 야수 펌블 — ${catchTick}틱에 다시 줍는다`)
      } else {
        caught = true
        const point = chase.trajectory.pointAt(chase.catchTick)
        // 0xb2710(P, f, 1) — 셋째 인자가 1 이라 준비 틱(내야 3 · 외야 6)을 +0xc8 에 넣는다
        grab(tick, chase.slot, {
          position: { x: point.x, y: 0, z: point.z },
          target: { x: point.x, y: 0, z: point.z },
          actionRemainingTicks: readyTicksOf(chase.slot),
        })
        log.push(`${tick}틱 ${chase.slot}번 야수가 공을 주웠다`)
      }
    }
    if (chase !== undefined && tick === chase.trajectory.landingTick && !ballOnGround) {
      // 낙구 0xb4492~0xb453c: state[0x1e] = 1, 포스 요구 루 0xa95e8
      ballOnGround = true
      const required = requiredBasesOnBounce(runnerStates())
      runners.forEach((runner, index) => {
        runner.state = { ...runner.state, requiredBase: required[index] ?? runner.state.requiredBase }
      })
    }

    // ── 2. 송구 판단 ──
    const newHolder = play.held && play.ballHolderSlot !== decidedHolder
    if (!play.finished && !ballLost && throwState.flight === null && newHolder) {
      decideThrow(tick)
    }

    // ── 3. 송구 도착 ──
    const inFlight: ThrowInFlight | null = throwState.flight
    if (inFlight !== null && tick >= inFlight.arrivalTick) {
      if (inFlight.receiver === NONE) {
        throwState.flight = null
        ballLost = true
        play = { ...play, wantsThrow: false }
        log.push(`${tick}틱 악송구 — 받은 야수가 없다 (근사)`)
      } else if (isSamePoint(fielders[inFlight.receiver].position, basePosition(inFlight.base))) {
        throwState.flight = null
        play = { ...play, wantsThrow: false }
        grab(tick, inFlight.receiver)
        // 0xb4292 — 받은 야수가 선 루에 마지막으로 닿은 산 주자가 제 목표점에 있으면 결과 9
        const onBase = runners.find(
          (runner) => !runner.state.isOut && wrapBase(runner.state.startBase) === wrapBase(inFlight.base),
        )
        if (resultCode === null && onBase !== undefined && isAtTarget(onBase.state)) {
          resultCode = RUNNER_PLAY_RESULT.SAFE
          log.push(`${tick}틱 ${inFlight.base}루 세이프 (결과 9)`)
        }
      }
    }

    // ── 4. 자동 추가 진루 0xaf918 · 자동 슬라이딩 0xb030c ──
    if (!play.finished && autoBaserunningEnabled && resultCode === null) {
      const decisions = autoAdvanceDecisions({ ...contextAt(tick), force: true })
      for (const decision of decisions) {
        const runner = runners.find((candidate) => candidate.state.index === decision.runnerIndex)
        if (runner === undefined || runner.state.isOut || runner.state.scored) continue
        if (decision.toBase > HOME_BASE) continue
        // 타구 진행기와 같은 근사 — 목표 루에 닿아 있을 때만 묻는다
        if (!isAtTarget(runner.state)) continue
        startLeg(runner, decision.toBase)
        log.push(`${tick}틱 ${runner.state.index}번 주자 자동 진루 → ${decision.toBase}루`)
      }
    }
    if (!play.finished) {
      const throwing = throwState.flight !== null && tick < throwState.flight.arrivalTick
      const slid = autoSlideRunnerIndexes({
        isThrowInFlight: throwing,
        throwTargetBase: throwing && throwState.flight !== null ? throwState.flight.base : NONE,
        throwArrivalTicks: throwState.flight !== null ? throwState.flight.arrivalTick - tick : -1,
        runners: runners.map((runner) => slidingRunnerOf(runner.state)),
      })
      for (const index of slid) {
        const runner = runners[index]
        if (runner === undefined) continue
        runner.state = { ...runner.state, sliding: true, speed: runner.state.speed + SLIDING_SPEED_BONUS }
        log.push(`${tick}틱 ${runner.state.index}번 주자 자동 슬라이딩`)
      }
    }

    // ── 5. 그림 ──
    ticks.push(
      viewStateOf({
        tick,
        ball: ballPointAt(tick, chase, caught, catchTick, fielders, play.ballHolderSlot, throwState.flight),
        ballIsFlying: (chase !== undefined && !caught) || throwState.flight !== null,
        fielders,
        runners: runnerStates(),
        catchKind: null,
        chaserSlot: chase?.slot ?? play.ballHolderSlot,
        throwingSlot:
          throwState.flight !== null && tick < throwState.flight.releaseTick + 3 ? throwState.flight.from : NONE,
        throwBase: throwState.flight?.base ?? NONE,
        previousActions,
        aceIndexes: input.aceIndexes,
        defenseTeamIndex: input.defenseTeamIndex,
        offenseTeamIndex: input.offenseTeamIndex,
      }),
    )

    // ── 6. 움직이기 ──
    fielders = fielders.map((fielder) => {
      if (chase !== undefined && !caught && fielder.slot === chase.slot) {
        const point = chase.trajectory.pointAt(chase.catchTick)
        const goal = { x: point.x, y: 0, z: point.z }
        return { ...fielder, target: goal, position: stepToward(fielder.position, goal, fielder.speed) }
      }
      if (isSamePoint(fielder.position, fielder.target)) return fielder
      return { ...fielder, position: stepToward(fielder.position, fielder.target, fielder.speed) }
    })
    for (const runner of runners) {
      if (runner.state.isOut || runner.state.scored) continue
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
    // (`runDefensePlay` 의 6c 절에 근거). 공 쥔 야수가 준비(vtC4)돼 있어야 던진다.
    // CPU 송구(수비 CPU · 설정 자동)는 새로 쥔 야수를 다음 틱 2절이 어차피 같은 점수식으로 본다 —
    // 그 판단을 이미 한 야수일 때만 여기서 한 번 더 본다(근사: 원본은 +0x128 이 선 동안 매 틱 다시 본다).
    if (
      outJudgedThisTick &&
      outs <= 2 &&
      !play.finished &&
      !ballLost &&
      throwState.flight === null &&
      play.held &&
      tick >= holderReadyTick &&
      (!cpuThrowEnabled || decidedHolder === play.ballHolderSlot)
    ) {
      decideThrow(tick, true)
    }

    // ── 8. 보류 득점 풀기 (0xaa34c) ──
    const stillActive = runners.some(
      (runner) => !runner.state.isOut && !runner.state.scored && !isAtTarget(runner.state),
    )
    held = releaseHeldRuns(held, {
      outs,
      ballOnGround,
      batterRunner: batterRunnerOf(),
      someRunnerStillActive: stillActive,
    })

    // ── 9. 끝났나 — 공이 정리됐고(쥐었거나 빠졌고, 날아가는 송구가 없다) 뛰는 주자가 없다 ──
    const holderSettled =
      !play.held || isSamePoint(fielders[play.ballHolderSlot].position, fielders[play.ballHolderSlot].target)
    const ballSettled = caught && throwState.flight === null && (ballLost || play.held) && holderSettled
    if ((resultCode !== null || ballSettled) && throwState.flight === null && !stillActive) {
      play = { ...play, finished: true }
    }
  }

  const voidedRuns = outs > 2 ? held.heldRuns : 0
  return {
    kind: input.kind,
    resultCode,
    advance: { bases: basesOf(runners), runsScored: held.scoreboardRuns, outsAdded },
    ticks,
    catchFielderSlot: chase?.slot ?? input.play.ballHolderSlot,
    catchTick: chase !== undefined ? catchTick : 0,
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

/** 공 그림 자리 — 줍기 전엔 궤적, 송구 중엔 낮은 포물선(타구 진행기와 같은 근사), 그 밖엔 쥔 야수 손 */
function ballPointAt(
  tick: number,
  chase: LooseBallChase | undefined,
  caught: boolean,
  catchTick: number,
  fielders: readonly FielderState[],
  holderSlot: number,
  flight: ThrowInFlight | null,
): WorldPoint {
  if (chase !== undefined && !caught) return chase.trajectory.pointAt(Math.min(tick, catchTick))
  if (flight !== null) {
    const from = fielders[flight.from]?.position ?? basePosition(0)
    const to = basePosition(flight.base)
    const whole = flight.arrivalTick - flight.releaseTick
    const done = Math.min(whole, tick - flight.releaseTick)
    if (whole <= 0) return to
    return {
      x: from.x + Math.trunc(((to.x - from.x) * done) / whole),
      y: Math.trunc((1200 * done * (whole - done)) / (whole * whole)),
      z: from.z + Math.trunc(((to.z - from.z) * done) / whole),
    }
  }
  return fielders[holderSlot]?.position ?? basePosition(0)
}
