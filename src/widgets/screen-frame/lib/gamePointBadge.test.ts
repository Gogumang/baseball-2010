import { describe, expect, it } from 'vitest'
import { gamePointBadgeOf } from '@/widgets/screen-frame/lib/gamePointBadge'

describe('G 숫자 0x54a60 (판 ≠ 0 갈래)', () => {
  it('머리띠 (168, 머리띠y + 18, 0x41, 정렬 1, "+" 없음, 둥근 판) — 판 (177, y+1, 60, 13) 의 (w+1)×(h+1) 테두리', () => {
    const badge = gamePointBadgeOf({ value: 1250, x: 168, y: 10, width: 0x41, align: 1, plus: false, plate: true })
    expect(badge.plate?.fill).toEqual({ x: 178, y: 12, width: 59, height: 12 })
    expect(badge.plate?.edges).toEqual([
      { x: 178, y: 11, width: 59, height: 1 },
      { x: 178, y: 24, width: 59, height: 1 },
      { x: 177, y: 12, width: 1, height: 12 },
      { x: 237, y: 12, width: 1, height: 12 },
    ])
    expect(badge.coin).toEqual({ x: 168, y: 9 })
    expect(badge.plus).toBeNull()
    // 합 = (4+1) + (8+1)·3 = 32 → 시작 168 + 65 − 32 + 2 = 203
    expect(badge.digits.map((d) => [d.digit, d.x, d.y])).toEqual([[1, 203, 14], [2, 208, 14], [5, 217, 14], [0, 226, 14]])
  })

  it('정산 기본 화면 (80, 289, 0x46, 정렬 2, "+", 둥근 판) — "+" 는 숫자 시작 − 8 − 2', () => {
    const badge = gamePointBadgeOf({ value: 30, x: 80, y: 289, width: 0x46, align: 2, plus: true, plate: true })
    expect(badge.coin).toEqual({ x: 80, y: 288 })
    expect(badge.digits[0]).toEqual({ digit: 3, x: 80 + 70 - 18 + 2, y: 293 })
    expect(badge.plus).toEqual({ x: 134 - 10, y: 293 })
  })

  it('정렬 비트 0x40 이면 숫자 그림 높이만큼 올린다 · 둥근 판이 없으면 칠도 없다', () => {
    const badge = gamePointBadgeOf({ value: 7, x: 0, y: 50, width: 0x50, align: 0x41, plus: false, plate: false })
    expect(badge.plate).toBeNull()
    expect(badge.coin.y).toBe(41)
    expect(badge.digits[0].y).toBe(46)
  })
})
