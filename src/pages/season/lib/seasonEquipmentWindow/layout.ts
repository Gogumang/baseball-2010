export interface WindowBox {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** mode_ui 프레임 31 의 박스 0~6 */
export const EQUIPMENT_WINDOW = {
  frame: 31,
  partSlots: { x: 134, y: 164, width: 19, height: 13 },
  labels: { x: 26, y: 180, width: 37, height: 15 },
  values: { x: 64, y: 180, width: 63, height: 15 },
  items: { x: 134, y: 180, width: 70, height: 15 },
  description: { x: 27, y: 233, width: 100, height: 37 },
  scroll: { x: 207, y: 185, width: 7, height: 73 },
  panel: { x: 18, y: 176, width: 203, height: 90 },
  /** 줄 사이 — y += h + 2 */
  rowGap: 2,
  visibleRows: 5,
  /** 이름표 img_text — 302 소지금 · 303 가격 · 333 효과 (표 0xd495c) */
  labelFrames: [302, 303, 333],
  /** 부위 표시 mode_ui 51 · 낀 칸 막대 mode_ui 44 */
  partMarkerFrame: 51,
  equippedBarFrame: 44,
  /** 정렬 0x24 의 ox */
  valueInset: 2,
  /** num 105 "+" */
  plusFrame: 105,
  /** 효과 이름표 img_text — 타자 336 + 부위 · 투수 340 + 부위 (0x83f48) */
  effectLabelBase: { 타자: 336, 투수: 340 },
  /** 0x83378 의 설명 상자 안쪽 (0xba411 인자 5 · 5) */
  descriptionInset: 5,
  /** 커서 테두리 · 부위 표시가 틱 % 10 == 0 에 꺼진다 */
  blinkPeriod: 10,
} as const

export const EQUIPMENT_COLORS = {
  separator: '#4a7bde',
  separatorShade: '#29318c',
  boxEdge: '#18244a',
  boxFill: '#1d44a8',
  boxLight: '#4a7dde',
  itemText: '#87f8ff',
  equippedText: '#cec7bd',
  cursor: '#ffff00',
  scrollTrack: '#102152',
  scrollThumb: '#ffffff',
} as const

/** 1px 넓이까지 칠하는 사각 — 선 · 점도 이걸로 편다 */
export interface WindowRect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly color: string
}

/** 줄 r 의 박스 (y += h + 2) */
export function windowRowOf(box: WindowBox, row: number): WindowBox {
  return { ...box, y: box.y + row * (box.height + EQUIPMENT_WINDOW.rowGap) }
}

/** 부위 표시 칸 — (박스 0 x + 2 + 부위 × (w + 2), y, w, h) */
export function partMarkerBoxOf(part: number): WindowBox {
  const box = EQUIPMENT_WINDOW.partSlots
  return { ...box, x: box.x + 2 + part * (box.width + 2) }
}

/** 0xb9e05 · 0xb9d35 의 정렬 0x22 가운데 — 가로 trunc(d / 2) + d % 2 · 세로 같은 식 (C 나머지) */
export function centeredOffsetOf(boxSize: number, imageSize: number): number {
  const d = boxSize - imageSize
  return Math.trunc(d / 2) + (d % 2)
}

/** 틱 % 10 ≠ 0 — 커서 테두리 · 부위 표시가 켜진 틱 */
export const isBlinkOn = (tick: number) => tick % EQUIPMENT_WINDOW.blinkPeriod !== 0
