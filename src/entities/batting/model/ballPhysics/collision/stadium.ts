import { VERTICAL_SLOPE } from '@/entities/batting/model/ballPhysics/constants'
import { divide, multiply, slopeOf } from '@/entities/batting/model/ballPhysics/integerMath'
import type { BallPoint } from '@/entities/batting/model/ballPhysics/types'

/** 0x9f7e8 이 돌려주는 0x2c 바이트 구조체 (S7 6-2) */
export interface CollisionResult {
  /** +0x26 */
  readonly hit: boolean
  /** +0x00 · +0x04 · +0x08 */
  readonly x: number
  readonly y: number
  readonly z: number
  /** +0x24 */
  readonly angle: number
  /** +0x28 폴(각 −45 · −135, 1999 < 높이 ≤ 7000) */
  readonly pole: boolean
  /** +0x29 담장 위로 넘음 (높이 > 1999) */
  readonly overFence: boolean
  /** +0x2a 홈 둘레 파울 쪽 관중석 위로 넘음 (높이 > 1999) */
  readonly overStand: boolean
}

export interface Segment {
  readonly x1: number
  readonly z1: number
  readonly x2: number
  readonly z2: number
}

/** 0xd7688 — 외야 담장 일곱 마디 (다섯째 워드 200 은 읽는 곳이 없다) */
export const OUTFIELD_FENCE: readonly Segment[] = [
  { x1: 0, z1: 11_440, x2: 1_935, z2: 8_905 },
  { x1: 1_935, z1: 8_905, x2: 8_772, z2: 4_160 },
  { x1: 8_772, z1: 4_160, x2: 13_158, z2: 1_820 },
  { x1: 13_158, z1: 1_820, x2: 26_832, z2: 1_820 },
  { x1: 26_832, z1: 1_820, x2: 31_218, z2: 4_160 },
  { x1: 31_218, z1: 4_160, x2: 38_055, z2: 8_905 },
  { x1: 38_055, z1: 8_905, x2: 40_000, z2: 11_440 },
]
/** 0xd7674 — 3루 쪽 파울 관중석 벽 (다섯째 워드 100) */
export const THIRD_BASE_STAND: Segment = { x1: 0, z1: 13_095, x2: 11_480, z2: 32_500 }
/** 0xd7660 — 1루 쪽 파울 관중석 벽 */
export const FIRST_BASE_STAND: Segment = { x1: 28_520, z1: 32_500, x2: 40_000, z2: 13_095 }

export const NO_COLLISION: CollisionResult = {
  hit: false,
  x: 0,
  y: 0,
  z: 0,
  angle: 0,
  pole: false,
  overFence: false,
  overStand: false,
}

export interface Crossing {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly slope: number
  readonly pathSlope: number
}

/**
 * 직선 마디와 prev→cur 선분의 교차 (9f8a6~9fa12 · 9fb08~9fc96 — 두 갈래가 같은 식).
 * 마디는 **무한 직선**으로 본다(양 끝 x 범위는 부르는 쪽이 따로 거른다).
 */
export function crossingOf(segment: Segment, previous: BallPoint, current: BallPoint): Crossing | null {
  const slope = slopeOf(segment.x1, segment.z1, segment.x2, segment.z2)
  const vertical = previous.x === current.x
  const pathSlope = vertical ? VERTICAL_SLOPE : divide(multiply(current.z - previous.z, 100), current.x - previous.x)
  if (slope === pathSlope) return null
  const previousSide = divide(multiply(previous.x - segment.x1, slope), 100) + segment.z1 - previous.z
  const currentSide = divide(multiply(current.x - segment.x1, slope), 100) + segment.z1 - current.z
  if (Math.sign(previousSide) === Math.sign(currentSide)) return null
  // 9f97a — 32비트 정수로 감기는 그대로 (기울기가 크면 곱이 넘친다)
  const numerator =
    ((((multiply(segment.x1, slope) - multiply(segment.z1, 100)) | 0) - multiply(current.x, pathSlope)) | 0) + multiply(current.z, 100)
  const x = vertical ? current.x : divide(numerator | 0, (slope - pathSlope) | 0)
  const z = divide(multiply(x - segment.x1, slope), 100) + segment.z1
  const dx = current.x - previous.x
  const dz = current.z - previous.z
  const rise = current.y - previous.y
  const y = previous.y + (Math.abs(dx) > Math.abs(dz) ? divide(multiply(x - previous.x, rise), dx) : divide(multiply(z - previous.z, rise), dz))
  return { x, y, z, slope, pathSlope }
}
