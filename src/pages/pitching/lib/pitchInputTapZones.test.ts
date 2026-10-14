import { describe, expect, it } from 'vitest'
import { aimTapRectsOf, gaugeTapRectOf, slotTapRectOf } from '@/pages/pitching/lib/pitchInputTapZones'
import { MENU_PRESS_RECT, TIME_PRESS_RECT } from '@/features/play-game/model/stagePressAreas'
import { ZONE_CENTERS } from '@/entities/pitching/model/pitchCurve'

describe('투구 입력 누름 칸', () => {
  it('소프트키 칸은 "*MENU" (0, 307) · "#TIME" (198, 307) 글자 자리 41×12 다', () => {
    expect(MENU_PRESS_RECT).toEqual({ x: 0, y: 307, width: 41, height: 12 })
    expect(TIME_PRESS_RECT).toEqual({ x: 198, y: 307, width: 41, height: 12 })
  })

  it('구질 칸은 투수 앵커에서 잰다 — 좌타 (83, 188) · 우타 (156, 188)', () => {
    expect(slotTapRectOf(1, 1)).toEqual({ x: 63, y: 118, width: 64, height: 20 })
    expect(slotTapRectOf(1, 0)).toEqual({ x: 136, y: 118, width: 64, height: 20 })
    expect(slotTapRectOf(6, 1)).toBeNull()
  })

  it('조준 칸은 자르기 상자의 투영을 3 × 3 으로 — 가운데 칸이 존 중심의 투영을 품는다', () => {
    const rects = aimTapRectsOf(1)
    expect(rects).toHaveLength(9)
    const middle = rects[4]
    const center = gaugeTapRectOf(ZONE_CENTERS[1], 1)
    const centerX = center.x + center.width / 2
    const centerY = center.y + center.height / 2
    expect(centerX).toBeGreaterThanOrEqual(middle.x)
    expect(centerX).toBeLessThanOrEqual(middle.x + middle.width)
    expect(centerY).toBeGreaterThanOrEqual(middle.y)
    expect(centerY).toBeLessThanOrEqual(middle.y + middle.height)
  })
})
