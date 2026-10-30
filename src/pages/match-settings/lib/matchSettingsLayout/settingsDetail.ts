/** 상세 창 — 화살 · 줄 · 칸 꼴 · 숫자 · OK · 깜빡 */
import { DETAIL_WINDOW, HALF_W } from '@/pages/match-settings/lib/matchSettingsLayout/settingsWindow'
import type { RoundOutline, SettingsBox, SettingsPoint } from '@/pages/match-settings/lib/matchSettingsLayout/settingsWindow'

/** 상세 화살 — slt_frame 이미지 32 ▲ · 33 ▼ (13×8) */
export const DETAIL_ARROWS = {
  up: 32,
  down: 33,
  x: HALF_W - 6,
  /** 깜빡이면 2 */
  bob: 2,
} as const
/** ▲ y = y0 − 깜빡2 − 10 */
export const detailUpArrowYOf = (bob: number): number => DETAIL_WINDOW.y - bob - 10
/** ▼ y = y0 + 깜빡2 + 0xd6 */
export const detailDownArrowYOf = (bob: number): number => DETAIL_WINDOW.y + bob + 0xd6

/** 상세 줄 Y (y0 + 0x22 → +0x27 → +20 → +40) */
export const DETAIL_ROW_Y = [88, 127, 147, 187] as const

/** 줄 머리 네모 — 지금 줄 38(노랑) · 아니면 39 — (35, Y − 2) */
export const DETAIL_MARK = { current: 38, other: 39, x: 35, dy: -2 } as const

/** 줄 이름 두 장 (45, Y − 3) · (67, Y − 3) — 팔레트 0 */
export const DETAIL_LABEL = { x: [45, 67], dy: -3 } as const
export const DETAIL_LABEL_FRAMES = [
  [149, 354],
  [352, 355],
  [150, 354],
  [338, 355],
] as const

/** 상세 칸 꼴 — 9칸 줄(0 · 2) 과 3칸 줄(1 · 3) */
export interface DetailCellShape {
  readonly offFrame: number
  readonly onFrame: number
  readonly width: number
  readonly height: number
  readonly x: number
  /** 줄 Y 에서 */
  readonly dy: number
  /** 숫자 가운데 x 를 칸 가운데에서 옮기는 값 */
  readonly numberDx: number
  /** "루" 그림 — 9칸 줄은 없다 */
  readonly hasBaseLabel: boolean
}

const INNING_CELL: DetailCellShape = {
  offFrame: 48,
  onFrame: 49,
  width: 19,
  height: 15,
  x: 29,
  dy: 11,
  numberDx: 0,
  hasBaseLabel: false,
}
const BASE_CELL: DetailCellShape = {
  offFrame: 50,
  onFrame: 51,
  width: 33,
  height: 15,
  x: 107,
  dy: -6,
  numberDx: -3,
  hasBaseLabel: true,
}

/** 줄별 칸 꼴 — 0 타자조작 · 1 공격주자 · 2 투수조작 · 3 수비주자 */
export const DETAIL_CELL_SHAPES: readonly DetailCellShape[] = [INNING_CELL, BASE_CELL, INNING_CELL, BASE_CELL]

/** 칸 i 의 상자 — 칸 사이는 w + 1 */
export function detailCellBoxOf(row: number, cell: number): SettingsBox {
  const shape = DETAIL_CELL_SHAPES[row] ?? INNING_CELL
  return {
    x: shape.x + (shape.width + 1) * cell,
    y: (DETAIL_ROW_Y[row] ?? 0) + shape.dy,
    width: shape.width,
    height: shape.height,
  }
}

/** 칸 숫자의 가운데 — (칸x + w/2 + 보정, 칸y + h/2 + 1). 0x585ac 정렬 0x22 가 숫자 폭·높이의 반을 뺀다 */
export function detailNumberCenterOf(row: number, cell: number): SettingsPoint {
  const shape = DETAIL_CELL_SHAPES[row] ?? INNING_CELL
  const box = detailCellBoxOf(row, cell)
  return { x: box.x + (shape.width >> 1) + shape.numberDx, y: box.y + (shape.height >> 1) + 1 }
}

/** "루" img_text 390 — (칸x + w/2 + 2, 칸y + 3) */
export const BASE_LABEL_FRAME = 390
export function baseLabelPointOf(row: number, cell: number): SettingsPoint {
  const shape = DETAIL_CELL_SHAPES[row] ?? BASE_CELL
  const box = detailCellBoxOf(row, cell)
  return { x: box.x + (shape.width >> 1) + 2, y: box.y + 3 }
}

/** 칸 테두리 0x6aa64 — (칸x, 칸y, w − 1, h − 1) */
export function detailCellOutlineOf(row: number, cell: number, color: string): RoundOutline {
  const box = detailCellBoxOf(row, cell)
  return { x: box.x, y: box.y, width: box.width - 1, height: box.height - 1, color }
}

/** 숫자 단색 — 켜짐 흰색 · 꺼짐 RGB(142,148,193) (0x1400748 → 0x585ac 효과 0xb) */
export const DETAIL_NUMBER_COLOR = { on: '#FFFFFF', off: '#8E94C1' } as const

/** num.pzx 이미지 90 + 숫자 — 크기 8×8, "1"(91) 만 4×8 */
export const DETAIL_NUMBER = { base: 90, height: 8 } as const
export const detailDigitWidthOf = (digit: number): number => (digit === 1 ? 4 : 8)

/** 확인 단추 — popup 프레임 0(41×15) · 고르면 18. x = W/2 − 41/2 · y = y0 + 190 */
export const DETAIL_OK = {
  frame: 0,
  selectedFrame: 18,
  width: 41,
  height: 15,
  x: HALF_W - (41 >> 1),
  y: DETAIL_WINDOW.y + 190,
} as const

/** 깜빡임 — 그릴 때마다 [skin+0x40c] 를 1 올린 뒤 `% 8 ≤ 4` (6045a~6046c) */
export const isSettingsBlinkOn = (drawCount: number): boolean => ((drawCount % 8) + 8) % 8 <= 4

/** 설명 글 줄 높이 — 0xba268 → 0x6ecd0(상자, 1) 앱 전역 글꼴(높이 11 + 줄간 3) */
export const DESCRIPTION_LINE_HEIGHT = 14
