import { afterEach, describe, expect, it } from 'vitest'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
import {
  BOARD_COLORS,
  EQUIPMENT_BOXES,
  EQUIPMENT_COLORS,
  alignedPositionOf,
  boardRectsOf,
  descriptionPanelRectsOf,
  digitShiftOf,
  effectOffsetsOf,
  rowBoxOf,
  scrollBarRectsOf,
  tabCursorBoxOf,
  tabSeparatorRectsOf,
} from '@/pages/shop/lib/equipmentWindowLayout'
import type { PixelRect } from '@/pages/shop/lib/equipmentWindowLayout'

/** 사각형들을 칠한 뒤 (x, y) 의 색 — 나중 것이 이긴다 */
const colorAt = (rects: readonly PixelRect[], x: number, y: number): string | null =>
  rects.reduce<string | null>(
    (color, rect) => (x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height ? rect.color : color),
    null,
  )

describe('장비 창 배치 (mode_ui 프레임 30 · 31)', () => {
  it('박스는 boxes.json 의 "030" 그대로다', () => {
    expect(EQUIPMENT_BOXES.tab).toEqual({ x: 134, y: 164, width: 19, height: 13 })
    expect(EQUIPMENT_BOXES.row).toEqual({ x: 134, y: 180, width: 70, height: 15 })
    expect(EQUIPMENT_BOXES.board).toEqual({ x: 18, y: 176, width: 203, height: 90 })
  })

  it('줄은 높이 + 2 = 17 씩 내려가고, 탭 커서는 박스0.x + 2 + 21·부위', () => {
    expect(rowBoxOf(EQUIPMENT_BOXES.row, 4).y).toBe(180 + 68)
    expect(tabCursorBoxOf(0).x).toBe(136)
    expect(tabCursorBoxOf(3).x).toBe(136 + 63)
  })
})

describe('판 0x7c110 (박스 6, 깃발 1)', () => {
  const rects = boardRectsOf(EQUIPMENT_BOXES.board, true)

  it('판 속은 #335FCD, 오른쪽 위로 12줄 솟은 칸은 #1D44A8', () => {
    expect(colorAt(rects, 100, 200)).toBe(BOARD_COLORS.fill)
    // c = 18 + 101 + 1 = 120 · 줄 Y−1 = 175 의 솟은 칸은 c+2 부터
    expect(colorAt(rects, 200, 170)).toBe(BOARD_COLORS.raised)
    expect(colorAt(rects, 121, 175)).toBe(BOARD_COLORS.light)
    expect(colorAt(rects, 121, 174)).toBe(BOARD_COLORS.dark)
  })

  it('왼쪽 아래 칸 빗변은 X 를 두 번 더한 자리(원본 그대로)', () => {
    // b = 18 + 101 − 1 = 118 → 줄 Y+H (i = 1) 의 빗변 시작 x = X + b = 136
    expect(colorAt(rects, 135, 266)).toBe(BOARD_COLORS.fill)
    expect(colorAt(rects, 136, 266)).toBe(BOARD_COLORS.dark)
    expect(colorAt(rects, 150, 266)).toBe(BOARD_COLORS.dark)
  })

  it('왼·오른 테 2칸 #244CAE', () => {
    expect(colorAt(rects, 16, 200)).toBe(BOARD_COLORS.dark)
    expect(colorAt(rects, 222, 200)).toBe(BOARD_COLORS.dark)
  })
})

describe('탭 세로선 · 설명 판', () => {
  it('탭 칸마다 두 줄 세로선 — 높이 h − 2 + 1', () => {
    const lines = tabSeparatorRectsOf(EQUIPMENT_BOXES.tab)
    expect(lines).toHaveLength(8)
    expect(lines[0]).toEqual({ x: 134, y: 164, width: 1, height: 12, color: EQUIPMENT_COLORS.tabLine })
    expect(lines[7].x).toBe(134 + 63 + 1)
  })

  it('설명 판은 오른쪽 아래 모서리를 깎는다', () => {
    const rects = descriptionPanelRectsOf(EQUIPMENT_BOXES.description)
    const { x, y, width, height } = EQUIPMENT_BOXES.description
    expect(colorAt(rects, x + 10, y + 10)).toBe(EQUIPMENT_COLORS.panelFill)
    expect(colorAt(rects, x, y + 10)).toBe(EQUIPMENT_COLORS.panelEdge)
    expect(colorAt(rects, x + width - 1, y + height - 5)).toBe(EQUIPMENT_COLORS.panelLight)
    expect(colorAt(rects, x + width - 1, y + height - 1)).toBeNull()
    expect(colorAt(rects, x + width - 5, y + height - 1)).toBe(EQUIPMENT_COLORS.panelLight)
  })
})

describe('스크롤 막대', () => {
  it('다섯 줄 이하면 손잡이가 가득 찬다', () => {
    const rects = scrollBarRectsOf(EQUIPMENT_BOXES.scrollBar, 5, 0, 5)
    expect(rects[1]).toMatchObject({ x: 208, y: 185, width: 5, height: 73 })
  })

  it('11줄이면 L = (73·5 + 10) / 11 = 34, 윗줄 6 이면 d = 6·73 / 11 = 39', () => {
    const rects = scrollBarRectsOf(EQUIPMENT_BOXES.scrollBar, 11, 6, 5)
    expect(rects[1]).toMatchObject({ y: 185 + 39, height: 33 })
    expect(rects[2]).toMatchObject({ x: 209, y: 185 + 40, width: 3, height: 31 })
  })
})

describe('효과 줄 자리', () => {
  it('0x6c805 는 자릿수 − 1', () => {
    expect(digitShiftOf(30)).toBe(1)
    expect(digitShiftOf(250)).toBe(2)
    expect(digitShiftOf(5)).toBe(0)
  })

  it('보너스 두 자리면 이름 ox −26 · "+" ox −17', () => {
    expect(effectOffsetsOf(90)).toEqual({ labelOx: -26, plusOx: -17 })
  })

  it('정렬 0x24 는 오른쪽 · 세로 가운데 올림, 0xb9d35 는 내림', () => {
    const effect = rowBoxOf(EQUIPMENT_BOXES.value, 2)
    expect(alignedPositionOf(effect, 21, 10, 0x24, -26)).toEqual({ x: 64 + 63 - 21 - 26, y: 214 + 3 })
    expect(alignedPositionOf(effect, 6, 6, 0x24, -17, 1, true)).toEqual({ x: 64 + 57 - 17, y: 214 + 4 + 1 })
  })
})

describe('B-89 고친 길 — 아래 칸 빗변은 X 를 한 번만 더한다', () => {
  afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

  it('오른쪽 아랫변이 X + trunc(W/2) − s + 2 에서 선다 (원본은 X 를 한 번 더 더한다)', () => {
    const board = { x: 18, y: 100, width: 100, height: 40 }
    const 아랫변 = () => boardRectsOf(board, false).find((rect) => rect.y === board.y + board.height + 1)
    expect(아랫변()?.x).toBe(18 + 18 + 50 - 10 + 2)
    setBugfixConfigForTests(bugfixConfigWith(['B-89']))
    expect(아랫변()?.x).toBe(18 + 50 - 10 + 2)
  })
})
