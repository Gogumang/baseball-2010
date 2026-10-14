import { describe, expect, it } from 'vitest'
import { LASER_SHINE_COLOR_565, shinePixel565, shinePixels } from '@/pages/defense/lib/laserShine'

describe('레이저 반짝임 — 그리기 효과 0xc (0x98394~0x983a8)', () => {
  it('색은 0x1400748(255, 0, 0) = 565 0xf800', () => {
    expect(LASER_SHINE_COLOR_565).toBe(0xf800)
  })

  it('out = (그림 & 0xf7de) >> 1 + (색 & 0xf7de) >> 1 — 화면은 안 본다', () => {
    // 흰 그림 → R5 15 + 15 = 30 · G6 31 · B5 15
    expect(shinePixel565(0xffff, 0xf800)).toBe((30 << 11) | (31 << 5) | 15)
    // 검정 그림 → 빨강 반
    expect(shinePixel565(0x0000, 0xf800)).toBe(15 << 11)
  })

  it('투명 칸(알파 0)은 손대지 않고, 그림 칸은 몸 전체가 물든다', () => {
    const rgba = new Uint8ClampedArray([0, 0, 0, 0, 255, 255, 255, 255])
    const out = shinePixels(rgba)
    expect(Array.from(out.slice(0, 4))).toEqual([0, 0, 0, 0])
    // 565 (30, 31, 15) → 비트 복제 8비트
    expect(Array.from(out.slice(4))).toEqual([247, 125, 123, 255])
  })
})
