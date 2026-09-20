import { CATCH_KIND } from '@/entities/fielding/model/catchPrediction'
import {
  basePosition,
  isSamePoint,
  progressPercent,
  SLIDING_PROGRESS_RANGE,
  type WorldPoint,
} from '@/entities/fielding/model/fieldGeometry'
import { NONE, type FielderState, type RunnerState } from '@/entities/fielding/model/fieldingState'
import {
  FIELDER_ACTION,
  RUNNER_ACTION,
  type DefenseFielder,
  type DefenseRunner,
  type DefenseViewState,
} from '@/pages/defense/lib/defenseView'

/**
 * 한 틱치 화면 스냅샷 만들기.
 *
 * 모양(`DefenseViewState`)은 `pages/defense/lib/defenseView.ts` 가 이미 정해 두었고 그 파일은
 * 건드리지 않기로 했으므로 **타입만 가져다 쓴다**. 화면 결선(라우팅)은 여기 몫이 아니다.
 *
 * 동작 번호는 R3 2-1(야수 vt44 = 0xa1234) · R3 8-1(주자 vt40 = 0xa0070) 의 표를 따른다.
 * 어느 틱에 어느 칸을 쓰는지는 원본 동작 큐를 안 읽었으므로 **움직이는 방향에서 뽑아 쓴다(근사)**.
 */

/** 진행기가 내주는 한 틱 — 화면이 쓰는 스냅샷에 틱 번호만 붙였다 */
export interface DefensePlayView extends DefenseViewState {
  readonly tick: number
}

/** 같은 동작이 언제부터 이어지고 있는지 기억하는 칸 (`actionTick` 을 세려면 필요하다) */
export type ActionMemory = Map<string, { action: number; since: number }>

export interface ViewStateInput {
  readonly tick: number
  readonly ball: WorldPoint
  readonly ballIsFlying: boolean
  readonly fielders: readonly FielderState[]
  readonly runners: readonly RunnerState[]
  /** 이번 틱에 포구 동작 중이면 그 종류, 아니면 null */
  readonly catchKind: number | null
  readonly chaserSlot: number
  /** 이번 틱에 송구 동작 중인 야수 칸. 없으면 −1 */
  readonly throwingSlot: number
  /** 송구가 가고 있는 루. 없으면 −1 */
  readonly throwBase: number
  readonly previousActions: ActionMemory
}

export function viewStateOf(input: ViewStateInput): DefensePlayView {
  const fielders: DefenseFielder[] = input.fielders.map((fielder) => {
    const action = fielderActionOf(fielder, input)
    return {
      slot: fielder.slot,
      x: fielder.position.x,
      z: fielder.position.z,
      action,
      actionTick: tickSince(input.previousActions, `f${fielder.slot}`, action, input.tick),
    }
  })

  const runners: DefenseRunner[] = input.runners.map((runner) => {
    const action = runnerActionOf(runner, input)
    return {
      index: runner.index,
      x: runner.position.x,
      z: runner.position.z,
      action,
      actionTick: tickSince(input.previousActions, `r${runner.index}`, action, input.tick),
      base: ((runner.targetBase % 4) + 4) % 4,
      isAdvancing: runner.targetBase > runner.startBase,
      // 아웃된 주자도 걸어 나가는 동안은 그린다 (R3 3-4)
      isVisible: true,
    }
  })

  return {
    tick: input.tick,
    ball: { x: input.ball.x, z: input.ball.z, height: input.ball.y, isFlying: input.ballIsFlying },
    fielders,
    runners,
    flash: null,
    cameraTarget: null,
  }
}

/** 야수 동작 — 포구 > 송구 > 달리기 > 제자리 */
function fielderActionOf(fielder: FielderState, input: ViewStateInput): number {
  if (fielder.slot === input.chaserSlot && input.catchKind !== null) {
    return catchActionOf(input.catchKind, fielder.position, input.ball)
  }
  if (fielder.slot === input.throwingSlot) return FIELDER_ACTION.throw
  return runActionOf(fielder.position, fielder.target, FIELDER_ACTION.stand, [
    FIELDER_ACTION.runDown,
    FIELDER_ACTION.runUp,
    FIELDER_ACTION.runLeft,
    FIELDER_ACTION.runRight,
  ])
}

/** 포구 종류 → 동작 번호 (R3 2-1 표) */
function catchActionOf(kind: number, fielder: WorldPoint, ball: WorldPoint): number {
  switch (kind) {
    case CATCH_KIND.CHEST:
      return FIELDER_ACTION.catchChest
    case CATCH_KIND.JUMP:
      return FIELDER_ACTION.jumpCatch
    case CATCH_KIND.SLIDE:
      return FIELDER_ACTION.slideCatchDown + directionIndexOf(fielder, ball)
    default:
      return FIELDER_ACTION.catchLow
  }
}

/** 주자 동작 — 루에 서 있으면 제자리, 막판에 송구가 오면 슬라이딩, 아니면 달리기 */
function runnerActionOf(runner: RunnerState, input: ViewStateInput): number {
  const target = basePosition(runner.targetBase)
  if (isSamePoint(runner.position, target)) return RUNNER_ACTION.stand
  const progress = progressPercent(runner.legStart, runner.position, target)
  const playedOn =
    input.throwBase !== NONE && ((input.throwBase % 4) + 4) % 4 === ((runner.targetBase % 4) + 4) % 4
  if (
    playedOn &&
    progress >= SLIDING_PROGRESS_RANGE.minimum &&
    progress <= SLIDING_PROGRESS_RANGE.maximum
  ) {
    return RUNNER_ACTION.slide
  }
  return RUNNER_ACTION.run
}

/** 0 아래 · 1 위 · 2 왼 · 3 오른 — 방향별 동작표의 칸 번호 */
function directionIndexOf(from: WorldPoint, to: WorldPoint): number {
  const dx = to.x - from.x
  const dz = to.z - from.z
  if (Math.abs(dx) > Math.abs(dz)) return dx > 0 ? 3 : 2
  return dz > 0 ? 0 : 1
}

function runActionOf(
  position: WorldPoint,
  target: WorldPoint,
  standAction: number,
  runActions: readonly [number, number, number, number],
): number {
  if (position.x === target.x && position.z === target.z) return standAction
  return runActions[directionIndexOf(position, target)]
}

function tickSince(memory: ActionMemory, key: string, action: number, tick: number): number {
  const previous = memory.get(key)
  if (previous === undefined || previous.action !== action) {
    memory.set(key, { action, since: tick })
    return 0
  }
  return tick - previous.since
}
