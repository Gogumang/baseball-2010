import { describe, expect, it } from 'vitest'
import {
  breakingPitchCursorAfter,
  breakingPitchCursorAfterToggle,
  breakingPitchKeyOf,
} from '@/pages/pitcher-league/lib/breakingPitchCursor'

describe('0x67 변화구 칸 커서 (0x12410 · 격자 [this+0x88] 꼴 0x330)', () => {
  it('↓ 는 칸 + 2 — 6·7 은 OK 칸(8), OK 칸에서는 칸 − 7 = 1', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map((cell) => breakingPitchCursorAfter(cell, 'down')))
      .toEqual([2, 3, 4, 5, 6, 7, 8, 8, 1])
  })

  it('↑ 는 칸 − 2 — 0·1 은 OK 칸(8), OK 칸에서는 7', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map((cell) => breakingPitchCursorAfter(cell, 'up')))
      .toEqual([8, 8, 0, 1, 2, 3, 4, 5, 7])
  })

  it('← → 는 1열 꼴 0x330 이라 칸 번호 ±1 을 9 칸 안에서 감는다 (0x10 + 0x100 + 0x20)', () => {
    expect(breakingPitchCursorAfter(0, 'right')).toBe(1)
    expect(breakingPitchCursorAfter(8, 'right')).toBe(0)
    expect(breakingPitchCursorAfter(0, 'left')).toBe(8)
    expect(breakingPitchCursorAfter(5, 'left')).toBe(4)
  })

  it('구질 칸 OK 뒤 — 두 개가 되면 OK 칸, 아니면 칸 + 2 (9 면 8)', () => {
    expect(breakingPitchCursorAfterToggle(0, 2)).toBe(8)
    expect(breakingPitchCursorAfterToggle(0, 1)).toBe(2)
    expect(breakingPitchCursorAfterToggle(6, 1)).toBe(8)
    expect(breakingPitchCursorAfterToggle(7, 0)).toBe(8)
  })

  it('숫자 2·4·5·6·8 은 ↑ ← OK → ↓ (0x12410 · 표 0xd2e7c)', () => {
    expect(['2', '4', '5', '6', '8'].map(breakingPitchKeyOf)).toEqual(['up', 'left', 'ok', 'right', 'down'])
    expect(breakingPitchKeyOf('Escape')).toBe('clr')
    expect(breakingPitchKeyOf('a')).toBeNull()
  })
})
