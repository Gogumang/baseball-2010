import { describe, expect, it } from 'vitest'
import { goalTickerFrameAt } from '@/entities/mission/model/goalTicker'

describe('미션 목표 글 띠 (0x36714)', () => {
  it('줄이 하나면 늘 머문다', () => {
    expect(goalTickerFrameAt(500, 1)).toEqual({ index: 0, nextIndex: null, offsetX: 0, offsetY: 0 })
  })

  it('21틱 머문 뒤 17틱 동안 x +5(끝 75) · y +3(끝 50) 으로 넘기고 다음 줄로 간다', () => {
    expect(goalTickerFrameAt(20, 2)).toEqual({ index: 0, nextIndex: null, offsetX: 0, offsetY: 0 })
    expect(goalTickerFrameAt(21, 2)).toEqual({ index: 0, nextIndex: 1, offsetX: 0, offsetY: 0 })
    expect(goalTickerFrameAt(21 + 15, 2)).toEqual({ index: 0, nextIndex: 1, offsetX: 75, offsetY: 45 })
    expect(goalTickerFrameAt(21 + 16, 2)).toEqual({ index: 0, nextIndex: 1, offsetX: 75, offsetY: 48 })
    expect(goalTickerFrameAt(38, 2)).toEqual({ index: 1, nextIndex: null, offsetX: 0, offsetY: 0 })
  })

  it('끝 줄 다음은 0번 줄이다', () => {
    expect(goalTickerFrameAt(38 + 21, 2).nextIndex).toBe(0)
    expect(goalTickerFrameAt(76, 2).index).toBe(0)
  })
})
