import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { battedBallTrajectory } from '@/entities/batting/model/battedBallFlight'
import type { BattedBallPattern } from '@/shared/config/original/battedBallPatterns'
import {
  autoAdvanceDecisions,
  requiredBasesOnBounce,
  requiredBasesOnFlyCatch,
} from '@/entities/fielding/model/autoAdvance'
import type { BattedBallTrajectory } from '@/entities/fielding/model/catchPrediction'
import {
  BASE_DEFAULT_FIELDER,
  basePosition,
  isSamePoint,
  runnerSpeedOf,
  stepToward,
  type WorldPoint,
} from '@/entities/fielding/model/fieldGeometry'
import {
  AI_STATE,
  createFielders,
  createRunner,
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
  runsAfterTwoOutRule,
  type HeldRunState,
} from '@/entities/fielding/model/heldRuns'
import { defenseArrivalTicks, secondBaseCoverSlot } from '@/entities/fielding/model/throwArrival'
import { readyTicksOf } from '@/entities/fielding/model/throwPlan'
import { chooseThrowTargetBase } from '@/entities/fielding/model/throwTargetBase'
import { EMPTY_BASES, type AdvanceResult, type BaseState } from '@/entities/game/model/baseState'
import { forecastCatch } from '@/features/defense-play/model/catchForecast'
import { viewStateOf, type DefensePlayView } from '@/features/defense-play/model/defensePlayView'

/**
 * 타구 하나를 **틱 단위로 끝까지 돌리는 순수 함수**.
 *
 * `entities/fielding` 에 따로따로 들어와 있는 조각들을 여기서 한 줄로 잇는다:
 *   포구 예보(0xb12d0 · 0xb3b38) → 송구 목표 루(0xafb24) → 송구 도착 틱(0xaf284) →
 *   자동 추가 진루(0xaf918) → 2아웃 득점 보류(state[0]).
 *
 * ## 무엇이 무엇을 정하는가 (중요)
 * **타자주자의 운명은 결과 코드가 정한다.** 안타·아웃은 `battedBallOutcome.outcomeOfPattern` 이
 * 이미 정해 놓았고(그 자체가 위치 분석 4차의 근사다), 이 진행기는 **나머지 주자의 진루·추가 아웃·
 * 득점**을 원본 규칙으로 정한다. 그래서 여기서 바뀌는 것은 `baseState` 의 두 근사 —
 * "희생플라이 보장" 과 "고정 진루표" — 이고, 그 자리를 `autoAdvanceDecisions` + `heldRuns` 가 채운다.
 *
 * ⚠️ 타구 궤적은 `entities/batting/model/battedBallFlight` 의 **근사**다. 원본 물리 루프
 * (0xb3b38·0xb401c)는 해독 금지 주제라 뜯지 않았고, 원본 패턴 데이터의 각·세기·높이만 읽어 썼다.
 */

/** 능력치를 안 주면 쓰는 값 — 원본 평균대(등급 3) */
const DEFAULT_ABILITY = 500
/** 한 플레이가 이 틱을 넘기면 강제로 끊는다 (원본에는 없는 우리 쪽 안전망) */
const DEFAULT_MAXIMUM_TICKS = 240
/** 홈을 가리키는 루 번호 — 원본 루 표의 [4] 가 홈의 사본이라 진루는 4 로 센다 */
const HOME_BASE = 4

export interface DefensePlayInput {
  /** 타석 결과 — 타자주자의 운명이 여기서 온다 */
  readonly outcome: AtBatOutcome
  /** 원본 패턴에서 만든 타구 궤적 */
  readonly trajectory: BattedBallTrajectory
  /** 투구 때의 루 상황 */
  readonly bases: BaseState
  /** 투구 때의 아웃 수 */
  readonly outs: number
  /** 수비 9명의 수비 능력치 (칸 순서). 기본 500 */
  readonly defenseAbilities?: readonly number[]
  /** 주자들의 주루 능력치. 기본 500 */
  readonly runAbility?: number
  readonly maximumTicks?: number
}

export interface DefensePlayResult {
  /** `baseState.advanceRunners` 와 같은 모양 — 그대로 경기 상태에 넣을 수 있다 */
  readonly advance: AdvanceResult
  /** 매 틱의 화면 스냅샷 (`pages/defense` 가 그대로 그린다) */
  readonly ticks: readonly DefensePlayView[]
  /** 잡은 야수 칸 */
  readonly catchFielderSlot: number
  /** 포구 틱 */
  readonly catchTick: number
  /** 뜬공을 뜬 채로 잡았는가 (태그업이 걸리는 조건) */
  readonly caughtOnTheFly: boolean
  /** CPU 가 고른 송구 목표 루. −1 이면 안 던졌다 */
  readonly throwBase: number
  /** 송구 도착 틱. 송구가 없으면 −1 */
  readonly throwArrivalTick: number
  /** 보류됐다가 3아웃으로 날아간 득점 수 (state[0]) */
  readonly voidedRuns: number
  /** 사람이 읽을 진행 기록 — 테스트가 "왜 그렇게 됐나" 를 확인할 때 쓴다 */
  readonly log: readonly string[]
}

/** 이 타석이 수비 시뮬레이션을 돌릴 타구인가 — 삼진·볼넷·홈런은 돌릴 것이 없다 */
export function isBattedBallInPlay(outcome: AtBatOutcome): boolean {
  return outcome.kind === '안타' || outcome.kind === '아웃'
}

/** 뜬 채로 잡히는 타구인가. 땅볼 아웃은 "잡히는 타구" 가 아니라 굴러간 공을 주운 것이다 */
function catchesOnTheFly(outcome: AtBatOutcome): boolean {
  return outcome.kind === '아웃' && (outcome.detail === '뜬공아웃' || outcome.detail === '직선타아웃')
}

/** 타자주자가 최소한 몇 루까지 가는가 */
function batterMinimumBaseOf(outcome: AtBatOutcome): number {
  if (outcome.kind === '안타') return outcome.bases
  if (outcome.kind === '홈런') return HOME_BASE
  return 1
}

interface MutableRunner {
  state: RunnerState
  /** 최소 진루 루 — 타자주자만 결과 코드로 정해진다 */
  minimumBase: number
  /** 이미 득점 처리를 했는가 */
  counted: boolean
}

/**
 * 포스 판정 — 뒤 루가 모두 차 있어야 밀린다. 타자주자는 언제나 뛴다.
 * (원본 `requiredBasesOnBounce` 는 주자 번호와 목표 루를 비교하는 **다른** 계산이라 요구 루에만 쓴다.)
 */
function forcedFlagsOf(bases: BaseState): { first: boolean; second: boolean; third: boolean } {
  return {
    first: true,
    second: bases.first,
    third: bases.first && bases.second,
  }
}

function createPlayRunners(bases: BaseState, outcome: AtBatOutcome, speed: number): MutableRunner[] {
  const forced = forcedFlagsOf(bases)
  const runners: MutableRunner[] = []
  const push = (fromBase: number, isForced: boolean, minimumBase: number) => {
    const index = runners.length
    // 포스로 밀리는 주자만 바로 뛴다. 나머지는 루에 붙어 있다가 자동 진루(0xaf918)가 보내 준다.
    const targetBase = isForced ? fromBase + 1 : fromBase
    runners.push({
      state: createRunner(index, fromBase, speed, { targetBase, isBatterRunner: index === 0 }),
      minimumBase,
      counted: false,
    })
  }
  // 0 = 타자주자. 그 뒤는 **뒤 주자 → 앞선 주자** 순서다 (자동 진루가 목록 끝부터 = 앞선 주자부터 본다)
  // 최소 진루 루는 **타자주자만** 결과 코드로 정해진다. 나머지는 포스로 밀리거나 자동 진루로만 간다.
  push(0, true, batterMinimumBaseOf(outcome))
  if (bases.first) push(1, forced.second, 1)
  if (bases.second) push(2, forced.third, 2)
  if (bases.third) push(3, forced.third, 3)
  return runners
}

/**
 * 루 커버 배정 — 기본표 0xd85a8 = [포수, 1루수, 2루수, 3루수] 에 2루 규칙(0xb1e24)을 얹는다.
 * 공을 쫓는 야수는 커버를 못 하므로 1루만 투수(0)가 대신 들어가고, 나머지는 커버 없음(−1)이 된다
 * — `defenseArrivalTicks` 의 (A) 갈래가 그때 "직접 들고 뛰기" 를 본다.
 */
function assignCovers(chaserSlot: number, ballToFirstSide: boolean): number[] {
  const covers = [...BASE_DEFAULT_FIELDER]
  covers[2] = secondBaseCoverSlot(ballToFirstSide, chaserSlot)
  return covers.map((slot, base) => {
    if (slot !== chaserSlot) return slot
    return base === 1 ? 0 : NONE
  })
}

export function runDefensePlay(input: DefensePlayInput): DefensePlayResult {
  const trajectory = input.trajectory
  const abilities =
    input.defenseAbilities ?? Array.from({ length: 9 }, () => DEFAULT_ABILITY)
  const speed = runnerSpeedOf(input.runAbility ?? DEFAULT_ABILITY)
  const maximumTicks = input.maximumTicks ?? DEFAULT_MAXIMUM_TICKS

  let fielders = createFielders(abilities)
  const runners = createPlayRunners(input.bases, input.outcome, speed)
  const onTheFly = catchesOnTheFly(input.outcome)

  // ── 포구 예보 ──
  // 뜬 채로 잡히는 타구는 낙구 전까지만, 굴러간 타구는 낙구 **다음** 틱부터 본다.
  // (낙구 틱에 걸리면 `chooseChaser` 우선순위 1~5 = "낙구 전 포구" 가 되어 잡힌 공이 된다)
  const forecast = forecastCatch(
    trajectory,
    fielders,
    onTheFly
      ? { from: 0, to: trajectory.landingTick }
      : { from: trajectory.landingTick + 1, to: Number.POSITIVE_INFINITY },
  )
  const chaserSlot = forecast.choice.slot
  const catchTick = Math.max(0, Math.min(forecast.choice.catchTick, maximumTicks))
  const catchPoint = trajectory.pointAt(catchTick)
  const covers = assignCovers(chaserSlot, catchPoint.x > basePosition(0).x)

  // 시작 목표를 미리 세워 둔다 — 첫 틱부터 쫓는 야수는 공 쪽, 커버 야수는 제 루 쪽을 보고 있어야 한다
  fielders = fielders.map((fielder) => {
    if (fielder.slot === chaserSlot) {
      return { ...fielder, target: catchPoint, aiState: AI_STATE.CHASE }
    }
    const base = covers.indexOf(fielder.slot)
    if (base < 0) return fielder
    return {
      ...fielder,
      target: basePosition(base),
      targetBase: base,
      aiState: AI_STATE.COVER_HOME + base,
    }
  })

  let play: PlayView = {
    ...initialPlayView(1),
    coverOfBase: covers,
    ballHolderSlot: chaserSlot,
    catchFielderSlot: chaserSlot,
    catchKind: forecast.choice.kind,
    catchTick,
    actionStartTick: forecast.choice.actionStartTick,
    earliestCatchTick: onTheFly ? forecast.earliestCatchTick : 0xffff,
  }

  let held: HeldRunState = EMPTY_HELD_RUNS
  let outs = input.outs
  let outsAdded = 0
  let throwBase = NONE
  let throwArrivalTick = -1
  let throwFromSlot = NONE
  let batterOutTick = -1
  const ticks: DefensePlayView[] = []
  const log: string[] = []
  const previousActions = new Map<string, { action: number; since: number }>()

  const contextAt = (tick: number): DefenseContext => ({
    play,
    fielders,
    runners: runners.map((runner) => runner.state),
    currentTick: tick,
    landingTick: trajectory.landingTick,
  })

  for (let tick = 0; tick <= maximumTicks; tick += 1) {
    const ballOnGround = play.everHeld || tick >= trajectory.landingTick

    // ── 1. 포구 ──
    if (tick === catchTick) {
      fielders = fielders.map((fielder) =>
        fielder.slot === chaserSlot
          ? {
              ...fielder,
              position: catchPoint,
              target: catchPoint,
              holdingBall: true,
              // 잡고 던지기까지의 준비 틱(내야 3 · 외야 6, cfg+0x20/+0x22) 을 동작 남은 틱(+0xc8)에 넣는다.
              // `defenseArrivalTicks` 의 "이미 잡았다" 갈래가 이 칸을 그대로 더한다 (0xaf53e).
              actionRemainingTicks: readyTicksOf(fielder.slot),
            }
          : fielder,
      )
      play = { ...play, held: true, everHeld: true, wantsThrow: true }
      log.push(`${tick}틱 ${chaserSlot}번 야수가 잡았다 (종류 ${play.catchKind})`)

      if (onTheFly) {
        // 뜬공 아웃 — 타자주자는 여기서 죽고, 나머지는 리터치(0xa9620) 뒤 태그업 판정을 받는다
        markOut(runners[0])
        outs += 1
        outsAdded += 1
        batterOutTick = tick
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
        }
      } else {
        // 굴러간 공 — 포스 요구 루를 세운다 (0xa95e8)
        const required = requiredBasesOnBounce(runners.map((runner) => runner.state))
        runners.forEach((runner, index) => {
          runner.state = { ...runner.state, requiredBase: required[index] }
        })
      }

      // ── 송구 목표 루 (0xafb24) ──
      const active = runners.filter((runner) => !runner.state.isOut && !runner.state.scored).length
      throwBase = chooseThrowTargetBase({ ...contextAt(tick), activeRunnerCount: active })
      if (throwBase !== NONE) {
        throwArrivalTick = tick + defenseArrivalTicks(contextAt(tick), throwBase)
        throwFromSlot = chaserSlot
        log.push(`${tick}틱 ${throwBase}루로 송구 — ${throwArrivalTick}틱 도착`)
      }
      // 땅볼·직선타로 타자주자가 죽는 시각은 1루에 공이 닿는 때다
      if (input.outcome.kind === '아웃' && !onTheFly) {
        batterOutTick = tick + defenseArrivalTicks(contextAt(tick), 1)
      }
    }

    // ── 2. 송구 도착 — 그 루로 가던 주자가 아직 못 닿았으면 아웃 ──
    if (throwArrivalTick >= 0 && tick === throwArrivalTick) {
      for (let index = runners.length - 1; index >= 1; index -= 1) {
        const runner = runners[index]
        if (runner.state.isOut || runner.state.scored) continue
        if (wrapBase(runner.state.targetBase) !== wrapBase(throwBase)) continue
        if (isAtTarget(runner.state)) continue
        markOut(runner)
        outs += 1
        outsAdded += 1
        log.push(`${tick}틱 ${index}번 주자 ${throwBase}루에서 아웃`)
        break
      }
      play = { ...play, wantsThrow: false }
    }

    // ── 3. 타자주자의 선언된 운명 ──
    if (batterOutTick >= 0 && tick === batterOutTick && !runners[0].state.isOut) {
      markOut(runners[0])
      outs += 1
      outsAdded += 1
      log.push(`${tick}틱 타자주자 아웃`)
    }

    // ── 4. 자동 추가 진루 (0xaf918) ──
    // 멈춘 주자(루에 붙은 주자·태그업 대기)까지 보려면 force 가 필요하다 — 원본 인자 그대로다.
    if (!play.finished) {
      const decisions = autoAdvanceDecisions({ ...contextAt(tick), force: true })
      for (const decision of decisions) {
        const runner = runners[decision.runnerIndex]
        if (runner === undefined || runner.state.isOut || runner.state.scored) continue
        if (decision.toBase > HOME_BASE) continue
        // **근사**: 원본은 이 판정을 매 틱 돌리지만, 여기서는 **지금 목표 루에 닿아 있을 때만** 묻는다.
        // 안 그러면 달리는 도중에 한 루씩 계속 얹혀 타구가 떠나기도 전에 홈까지 밀려 버린다.
        if (!isAtTarget(runner.state)) continue
        // 타자주자는 결과 코드가 정한 루에서 멈춘다 — 안타 종류가 이미 정해져 있어 더 가면 기록과 어긋난다
        if (runner.state.isBatterRunner && decision.toBase > runner.minimumBase) continue
        startLeg(runner, decision.toBase)
      }
    }

    // ── 5. 화면 스냅샷 ──
    ticks.push(
      viewStateOf({
        tick,
        ball: ballPointAt({
          tick,
          trajectory,
          catchTick,
          fielders,
          chaserSlot,
          throwBase,
          throwArrivalTick,
          throwFromSlot,
        }),
        ballIsFlying: tick < catchTick || (throwArrivalTick >= 0 && tick < throwArrivalTick),
        fielders,
        runners: runners.map((runner) => runner.state),
        catchKind: tick >= play.actionStartTick && tick <= catchTick ? play.catchKind : null,
        chaserSlot,
        throwingSlot: throwArrivalTick >= 0 && tick >= catchTick && tick < catchTick + 3 ? chaserSlot : NONE,
        throwBase,
        previousActions,
      }),
    )

    // ── 6. 한 틱 움직이기 ──
    fielders = fielders.map((fielder) => moveFielder(fielder, { chaserSlot, catchPoint, covers, tick, catchTick }))
    for (const runner of runners) {
      if (runner.state.isOut || runner.state.scored) continue
      const target = basePosition(runner.state.targetBase)
      runner.state = {
        ...runner.state,
        position: stepToward(runner.state.position, target, runner.state.speed),
      }
      if (!isAtTarget(runner.state)) continue
      runner.state = { ...runner.state, settled: true }
      // 결과 코드가 정한 루까지는 반드시 간다 (타자주자의 1·2·3루타). 한 루씩 이어 달린다
      if (runner.state.targetBase < runner.minimumBase) {
        startLeg(runner, runner.state.targetBase + 1)
        continue
      }
      // 홈을 밟았다 — 2아웃 보류 규칙(state[0])을 태운다
      if (wrapBase(runner.state.targetBase) === 0 && runner.state.targetBase !== 0 && !runner.counted) {
        runner.counted = true
        runner.state = { ...runner.state, scored: true }
        held = onRunnerReachesHome(held, {
          outs,
          ballOnGround,
          batterRunner: runners[0].state,
          scoringRunnerIsBatterRunner: runner.state.index === 0,
        })
        log.push(`${tick}틱 ${runner.state.index}번 주자 홈 — 보류 ${held.heldRuns} / 득점 ${held.scoreboardRuns}`)
      }
    }

    // ── 7. 보류 득점 풀기 (0xaa34c) ──
    const stillActive = runners.some(
      (runner) => !runner.state.isOut && !runner.state.scored && !isAtTarget(runner.state),
    )
    held = releaseHeldRuns(held, {
      outs,
      ballOnGround,
      batterRunner: runners[0].state,
      someRunnerStillActive: stillActive,
    })

    // ── 8. 끝났나 ──
    const throwSettled = throwArrivalTick < 0 || tick >= throwArrivalTick
    const batterSettled = batterOutTick < 0 || tick >= batterOutTick
    if (play.everHeld && throwSettled && batterSettled && !stillActive) {
      play = { ...play, finished: true }
      break
    }
  }

  /**
   * 타석 단위로 마무리할 때의 같은 결과 규칙 (S2 2-5, `runsAfterTwoOutRule`):
   * **땅볼로 타자주자가 아웃이 되어 그 플레이에서 3아웃이 되면 주자 득점은 0** 이다.
   * 틱 단위로는 주자가 타자주자보다 먼저 홈을 밟아 `state[0]` 보류를 안 타는 경우가 있어
   * (0xaa164 는 "타자주자가 살아서 뛰는 중" 이면 바로 올린다) 마지막에 한 번 더 건다.
   */
  const runsScored = runsAfterTwoOutRule(held.scoreboardRuns, {
    outsAfter: outs,
    ballOnGround: !onTheFly,
    batterRunnerOut: runners[0].state.isOut,
  })

  return {
    advance: {
      bases: basesOf(runners),
      runsScored,
      outsAdded,
    },
    ticks,
    catchFielderSlot: chaserSlot,
    catchTick,
    caughtOnTheFly: onTheFly,
    throwBase,
    throwArrivalTick,
    voidedRuns: held.heldRuns + (held.scoreboardRuns - runsScored),
    log,
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

function isAtTarget(runner: RunnerState): boolean {
  return isSamePoint(runner.position, basePosition(runner.targetBase))
}

function markOut(runner: MutableRunner): void {
  runner.state = { ...runner.state, isOut: true, settled: true }
}

/** 다음 구간 시작 — 출발점(+0x14)과 출발 루(+0x7c)를 새로 잡아야 진행률·협살 계산이 맞는다 */
function startLeg(runner: MutableRunner, toBase: number): void {
  runner.state = {
    ...runner.state,
    legStart: runner.state.position,
    startBase: runner.state.targetBase,
    targetBase: toBase,
    settled: false,
  }
}

function basesOf(runners: readonly MutableRunner[]): BaseState {
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

interface FielderMoveInput {
  readonly chaserSlot: number
  readonly catchPoint: WorldPoint
  readonly covers: readonly number[]
  readonly tick: number
  readonly catchTick: number
}

/** 야수 한 틱 — 쫓는 야수는 포구 지점으로, 커버는 제 루로, 나머지는 제자리 */
function moveFielder(fielder: FielderState, input: FielderMoveInput): FielderState {
  if (fielder.slot === input.chaserSlot) {
    if (input.tick >= input.catchTick) return fielder
    return {
      ...fielder,
      target: input.catchPoint,
      position: stepToward(fielder.position, input.catchPoint, fielder.speed),
      aiState: AI_STATE.CHASE,
    }
  }
  const base = input.covers.indexOf(fielder.slot)
  if (base < 0) return fielder
  const point = basePosition(base)
  return {
    ...fielder,
    target: point,
    targetBase: base,
    position: stepToward(fielder.position, point, fielder.speed),
    aiState: AI_STATE.COVER_HOME + base,
  }
}

interface BallPointInput {
  readonly tick: number
  readonly trajectory: BattedBallTrajectory
  readonly catchTick: number
  readonly fielders: readonly FielderState[]
  readonly chaserSlot: number
  readonly throwBase: number
  readonly throwArrivalTick: number
  readonly throwFromSlot: number
}

/** 이번 틱에 공이 어디 있나 — 포구 전에는 궤적, 포구 뒤에는 송구선 위 */
function ballPointAt(input: BallPointInput): WorldPoint {
  if (input.tick < input.catchTick) return input.trajectory.pointAt(input.tick)
  const holder = input.fielders[input.chaserSlot] ?? input.fielders[0]
  if (input.throwArrivalTick < 0 || input.throwBase === NONE) return holder.position
  if (input.tick >= input.throwArrivalTick) return basePosition(input.throwBase)

  const from = input.fielders[input.throwFromSlot]?.position ?? holder.position
  const to = basePosition(input.throwBase)
  const whole = input.throwArrivalTick - input.catchTick
  if (whole <= 0) return to
  const done = input.tick - input.catchTick
  return {
    x: from.x + Math.trunc(((to.x - from.x) * done) / whole),
    // 송구는 낮은 포물선으로 본다 (근사) — 화면이 공 크기를 고를 때만 쓴다
    y: Math.trunc((1200 * done * (whole - done)) / (whole * whole)),
    z: from.z + Math.trunc(((to.z - from.z) * done) / whole),
  }
}
