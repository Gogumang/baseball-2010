import { describe, expect, it } from 'vitest'
import {
  HALF_INNING_CARDS_Y, HALF_INNING_CARD_X, dueUpCardPlacementOf, dueUpLineupSlotOf, dueUpOrderOf, halfInningCardsAt,
  pitcherCardPlacementOf,
} from '@/widgets/game-scene/lib/halfInningCardsLayout'

describe('공수 교대 판 두 팀 판의 자리 (0x4fe9c)', () => {
  it('폭 212(game_ui 프레임 19 상자 4) — 왼쪽 (14, 158) · 오른쪽 (150, 158)', () => {
    expect(HALF_INNING_CARD_X).toEqual({ left: 14, right: 150 })
    expect(HALF_INNING_CARDS_Y).toBe(158)
  })

  it('초(st[9] = 0)면 왼쪽이 DUE UP(0x42364), 말이면 왼쪽이 PITCHER(0x420dc)', () => {
    expect(halfInningCardsAt(0)).toEqual({ dueUpX: 14, pitcherX: 150 })
    expect(halfInningCardsAt(1)).toEqual({ dueUpX: 150, pitcherX: 14 })
  })
})

describe('PITCHER 판 0x420dc', () => {
  it('머리 칸 (x, y, 0x35, 0xc) · 몸통 (x, y + 10, 0x4d, 0x36) · img_text 186 · game_ui 프레임 31 · 17 · 이미지 0 · 이름 칸', () => {
    const placed = pitcherCardPlacementOf(150, 158, { strikes: 0, balls: 0, outs: 0 })
    expect(placed.plates).toEqual([
      { x: 150, y: 158, width: 0x35, height: 0xc },
      { x: 150, y: 168, width: 0x4d, height: 0x36 },
    ])
    expect(placed.title).toEqual({ frame: 186, x: 155, y: 162 })
    expect(placed.frames).toEqual([{ frame: 31, x: 153, y: 171 }, { frame: 17, x: 137, y: 18 }])
    expect(placed.images).toEqual([{ image: 0, x: 159, y: 174 }])
    expect(placed.name).toEqual({ x: 171, y: 173, width: 0x34, height: 0 })
  })

  it('S·B·O 점은 min(st[4], 2) · min(st[5], 3) · min(st[6], 2) 개, 9px 간격', () => {
    const placed = pitcherCardPlacementOf(14, 158, { strikes: 2, balls: 4, outs: 3 })
    const dots = placed.images.slice(1)
    expect(dots.filter((dot) => dot.image === 13).map((dot) => [dot.x, dot.y])).toEqual([[36, 190], [45, 190]])
    expect(dots.filter((dot) => dot.image === 14).map((dot) => dot.x)).toEqual([36, 45, 54])
    expect(dots.filter((dot) => dot.image === 15).map((dot) => [dot.x, dot.y])).toEqual([[36, 210], [45, 210]])
  })
})

describe('DUE UP 판 0x42364', () => {
  it('타순 번호 = 팀[+0x32] + i + 1, 9 를 넘으면 mod 9 — 이름은 타순 칸 (팀[+0x32] + i) mod 9', () => {
    expect([0, 1, 2].map((row) => dueUpOrderOf(0, row))).toEqual([1, 2, 3])
    expect([0, 1, 2].map((row) => dueUpOrderOf(7, row))).toEqual([8, 9, 1])
    expect([0, 1, 2].map((row) => dueUpOrderOf(8, row))).toEqual([9, 1, 2])
    expect([0, 1, 2].map((row) => dueUpLineupSlotOf(8, row))).toEqual([8, 0, 1])
  })

  it('머리 칸 (x + 0x13, y, 0x33, 0xc) · img_text 187 · game_ui 프레임 32 · 줄마다 0x11 아래', () => {
    const placed = dueUpCardPlacementOf(14, 158, 0)
    expect(placed.plates[0]).toEqual({ x: 33, y: 158, width: 0x33, height: 0xc })
    expect(placed.title).toEqual({ frame: 187, x: 42, y: 162 })
    expect(placed.frame).toEqual({ frame: 32, x: 17, y: 171 })
    expect(placed.rows.map((row) => row.name.y)).toEqual([173, 190, 207])
  })

  it('숫자 0xba719 정렬 0x22 — 칸 (x + 4, yᵢ + 0xd, 19, 15) 가운데, num 이미지 0x1e + 자리', () => {
    const placed = dueUpCardPlacementOf(14, 158, 0)
    // "1" 폭 4: x = 18 + (15 >> 1) = 25, y = 171 + 2 + 1 = 174
    expect(placed.rows[0]!.digits).toEqual([{ image: 31, x: 25, y: 174 }])
    // "2" 폭 6: x = 18 + (13 >> 1) = 24
    expect(placed.rows[1]!.digits).toEqual([{ image: 32, x: 24, y: 191 }])
  })
})
