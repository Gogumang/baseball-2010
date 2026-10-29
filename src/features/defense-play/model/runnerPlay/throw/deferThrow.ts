import { basePosition, isSamePoint } from '@/entities/fielding/model/fieldGeometry'
import { acceptsTargetVt14 } from '@/entities/fielding/model/fielderPose'
import { AI_STATE, type FielderState, fielderArrivalTicks } from '@/entities/fielding/model/fieldingState'
import type { ThrowPlan } from '@/entities/fielding/model/throwPlan'
import type { RunnerPlayFrame } from '@/features/defense-play/model/runnerPlay/frame/runnerPlayFrame'
import { wrapBase } from '@/features/defense-play/model/runnerPlay/runners/playRunners'

/** b2eb2: 받는 야수(중계면 중계맨)가 목표점에 없고 1구간 틱(계획 [5]) 안에 못 닿는다 */
export function isReceiverLate(g: RunnerPlayFrame, plan: ThrowPlan): boolean {
  const receiver = g.fielders[plan.toSlot]
  if (receiver === undefined || isSamePoint(receiver.position, receiver.target)) return false
  return fielderArrivalTicks(receiver) > plan.firstLegTicks
}

/** b30a2 미루기 — 공 가진 야수가 이미 AI 9 면 0, 아니면 +0x15c · +0x158 · AI 9 · b30d0 vt48(루) → vt14(관문이 막으면 목표는 그대로, r196) */
export function deferThrow(g: RunnerPlayFrame, tick: number, holder: FielderState, plan: ThrowPlan): boolean {
  if (holder.aiState === AI_STATE.RECEIVE) return false
  g.deferredThrowReceiver = plan.toSlot
  g.deferredThrowBase = plan.base
  g.fielders = g.fielders.map((fielder) => (fielder.slot === holder.slot ? deferredHolderOf(fielder, plan.base) : fielder))
  g.log.push(`${tick}틱 ${holder.slot}번 야수가 ${plan.base}루 송구를 미룬다 — ${plan.toSlot}번 야수가 늦다 (AI 9)`)
  return true
}

function deferredHolderOf(fielder: FielderState, base: number): FielderState {
  if (!acceptsTargetVt14(fielder)) return { ...fielder, aiState: AI_STATE.RECEIVE }
  return { ...fielder, aiState: AI_STATE.RECEIVE, target: basePosition(base), targetBase: wrapBase(base) }
}
