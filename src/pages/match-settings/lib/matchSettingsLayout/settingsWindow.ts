/** 작은 창 · 상세 창 판 · 제목 · 탭 · 목록 줄 · 찬스 칸 · 설명 칸 */
export interface SettingsBox {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface SettingsPoint {
  readonly x: number
  readonly y: number
}

const W = 240
const H = 320
export const HALF_W = W / 2
const HALF_H = H / 2

/** 0x55e60(skin, W/2, H/2, 192, h, 0, 0x22) — 가운데 정렬 0x22 */
const windowOf = (height: number): SettingsBox => ({
  x: HALF_W - 0x60,
  y: HALF_H - (height >> 1),
  width: 0xc0,
  height,
})

/** 종류 고르기 · 찬스 · 이닝 판 — (24, 80, 192, 160) */
export const SMALL_WINDOW: SettingsBox = windowOf(0xa0)
/** 상세 판 — (24, 54, 192, 212) */
export const DETAIL_WINDOW: SettingsBox = windowOf(0xd4)

/** 마우스 되돌아가기 단추 — 원본은 CLR 키가 맡는다 (**웹판 추가**). 판 바로 아래 왼쪽에 둔다 */
export const BACK_BUTTON = { width: 60, height: 14, gap: 4 } as const
export const backButtonOf = (board: SettingsBox): SettingsBox => ({
  x: board.x,
  y: board.y + board.height + BACK_BUTTON.gap,
  width: BACK_BUTTON.width,
  height: BACK_BUTTON.height,
})

/** img_text 팔레트 (0x913e5(애니, n)) — 0 흰 · 1 노랑 · 3 짙은 파랑 · 4 회색 */
export const IMG_TEXT_PALETTE = { 흰: 0, 노랑: 1, 파랑: 3, 회색: 4 } as const

/** 제목 "경기설정" — img_text 357 팔레트 3. x = W/2 − 0x60 − w/2 + 0x2d */
export const TITLE = {
  frame: 357,
  centerX: HALF_W - 0x60 + 0x2d,
  /** 종류·찬스·이닝 H/2 − 0x4b · 상세 H/2 − 0x65 */
  smallY: HALF_H - 0x4b,
  detailY: HALF_H - 0x65,
} as const

/** 꼬리 탭 — slt_frame **이미지** 40(91×15)을 효과 0x11 · 인자 0(좌우 뒤집기)로, 그 위에 종류 이름(팔레트 1) */
export const TAB = {
  image: 40,
  imageWidth: 91,
  /** W/2 − w + 0x5b */
  x: HALF_W - 91 + 0x5b,
  /** W/2 − w + 0x82 */
  labelX: HALF_W - 91 + 0x82,
  /** 찬스·이닝 (H/2 − 0x4a, H/2 − 0x48) · 상세 (y0 + 6, y0 + 8) */
  smallY: HALF_H - 0x4a,
  smallLabelY: HALF_H - 0x48,
  detailY: DETAIL_WINDOW.y + 6,
  detailLabelY: DETAIL_WINDOW.y + 8,
} as const

/** 꼬리 탭 위 이름 — 찬스 402 · 이닝 403 · 상세 353 */
export const TAB_LABEL_FRAMES = [402, 403, 353] as const

/** 종류 줄·이닝 값 줄 — slt_frame 프레임 15(101×18) */
export const LIST_ROW = {
  frame: 15,
  width: 101,
  height: 18,
  /** W/2 − 101/2 */
  x: HALF_W - (101 >> 1),
  /** H/2 − 0x32 */
  y: HALF_H - 0x32,
  step: 0x1a,
  /** 이름 그림은 줄 위에서 4 아래 */
  labelDy: 4,
} as const

export const listRowTopOf = (index: number): number => LIST_ROW.y + LIST_ROW.step * index

/** 가운데 놓기 — 원본 `W/2 − (w >> 1)` */
export const centeredLeftOf = (centerX: number, width: number): number => centerX - (width >> 1)

/** 둥근 테 0x6aa64(x, y, w, h, 둥글기 1, 색) — 선은 x..x+w · y..y+h, 네 모서리 점은 빈다 */
export interface RoundOutline extends SettingsBox {
  readonly color: string
}

/** 노랑 커서 RGB(255,255,85) · 켜진 칸 하늘 RGB(128,255,255) */
export const OUTLINE_COLOR = { 커서: '#FFFF55', 켜짐: '#80FFFF' } as const

/** 종류·이닝 줄 커서 — (70, 110 + 26k, 100, 17) */
export const listCursorOf = (index: number): RoundOutline => ({
  x: LIST_ROW.x,
  y: listRowTopOf(index),
  width: LIST_ROW.width - 1,
  height: LIST_ROW.height - 1,
  color: OUTLINE_COLOR.커서,
})

/** 찬스 두 칸 — popup 프레임 19 · 20, 고른 칸은 깜빡일 때 21 · 22, 이름 img_text 352 · 338 */
export const CHANCE_SLOTS = [
  { frame: 19, selectedFrame: 21, x: HALF_W - 0x42, y: HALF_H - 0x28, label: 352, labelX: HALF_W - 0x3c, labelY: HALF_H + 2 },
  { frame: 20, selectedFrame: 22, x: HALF_W + 0x1f, y: HALF_H - 0x28, label: 338, labelX: HALF_W + 0x25, labelY: HALF_H + 2 },
] as const
/** 찬스 칸 그림 크기 (popup 프레임 19 · 20 = 35×35) — 마우스 칸으로만 쓴다 */
export const CHANCE_SLOT_SIZE = 35

/** 설명 칸 0xbb28c(W/2, y, 182, 40, 2) 와 글 0xba268(x, y, 폭) */
export interface DescriptionLayout {
  readonly box: SettingsBox
  readonly text: SettingsBox
}

const DESCRIPTION_BOX_WIDTH = 0xb6
const DESCRIPTION_BOX_HEIGHT = 0x28

/** 종류·찬스·이닝 — 칸 (29, 195) · 글 (24, 202, 폭 192) */
export const SMALL_DESCRIPTION: DescriptionLayout = {
  box: { x: HALF_W - DESCRIPTION_BOX_WIDTH / 2, y: HALF_H + 0x23, width: DESCRIPTION_BOX_WIDTH, height: DESCRIPTION_BOX_HEIGHT },
  text: { x: HALF_W - 0x60, y: HALF_H + 0x2a, width: 0xc0, height: DESCRIPTION_BOX_HEIGHT },
}

/** 상세 — 칸 (29, 199) · 글 (34, 206, 폭 172) */
export const DETAIL_DESCRIPTION: DescriptionLayout = {
  box: { x: HALF_W - DESCRIPTION_BOX_WIDTH / 2, y: HALF_H + 0x27, width: DESCRIPTION_BOX_WIDTH, height: DESCRIPTION_BOX_HEIGHT },
  text: { x: HALF_W - 0x56, y: HALF_H + 0x2e, width: 0xac, height: DESCRIPTION_BOX_HEIGHT },
}

/** 설명 칸 색 — 0xbb28c 를 떠서 본 칠·선 (안 RGB(29,68,168) · 위·왼 (8,36,107) · 아래·오른 (90,134,255)) */
export const DESCRIPTION_BOX_COLORS = { fill: '#1D44A8', dark: '#08246B', light: '#5A86FF' } as const
