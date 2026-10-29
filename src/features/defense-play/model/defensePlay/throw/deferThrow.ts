import { basePosition, isSamePoint } from '@/entities/fielding/model/fieldGeometry'
import { AI_STATE, type FielderState, fielderArrivalTicks } from '@/entities/fielding/model/fieldingState'
import type { ThrowPlan } from '@/entities/fielding/model/throwPlan'
import { wrapBase } from '@/features/defense-play/model/defensePlay/runners/mutableRunner'
import type { TickFrame } from '@/features/defense-play/model/defensePlay/step/tickFrame'
import type { ThrowChooser } from '@/features/defense-play/model/defensePlay/throw/throwChooser'
import type { DefensePlayState } from '@/features/defense-play/model/defensePlay/types/defensePlayState'

/** b2eb2~b2ee4: 받는 야수(중계면 중계맨)가 목표점에 없고 1구간 틱 안에 못 닿으면 미룬다 (AI 9) */
export function isReceiverLate(s: DefensePlayState, plan: ThrowPlan): boolean {
  const receiver = s.fielders[plan.toSlot]
  if (receiver === undefined || isSamePoint(receiver.position, receiver.target)) return false
  return fielderArrivalTicks(receiver) > plan.firstLegTicks
}

/**
 * b30a2 미루기: 공가진야수 AI == 9 → 0 / 아니면 +0x15c = [3] · +0x158 = [7] · AI 9 · 공가진야수.vt48([7]) ; 1.
 * 미룰 때 공 가진 야수는 vt48(루)로 그 루를 향해 걷는다(`moveFielder`) — AI 고리의 AI 9 갈래(b4838)가 다시 보낸다
 */
export function deferThrow(s: DefensePlayState, t: TickFrame, holder: FielderState, plan: ThrowPlan, chooser: ThrowChooser): boolean {
  if (holder.aiState === AI_STATE.RECEIVE) return false
  s.deferredThrowReceiver = plan.toSlot
  s.deferredThrowBase = plan.base
  const point = basePosition(plan.base)
  s.fielders = s.fielders.map((fielder) =>
    fielder.slot === holder.slot ? { ...fielder, aiState: AI_STATE.RECEIVE, target: point, targetBase: wrapBase(plan.base) } : fielder,
  )
  const byCpu = chooser === 'CPU' ? ' (CPU 결정)' : ''
  s.log.push(`${t.tick}틱 ${holder.slot}번 야수가 ${plan.base}루 송구를 미룬다 — ${plan.toSlot}번 야수가 늦다 (AI 9)${byCpu}`)
  return true
}
