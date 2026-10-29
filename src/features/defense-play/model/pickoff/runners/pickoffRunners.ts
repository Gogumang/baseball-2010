import { basePosition, isSamePoint } from '@/entities/fielding/model/fieldGeometry'
import type { RunnerState } from '@/entities/fielding/model/fieldingState'
import { type BaseState, EMPTY_BASES } from '@/entities/game/model/baseState'
import type { PickoffFrame } from '@/features/defense-play/model/pickoff/frame/pickoffFrame'
import type { PickoffRunner } from '@/features/defense-play/model/pickoff/types/pickoffTypes'

export function markSlot(marks: number[], slot: number, value: number) {
  return marks.map((current, index) => (index === slot ? value : current))
}

export function runnerStates(g: PickoffFrame) {
  return g.runners.map((runner) => runner.state)
}

export const wrapBase = (base: number) => ((base % 4) + 4) % 4

export function isAtTarget(runner: RunnerState): boolean {
  return isSamePoint(runner.position, basePosition(runner.targetBase))
}

export function basesOf(runners: readonly PickoffRunner[]): BaseState {
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
