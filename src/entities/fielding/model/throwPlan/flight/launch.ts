import type { WorldPoint } from '@/entities/fielding/model/fieldGeometry'
import type { FielderState } from '@/entities/fielding/model/fieldingState'
import { throwFlightOf } from '@/entities/fielding/model/throwPlan/flight/throwFlight'

/** a16b0~a16ba — cfg+0x42(17000) × 0x78 / 0x64 = 20400 (`BOUNCE_THROW_DISTANCE` 와 같은 값) */
const BOUNCE_THROW_ELEVATION_DISTANCE = 20_400

/** 레이저 송구(플레이+0x1f4) 속도 — 0xb2e38 이 고르는 야수 vtb0 = 0xa222c 가 `+0xdc = 0xfa << 3` 으로 넣는다 (a229c) */
export const LASER_THROW_SPEED = 2000

/** 특수 송구 속도 +0xd8 = +0xd4 × 130 / 100 (0xa0fc4) */
export const SPECIAL_THROW_SPEED_PERCENT = 130

/** 송구 공의 쏘기 값 — 공.vt44(h, w, φ) 의 세 인자 (a1a20 · 레이저 a2402) */
export interface ThrowLaunch {
  /** 수평 속도 h */
  readonly horizontalSpeed: number
  /** 수직 속도 w */
  readonly verticalSpeed: number
  /** 방향 φ (도) */
  readonly direction: number
}

/**
 * **보통 송구의 쏘기 값** — 0xa1620 a173c~a17ee (레이저 0xa222c a22f2~a23aa 도 같은 산술, 속도만 +0xdc = 2000):
 * ```
 * a173c  h = v·cos16(θ) >> 16 (θ = 0xbfab0(d·g'·100 / v²) >> 1)
 * a17e0  t = ⌈큰 축 거리 / |h·cos|sin(φ) >> 16|⌉ (0x6c5d8)
 * a17ee  w = g'·t >> 1   (g' = 0xa279c 가 배율을 곱한 공+0x44)
 * ```
 * 악송구 · 흔들림 · 원바운드 갈래가 아니면 이 값 그대로 a19d6 으로 가 쏜다.
 */
export function throwLaunchOf(fielder: FielderState, point: WorldPoint): ThrowLaunch {
  const flight = throwFlightOf(fielder, point)
  return {
    horizontalSpeed: flight.horizontalSpeed,
    verticalSpeed: (flight.gravity * flight.ticks) >> 1,
    direction: flight.direction,
  }
}

/**
 * **원바운드 송구 갈래** — 0xa1620 (직접 뜬 것):
 * ```
 * a16be  특수 && d > cfg+0x42 × 120 / 100(= 20400) → d = 20400 · 원바운드 표시(sp+0x10) = 1
 * a1710  θ 는 그 줄인 d 로 (h 가 커지고 앙각이 낮아 받는 점 앞에 떨어진다) · t 는 실제 dx · dz 로 · w = g'·t >> 1
 * a17fc  원바운드면 0xbfaa0 = rand(0, 2) ≠ 0 ? φ + 1 : φ − 1 · 야수+0xc0 = 4 · 공+0xaac = 1 → a19d6 (악송구 · 흔들림 굴림 없음)
 * ```
 * 공+0xaac 라 0xb2e38 의 받는 점 끼워 넣기(b2f9c)도 +0x1e8 도 없고, 예보 vt24(0) 은 움직임허용 모두로 줍는 야수를 고른다.
 */
export function bounceThrowLaunchOf(fielder: FielderState, point: WorldPoint, turnsLeft: boolean): ThrowLaunch {
  const flight = throwFlightOf(fielder, point, BOUNCE_THROW_ELEVATION_DISTANCE)
  return {
    horizontalSpeed: flight.horizontalSpeed,
    verticalSpeed: (flight.gravity * flight.ticks) >> 1,
    direction: flight.direction + (turnsLeft ? 1 : -1),
  }
}

/**
 * 던지는 순간의 +0xdc — 0xa1620 a16dc~a16ec: `+0xdc = 특수 ? +0xd8 : +0xd4`. 던진 뒤에도 그 판 동안 남는다.
 */
export function thrownWith(fielder: FielderState, special: boolean): FielderState {
  const speed = special ? Math.trunc((fielder.baseThrowSpeed * SPECIAL_THROW_SPEED_PERCENT) / 100) : fielder.baseThrowSpeed
  return speed === fielder.throwSpeed ? fielder : { ...fielder, throwSpeed: speed }
}
