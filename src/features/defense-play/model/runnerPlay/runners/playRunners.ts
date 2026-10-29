import type { SlidingRunner } from '@/entities/defense-controls/model/sliding'
import { basePosition, isSamePoint, progressPercent, ticksToReach } from '@/entities/fielding/model/fieldGeometry'
import { isReadyToThrow } from '@/entities/fielding/model/fielderPose'
import type { RunnerState } from '@/entities/fielding/model/fieldingState'
import { type BaseState, EMPTY_BASES } from '@/entities/game/model/baseState'
import type { RunnerPlayFrame } from '@/features/defense-play/model/runnerPlay/frame/runnerPlayFrame'
import type { PlayRunner } from '@/features/defense-play/model/runnerPlay/types/runnerPlayTypes'

export const wrapBase = (base: number) => ((base % 4) + 4) % 4

export function isAtTarget(runner: RunnerState): boolean {
  return isSamePoint(runner.position, basePosition(runner.targetBase))
}

/** 다음 구간 시작 — 출발점(+0x14)과 닿은 루(+0x8c)를 새로 잡는다 (타구 진행기 `startLeg` 와 같다) */
export function startLeg(runner: PlayRunner, toBase: number): void {
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

export function basesOf(runners: readonly PlayRunner[]): BaseState {
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

export function markSlot(marks: number[], slot: number, value: number) {
  return marks.map((current, index) => (index === slot ? value : current))
}

export function runnerStates(g: RunnerPlayFrame) {
  return g.runners.map((runner) => runner.state)
}

/**
 * 공 쥔 야수 vtC4 = 0xa20ec — 자세 워드(+0xb0~+0xb3) 0 · 잠금 +0xb4 ≤ 0 · +0xc8(준비 틱) ≤ 0. 준비 틱은 쥐기 0xb2710(P, f, 1)이 넣고
 * 야수 틱 0xa1284 가 줄인다. 받는 포구의 자세 워드도 여기서 막는다(r176 — 타구 진행기와 같은 `fielderPose`)
 */
export function isHolderReady(g: RunnerPlayFrame): boolean {
  const holder = g.fielders[g.play.ballHolderSlot]
  return g.play.held && holder !== undefined && holder.holdingBall && isReadyToThrow(holder)
}

export function batterRunnerOf(g: RunnerPlayFrame) {
  return g.runners[0]?.state.isBatterRunner === true ? g.runners[0].state : undefined
}
