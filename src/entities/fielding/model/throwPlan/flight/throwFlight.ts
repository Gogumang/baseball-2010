import { horizontalDistance, UNREACHABLE_TICKS, type WorldPoint } from '@/entities/fielding/model/fieldGeometry'
import type { FielderState } from '@/entities/fielding/model/fieldingState'
import { throwGravityPercentOf } from '@/entities/fielding/model/throwPlan/constants'
import { arcsineDegrees } from '@/entities/fielding/model/throwPlan/flight/arcsine'
import { atan2Degrees, cosineSixteen, sineSixteen } from '@/shared/lib/math/originalTrigonometry'

/**
 * 공 중력 공+0x44 = **90**. 공 생성 0xa267c 가 `0xbef18(공, 0x5a)` 로 넣고, 화면 초기화 0x3edd0 이
 * `[장면+0x19cc]`(0xb08e8 = data/pattern.dat 적재본)+4 바이트[4] 로 다시 넣는데 그 파일 바이트 4 도 0x5a 다.
 * 송구 0xa1620 은 0xa279c 로 잠깐 배율을 곱했다가 궤적을 다 만든 0xa2a88 끝(a2b24)에서 되돌린다 —
 * 그래서 0xa1adc 가 읽을 때는 늘 90 이다.
 */
const BALL_GRAVITY = 90
/** 0xa1adc 가 수평 속도 0 일 때 돌려주는 값 (a1b7e) */
export const NEVER_ARRIVES = 0x7fffffff

/** 0xa1adc · 0xa1620 이 함께 쓰는 중간값 — 중력 g' · 수평 속도 h · 방향 φ · 큰 축 */
export interface ThrowFlight {
  readonly ticks: number
  readonly gravity: number
  readonly horizontalSpeed: number
  readonly direction: number
  readonly alongX: boolean
  readonly axisDistance: number
}

/** a1b8a~a1bd8 · a17b0~a17e0 — 큰 축 거리 ÷ 그 축 속도 성분, 올림(0x6c5d8) */
export function axisTicks(axisDistance: number, horizontalSpeed: number, direction: number, alongX: boolean): number {
  const axisSpeed = Math.abs((horizontalSpeed * (alongX ? cosineSixteen(direction) : sineSixteen(direction))) >> 16)
  // 큰 축 성분은 cos/sin 45° 이상이라 0 이 안 된다 — 0 이면 원본은 0 으로 나눈다(지어내지 않고 도달 못 함으로 둔다)
  if (axisSpeed === 0) return NEVER_ARRIVES
  return Math.ceil(axisDistance / axisSpeed)
}

/**
 * @param elevationCap 0xa1620 의 원바운드 갈래(a16be~a16ce): 특수 && 거리 > 상한이면 **앙각을 구할 거리만** 상한으로 바꾼다
 *   (큰 축 틱 t 는 a1796~a17e0 이 실제 dx · dz 로 잰다).
 */
export function throwFlightOf(fielder: FielderState, point: WorldPoint, elevationCap?: number): ThrowFlight {
  const from = fielder.position
  const gravity = Math.trunc((throwGravityPercentOf(fielder.slot) * BALL_GRAVITY) / 100)
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
  const elevationDistance = elevationCap !== undefined && distance > elevationCap ? elevationCap : distance
  const sineOfDouble = Math.trunc((elevationDistance * gravity * 100) / (speed * speed))
  const elevation = arcsineDegrees(sineOfDouble) >> 1
  const horizontalSpeed = (speed * cosineSixteen(elevation)) >> 16
  if (horizontalSpeed === 0) return { ...base, ticks: NEVER_ARRIVES, horizontalSpeed }
  return { ...base, horizontalSpeed, ticks: axisTicks(axisDistance, horizontalSpeed, direction, alongX) }
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
 * 원본 그대로: v 는 +0xdc **지난 송구의 속도**다(`FielderState.throwSpeed`) — 0xa1620 이 송구마다 특수면 +0xd8(130%),
 * 아니면 +0xd4 로 덮어쓰고(a16ec), 판 시작 0xb0fb4 → 0xa0fc4 가 +0xd4 로 되돌린다. `thrownWith` 가 그 덮어쓰기다.
 * (거리 20400 을 넘으면 원바운드가 되는 것은 0xa1620 쪽이다 — `BOUNCE_THROW_DISTANCE`)
 */
export function throwTicksTo(fielder: FielderState, point: WorldPoint): number {
  return throwFlightOf(fielder, point).ticks
}

/** 다른 야수에게 던지는 틱 — vt 0xb4 = 0xa1a60 (상대 +0x20 위치를 vt 0xb8 에 넘긴다) */
export function throwTicksToFielder(fielder: FielderState, receiver: FielderState): number {
  return throwTicksTo(fielder, receiver.position)
}
