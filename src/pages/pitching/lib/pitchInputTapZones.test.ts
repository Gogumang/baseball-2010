import { describe, expect, it } from 'vitest'
import { AIM_TAP_MIN_CELL, aimTapRectsOf, gaugeTapRectOf, okBadgeTapRectOf, slotTapRectOf } from '@/pages/pitching/lib/pitchInputTapZones'
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

  it('칸 0 의 "OK" 글자(고리 프레임 25 의 왼쪽 위 귀)도 누름 칸이다 — 좌타 (37, 134) · 다른 칸과 겹치지 않는다', () => {
    const badge = okBadgeTapRectOf(1)
    expect(badge).toEqual({ x: 37, y: 134, width: 24, height: 15 })
    const overlaps = (a: typeof badge, b: typeof badge) =>
      a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
    for (const slot of [1, 2, 3, 4, 5]) {
      const rect = slotTapRectOf(slot, 1)
      expect(rect).not.toBeNull()
      if (rect !== null) expect(overlaps(badge, rect)).toBe(false)
    }
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

  it('조준 칸은 손가락 크기까지 바깥으로 넓힌다 — 칸끼리 안 겹치고 빈틈 없이, 소프트키 글자 칸(y 307~)에 안 닿는다', () => {
    for (const side of [0, 1]) {
      const rects = aimTapRectsOf(side)
      for (const rect of rects) {
        expect(rect.width).toBeGreaterThanOrEqual(AIM_TAP_MIN_CELL.width)
        expect(rect.height).toBeGreaterThanOrEqual(AIM_TAP_MIN_CELL.height)
        expect(rect.y + rect.height).toBeLessThan(MENU_PRESS_RECT.y)
      }
      // 이웃 칸은 경계를 맞댄다 (겹침 · 틈 없음)
      for (let index = 0; index < 9; index += 1) {
        const rect = rects[index]
        if (index % 3 < 2) expect(rects[index + 1].x).toBe(rect.x + rect.width)
        if (index < 6) expect(rects[index + 3].y).toBe(rect.y + rect.height)
      }
    }
  })
})
