import type { ThrowPlan } from '@/entities/fielding/model/throwPlan'
import type { RunnerPlayFrame } from '@/features/defense-play/model/runnerPlay/frame/runnerPlayFrame'
import type { ThrowChooser } from '@/features/defense-play/model/runnerPlay/types/runnerPlayTypes'
import type { ThrownBall } from '@/features/defense-play/model/throwLaunch'

export interface ThrowLogFacts {
  readonly tick: number
  readonly holderSlot: number
  readonly base: number
  readonly laser: boolean
  readonly cpuSpecial: boolean
  readonly plan: ThrowPlan
  readonly thrown: ThrownBall
  readonly byHuman: ThrowChooser
}

/** 송구 한 번의 기록 줄 — 받는 틱 · 줍는 야수는 송구 예보(`takeLooseBall`) 뒤의 쫓는 공으로 본다 */
export function throwLogOf(g: RunnerPlayFrame, facts: ThrowLogFacts): string {
  const { tick, holderSlot, base, plan, thrown } = facts
  const laser = facts.laser ? '레이저 ' : ''
  const special = facts.cpuSpecial ? ' (특수)' : ''
  const relay = plan.relayed ? ` (${plan.toSlot}번 야수 중계)` : ''
  const bounce = thrown.bounce ? ' (원바운드)' : ''
  const head = `${tick}틱 ${holderSlot}번 야수가 ${base}루로 ${laser}송구 — ${g.chase?.catchTick ?? tick}틱 도착`
  return `${head}${special}${relay}${bounce}${flightNoteOf(thrown)}${pickerNoteOf(g, plan)}${chooserNoteOf(facts.byHuman)}`
}

/** 예보가 고른 야수가 계획의 받는 야수가 아니면 그 야수가 줍는다 */
function pickerNoteOf(g: RunnerPlayFrame, plan: ThrowPlan): string {
  return g.chase !== null && g.chase.slot !== plan.toSlot ? ` (${g.chase.slot}번 야수가 줍는다)` : ''
}

function flightNoteOf(thrown: ThrownBall): string {
  if (thrown.errant) return ' (악송구)'
  return thrown.wobbled ? ' (흔들린 긴 송구)' : ''
}

/** 누가 고른 송구인가 — 사람 키(참)는 꼬리가 없다 */
function chooserNoteOf(byHuman: ThrowChooser): string {
  if (byHuman === '미룬') return ' (AI 9 미룬 송구)'
  if (byHuman === '중계') return ' (중계 이어 던지기)'
  return byHuman ? '' : ' (CPU 결정)'
}
