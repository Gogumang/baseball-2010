/**
 * 환경설정 창 배치 (공용 페이지 0x593c8 종류 8 · 메인 메뉴 상태 8 — P6 5절 확정).
 *
 * 기준 (0x59436~0x594a4):
 * ```
 * x0 = W/2 − 96 = 24 · x1 = W/2 − 86 = 34 · hh = 212 · y0 = H/2 − hh/2 = 54
 * 창 = 공용 판 (24, 54, 192, 212)
 * 줄 i = 0..5 → Y_i = y0 − 5 + 25·i = 49 + 25i
 * ```
 * 그림은 `img_text` 가 아니라 **`ui/slt_frame.pzx`** 다 (F-8 의 img_text 표기는 잘못 읽은 것).
 * 제목만 img_text 프레임 289 "기본 설정"(46×10) 을 쓴다.
 */
export const SCREEN = { width: 240, height: 320 } as const

export const PANEL = { x: 24, y: 54, width: 192, height: 212 } as const
/** x1 = W/2 − 86 */
const X1 = 34
/** 제목 img_text 프레임 289 — (x1 − 23 + 31, y0 + 5) */
export const TITLE = { frame: 289, x: X1 - 23 + 31, y: PANEL.y + 5 } as const

export const ROW_COUNT = 6
/** Y_i = y0 − 5 + 25i */
export const rowTopOf = (index: number) => PANEL.y - 5 + 25 * index

/** 값 줄(사운드·속도·진동)과 메뉴 줄(상세 설정·모드 초기화·게임 데이터 관리)의 경계 */
export const FIRST_MENU_ROW = 3

/** 값 줄 — 글머리 이미지 39, 이름 흰색, 아이콘 바탕 이미지 87, 값 막대 프레임 35, 좌우 화살 이미지 20 */
export const VALUE_ROW = {
  bulletImage: 39,
  bullet: { x: PANEL.x + 14, dy: 44 },
  name: { x: PANEL.x + 33, dy: 41 },
  iconBackImage: 87,
  iconBack: { x: PANEL.x + 68, dy: 36 },
  barFrame: 35,
  bar: { x: PANEL.x + 98, dy: 37, width: 77, height: 18 },
  arrowImage: 20,
  leftArrow: { x: PANEL.x + 91, dy: 41 },
  rightArrow: { x: PANEL.x + 176, dy: 41 },
} as const

/** 메뉴 줄 — 노란 네모 38, 막대 프레임 37, 이름 #7B93D4 가운데 */
export const MENU_ROW = {
  bulletImage: 38,
  bullet: { x: PANEL.x + 14, dy: 45 },
  barFrame: 37,
  bar: { x: PANEL.x + 32, dy: 38, width: 142, height: 18 },
  name: { x: PANEL.x + 32, dy: 42, width: 142 },
} as const

/** 줄별 아이콘 (이미지 87 바탕 가운데) */
export const ROW_ICON_IMAGES = { sound: 89, speed: 53, vibration: 91 } as const

/**
 * 사운드 값 — 소리 크기만큼 이미지 98 + k 를 `x = x0 + 118 + k·(w + 1)`,
 * `y = Y + 35 + (h최대 − h)` 에 찍는다 (P6 5절 확정). 곧 **아래 맞춤**이다.
 * 이미지 98~101 은 12×2 · 12×5 · 12×8 · 12×11 이라 밑변이 모두 Y + 46 에 모인다.
 */
export const SOUND_BARS = {
  firstImage: 98,
  x: PANEL.x + 118,
  dy: 35,
  gap: 1,
  /** 이미지 98~101 의 폭·높이 (public/sprites/slt_frame/098~101.png) */
  sizes: [
    { width: 12, height: 2 }, { width: 12, height: 5 },
    { width: 12, height: 8 }, { width: 12, height: 11 },
  ],
} as const

/**
 * 속도 값 — 속도 + 1 개만큼 이미지 102 + k 를 x0 + 107 부터 가로로, `y = Y + 37` **아래 맞춤**.
 * 이미지 102~105 는 11×7 · 11×7 · 12×9 · 12×9 라 밑변이 모두 Y + 46 에 모인다.
 * 가로 간격은 원본 식을 못 읽어 예전 값(12px)을 그대로 둔다.
 */
export const SPEED_MARKS = {
  firstImage: 102,
  x: PANEL.x + 107,
  dy: 37,
  step: 12,
  /** 이미지 102~105 의 폭·높이 (public/sprites/slt_frame/102~105.png) */
  sizes: [
    { width: 11, height: 7 }, { width: 11, height: 7 },
    { width: 12, height: 9 }, { width: 12, height: 9 },
  ],
} as const

/** 아래 맞춤 세로 보정 — `(h최대 − h)`. 표에 없는 칸은 마지막 칸으로 본다. */
export function bottomAlignOffset(sizes: readonly { readonly height: number }[], index: number): number {
  if (sizes.length === 0) return 0
  const tallest = Math.max(...sizes.map((size) => size.height))
  const size = sizes[Math.min(Math.max(0, index), sizes.length - 1)]
  return tallest - size.height
}
/** 진동 값 — OFF/ON 두 칸, 고른 쪽에 노랑 사각 35×15 */
export const VIBRATION = {
  off: { x: PANEL.x + 97, dy: 41, width: 38 },
  on: { x: PANEL.x + 136, dy: 41, width: 38 },
  highlight: { width: 35, height: 15, dy: 38 },
} as const

/**
 * 아래 OK 버튼 — `ui/popup.pzx` 프레임 0 을 가운데에.
 * 원본 식은 `y = H/2 + hh/2 − h − 6` 인데 문서가 적어 둔 결과값은 251 이라 −6 이 빠진 값과 맞는다.
 * 여기서는 문서의 결과값을 따른다 (h = 15).
 */
export const OK_BUTTON = { frame: 0, width: 41, height: 15, y: 251 } as const
