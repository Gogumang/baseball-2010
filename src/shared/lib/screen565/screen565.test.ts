import { describe, expect, it } from 'vitest'
import { applyZoom565, blurRightDown565, zoomSourceIndexes } from '@/shared/lib/screen565/screen565'

describe('0xc3468 오른쪽 · 아래 이웃 평균 흐리기', () => {
  it('n = 1 — 칸마다 오른쪽 하나 · 아래 하나를 반씩 더한다(채널 아래 1 비트를 지우고), 끝 칸 · 끝 줄은 그대로', () => {
    // 3 × 2 — 빨강 채널만 (값 << 11)
    const red = (value: number) => value << 11
    const pixels = new Uint16Array([red(4), red(6), red(9), red(10), red(20), red(31)])
    blurRightDown565(pixels, 3, 2, 0, 0, 3, 2, 1)
    // 줄 0 만 돈다(끝 줄 = 2 − 1), 칸 0 · 1 (끝 칸 = 3 − 1): (0,0) = 6/2 + 10/2 = 8 · (1,0) = 9>>1 + 20/2 = 4 + 10 = 14
    expect(Array.from(pixels, (p) => p >> 11)).toEqual([8, 14, 9, 10, 20, 31])
  })

  it('n = 2 — 오른쪽 둘 · 아래 둘을 넷으로 나눠 더한다(아래 2 비트를 지우고)', () => {
    const blue = (value: number) => value
    const width = 3
    const pixels = new Uint16Array([blue(0), blue(7), blue(13), blue(1), blue(0), blue(0), blue(30), blue(0), blue(0)])
    blurRightDown565(pixels, width, 3, 0, 0, width, 3, 2)
    // (0,0) 만: 오른쪽 7>>2=1 · 13>>2=3, 아래 1>>2=0 · 30>>2=7 → 11
    expect(pixels[0]).toBe(11)
    expect(Array.from(pixels.slice(1))).toEqual([7, 13, 1, 0, 0, 30, 0, 0])
  })
})

describe('0xbb43c 화면 확대', () => {
  it('100 % 면 화면 그대로다', () => {
    const indexes = zoomSourceIndexes(240, 320, 100, 121, 267)
    expect(indexes.every((from, at) => from === at)).toBe(true)
  })

  it('112 % · 중심 (121, 267) — 상자 214 × 285, 아래로 넘쳐 sy = 35 · sx = 14 에서 떠 빈 칸 없이 편다', () => {
    const indexes = zoomSourceIndexes(240, 320, 112, 121, 267)
    expect(indexes[0]).toBe(35 * 240 + 14)
    expect(indexes.every((from) => from >= 0)).toBe(true)
    // 줄마다 원본 칸 번호는 줄지 않는다(덩이를 차례로 덮는다)
    for (let x = 1; x < 240; x += 1) expect(indexes[x]).toBeGreaterThanOrEqual(indexes[x - 1])
    // 마지막 칸은 상자의 오른쪽 아래 칸
    expect(indexes[240 * 320 - 1]).toBe((35 + 284) * 240 + 14 + 213)
  })

  it('확대표대로 화소를 옮긴다', () => {
    const pixels = new Uint16Array([1, 2, 3, 4])
    applyZoom565(pixels, new Int32Array([3, 3, -1, 0]))
    expect(Array.from(pixels)).toEqual([4, 4, 3, 1])
  })
})
