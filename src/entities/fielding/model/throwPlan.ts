import {
  basePosition,
  horizontalDistance,
  isOutfieldSlot,
  UNREACHABLE_TICKS,
  type WorldPoint,
} from '@/entities/fielding/model/fieldGeometry'
import { AI_STATE, NONE, type FielderState } from '@/entities/fielding/model/fieldingState'
import { SINE_HUNDRED_TABLE } from '@/shared/config/original/trigonometryTables'
import { atan2Degrees, cosineSixteen, sineSixteen } from '@/shared/lib/math/originalTrigonometry'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { randomIntegerBelow } from '@/shared/lib/random/originalRandom'

/** 악송구 수평 속도 하한 (a186e: ≤ 99 → 100) */
const MINIMUM_THROW_SPEED = 100

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
/** cfg+0x1c = 70 — 내야(칸 ≤ 5) 송구 공 **중력** 배율(%) — 0xa1adc · 0xa16f4 가 공+0x44 에 곱한다 */
export const THROW_COEFFICIENT_INFIELD = 70
/** cfg+0x1e = 80 — 외야 송구 공 중력 배율(%) */
export const THROW_COEFFICIENT_OUTFIELD = 80
/**
 * 공 중력 공+0x44 = **90**. 공 생성 0xa267c 가 `0xbef18(공, 0x5a)` 로 넣고, 화면 초기화 0x3edd0 이
 * `[장면+0x19cc]`(0xb08e8 = data/pattern.dat 적재본)+4 바이트[4] 로 다시 넣는데 그 파일 바이트 4 도 0x5a 다.
 * 송구 0xa1620 은 0xa279c 로 잠깐 배율을 곱했다가 궤적을 다 만든 0xa2a88 끝(a2b24)에서 되돌린다 —
 * 그래서 0xa1adc 가 읽을 때는 늘 90 이다.
 */
const BALL_GRAVITY = 90
/** 0xa1adc 가 수평 속도 0 일 때 돌려주는 값 (a1b7e) */
const NEVER_ARRIVES = 0x7fffffff
/** 0xbfab0 역사인 표(0xd8de0, sin×100 0~90°)의 마지막 칸 */
const LAST_ARCSINE_INDEX = 90
/** 직접 송구에 "특수" 표시가 붙는 문턱 (0xb3444 의 `[1] = 외야수 && 특수 && 송구틱 > 17`) */
const SPECIAL_THROW_TICKS = 17
/** 중계맨 후보 = 내야 칸 2~5 */
const RELAY_SLOTS = [2, 3, 4, 5] as const
/** 중계맨을 못 고르면 유격수(5, AI 상태 0xa 일 때) 아니면 2루수(3) */
const RELAY_FALLBACK_SHORTSTOP = 5
const RELAY_FALLBACK_SECOND = 3

/** 0xbfab0 — sin×100 표(0xd8de0) 이진 탐색. lo 0 · hi 90 에서 가운데가 두 번 같으면 멈춘다. 음수는 −asin(−x) */
function arcsineDegrees(value: number): number {
  if (value < 0) return -arcsineDegrees(-value)
  let low = 0
  let high = LAST_ARCSINE_INDEX
  let previous = -1
  for (;;) {
    const middle = (low + high) >> 1
    if (middle === previous) return middle
    previous = middle
    if (value < SINE_HUNDRED_TABLE[middle]) high = middle
    else low = middle
  }
}

/**
 * 송구가 어떤 점에 닿는 틱 — 야수 vt 0xbc = **0xa1adc** (야수 vt 0xb8 = 0xa1a98 이 제 위치 +0x20 과 점을,
 * vt 0xb4 = 0xa1a60 이 상대의 +0x20 을 넘긴다). 궤적 물리 루프(0xb401c)가 아니라 정수 산술과 표뿐이다 (직접 뜬 것):
 * ```
 * a1aea  g = [야수+0xd0](공)+0x44 = 90 ; c = 칸(+0x88) ≤ 5 ? cfg+0x1c(70) : cfg+0x1e(80)
 * a1b10  g' = c·g / 100                                     ; 63 · 72
 * a1b40  d = 0xbf9f0(위치, 점) = isqrt(dx² + dz²) ; d == 0 → 0
 * a1b4c  s = d·g'·100 / v²      (v = 야수+0xdc 송구 속도)   ; sin(2θ)×100
 * a1b66  θ = 0xbfab0(s) >> 1                                ; 표 0xd8de0 역사인
 * a1b74  h = (v · cos16(θ)) >> 16 ; h == 0 → 0x7fffffff     ; 수평 속도
 * a1b8a  방향 φ: dx == 0 → dz > 0 ? 90 : −90, 아니면 0x6c71c(|dz·10000/dx|) 를 사분면에 붙인다
 * a1bd8  |dx| > |dz| → ⌈|dx| / |h·cos16(φ) >> 16|⌉ , 아니면 ⌈|dz| / |h·sin16(φ) >> 16|⌉   (0x6c5d8 = 올림 나눗셈)
 * ```
 * 곧 **70/80 % 는 속도가 아니라 중력 배율**이고, 공은 수평 속도 v·cosθ 로 큰 축을 따라 한 틱씩 간다
 * (공 틱 0xa28c0 의 `x += cos·속도 >> 16` 과 같은 걸음). 송구 0xa1620 도 같은 식으로 쏜다.
 * ⚠️ 원본 그대로: v 는 +0xdc **지난 송구의 속도**다(`FielderState.throwSpeed`) — 0xa1620 이 송구마다 특수면 +0xd8(130%),
 * 아니면 +0xd4 로 덮어쓰고(a16ec), 판 시작 0xb0fb4 → 0xa0fc4 가 +0xd4 로 되돌린다. `thrownWith` 가 그 덮어쓰기다.
 * (거리 20400 을 넘으면 원바운드가 되는 것은 0xa1620 쪽이다 — `BOUNCE_THROW_DISTANCE`)
 */
export function throwTicksTo(fielder: FielderState, point: WorldPoint): number {
  return throwFlightOf(fielder, point).ticks
}

/** 0xa1adc · 0xa1620 이 함께 쓰는 중간값 — 중력 g' · 수평 속도 h · 방향 φ · 큰 축 */
interface ThrowFlight {
  readonly ticks: number
  readonly gravity: number
  readonly horizontalSpeed: number
  readonly direction: number
  readonly alongX: boolean
  readonly axisDistance: number
}

function throwFlightOf(fielder: FielderState, point: WorldPoint): ThrowFlight {
  const from = fielder.position
  const coefficient = isOutfieldSlot(fielder.slot) ? THROW_COEFFICIENT_OUTFIELD : THROW_COEFFICIENT_INFIELD
  const gravity = Math.trunc((coefficient * BALL_GRAVITY) / 100)
  const dx = point.x - from.x
  const dz = point.z - from.z
  const alongX = Math.abs(dx) > Math.abs(dz)
  const axisDistance = alongX ? Math.abs(dx) : Math.abs(dz)
  const direction = atan2Degrees(dx, dz)
  const base = { gravity, direction, alongX, axisDistance }
  const distance = horizontalDistance(from, point)
  if (distance === 0) return { ...base, ticks: 0, horizontalSpeed: 0 }
  const speed = fielder.throwSpeed
  if (speed <= 0) return { ...base, ticks: UNREACHABLE_TICKS, horizontalSpeed: 0 }
  const sineOfDouble = Math.trunc((distance * gravity * 100) / (speed * speed))
  const elevation = arcsineDegrees(sineOfDouble) >> 1
  const horizontalSpeed = (speed * cosineSixteen(elevation)) >> 16
  if (horizontalSpeed === 0) return { ...base, ticks: NEVER_ARRIVES, horizontalSpeed }
  return { ...base, horizontalSpeed, ticks: axisTicks(axisDistance, horizontalSpeed, direction, alongX) }
}

/** a1b8a~a1bd8 · a17b0~a17e0 — 큰 축 거리 ÷ 그 축 속도 성분, 올림(0x6c5d8) */
function axisTicks(axisDistance: number, horizontalSpeed: number, direction: number, alongX: boolean): number {
  const axisSpeed = Math.abs((horizontalSpeed * (alongX ? cosineSixteen(direction) : sineSixteen(direction))) >> 16)
  // 큰 축 성분은 cos/sin 45° 이상이라 0 이 안 된다 — 0 이면 원본은 0 으로 나눈다(지어내지 않고 도달 못 함으로 둔다)
  if (axisSpeed === 0) return NEVER_ARRIVES
  return Math.ceil(axisDistance / axisSpeed)
}

/** a1908: 악송구 방향 흔들림의 부호 표 0xd7aec = [1, −1] */
const ERRANT_DIRECTION_SIGNS = [1, -1] as const

/** 악송구 공의 날아가기 (0xa1620 의 악송구 갈래가 정한 값) */
export interface ErrantThrowFlight {
  /** 큰 축 거리를 흔들린 수평 속도·방향으로 가는 틱 — 이 진행기의 "도착" 틱 */
  readonly ticks: number
  /** 흔들린 수평 속도 h' */
  readonly horizontalSpeed: number
  /** 흔들린 방향 φ' (도) */
  readonly direction: number
}

/**
 * **악송구 갈래** — 0xa1620 이 `rand(0,10000) < 기준`(0xa1828, `rollThrowError`) 뒤에 공을 흔든다 (직접 뜬 것).
 * `rollThrowError` 가 앞 굴림 셋(기준 · 수평 속도 · 수직 속도)을 했고, 여기서 나머지 둘을 굴린다.
 * ```
 * a173c  h = v·cos16(θ) >> 16 ; t = ⌈큰 축 거리 / |h·cos|sin(φ) >> 16|⌉        ; 0xa1adc 와 같은 산술
 * a17e4  w = g'·t >> 1                                                            ; 수직 속도(공+0x44 = g')
 * a1868  h += rand(−50, 특수?0:51) ; h ≤ 99 → 100
 * a1876  w += rand(−49, 특수?0:50) ; 0 ≤ w ≤ 99 → 100 · −99 ≤ w < 0 → −100
 * a18a4  w > 1000 → w·3/4 · w > 800 → w·4/5 · w > 500 → w·5/6
 *        아니면 h > 1200 → h·6/7 · h > 900 → h·8/9
 * a1908  m = rand(0, 22 − h/150) ; φ += [1, −1][rand(0,2)] · m ; +0xc0 = 4 → a19d2 h · w · φ 로 쏜다
 * ```
 * ⚠️ 그 뒤 공 경로(궤적 물리 0xb401c, 해독 금지 구역)와 누가 줍는지는 안 옮겼다 — 이 진행기는 악송구를 "아무도 못 받는다" 로
 * 보고, 공이 원래 목표의 큰 축 거리를 h'·φ' 로 다 가는 틱을 도착 틱으로 쓴다(근사).
 */
export function errantThrowFlight(
  fielder: FielderState,
  point: WorldPoint,
  error: { readonly speedDelta: number; readonly verticalDelta: number },
  random: RandomPort,
): ErrantThrowFlight {
  const flight = throwFlightOf(fielder, point)
  let horizontal = flight.horizontalSpeed + error.speedDelta
  if (horizontal <= 99) horizontal = MINIMUM_THROW_SPEED
  let vertical = ((flight.gravity * flight.ticks) >> 1) + error.verticalDelta
  if (vertical >= 0 && vertical <= 99) vertical = 100
  else if (vertical < 0 && vertical > -100) vertical = -100
  if (vertical > 1000) vertical = Math.trunc((vertical * 3) / 4)
  else if (vertical > 800) vertical = Math.trunc((vertical * 4) / 5)
  else if (vertical > 500) vertical = Math.trunc((vertical * 5) / 6)
  else if (horizontal > 1200) horizontal = Math.trunc((horizontal * 6) / 7)
  else if (horizontal > 900) horizontal = Math.trunc((horizontal * 8) / 9)
  const magnitude = randomIntegerBelow(random, 0, 22 - Math.trunc(horizontal / 150))
  const sign = ERRANT_DIRECTION_SIGNS[randomIntegerBelow(random, 0, 2)] ?? 1
  const direction = flight.direction + sign * magnitude
  return {
    horizontalSpeed: horizontal,
    direction,
    ticks: flight.axisDistance === 0 ? 0 : axisTicks(flight.axisDistance, horizontal, direction, flight.alongX),
  }
}

/** 레이저 송구(플레이+0x1f4) 속도 — 0xb2e38 이 고르는 야수 vtb0 = 0xa222c 가 `+0xdc = 0xfa << 3` 으로 넣는다 (a229c) */
export const LASER_THROW_SPEED = 2000

/** 특수 송구 속도 +0xd8 = +0xd4 × 130 / 100 (0xa0fc4) */
export const SPECIAL_THROW_SPEED_PERCENT = 130

/**
 * 던지는 순간의 +0xdc — 0xa1620 a16dc~a16ec: `+0xdc = 특수 ? +0xd8 : +0xd4`. 던진 뒤에도 그 판 동안 남는다.
 */
export function thrownWith(fielder: FielderState, special: boolean): FielderState {
  const speed = special
    ? Math.trunc((fielder.baseThrowSpeed * SPECIAL_THROW_SPEED_PERCENT) / 100)
    : fielder.baseThrowSpeed
  return speed === fielder.throwSpeed ? fielder : { ...fielder, throwSpeed: speed }
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
