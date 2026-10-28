import { describe, expect, it } from 'vitest'
import { CURSOR_SHAKE_DIRECTION_CODES, cursorShakeDirectionOfKey, cursorShakeOf } from '@/shared/lib/cursorShake/cursorShake'

describe('고른 칸 까딱임 표 (0xce8bc · 0xce88c = 0xd1784 · 0xd1754)', () => {
  it('두 그리기 — ← (−2,0)(+2,0) · → (+2,0)(−2,0) · ↑ (0,−2)(0,+2) · ↓ (0,+2)(0,−2)', () => {
    const of = (direction: keyof typeof CURSOR_SHAKE_DIRECTION_CODES) =>
      [0, 1, 2].map((t) => cursorShakeOf(CURSOR_SHAKE_DIRECTION_CODES[direction], t))
    expect(of('left')).toEqual([
      { dx: -2, dy: 0 },
      { dx: 2, dy: 0 },
      { dx: 0, dy: 0 },
    ])
    expect(of('right')).toEqual([
      { dx: 2, dy: 0 },
      { dx: -2, dy: 0 },
      { dx: 0, dy: 0 },
    ])
    expect(of('up')).toEqual([
      { dx: 0, dy: -2 },
      { dx: 0, dy: 2 },
      { dx: 0, dy: 0 },
    ])
    expect(of('down')).toEqual([
      { dx: 0, dy: 2 },
      { dx: 0, dy: -2 },
      { dx: 0, dy: 0 },
    ])
  })

  it('0x5550d 는 화살표 키만 적는다', () => {
    expect(cursorShakeDirectionOfKey('ArrowUp')).toBe('up')
    expect(cursorShakeDirectionOfKey('8')).toBeNull()
  })
})
