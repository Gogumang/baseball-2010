import { PANEL, SCREEN_WIDTH } from '@/pages/record/lib/recordAnnalsLayout/annalsTabs'

/**
 * 칸 격자 (탭 1 진행 · 탭 2 스킬, 0x2ebe0~0x2ec18):
 * `x = W/2 − 87 + 44·(i % 4)` = 33 · 77 · 121 · 165 · `y = y0 + 33 + 28·(i / 4)` = 87 · 115 · 143, 칸 41×25
 */
export const CELL_GRID = {
  columns: 4,
  visibleRows: 3,
  width: 41,
  height: 25,
  firstX: SCREEN_WIDTH / 2 - 87,
  stepX: 44,
  firstY: PANEL.y + 33,
  stepY: 28,
} as const

export function cellPositionOf(index: number) {
  return {
    x: CELL_GRID.firstX + CELL_GRID.stepX * (index % CELL_GRID.columns),
    y: CELL_GRID.firstY + CELL_GRID.stepY * Math.floor(index / CELL_GRID.columns),
  }
}

/** 얻은 칸 파랑 17 (진행) · 보라 20 (스킬) · 못 얻은 칸 회색 18 · 고른 칸 노란 테두리 21 */
export const CELL_FRAMES = { progress: 17, skill: 20, locked: 18, cursor: 21 } as const

/** 못 얻은 칸의 "?" 두 개 — 이미지 111 을 (x+10, y+7) · (x+20, y+7) */
export const LOCKED_MARK = { image: 111, dx: [10, 20], dy: 7 } as const

/**
 * 위·아래 스크롤 표시 — 프레임 24 ▲ (42×11) · 23 ▼ (0x2eb2c~0x2ebc8 · 0x2eff4~0x2f090).
 * x 는 둘 다 프레임 24 폭으로 가운데 (W/2 − 21). y 는 깜박임(`isBlinkOn`)에 따라 1px 까딱인다 —
 * 켜지면 ▲ y0 + 20 · ▼ y0 + 116, 꺼지면 ▲ y0 + 21 · ▼ y0 + 115.
 */
export const SCROLL_MARKS = {
  up: { frame: 24, yOn: PANEL.y + 20, yOff: PANEL.y + 21 },
  down: { frame: 23, yOn: PANEL.y + 116, yOff: PANEL.y + 115 },
  x: SCREEN_WIDTH / 2 - 21,
} as const

/** 닉네임 줄 — slt_frame 프레임 12 (164×18) 을 (33, 89 + 19i) */
export const NAME_ROW = {
  frame: 12,
  x: SCREEN_WIDTH / 2 - 87,
  firstY: PANEL.y + 35,
  step: 19,
  numberX: SCREEN_WIDTH / 2 - 72,
  nameX: SCREEN_WIDTH / 2 - 50,
  visibleRows: 8,
} as const

/**
 * 아래 합계 줄 — 프레임 15 (101×18) + 노란 네모 38 + img_text 269 "전체합계", 값은 노랑. 탭 3 (0x2f834~0x2f920) · 탭 4 (0x2fa60~0x2fb90)
 * 가 같은 꼴이다 — w·h = 프레임 15 상자(101, 18), x0 = 24 · y0 = 54:
 * 프레임 15 (x0 − w + 0xb6 = 105, y0 − h + 0xce = 242) · 이미지 0x26 (x0 + 0x10 = 40, y0 − h + 0xd3 = **247**) ·
 * img_text 0x10d (x0 + 0x1a = 50, y0 − h + 0xd2 = **246**) · 값 0xba269(글, x0 − w + 0xbb = **110**, y0 − h + 0xd2 = **246**, w − 10 = **91**)
 * 호출 2fb90 (탭 3 `"!C!cffff00%d/%d"` 가운데 · 탭 4 `"!R!cFFFF00…"` 오른쪽). *(정정 r129 — 전에는 네모 246 · 글씨 242 · 값 (105, 243, 101))*
 */
export const TOTAL_ROW = {
  frame: 15,
  frameX: PANEL.x - 101 + 0xb6,
  bulletX: PANEL.x + 0x10,
  bulletDy: 5,
  labelFrame: 269,
  labelX: PANEL.x + 0x1a,
  labelDy: 4,
  value: { x: PANEL.x - 101 + 0xbb, dy: 4, width: 101 - 10 },
  y: 242,
} as const
