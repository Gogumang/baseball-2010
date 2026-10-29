export const SCREEN = { width: 240, height: 320 } as const

export const PANEL = { x: 24, y: 54, width: 192, height: 212 } as const

/** x1 = W/2 − 86 */
export const X1 = 34

/** 제목 img_text 프레임 289 — (x1 − 23 + 31, y0 + 5) */
export const TITLE = { frame: 289, x: X1 - 23 + 31, y: PANEL.y + 5 } as const

export const ROW_COUNT = 6

/** Y_i = y0 − 5 + 25i */
export const rowTopOf = (index: number) => PANEL.y - 5 + 25 * index

/** 값 줄(사운드·속도·진동)과 메뉴 줄(상세 설정·모드 초기화·게임 데이터 관리)의 경계 */
export const FIRST_MENU_ROW = 3

/**
 * 값 줄 — 글머리 이미지 39(고른 줄은 38 덧그림), 이름 흰색, 아이콘 바탕 이미지 87, 값 막대 프레임 35(진동 줄은 38),
 * 좌우 화살 이미지 20 — 화살은 **고른 줄이 깜빡일 때만** (x0 + 91 · 뒤집어 x0 + 176, Y + 41) (0x597a2~0x597da).
 * 그리기 0x59600~0x598f2 를 직접 떴다.
 */
export const VALUE_ROW = {
  bulletImage: 39,
  selectedBulletImage: 38,
  bullet: { x: PANEL.x + 14, dy: 44 },
  name: { x: PANEL.x + 33, dy: 41 },
  iconBackImage: 87,
  iconBack: { x: PANEL.x + 68, dy: 36 },
  barFrame: 35,
  /** 진동 줄(칸 2)만 프레임 0x26 = 38 (0x596ee) */
  vibrationBarFrame: 38,
  bar: { x: PANEL.x + 98, dy: 37, width: 77, height: 18 },
  arrowImage: 20,
  leftArrow: { x: PANEL.x + 91, dy: 41 },
  rightArrow: { x: PANEL.x + 176, dy: 41 },
} as const

/**
 * 메뉴 줄 — 글머리 이미지 39(고른 줄은 38 덧그림, 둘 다 (x0 + 14, Y + 44)), 막대 프레임 37,
 * 이름 가운데 — 고른 줄 "!C!cffffff%s" 흰색 · 아닌 줄 "!C!c7B93D4%s" (0x5981a~0x598c0)
 */
export const MENU_ROW = {
  bulletImage: 39,
  selectedBulletImage: 38,
  bullet: { x: PANEL.x + 14, dy: 44 },
  barFrame: 37,
  /** 프레임 0x25 를 (x0 + 0x20, Y + 0x25) — 0x59834~0x59850. *(정정 r129 — 전에는 dy 38)* */
  bar: { x: PANEL.x + 32, dy: 0x25, width: 142, height: 18 },
  /** 0xba269(글, x0 + 0x20, Y + 0x29, 프레임 0x25 폭 142, −1, 0) — 호출 59896(0x59876~0x59896). *(정정 r129 — 전에는 dy 42)* */
  name: { x: PANEL.x + 32, dy: 0x29, width: 142 },
} as const

/** 아이콘 바탕 이미지 87 은 20×20 파란 네모다 — 아이콘은 이 안 **가운데**에 놓인다 (P6 5절) */
export const ICON_BACK_SIZE = 20

/**
 * 줄별 아이콘 (이미지 87 바탕 가운데) — 크기는 public/sprites/slt_frame/*.png 실측이다.
 * 예전에는 세 아이콘을 모두 (+3, +3) 에 놓았는데, 문서가 "바탕 가운데" 라 실제 크기로 가운데 맞춘다.
 */
export const ROW_ICON_IMAGES = { sound: 89, speed: 53, vibration: 91 } as const

export const ROW_ICONS = [
  { image: ROW_ICON_IMAGES.sound, width: 14, height: 15 },
  { image: ROW_ICON_IMAGES.speed, width: 11, height: 11 },
  { image: ROW_ICON_IMAGES.vibration, width: 10, height: 13 },
] as const

/** 소리 0 이면 아이콘 0x58 = 88 (0x59942) · 진동 켜짐이면 0x5c = 92 (0x59c50) */
export const SOUND_OFF_ICON = { image: 88, width: 10, height: 13 } as const

export const VIBRATION_ON_ICON = { image: 92, width: 18, height: 13 } as const

/** 20×20 바탕 안 가운데 맞춤 보정 */
export const iconCenterOffsetOf = (size: { readonly width: number; readonly height: number }) => ({
  dx: Math.trunc((ICON_BACK_SIZE - size.width) / 2),
  dy: Math.trunc((ICON_BACK_SIZE - size.height) / 2),
})
