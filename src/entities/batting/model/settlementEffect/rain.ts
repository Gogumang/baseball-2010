import type { FireworksParticlePort, HomeRunFireworks } from '@/entities/batting/model/homeRunFireworks'

/** s8 로 자른다 */
export function signedByte(value: number): number {
  return ((value & 0xff) << 24) >> 24
}

/** 빗방울 칸 (0x18 바이트) */
export interface RainDrop {
  /** +4 · +8 */
  x: number
  y: number
  /** +0xc · +0xd — s8 */
  vx: number
  vy: number
  /** +0xe — 짙기 (0..0x80) */
  alpha: number
  /** +0xf — 짙기 걸음 */
  alphaStep: number
  /** +0x10 — 선 길이 */
  length: number
  /** +0x12 — 기다림 (s8) */
  delay: number
  /** +0x14 — 땅 y (u16) */
  ground: number
  /** 이번 틱 고리에서 0x8f8ec 로 그렸나 — 다시 깐 방울은 그 틱에 안 그린다 */
  isDrawn: boolean
}

/** 튐 칸 (0x10 바이트) */
export interface RainSplash {
  x: number
  y: number
  /** +0xc */
  life: number
}

/** 칸 풀 — 쓰는 표(+4) · 마지막 칸(+8) */
export interface SlotPool<T> {
  readonly slots: (T | null)[]
  cursor: number
}

export interface SceneRain {
  /** +0x18 — 바람 (s8) */
  wind: number
  /** +0x19 */
  windStep: number
  /** +0x1a */
  windTicks: number
  /** +0x1c · +0x1d */
  readonly accelerationX: number
  readonly gravity: number
  readonly drops: SlotPool<RainDrop>
  readonly splashes: SlotPool<RainSplash>
}

/** 정산이 켠 효과 — 없으면 null(끔) */
export type SettlementEffect =
  | { readonly kind: 'fireworks'; fireworks: HomeRunFireworks<number> }
  | { readonly kind: 'rain'; readonly rain: SceneRain }

/** 결과 그림이 효과에 넘기는 파티클 자리 */
export type SettlementParticlePort = FireworksParticlePort<number>

/** 칸 고르기 (0x8ffc0 · 0x902d8 · 0x90240 꼴) — 0 부터 첫 빈 칸, 없으면 마지막 칸(+8) */
export function freeSlotOf<T>(pool: SlotPool<T>): number {
  const index = pool.slots.indexOf(null)
  return index >= 0 ? index : pool.cursor
}
