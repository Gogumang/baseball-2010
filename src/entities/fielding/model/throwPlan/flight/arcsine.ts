import { SINE_HUNDRED_TABLE } from '@/shared/config/original/trigonometryTables'

/** 0xbfab0 역사인 표(0xd8de0, sin×100 0~90°)의 마지막 칸 */
const LAST_ARCSINE_INDEX = 90

/** 0xbfab0 — sin×100 표(0xd8de0) 이진 탐색. lo 0 · hi 90 에서 가운데가 두 번 같으면 멈춘다. 음수는 −asin(−x) */
export function arcsineDegrees(value: number): number {
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
