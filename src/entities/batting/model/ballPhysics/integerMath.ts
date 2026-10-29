import { TANGENT_TABLE } from '@/shared/config/original/trigonometryTables'
import { VERTICAL_SLOPE } from '@/entities/batting/model/ballPhysics/constants'

// ── 원본 정수 연산 ──────────────────────────────────────────────────────

/** 0xca7b4 — 부호 있는 나눗셈(0 쪽으로 버림), 0 으로 나누면 0 (0xca83c) */
export function divide(numerator: number, denominator: number): number {
  if (denominator === 0) return 0
  const quotient = Math.floor(Math.abs(numerator) / Math.abs(denominator))
  return (numerator < 0 !== denominator < 0 ? -quotient : quotient) | 0
}

export const multiply = Math.imul

/** 0x6c758 → 0x6c71c — tan × 10000 표 이진 탐색(절댓값). 곱은 32비트로 감긴다 */
export function arctangentOfSlope(slope: number): number {
  let value = multiply(slope, 100)
  if (value < 0) value = -value | 0
  let low = 0
  let high = 89
  let previous = -1
  for (;;) {
    const middle = (low + high) >> 1
    if (middle === previous) return middle
    previous = middle
    if (value < TANGENT_TABLE[middle]) high = middle
    else low = middle
  }
}

/** s16 로 자른다 (strh) */
export const toShort = (value: number) => (value << 16) >> 16

/** 0x9f8ae · 0x9fb10 — 두 점의 기울기 ×100 (x 가 같으면 0x40000000) */
export function slopeOf(fromX: number, fromZ: number, toX: number, toZ: number): number {
  if (fromX === toX) return VERTICAL_SLOPE
  return divide(multiply(toZ - fromZ, 100), toX - fromX)
}
