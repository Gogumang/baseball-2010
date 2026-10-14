import { describe, expect, it } from 'vitest'
import { alignedTopLeftOf, commonPanelPaintsOf, insetBoxPaintsOf } from '@/shared/lib/commonPanel/commonPanel'
import type { PanelPaint } from '@/shared/lib/commonPanel/commonPanel'

/** 칠 목록을 차례대로 칠한 화소 표 (빈 곳은 null) */
function rasterOf(paints: readonly PanelPaint[], width: number, height: number): (string | null)[][] {
  const grid: (string | null)[][] = Array.from({ length: height }, () => Array<string | null>(width).fill(null))
  for (const paint of paints) {
    for (let y = paint.y; y < paint.y + paint.height; y += 1) {
      for (let x = paint.x; x < paint.x + paint.width; x += 1) {
        if (y >= 0 && y < height && x >= 0 && x < width) grid[y]![x] = paint.color
      }
    }
  }
  return grid
}

describe('공용 판 0x55e60', () => {
  it('바깥 #080408 테두리 · 네 모서리 점은 비고, 안쪽 모서리 점은 #080408, 그 안 흰 테두리 (0x55f0e~0x55fb2)', () => {
    const grid = rasterOf(commonPanelPaintsOf({ width: 192, height: 212 }), 192, 212)
    expect(grid[0]![0]).toBeNull()
    expect(grid[0]![191]).toBeNull()
    expect(grid[211]![0]).toBeNull()
    expect(grid[211]![191]).toBeNull()
    expect(grid[0]![1]).toBe('#080408')
    expect(grid[100]![191]).toBe('#080408')
    expect(grid[1]![1]).toBe('#080408')
    expect(grid[1]![190]).toBe('#080408')
    expect(grid[210]![190]).toBe('#080408')
    expect(grid[1]![2]).toBe('#FFFFFF')
    expect(grid[2]![1]).toBe('#FFFFFF')
    expect(grid[210]![100]).toBe('#FFFFFF')
    expect(grid[100]![190]).toBe('#FFFFFF')
    expect(grid[100]![100]).toBe('#335FCD')
  })

  it('위 띠 16 — #C5C5C5 선 y 2 · 18, 흰 칠 y 3~10, #E2E2E2 칠 y 10~17 (0x560fe~0x56170)', () => {
    const grid = rasterOf(commonPanelPaintsOf({ width: 192, height: 212, topBand: 16 }), 192, 212)
    expect(grid[2]![2]).toBe('#C5C5C5')
    expect(grid[2]![189]).toBe('#C5C5C5')
    expect(grid[2]![190]).toBe('#FFFFFF')
    expect(grid[3]![50]).toBe('#FFFFFF')
    expect(grid[9]![50]).toBe('#FFFFFF')
    expect(grid[10]![50]).toBe('#E2E2E2')
    expect(grid[17]![50]).toBe('#E2E2E2')
    expect(grid[18]![50]).toBe('#C5C5C5')
    expect(grid[19]![50]).toBe('#335FCD')
  })

  it('아래 띠 b — 선 y = h − b − 3 · h − 3 (0x56178~0x561e6)', () => {
    const grid = rasterOf(commonPanelPaintsOf({ width: 100, height: 100, bottomBand: 10 }), 100, 100)
    expect(grid[87]![50]).toBe('#C5C5C5')
    expect(grid[88]![50]).toBe('#FFFFFF')
    expect(grid[92]![50]).toBe('#E2E2E2')
    expect(grid[97]![50]).toBe('#C5C5C5')
    expect(grid[98]![50]).toBe('#FFFFFF')
  })

  it('제목 탭 — 왼쪽 위 사다리꼴 #E2E2E2, 45° #C5C5C5 · #1D44A8 그림자, 흰 반사 8줄 (0x55fbe~0x560fa)', () => {
    const grid = rasterOf(commonPanelPaintsOf({ width: 192, height: 212, titleTab: true }), 192, 212)
    const cx = 96
    expect(grid[2]![189]).toBe('#E2E2E2')
    expect(grid[3]![5]).toBe('#FFFFFF')
    expect(grid[11]![5]).toBe('#E2E2E2')
    expect(grid[16]![cx - 14]).toBe('#E2E2E2')
    expect(grid[17]![2]).toBe('#C5C5C5')
    expect(grid[18]![2]).toBe('#1D44A8')
    expect(grid[10]![cx - 7]).toBe('#C5C5C5')
    expect(grid[3]![cx]).toBe('#C5C5C5')
    expect(grid[3]![cx + 1]).toBe('#C5C5C5')
    expect(grid[4]![cx + 1]).toBe('#1D44A8')
    expect(grid[10]![cx + 10]).toBe('#335FCD')
    expect(grid[3]![cx - 2]).toBe('#FFFFFF')
    expect(grid[10]![cx - 9]).toBe('#FFFFFF')
    expect(grid[10]![cx - 8]).toBe('#E2E2E2')
  })
})

describe('안쪽 칸 0xbb28c', () => {
  it('#1D44A8 칠, 위·왼쪽 #08246B (끝 점 포함), 오른쪽·아래 #5A86FF', () => {
    const grid = rasterOf(insetBoxPaintsOf(10, 8), 10, 8)
    expect(grid[3]![3]).toBe('#1D44A8')
    expect(grid[0]![0]).toBe('#08246B')
    expect(grid[0]![9]).toBe('#08246B')
    expect(grid[7]![0]).toBe('#08246B')
    expect(grid[7]![9]).toBe('#5A86FF')
    expect(grid[3]![9]).toBe('#5A86FF')
    expect(grid[7]![4]).toBe('#5A86FF')
  })
})

describe('정렬 비트', () => {
  it('0x22 는 가운데, 0x2 의 반은 asr 로 버린다', () => {
    expect(alignedTopLeftOf(120, 160, 192, 212, 0x22)).toEqual({ x: 24, y: 54 })
    expect(alignedTopLeftOf(120, 190, 173, 60, 0x2)).toEqual({ x: 34, y: 190 })
    expect(alignedTopLeftOf(24, 48, 192, 212, 0x11)).toEqual({ x: 24, y: 48 })
  })
})
