import {
  basePosition,
  horizontalDistance,
  isOutfieldSlot,
  UNREACHABLE_TICKS,
  type WorldPoint,
} from '@/entities/fielding/model/fieldGeometry'
import { AI_STATE, NONE, type FielderState } from '@/entities/fielding/model/fieldingState'

/**
 * 송구 계획 0xb3444 (플레이 vt 0x8c) 와 송구 도착 틱 (야수 vt 0xbc = 0xa1adc).
 * 설정값은 d_level.dat (cfg = 파일 + 4) 에서 온다 — S7 5-2 에서 실측으로 확정된 값들이다.
 */

/** cfg+0x20 = 3 — 내야수가 잡고 던지기까지 / 중계 받고 다시 던지는 지연 */
export const INFIELD_READY_TICKS = 3
/** cfg+0x22 = 6 — 외야수가 잡고 던지기까지 */
export const OUTFIELD_READY_TICKS = 6
/** cfg+0x42 = 17000 — 중계 문턱 (파일 0x3e, 미정렬 u32 로 읽어도 17000) */
export const RELAY_DISTANCE = 17_000
/** cfg+0x1c = 70 — 내야 송구 속도 계수(%) */
export const THROW_COEFFICIENT_INFIELD = 70
/** cfg+0x1e = 80 — 외야 송구 속도 계수(%) */
export const THROW_COEFFICIENT_OUTFIELD = 80
/** 직접 송구에 "특수" 표시가 붙는 문턱 (0xb3444 의 `[1] = 외야수 && 특수 && 송구틱 > 17`) */
const SPECIAL_THROW_TICKS = 17
/** 중계맨 후보 = 내야 칸 2~5 */
const RELAY_SLOTS = [2, 3, 4, 5] as const
/** 중계맨을 못 고르면 유격수(5, AI 상태 0xa 일 때) 아니면 2루수(3) */
const RELAY_FALLBACK_SHORTSTOP = 5
const RELAY_FALLBACK_SECOND = 3

/** 송구 유효 속도 = 송구 공 속도 × (내야 70 / 외야 80) ÷ 100 (0xa1adc, S8 2-3) */
export function effectiveThrowSpeedOf(fielder: FielderState): number {
  const coefficient = isOutfieldSlot(fielder.slot) ? THROW_COEFFICIENT_OUTFIELD : THROW_COEFFICIENT_INFIELD
  return Math.trunc((fielder.throwSpeed * coefficient) / 100)
}

/**
 * 송구가 어떤 점에 닿는 틱 — 야수 vt 0xbc = 0xa1adc (야수 vt 0xb8 이 점을, vt 0xb4 가 다른 캐릭터를 받는다).
 *
 * **근사**: 원본은 거리와 속도로 asin/cos 표(0xbfab0·0x6c7f4)를 써 포물선을 만든 뒤 그 길이를 센다.
 * 그 탄도 계산은 타구 궤적과 같은 물리 루프라 아직 안 풀었다 — 여기서는 "거리 ÷ 유효 속도" 로 둔다.
 * (거리 20400 을 넘으면 원바운드가 되는 것도 그쪽 몫이다 — `BOUNCE_THROW_DISTANCE`)
 */
export function throwTicksTo(fielder: FielderState, point: WorldPoint): number {
  const speed = effectiveThrowSpeedOf(fielder)
  if (speed <= 0) return UNREACHABLE_TICKS
  return Math.trunc(horizontalDistance(fielder.position, point) / speed)
}

/** 다른 야수에게 던지는 틱 — vt 0xb4 = 0xa1a60 (상대 +0x20 위치를 vt 0xb8 에 넘긴다) */
export function throwTicksToFielder(fielder: FielderState, receiver: FielderState): number {
  return throwTicksTo(fielder, receiver.position)
}

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
  const needsRelay =
    isOutfieldSlot(thrower.slot) &&
    !special &&
    horizontalDistance(thrower.position, receiver.target) >= RELAY_DISTANCE

  if (!needsRelay) {
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

/** 중계맨 고르기 — 후보는 내야 칸 2~5, 기준은 두 구간 송구 틱의 합 (목표점 기준) */
export function chooseRelaySlot(
  fielders: readonly FielderState[],
  thrower: FielderState,
  receiver: FielderState,
): number {
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
  return fielders[RELAY_FALLBACK_SHORTSTOP]?.aiState === AI_STATE.BUSY
    ? RELAY_FALLBACK_SHORTSTOP
    : RELAY_FALLBACK_SECOND
}

/**
 * 중계를 낀 홈 송구처럼 "루 좌표로 보내는" 2구간 송구 틱 — 0xaf284 의 중계 가지가 쓰는 형태.
 * `공야수.vtb4(중계맨) + 중계맨.vtb8(루 좌표) + 3`
 */
export function relayTicksToBase(
  fielders: readonly FielderState[],
  thrower: FielderState,
  receiver: FielderState,
  base: number,
): number {
  const relaySlot = chooseRelaySlot(fielders, thrower, receiver)
  const relayFielder = fielders[relaySlot]
  return (
    throwTicksToFielder(thrower, relayFielder) +
    throwTicksTo(relayFielder, basePosition(base)) +
    INFIELD_READY_TICKS
  )
}

/** 잡고 던지기까지의 준비 틱 — 내야 3 · 외야 6 (cfg+0x20 / cfg+0x22) */
export function readyTicksOf(slot: number): number {
  return isOutfieldSlot(slot) ? OUTFIELD_READY_TICKS : INFIELD_READY_TICKS
}
