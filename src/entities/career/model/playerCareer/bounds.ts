/** 값을 [최소, 최대] 로 자른다 */
export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

/** s8 칸 (ldrsb · strb) */
export const toInt8 = (value: number) => (value << 24) >> 24
/** s16 칸 (ldrsh · strh) */
export const toInt16 = (value: number) => (value << 16) >> 16
