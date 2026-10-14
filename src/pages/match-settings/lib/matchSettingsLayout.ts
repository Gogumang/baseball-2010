/**
 * 경기진행 설정 창의 배치 — 그리기 **0x6042c** 를 직접 떴다(2026-10-14, 메인 eb368bf).
 *
 * 0x6042c 를 capstone 으로 읽고, unicorn 으로 그 함수만 돌려(그림·글·숫자·칸 호출을 가로채) 상태마다 인자를 받아 적었다.
 * W = 240 · H = 320 · y0 = 판 위쪽. 그림 상자(0xba815)의 폭 w 는 `asr` 반올림이라 `w >> 1` 이다.
 * ```
 * 6042c  [skin+0x2ba] == 0 이면 곧장 끝 (61c40) · [skin+0x40c] += 1 · 깜빡 = (그 값 % 8) ≤ 4  ; [sp+0xa0]
 * 604d2  단계 [skin+0x2bb] == 0 → 종류 고르기, 아니면 6074c 가 종류 [skin+0x2bc] 로 갈린다 (0 607b4 · 1 60ae8 · 2 60e58)
 *
 * ── 종류 고르기 · 찬스 · 이닝 (판 0x55e60(skin, W/2, H/2, 192, 160, 0, 0x22) → (24, 80, 192, 160))
 *        제목 img_text 357 "경기설정" 팔레트 3 을 (W/2 − 0x60 − w/2 + 0x2d, H/2 − 0x4b) = (69 − w/2, 85)
 *   종류 줄 k(0~2): slt_frame 프레임 15(101×18) (W/2 − w/2, H/2 − 0x32 + 26k) = (70, 110 + 26k)
 *                   img_text 표 0xd1c70[k] = 399~401 팔레트 0 을 (W/2 − w/2, 114 + 26k)
 *        깜빡이면 0x6aa64(70, 110 + 26·종류, 100, 17, 둥글기 1, RGB(255,255,85))
 *   찬스·이닝: 꼬리 탭 slt_frame 이미지 40(91×15) 을 효과 0x11(좌우 뒤집기) 로 (W/2 − w + 0x5b, H/2 − 0x4a) = (120, 86),
 *              그 위 img_text 402 "찬스" / 403 "이닝" 팔레트 1 을 (W/2 − w(91) + 0x82, H/2 − 0x48) = (159, 88)
 *   찬스: popup 프레임 19(방망이) (W/2 − 0x42, H/2 − 0x28) = (54, 120) · 20(글러브) (W/2 + 0x1f, 120) = (151, 120)
 *         img_text 352 "공격" (W/2 − 0x3c, H/2 + 2) = (60, 162) · 338 "수비" (W/2 + 0x25, 162) = (157, 162)
 *         깜빡이면 값 0 → 프레임 21 을 (54, 120) · 값 1 → 프레임 22 를 (151, 120)
 *   이닝: 종류 줄과 같은 자리에 img_text 표 0xd1c90 = 404~406, 커서도 같은 꼴(값 줄)
 *   설명: 칸 0xbb28c(W/2, H/2 + 0x23, 182, 40, 2) → (29, 195, 182, 40),
 *         글 0xba268(글, W/2 − 0x60, H/2 + 0x2a, 192, −1) = (24, 202, 폭 192) — 종류 0xd1c7c[종류] · 찬스 0xd1c88[값] · 이닝 0xd1c9c[값]
 *
 * ── 상세 (판 0x55e60(skin, W/2, H/2, 192, 212, 0, 0x22) → (24, 54, 192, 212), y0 = 54)
 *        제목 357 팔레트 3 (69 − w/2, H/2 − 0x65) = (49, 59) · 꼬리 탭 이미지 40 (120, y0 + 6) · img_text 353 "상세" 팔레트 1 (159, y0 + 8)
 *        화살 slt_frame 이미지 32 (W/2 − 6, y0 − 깜빡2 − 10) · 33 (W/2 − 6, y0 + 깜빡2 + 0xd6)   ; 깜빡2 = 깜빡 ? 2 : 0
 *   줄 Y = 88 · 127 · 147 · 187 (y0 + 0x22 에서 +0x27 · +20 · +40)
 *        네모 slt_frame 이미지 (지금 줄 ? 38 : 39) (35, Y − 2) · 이름 두 장 img_text 팔레트 0 (45, Y − 3) · (67, Y − 3)
 *          0 [149 "타자", 354 "조작"] · 1 [352 "공격", 355 "주자"] · 2 [150 "투수", 354] · 3 [338 "수비", 355]
 *   줄 0 · 2 (9칸): slt_frame 프레임 (켜짐 ? 49 : 48)(19×15) 을 (29 + 20i, Y + 11)
 *   줄 1 · 3 (3칸): slt_frame 프레임 (켜짐 ? 51 : 50)(33×15) 을 (107 + 34i, Y − 6)
 *        숫자 0x585ac(num 이미지 90 + 숫자, 칸x + w/2 (+ 주자 줄은 −3), 칸y + h/2 + 1, 정렬 0x22, 효과 0xb 단색)
 *          — 켜짐 흰색 · 꺼짐 RGB(142,148,193)
 *        주자 줄은 img_text 390 "루" 를 (칸x + w/2 + 2, 칸y + 3) — 켜짐 팔레트 0 · 꺼짐 팔레트 4
 *        켜진 칸은 0x6aa64(칸x, 칸y, w − 1, h − 1, 1, RGB(128,255,255)) — 단 (지금 줄 · 지금 칸) 은 건너뛴다
 *        지금 줄이고 깜빡이면 지금 칸에 0x6aa64(…, RGB(255,255,85))
 *   설명: 칸 0xbb28c(W/2, H/2 + 0x27, 182, 40, 2) → (29, 199, 182, 40) ·
 *         줄 ≠ 4 이면 글 0xba268(StrMAINMENU[121 + 줄]([skin+0x2a4] 0x702b5), W/2 − 0x56, H/2 + 0x2e, 172, −1) = (34, 206, 폭 172)
 *   확인: popup 프레임 (줄 == 4 ? 18 : 0) 을 (W/2 − w(프레임 0 = 41)/2, y0 + 190) = (100, 244) — 깜빡이지 않는다
 * ```
 * ⚠️ 미확인: 깜빡 카운터 [skin+0x40c] 의 시작 값 — 스킨 칸이라 다른 화면과 함께 센다. 웹은 창을 연 뒤 갱신 수 + 1 로 센다.
 * 판 0x55e60 은 공용 `CommonPanel` 이 그린다 — 네 자리 모두 (…, 0, 0x22, 0, 0, 제목 탭 1, 어둡게 1).
 */

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
const HALF_W = W / 2
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
  offFrame: 48, onFrame: 49, width: 19, height: 15, x: 29, dy: 11, numberDx: 0, hasBaseLabel: false,
}
const BASE_CELL: DetailCellShape = {
  offFrame: 50, onFrame: 51, width: 33, height: 15, x: 107, dy: -6, numberDx: -3, hasBaseLabel: true,
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
