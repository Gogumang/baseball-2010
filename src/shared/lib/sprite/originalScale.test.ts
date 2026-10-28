import { describe, expect, it } from 'vitest'
import { TEAM_LOGO_BOX, packedPixelsOf, rgbaOfPacked, scalePixelsLikeOriginal, splatExtentOf } from '@/shared/lib/sprite/originalScale'
import { ORIGINAL_SCALE_CASES } from '@/shared/lib/sprite/originalScale.fixture'

/** emu_scale.py 의 lcg_image 와 같은 그림 */
function lcgImage(width: number, height: number, seed: number): Uint32Array {
  let s = seed
  const pixels = new Uint32Array(width * height)
  for (let index = 0; index < pixels.length; index += 1) {
    s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff
    const value = (s >> 16) & 0xff
    pixels[index] = value < 64 ? 0 : value
  }
  return pixels
}

function hexOf(pixels: Uint32Array): string {
  return Array.from(pixels, (value) => value.toString(16).padStart(2, '0')).join('')
}

describe('0x662dc → 0x65f64 원본 늘이기 · 줄이기', () => {
  it.each(ORIGINAL_SCALE_CASES)('$width×$height → 원본(unicorn)과 바이트가 같다', (sample) => {
    const scaled = scalePixelsLikeOriginal(
      lcgImage(sample.width, sample.height, sample.seed),
      sample.width,
      sample.height,
      TEAM_LOGO_BOX.width,
      TEAM_LOGO_BOX.height,
    )
    expect(scaled).not.toBeNull()
    expect([scaled?.width, scaled?.height]).toEqual([sample.outWidth, sample.outHeight])
    expect(hexOf(scaled?.pixels ?? new Uint32Array())).toBe(sample.hex)
  })

  it('team_logo 크기들(75~78)은 모두 35×34 가 된다', () => {
    for (const [width, height] of [
      [77, 76],
      [75, 76],
      [76, 76],
      [76, 77],
      [76, 78],
      [78, 76],
    ] as const) {
      const scaled = scalePixelsLikeOriginal(new Uint32Array(width * height).fill(1), width, height, 35, 34)
      expect([scaled?.width, scaled?.height]).toEqual([35, 34])
    }
  })

  it('0x6c64c 뉴턴 제곱근 − 1 — 위에서 내려와 걸음이 0 이면 멈춘다(unicorn 값)', () => {
    expect([0, 1, 2, 3, 4, 8, 9, 10, 24, 25, 26, 99, 100].map(splatExtentOf)).toEqual([0, 1, 1, 1, 2, 2, 3, 3, 4, 5, 5, 9, 10])
  })

  it('알파 0 은 0 번 색으로 모으고 RGBA 로 되돌린다', () => {
    const rgba = new Uint8ClampedArray([10, 20, 30, 0, 1, 2, 3, 255])
    const packed = packedPixelsOf(rgba)
    expect(packed[0]).toBe(0)
    expect(Array.from(rgbaOfPacked(packed))).toEqual([0, 0, 0, 0, 1, 2, 3, 255])
  })
})
