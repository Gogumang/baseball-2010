import { describe, expect, it } from 'vitest'
import { bakedImgTextPaletteOf, imgTextPaletteMatrix } from '@/shared/ui/ImgTextPalette/ImgTextPalette'

/** 색 행렬을 0~255 RGB 한 점에 건다 (feColorMatrix 와 같은 식, 0~1 로 자른다) */
const apply = (matrix: string, [r, g, b]: readonly number[]) => {
  const m = matrix.trim().split(/\s+/).map(Number)
  const input = [r / 255, g / 255, b / 255, 1, 1]
  return [0, 1, 2].map((row) => {
    const value = [0, 1, 2, 3, 4].reduce((sum, column) => sum + m[row * 5 + column] * (column === 3 ? 1 : input[column]), 0)
    return Math.round(Math.min(1, Math.max(0, value)) * 255)
  })
}

describe('img_text 팔레트 행렬', () => {
  it('흰 글자(0) → 짙은 파랑(3): 255 → #2949A5 · 239 → #10246B', () => {
    const matrix = imgTextPaletteMatrix(0, 3)
    expect(apply(matrix, [255, 255, 255])).toEqual([0x29, 0x49, 0xa5])
    expect(apply(matrix, [239, 239, 239])).toEqual([0x10, 0x24, 0x6b])
  })

  it('구워 둔 짙은 파랑(3) → 흰(0) 로 되돌린다 — 47 "순위" · 49 "선발" 을 팔레트 0 으로 찍는 곳', () => {
    const matrix = imgTextPaletteMatrix(3, 0)
    expect(apply(matrix, [0x29, 0x49, 0xa5])).toEqual([255, 255, 255])
    expect(apply(matrix, [0x10, 0x24, 0x6b])).toEqual([239, 239, 239])
  })

  it('흰(0) → 노랑(1): #FFE352 · #FFB229', () => {
    const matrix = imgTextPaletteMatrix(0, 1)
    expect(apply(matrix, [255, 255, 255])).toEqual([0xff, 0xe3, 0x52])
    expect(apply(matrix, [239, 239, 239])).toEqual([0xff, 0xb2, 0x29])
  })

  it('구워 둔 프레임 — 47~51 은 3, 157 · 158 은 4, 그 밖은 0', () => {
    expect([47, 48, 49, 50, 51].map(bakedImgTextPaletteOf)).toEqual([3, 3, 3, 3, 3])
    expect([157, 158, 159, 344].map(bakedImgTextPaletteOf)).toEqual([4, 4, 0, 0])
  })
})
