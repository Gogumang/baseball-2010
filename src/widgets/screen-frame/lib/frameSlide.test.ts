import { describe, expect, it } from 'vitest'
import { frameSlideOf, isFrameSlideClearedAt } from '@/widgets/screen-frame/lib/frameSlide'

describe('머리띠 미끄러짐 깃발 [skin+0x84]', () => {
  it('머리띠가 30 에 닿는 그림(5)까지는 페이지가 깃발을 보고, 그다음 그림(6)부터 지워져 있다 (0x54e16 · 머리띠는 마지막에 그린다)', () => {
    expect(frameSlideOf(5)).toBe(30)
    expect([0, 1, 2, 3, 4, 5].map(isFrameSlideClearedAt)).toEqual([false, false, false, false, false, false])
    expect(isFrameSlideClearedAt(6)).toBe(true)
    expect(isFrameSlideClearedAt(40)).toBe(true)
  })
})
