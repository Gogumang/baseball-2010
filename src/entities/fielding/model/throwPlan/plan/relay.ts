import { basePosition } from '@/entities/fielding/model/fieldGeometry'
import { AI_STATE, NONE, type FielderState } from '@/entities/fielding/model/fieldingState'
import { INFIELD_READY_TICKS } from '@/entities/fielding/model/throwPlan/constants'
import { throwTicksTo, throwTicksToFielder } from '@/entities/fielding/model/throwPlan/flight/throwFlight'

/** 중계맨 후보 = 내야 칸 2~5 */
const RELAY_SLOTS = [2, 3, 4, 5] as const
/** 중계맨을 못 고르면 유격수(5, AI 상태 0xa 일 때) 아니면 2루수(3) */
const RELAY_FALLBACK_SHORTSTOP = 5
const RELAY_FALLBACK_SECOND = 3

/** 중계맨 고르기 — 후보는 내야 칸 2~5, 기준은 두 구간 송구 틱의 합 (목표점 기준) */
export function chooseRelaySlot(fielders: readonly FielderState[], thrower: FielderState, receiver: FielderState): number {
  let best = NONE
  let bestTicks = Number.POSITIVE_INFINITY
  for (const slot of RELAY_SLOTS) {
    const candidate = fielders[slot]
    if (candidate === undefined) continue
    const ticks = throwTicksTo(thrower, candidate.target) + throwTicksTo(candidate, receiver.target)
    if (ticks < bestTicks) {
      bestTicks = ticks
      best = slot
    }
  }
  if (best !== NONE) return best
  // 원본: 못 고르면 유격수(5)의 AI 상태가 0xa 일 때만 5, 아니면 2루수(3) — 0xaf4f8
  return fielders[RELAY_FALLBACK_SHORTSTOP]?.aiState === AI_STATE.BUSY ? RELAY_FALLBACK_SHORTSTOP : RELAY_FALLBACK_SECOND
}

/**
 * 중계를 낀 홈 송구처럼 "루 좌표로 보내는" 2구간 송구 틱 — 0xaf284 의 중계 가지가 쓰는 형태.
 * `공야수.vtb4(중계맨) + 중계맨.vtb8(루 좌표) + 3`
 */
export function relayTicksToBase(fielders: readonly FielderState[], thrower: FielderState, receiver: FielderState, base: number): number {
  const relaySlot = chooseRelaySlot(fielders, thrower, receiver)
  const relayFielder = fielders[relaySlot]
  return throwTicksToFielder(thrower, relayFielder) + throwTicksTo(relayFielder, basePosition(base)) + INFIELD_READY_TICKS
}
