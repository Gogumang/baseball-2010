import { NONE } from '@/entities/fielding/model/fieldingState'
import { EMPTY_HELD_RUNS } from '@/entities/fielding/model/heldRuns'
import { OUT_KIND } from '@/entities/fielding/model/outJudgement'
import { previousTargetAfterLead } from '@/entities/fielding/model/runnerLead'
import { CATCHER_BALL_POINT, PITCHER_BALL_POINT } from '@/features/defense-play/model/coverTick'
import type { DefensePlayView } from '@/features/defense-play/model/defensePlayView/viewStateInput'
import { enterDefenseScene } from '@/features/defense-play/model/defenseScene'
import { NO_LASER_FLAGS } from '@/features/defense-play/model/laserTick'
import { type LooseBallChase as ChasedBall, initialLooseBallChase } from '@/features/defense-play/model/looseBallChase'
import { DEFAULT_MAXIMUM_TICKS, VT4C_BLOCKED_PLAY_KINDS } from '@/features/defense-play/model/runnerPlay/constants'
import type { DiveBall, RunnerPlayFrame } from '@/features/defense-play/model/runnerPlay/frame/runnerPlayFrame'
import type { RunnerPlayEngineInput, RunnerPlayTickSound } from '@/features/defense-play/model/runnerPlay/types/runnerPlayTypes'

/** 판 시작 — 진행기 입력에서 판 칸을 연다(예전 제너레이터 머리의 지역 변수 그대로, 굴림 없음) */
export function openRunnerPlay(input: RunnerPlayEngineInput, ticks: DefensePlayView[], sound: RunnerPlayTickSound): RunnerPlayFrame {
  const manualThrowBase = input.manualThrowBase ?? NONE
  const chase = openingChaseOf(input)
  return {
    input,
    ticks,
    sound,
    abilities: input.abilities,
    maximumTicks: input.maximumTicks ?? DEFAULT_MAXIMUM_TICKS,
    ...controlSwitchesOf(input),
    manualThrowBase,
    vt4cRuns: !VT4C_BLOCKED_PLAY_KINDS.includes(input.kind),
    log: [],
    previousActions: new Map<string, { action: number; since: number }>(),
    fielders: input.fielders,
    play: { ...input.play, manualThrowBase },
    runners: input.runners.map((state) => ({ state, counted: false, arrivedThisListTick: false, previousTarget: previousTargetAfterLead(state) })),
    slidingSoundPlayed: false,
    outs: input.outs,
    outsAdded: 0,
    held: EMPTY_HELD_RUNS,
    ballOnGround: input.ballOnGround,
    tagOut: false,
    resultCode: null,
    chase,
    diveBall: diveBallOf(chase),
    firstCatchTick: -1,
    fumbled: false,
    errantThrow: false,
    firstThrowBase: NONE,
    firstThrowArrival: -1,
    flight: null,
    fielderArrivals: input.fielders.map(() => false),
    ...ballSlotsOf(input, chase),
    relayFlag: input.relayFlag ?? true,
    ...TICK_SLOTS_AT_OPEN,
    scene: enterDefenseScene(input.scene, true),
    ...LASER_SLOTS_AT_OPEN,
    counterBeforeHead: 0,
    endCounter: 0,
    closingListTickOpen: false,
    deferredThrowReceiver: NONE,
    deferredThrowBase: NONE,
    relayFinalSlot: NONE,
    relayBase: NONE,
    grabbed: false,
    fumbleMarks: Array.from({ length: input.fielders.length }, (_, slot) => input.fumbleMarks?.[slot] ?? 0),
    throwErrorMarks: Array.from({ length: input.fielders.length }, () => 0),
  }
}

/** 종류 9 — 폭투 · 포일 공(0xb284a)을 고른 야수가 쫓는다 */
function openingChaseOf(input: RunnerPlayEngineInput): ChasedBall | null {
  const chase = input.chase
  if (chase === undefined) return null
  return initialLooseBallChase(chase.trajectory, chase.slot, chase.catchTick, chase)
}

/**
 * 0xae690 = 공격 CPU || 주루 설정 자동 → 자동 진루 제어기 · 0xae6c8 = 수비 CPU || 송구 설정 자동 → CPU 송구 결정 제어기.
 * 안 넘기면 원본 기본값(주루 자동 · 송구 수동)
 */
function controlSwitchesOf(input: RunnerPlayEngineInput): Pick<RunnerPlayFrame, 'autoBaserunningEnabled' | 'cpuThrowEnabled'> {
  return {
    autoBaserunningEnabled: input.offenseIsCpu === true || (input.runningMode ?? '자동') !== '수동',
    cpuThrowEnabled: input.defenseIsCpu === true || (input.throwMode ?? '수동') !== '수동',
  }
}

/** 공 객체 · 지금 공 궤적 · 0xa276c 의 놓인 공(종류 5 는 포수 자리 0xd7c30, 그 밖은 투수판 0xd7c24 — 밀어내기 종류 2 는 `restingBall`) */
function ballSlotsOf(input: RunnerPlayEngineInput, chase: ChasedBall | null): Pick<RunnerPlayFrame, 'ballBody' | 'ballPath' | 'placedBallPoint'> {
  return {
    ballBody: chase?.body,
    ballPath: chase === null ? null : { trajectory: chase.trajectory, startTick: chase.startTick },
    placedBallPoint: input.restingBall ?? (input.kind === 5 ? CATCHER_BALL_POINT : PITCHER_BALL_POINT),
  }
}

/** 틱 칸의 처음 값 — 틱 머리(`beginRunnerPlayTick`)가 다시 적는다 */
const TICK_SLOTS_AT_OPEN = {
  ballEventThisTick: false,
  outJudgedThisTick: false,
  tickMessageCode: 0,
  lastJudgedKind: OUT_KIND.NONE,
  pausedAtHead: false,
  pausedThisTick: false,
}

/** 레이저 · 연출 칸의 처음 값 */
const LASER_SLOTS_AT_OPEN = {
  laserOutFlag: false,
  laserFlags: NO_LASER_FLAGS,
  laserArmed: false,
  laserThrow: false,
  laserTrailOn: false,
  gamePaused: false,
}

/** 판 시작의 다이빙 공 — 폭투 · 포일 공(0xb284a)의 예보 칸. 쫓는 공이 없으면 빈 칸 */
function diveBallOf(chase: ChasedBall | null): DiveBall {
  if (chase === null) return { ticks: [], catchTick: 0, launchTick: 0, trajectory: null, heldAt: -1 }
  return {
    ticks: chase.diveTicks ?? [],
    catchTick: chase.forecastCatchTick ?? chase.catchTick,
    launchTick: chase.startTick,
    trajectory: chase.trajectory,
    heldAt: -1,
  }
}
