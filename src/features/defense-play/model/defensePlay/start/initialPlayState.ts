import { isFairAngle } from '@/entities/batting/model/battedBallOutcome'
import { FIELDER_COUNT, type WorldPoint } from '@/entities/fielding/model/fieldGeometry'
import { NONE, type PlayView } from '@/entities/fielding/model/fieldingState'
import { EMPTY_HELD_RUNS } from '@/entities/fielding/model/heldRuns'
import { NO_RUNDOWN } from '@/entities/fielding/model/rundown'
import type { CatchForecast } from '@/features/defense-play/model/catchForecast'
import type { CoverTickResult } from '@/features/defense-play/model/coverTick'
import type { ContactMessageRoll } from '@/features/defense-play/model/defensePlay/start/contactMessage'
import type { DefensePlayInput } from '@/features/defense-play/model/defensePlay/types/defensePlayInput'
import type { DefensePlayState, MutableRunner } from '@/features/defense-play/model/defensePlay/types/defensePlayState'
import { enterDefenseScene } from '@/features/defense-play/model/defenseScene'

/** 판 시작에서 정해진 것들 — 나머지 칸은 판 시작 값(0 · 거짓 · −1 · NONE)이다 */
export interface OpeningState {
  readonly input: DefensePlayInput
  readonly message: ContactMessageRoll
  readonly abilities: readonly (number | null)[]
  readonly maximumTicks: number
  readonly uncatchable: boolean
  readonly onTheFly: boolean
  readonly runners: readonly MutableRunner[]
  readonly forecast: CatchForecast
  readonly catchTick: number
  readonly catchPoint: WorldPoint
  readonly covered: CoverTickResult
  readonly play: PlayView
  readonly wideFair: boolean
}

/** 판 시작 상태 — 판 칸 하나하나의 처음 값 */
export function initialPlayStateOf(opening: OpeningState): DefensePlayState {
  const { input, message, forecast } = opening
  const { trajectory, launchedPattern } = message
  return {
    input,
    trajectory,
    abilities: opening.abilities,
    maximumTicks: opening.maximumTicks,
    uncatchable: opening.uncatchable,
    onTheFly: opening.onTheFly,
    chaserSlot: forecast.choice.slot,
    catchPoint: opening.catchPoint,
    covers: opening.covered.play.coverOfBase,
    defenseIsCpu: input.defenseIsCpu === true,
    specialDefense: message.specialDefense,
    runners: opening.runners,
    ticks: [],
    log: [],
    previousActions: new Map<string, { action: number; since: number }>(),

    tick: 0,
    fielders: opening.covered.fielders,
    play: opening.play,
    held: EMPTY_HELD_RUNS,
    outs: input.outs,
    outsAdded: 0,
    throwBase: NONE,
    throwArrivalTick: -1,
    throwFromSlot: NONE,
    throwReleaseTick: -1,
    throwCount: 0,
    firstThrowBase: NONE,
    firstThrowArrivalTick: -1,
    safeCallTick: -1,
    flyOut: false,
    hitEvent: false,
    homeRunEvent: false,
    outEvents: 0,
    groundHomeRun: false,
    catchTick: opening.catchTick,
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
    rundowns: 0,
    rundownOuts: 0,
    tagOut: false,
    relayFlag: opening.covered.relayFlag,
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
    wideFair: opening.wideFair,
    homeRunFlag: false,
    groundRuleFlag: false,
    // 플레이 +0x127 — 패턴 플래그 비트 1 (0x514e6)
    landingChase: input.trajectory.landingChase === true,
    ballLandingTick: trajectory.landingTick,
    ballLaunchTick: 0,
    diveTicks: forecast.diveTicks,
    diveCatchTick: forecast.choice.catchTick,
    receivingThrow: false,
    fielderArrivals: [],
  }
}
