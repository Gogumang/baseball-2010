import type { WorldPoint } from '@/entities/fielding/model/fieldGeometry'
import type { FielderState } from '@/entities/fielding/model/fieldingState'
import { axisTicks, throwFlightOf } from '@/entities/fielding/model/throwPlan/flight/throwFlight'
import type { RandomPort } from '@/shared/api/random/randomPort'

/** 악송구 수평 속도 하한 (a186e: ≤ 99 → 100) */
const MINIMUM_THROW_SPEED = 100
/** a1876: 0 ≤ w ≤ 99 → 100 · −99 ≤ w < 0 → −100 */
const MINIMUM_VERTICAL_SPEED = 100
/** a1908: 악송구 방향 흔들림의 부호 표 0xd7aec = [1, −1] */
const ERRANT_DIRECTION_SIGNS = [1, -1] as const
/** a1908: 흔들림 폭 m = rand(0, 22 − h/150) */
const DIRECTION_WOBBLE_BASE = 22
const DIRECTION_WOBBLE_SPEED_STEP = 150

/** a18a4 — 앞에서부터 처음 넘는 문턱 하나만 줄인다: (문턱, 곱, 나눔) */
const VERTICAL_DAMPING = [
  [1000, 3, 4],
  [800, 4, 5],
  [500, 5, 6],
] as const
const HORIZONTAL_DAMPING = [
  [1200, 6, 7],
  [900, 8, 9],
] as const

/** 악송구 공의 날아가기 (0xa1620 의 악송구 갈래가 정한 값) */
export interface ErrantThrowFlight {
  /** 큰 축 거리를 흔들린 수평 속도·방향으로 가는 틱 — 이 진행기의 "도착" 틱 */
  readonly ticks: number
  /** 흔들린 수평 속도 h' */
  readonly horizontalSpeed: number
  /** 흔들린 방향 φ' (도) */
  readonly direction: number
  /** 흔들린 수직 속도 w' — 공.vt44 의 둘째 인자 (a1a20) */
  readonly verticalSpeed: number
}

/** a1876: 0 에 가까운 수직 속도는 ±100 으로 민다 */
function clampVertical(vertical: number): number {
  if (vertical >= 0 && vertical < MINIMUM_VERTICAL_SPEED) return MINIMUM_VERTICAL_SPEED
  if (vertical < 0 && vertical > -MINIMUM_VERTICAL_SPEED) return -MINIMUM_VERTICAL_SPEED
  return vertical
}

const scaled = (value: number, multiplier: number, divisor: number) => Math.trunc((value * multiplier) / divisor)

/** a18a4 — 수직 속도가 크면 그것만, 아니면 수평 속도가 크면 그것만 줄인다 */
function dampSpeeds(horizontal: number, vertical: number): { horizontal: number; vertical: number } {
  const verticalRule = VERTICAL_DAMPING.find(([limit]) => vertical > limit)
  if (verticalRule !== undefined) return { horizontal, vertical: scaled(vertical, verticalRule[1], verticalRule[2]) }
  const horizontalRule = HORIZONTAL_DAMPING.find(([limit]) => horizontal > limit)
  if (horizontalRule !== undefined) return { horizontal: scaled(horizontal, horizontalRule[1], horizontalRule[2]), vertical }
  return { horizontal, vertical }
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
 * 그 뒤 공은 0xb2e38 의 메시지 0x12 → 세계 0xbfed0 이 이 h' · w' · φ' 로 다시 깔고(`thrownBallTrajectory`), 예보 vt24(0)
 * 가 줍는 야수를 고른다 — 수비 진행기 `throwBall` 의 악송구 갈래.
 */
export function errantThrowFlight(
  fielder: FielderState,
  point: WorldPoint,
  error: { readonly speedDelta: number; readonly verticalDelta: number },
  random: RandomPort,
): ErrantThrowFlight {
  const flight = throwFlightOf(fielder, point)
  const { horizontal, vertical } = dampSpeeds(
    Math.max(flight.horizontalSpeed + error.speedDelta, MINIMUM_THROW_SPEED),
    clampVertical(((flight.gravity * flight.ticks) >> 1) + error.verticalDelta),
  )
  const magnitude = random.rand(0, DIRECTION_WOBBLE_BASE - Math.trunc(horizontal / DIRECTION_WOBBLE_SPEED_STEP))
  const sign = ERRANT_DIRECTION_SIGNS[random.rand(0, 2)] ?? 1
  const direction = flight.direction + sign * magnitude
  return {
    horizontalSpeed: horizontal,
    direction,
    verticalSpeed: vertical,
    ticks: flight.axisDistance === 0 ? 0 : axisTicks(flight.axisDistance, horizontal, direction, flight.alongX),
  }
}
