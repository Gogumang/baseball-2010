import { describe, expect, it } from 'vitest'
import { placePortraits, slideX } from '@/widgets/event-portraits/lib/portraitSlots'

describe('placePortraits — 원작 초상화 자리', () => {
  it('왼쪽은 45·75·105, 오른쪽은 화면폭에서 뺀 자리다', () => {
    const placed = placePortraits(
      [
        { file: 'event_char_0', animation: 19, side: 'left' },
        { file: 'event_char_0', animation: 4, side: 'right' },
        { file: 'event_char_1', animation: 0, side: 'left' },
      ],
      240,
    )
    expect(placed.map((item) => item.targetX)).toEqual([45, 195, 75])
  })

  it('한쪽에 네 번째 인물은 자리가 없어 빠진다', () => {
    const four = Array.from({ length: 4 }, () => ({ file: 'event_char_0' as const, animation: 16, side: 'left' as const }))
    expect(placePortraits(four, 240)).toHaveLength(3)
  })
})

describe('slideX — 한 번 갱신에 1/6 씩', () => {
  it('여섯 번 갱신하면 자리에 닿고 더 가지 않는다', () => {
    const [placed] = placePortraits([{ file: 'event_char_0', animation: 16, side: 'left' }], 240)
    expect(slideX(placed, 0, 240)).toBe(0)
    expect(slideX(placed, 3, 240)).toBeCloseTo(22.5)
    expect(slideX(placed, 6, 240)).toBe(45)
    expect(slideX(placed, 20, 240)).toBe(45)
  })

  it('오른쪽은 화면 끝에서 들어온다', () => {
    const [placed] = placePortraits([{ file: 'event_char_0', animation: 4, side: 'right' }], 240)
    expect(slideX(placed, 0, 240)).toBe(240)
    expect(slideX(placed, 6, 240)).toBe(195)
  })
})
