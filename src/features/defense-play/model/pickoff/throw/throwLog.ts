import type { ThrowPlan } from '@/entities/fielding/model/throwPlan'
import { PICKOFF_THROW } from '@/features/defense-play/model/pickoff/constants'
import type { PickoffFrame } from '@/features/defense-play/model/pickoff/frame/pickoffFrame'
import type { ThrownBall } from '@/features/defense-play/model/throwLaunch'

export interface ThrowLogFacts {
  readonly tick: number
  readonly holderSlot: number
  readonly base: number
  readonly laser: boolean
  readonly cpuSpecial: boolean
  readonly plan: ThrowPlan
  readonly thrown: ThrownBall
  /** 기록 줄 꼬리 — 견제 송구(`PICKOFF_THROW`)는 머리를 "견제 송구" 로 쓰고 꼬리를 안 붙인다 */
  readonly chooser: string
}

/** 송구 한 번의 기록 줄 — 받는 틱 · 줍는 야수는 송구 예보(`takeLooseBall`) 뒤의 쫓는 공으로 본다 */
export function throwLogOf(g: PickoffFrame, facts: ThrowLogFacts): string {
  const { plan, thrown } = facts
  const pickoff = facts.chooser === PICKOFF_THROW
  const special = facts.cpuSpecial ? ' (특수)' : ''
  const relay = plan.relayed ? ` (${plan.toSlot}번 야수 중계)` : ''
  const bounce = thrown.bounce ? ' (원바운드)' : ''
  const tail = pickoff ? '' : facts.chooser
  return `${throwHeadOf(g, facts, pickoff)}${special}${relay}${bounce}${flightNoteOf(thrown)}${pickerNoteOf(g, plan)}${tail}`
}

function throwHeadOf(g: PickoffFrame, facts: ThrowLogFacts, pickoff: boolean): string {
  const arrival = g.chase?.catchTick ?? facts.tick
  if (pickoff) return `${facts.tick}틱 ${facts.base}루 견제 송구 — ${arrival}틱 도착`
  const laser = facts.laser ? '레이저 ' : ''
  return `${facts.tick}틱 ${facts.holderSlot}번 야수가 ${facts.base}루로 ${laser}송구 — ${arrival}틱 도착`
}

function flightNoteOf(thrown: ThrownBall): string {
  if (thrown.errant) return ' (악송구)'
  return thrown.wobbled ? ' (흔들린 긴 송구)' : ''
}

function pickerNoteOf(g: PickoffFrame, plan: ThrowPlan): string {
  return g.chase !== null && g.chase.slot !== plan.toSlot ? ` (${g.chase.slot}번 야수가 줍는다)` : ''
}
