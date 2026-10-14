import { describe, expect, it } from 'vitest'
import { gridCursorBounceOf } from '@/shared/lib/gridCursorBounce/gridCursorBounce'

describe('격자 커서 튕김 0x7a7f6 — 표 0xd4080(dx, 간격 2) · 0xd4050(dy, 간격 3)', () => {
  it('옮긴 그림에 그 방향으로 2, 다음 그림에 반대로 2, 그다음 제자리', () => {
    expect([0, 1, 2].map((step) => gridCursorBounceOf('left', step))).toEqual([{ dx: -2, dy: 0 }, { dx: 2, dy: 0 }, { dx: 0, dy: 0 }])
    expect([0, 1].map((step) => gridCursorBounceOf('right', step))).toEqual([{ dx: 2, dy: 0 }, { dx: -2, dy: 0 }])
    expect([0, 1].map((step) => gridCursorBounceOf('up', step))).toEqual([{ dx: 0, dy: -2 }, { dx: 0, dy: 2 }])
    expect([0, 1].map((step) => gridCursorBounceOf('down', step))).toEqual([{ dx: 0, dy: 2 }, { dx: 0, dy: -2 }])
  })
})
