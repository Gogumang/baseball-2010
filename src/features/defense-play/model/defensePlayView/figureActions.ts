import { CATCH_KIND } from '@/entities/fielding/model/catchPrediction'
import { basePosition, isSamePoint, progressPercent, SLIDING_PROGRESS_RANGE, type WorldPoint } from '@/entities/fielding/model/fieldGeometry'
import { NONE, type FielderState, type RunnerState } from '@/entities/fielding/model/fieldingState'
import type { ViewStateInput } from '@/features/defense-play/model/defensePlayView/viewStateInput'
import { FIELDER_ACTION, RUNNER_ACTION } from '@/shared/config/original/defenseAnimations'

/*
 * 그림 동작 번호 고르기 — R3 2-1(야수 vt44 = 0xa1234) · R3 8-1(주자 vt40 = 0xa0070) 의 표.
 * 어느 틱에 어느 칸을 쓰는지는 원본 동작 큐를 안 읽었으므로 **움직이는 방향에서 뽑아 쓴다(근사)**.
 */

/** 야수 달리기 동작 — 방향 칸 0 아래 · 1 위 · 2 왼 · 3 오른 차례 */
const FIELDER_RUN_ACTIONS = [FIELDER_ACTION.runDown, FIELDER_ACTION.runUp, FIELDER_ACTION.runLeft, FIELDER_ACTION.runRight] as const

/** 야수 동작 — 포구 > 송구 > 달리기 > 제자리 */
export function fielderActionOf(fielder: FielderState, input: ViewStateInput): number {
  if (fielder.slot === input.chaserSlot && input.catchKind !== null) {
    return catchActionOf(input.catchKind, fielder.position, input.ball)
  }
  if (fielder.slot === input.throwingSlot) return FIELDER_ACTION.throw
  return runActionOf(fielder.position, fielder.target, FIELDER_ACTION.stand, FIELDER_RUN_ACTIONS)
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
export function runnerActionOf(runner: RunnerState, input: ViewStateInput): number {
  const target = basePosition(runner.targetBase)
  if (isSamePoint(runner.position, target)) return RUNNER_ACTION.stand
  const progress = progressPercent(runner.legStart, runner.position, target)
  if (isPlayedOn(input.throwBase, runner.targetBase) && isSlidingProgress(progress)) return RUNNER_ACTION.slide
  return RUNNER_ACTION.run
}

/** 송구가 이 주자의 목표 루로 가고 있나 */
function isPlayedOn(throwBase: number, targetBase: number): boolean {
  return throwBase !== NONE && baseIndexOf(throwBase) === baseIndexOf(targetBase)
}

/** 슬라이딩 구간(목표 루까지 남은 진행 막판)인가 */
function isSlidingProgress(progress: number): boolean {
  return progress >= SLIDING_PROGRESS_RANGE.minimum && progress <= SLIDING_PROGRESS_RANGE.maximum
}

/** 루 번호를 0~3 으로 (음수도 바르게 돈다) */
function baseIndexOf(base: number): number {
  return ((base % 4) + 4) % 4
}

/** 0 아래 · 1 위 · 2 왼 · 3 오른 — 방향별 동작표의 칸 번호 */
function directionIndexOf(from: WorldPoint, to: WorldPoint): number {
  const dx = to.x - from.x
  const dz = to.z - from.z
  if (Math.abs(dx) > Math.abs(dz)) return dx > 0 ? 3 : 2
  return dz > 0 ? 0 : 1
}

function runActionOf(position: WorldPoint, target: WorldPoint, standAction: number, runActions: readonly [number, number, number, number]): number {
  if (position.x === target.x && position.z === target.z) return standAction
  return runActions[directionIndexOf(position, target)]
}
