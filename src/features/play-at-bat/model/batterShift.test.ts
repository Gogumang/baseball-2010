import { describe, expect, it } from 'vitest'
import { nextBatterShift } from '@/features/play-at-bat/model/batterShift'

describe('nextBatterShift — 0x53670 좌우 키', () => {
  it('한 번에 3 씩, −9~9 안에서만 움직인다', () => {
    expect(nextBatterShift(0, 1)).toBe(3)
    expect(nextBatterShift(-6, -1)).toBe(-9)
    expect(nextBatterShift(-9, -1)).toBe(-9)
    expect(nextBatterShift(9, 1)).toBe(9)
  })
})
