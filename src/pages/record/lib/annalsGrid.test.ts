import { describe, expect, it } from 'vitest'
import {
  ANNALS_GRID_SHAPES, DIRECTION_CODES, PANEL_ANIMATION_DRAWS, PANEL_OPEN_START_HEIGHT, closingPanelHeightOf, cursorShakeOf,
  hasDownMark, isBlinkOn, moveGridCursor, openingPanelHeightOf, panelTopOf, scrollTopAfter,
} from '@/pages/record/lib/annalsGrid'

describe('기록연감 격자 키 처리 (0x2b7a0 · 0x2b640 · 0x6bead)', () => {
  it('탭별 격자 — 0 · 3 · 4 는 1열 8줄(세로 감기), 1 은 4×5 · 2 는 4×10(가로 감기)', () => {
    expect(ANNALS_GRID_SHAPES.map((shape) => [shape.columns, shape.rows])).toEqual([[1, 8], [4, 5], [4, 10], [1, 8], [1, 8]])
  })

  it('진행 탭 — 가로는 같은 줄 안에서 감고 세로는 끝에서 멈춘다', () => {
    const shape = ANNALS_GRID_SHAPES[1]
    expect(moveGridCursor(shape, 0, 'left')).toBe(3)
    expect(moveGridCursor(shape, 7, 'right')).toBe(4)
    expect(moveGridCursor(shape, 2, 'up')).toBe(2)
    expect(moveGridCursor(shape, 17, 'down')).toBe(17)
    expect(moveGridCursor(shape, 13, 'down')).toBe(17)
  })

  it('1열 탭 — 세로는 감고 가로는 그대로', () => {
    const shape = ANNALS_GRID_SHAPES[0]
    expect(moveGridCursor(shape, 0, 'up')).toBe(7)
    expect(moveGridCursor(shape, 7, 'down')).toBe(0)
    expect(moveGridCursor(shape, 3, 'left')).toBe(3)
  })

  it('창은 커서가 창 밖으로 나갈 때만 한 줄 움직인다 — 진행·스킬 탭만', () => {
    expect(scrollTopAfter(1, 0, 8, 'down')).toBe(0)
    expect(scrollTopAfter(1, 0, 12, 'down')).toBe(1)
    expect(scrollTopAfter(1, 2, 7, 'up')).toBe(1)
    expect(scrollTopAfter(1, 2, 8, 'up')).toBe(2)
    expect(scrollTopAfter(2, 6, 36, 'down')).toBe(7)
    expect(scrollTopAfter(0, 0, 7, 'down')).toBe(0)
  })

  it('▼ 은 탭 1 윗줄 ≤ 1 · 탭 2 윗줄 ≤ 6 일 때', () => {
    expect([0, 1, 2].map((top) => hasDownMark(1, top))).toEqual([true, true, false])
    expect([6, 7].map((top) => hasDownMark(2, top))).toEqual([true, false])
  })

  it('깜박임은 8 틱 중 앞 4 틱 (값 % 8 ≤ 3)', () => {
    expect([0, 3, 4, 7, 8].map(isBlinkOn)).toEqual([true, true, false, false, true])
  })

  it('고른 칸 흔들림 — 방향마다 두 틱 (표 0xce8bc[2·방향 + t] · 0xce88c[3·방향 + t]), 그 뒤는 멈춘다', () => {
    const shakeOf = (direction: keyof typeof DIRECTION_CODES) =>
      [0, 1, 2].map((tick) => cursorShakeOf(DIRECTION_CODES[direction], tick))
    expect(shakeOf('left')).toEqual([{ dx: -2, dy: 0 }, { dx: 2, dy: 0 }, { dx: 0, dy: 0 }])
    expect(shakeOf('right')).toEqual([{ dx: 2, dy: 0 }, { dx: -2, dy: 0 }, { dx: 0, dy: 0 }])
    expect(shakeOf('up')).toEqual([{ dx: 0, dy: -2 }, { dx: 0, dy: 2 }, { dx: 0, dy: 0 }])
    expect(shakeOf('down')).toEqual([{ dx: 0, dy: 2 }, { dx: 0, dy: -2 }, { dx: 0, dy: 0 }])
  })
})

describe('판 열고 닫기 (0x2407c · 0x2fb94)', () => {
  it('열기는 그림마다 32 → 36 → 52 → 116 → 212, 넷째 그림에서 끝난다', () => {
    expect([0, 1, 2, 3, 4, 5].map(openingPanelHeightOf)).toEqual([32, 36, 52, 116, 212, 212])
    expect(PANEL_ANIMATION_DRAWS).toBe(4)
  })

  it('닫기는 212 → 208 → 192 → 128 → 10', () => {
    expect([0, 1, 2, 3, 4].map(closingPanelHeightOf)).toEqual([212, 208, 192, 128, 10])
  })

  it('판은 가운데 160 에서 높이 반만큼 위 — 212 면 54', () => {
    expect(panelTopOf(212)).toBe(54)
    expect(panelTopOf(PANEL_OPEN_START_HEIGHT)).toBe(144)
  })
})
