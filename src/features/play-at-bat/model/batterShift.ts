/** 타자 좌우 이동 fe4 — 키 한 번에 ±3, 범위 [−9, 9]. 타석 준비(0x48d50)에서 0 으로 돌아간다 */
const SHIFT_STEP = 3
export const MAXIMUM_BATTER_SHIFT = 9

export function nextBatterShift(shift: number, direction: -1 | 1): number {
  return Math.max(-MAXIMUM_BATTER_SHIFT, Math.min(MAXIMUM_BATTER_SHIFT, shift + direction * SHIFT_STEP))
}
