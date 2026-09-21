import { describe, expect, it } from 'vitest'
import {
  OTHER_PEOPLE_ANIMATIONS, isHeroPortrait, placePortraits, portraitAnimationOf, portraitPaletteOf, slideX,
} from '@/widgets/event-portraits/lib/portraitSlots'

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

describe('주인공 초상화 — 피부 팔레트와 장타형 +8 (C-1)', () => {
  const 주인공 = { file: 'event_char_0' as const, animation: 3, side: 'left' as const }
  const 남 = { file: 'event_char_0' as const, animation: 19, side: 'left' as const }
  const 다른파일 = { file: 'event_char_1' as const, animation: 3, side: 'left' as const }

  it('event_char_0 애니 0~15 만 주인공이다', () => {
    expect(isHeroPortrait(주인공)).toBe(true)
    expect(isHeroPortrait({ ...주인공, animation: 15 })).toBe(true)
    expect(isHeroPortrait(남)).toBe(false)
    expect(isHeroPortrait(다른파일)).toBe(false)
  })

  it('장타형 주인공은 애니가 +8 이다 (0x63a70)', () => {
    expect(portraitAnimationOf(주인공, 0)).toBe(3)
    expect(portraitAnimationOf(주인공, 1)).toBe(11)
    // 이미 8~15 로 적힌 대본이 와도 두 번 더하지 않는다
    expect(portraitAnimationOf({ ...주인공, animation: 11 }, 1)).toBe(11)
    expect(portraitAnimationOf({ ...주인공, animation: 11 }, 0)).toBe(3)
  })

  it('주인공이 아닌 인물은 타입과 무관하게 그대로다', () => {
    expect(portraitAnimationOf(남, 1)).toBe(19)
    expect(portraitAnimationOf(다른파일, 1)).toBe(3)
  })

  it('피부 0 황인은 구운 팔레트 그대로, 1 백인 → 0 · 2 흑인 → 1 이다 (0x63a7e)', () => {
    expect(portraitPaletteOf(주인공, 0)).toBeNull()
    expect(portraitPaletteOf(주인공, 1)).toBe(0)
    expect(portraitPaletteOf(주인공, 2)).toBe(1)
  })

  it('주인공이 아닌 인물은 피부를 바꿔도 칠하지 않는다', () => {
    expect(portraitPaletteOf(남, 2)).toBeNull()
    expect(portraitPaletteOf(다른파일, 2)).toBeNull()
  })

  it('팔레트 2 는 인물 8·9(애니 58~71) 몫이라 주인공 범위와 겹치지 않는다', () => {
    expect(OTHER_PEOPLE_ANIMATIONS.palette).toBe(2)
    expect(isHeroPortrait({ ...주인공, animation: OTHER_PEOPLE_ANIMATIONS.from })).toBe(false)
    expect(isHeroPortrait({ ...주인공, animation: OTHER_PEOPLE_ANIMATIONS.to })).toBe(false)
  })
})
