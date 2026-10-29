import { horizontalDistance, isOutfieldSlot } from '@/entities/fielding/model/fieldGeometry'
import type { FielderState } from '@/entities/fielding/model/fieldingState'
import { INFIELD_READY_TICKS, RELAY_DISTANCE } from '@/entities/fielding/model/throwPlan/constants'
import { throwTicksTo, throwTicksToFielder } from '@/entities/fielding/model/throwPlan/flight/throwFlight'
import { chooseRelaySlot } from '@/entities/fielding/model/throwPlan/plan/relay'

/** 직접 송구에 "특수" 표시가 붙는 문턱 (0xb3444 의 `[1] = 외야수 && 특수 && 송구틱 > 17`) */
const SPECIAL_THROW_TICKS = 17

/** 송구 계획 결과 8바이트 (0xb3444) */
export interface ThrowPlan {
  /** [0] 중계인가 */
  readonly relayed: boolean
  /** [1] 특수(레이저급) 표시 */
  readonly special: boolean
  /** [2] 던지는 야수 번호 */
  readonly fromSlot: number
  /** [3] 받는 야수 번호 (중계면 중계맨) */
  readonly toSlot: number
  /** [4] 최종 받는 야수 번호 */
  readonly finalSlot: number
  /** [5] 1구간 틱 */
  readonly firstLegTicks: number
  /** [6] 전체 틱 (중계면 1구간 + 2구간 + 3) */
  readonly totalTicks: number
  /** [7] 목표 루 */
  readonly base: number
}

export interface ThrowPlanInput {
  readonly fielders: readonly FielderState[]
  readonly fromSlot: number
  readonly finalSlot: number
  readonly base: number
  /** 레이저(+0x1f4) 또는 인자로 들어온 특수 송구 */
  readonly special?: boolean
}

/** 중계 없이 받는 야수에게 바로 던진다 */
function directPlan(input: ThrowPlanInput, thrower: FielderState, receiver: FielderState, special: boolean): ThrowPlan {
  const ticks = throwTicksToFielder(thrower, receiver)
  return {
    relayed: false,
    special: isOutfieldSlot(thrower.slot) && special && ticks > SPECIAL_THROW_TICKS,
    fromSlot: input.fromSlot,
    toSlot: input.finalSlot,
    finalSlot: input.finalSlot,
    firstLegTicks: ticks,
    totalTicks: ticks,
    base: input.base,
  }
}

/** 내야 중계맨을 끼운다 — 전체 틱 = 1구간 + 2구간(중계맨 → 받는 야수 목표점) + 3 */
function relayPlan(input: ThrowPlanInput, thrower: FielderState, receiver: FielderState): ThrowPlan {
  const relaySlot = chooseRelaySlot(input.fielders, thrower, receiver)
  const relayFielder = input.fielders[relaySlot]
  const firstLeg = throwTicksToFielder(thrower, relayFielder)
  const secondLeg = throwTicksTo(relayFielder, receiver.target)
  return {
    relayed: true,
    special: false,
    fromSlot: input.fromSlot,
    toSlot: relaySlot,
    finalSlot: input.finalSlot,
    firstLegTicks: firstLeg,
    totalTicks: firstLeg + secondLeg + INFIELD_READY_TICKS,
    base: input.base,
  }
}

/**
 * 0xb3444 — 외야에서 멀리 던질 때 내야 중계를 끼울지 정한다.
 *
 * 중계 조건: 던지는 야수가 외야(칸 > 5) && 특수가 아니고 && 던지는 위치 ~ 받는 야수 목표점 거리 ≥ 17000.
 * 중계맨 = 내야 칸 2~5 중 `송구틱(외야수→i 목표점) + 송구틱(i→최종 목표점)` 최소.
 */
export function planThrow(input: ThrowPlanInput): ThrowPlan {
  const thrower = input.fielders[input.fromSlot]
  const receiver = input.fielders[input.finalSlot]
  const special = input.special === true
  const needsRelay = isOutfieldSlot(thrower.slot) && !special && horizontalDistance(thrower.position, receiver.target) >= RELAY_DISTANCE
  return needsRelay ? relayPlan(input, thrower, receiver) : directPlan(input, thrower, receiver, special)
}
