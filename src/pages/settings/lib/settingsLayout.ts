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

/** 20×20 바탕 안 가운데 맞춤 보정 */
export const iconCenterOffsetOf = (size: { readonly width: number; readonly height: number }) => ({
  dx: Math.trunc((ICON_BACK_SIZE - size.width) / 2),
  dy: Math.trunc((ICON_BACK_SIZE - size.height) / 2),
})

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
 *
 * 속도는 0~4 라 꺾쇠가 **최대 다섯 장(102~106)** 나온다. 예전에는 표에 102~105 넷만 적어 두어
 * 다섯째 장(106, 13×11)을 넷째 크기(12×9)로 잘못 보고 혼자 2px 내려앉았다 — 다섯 장을 다 적는다.
 * 다섯 장의 h최대는 11 이라 밑변이 모두 Y + 48 에 모인다 (소리 막대는 Y + 46).
 * 가로 간격은 원본 식을 못 읽어 예전 값(12px)을 그대로 둔다.
 */
export const SPEED_MARKS = {
  firstImage: 102,
  x: PANEL.x + 107,
  dy: 37,
  step: 12,
  /** 이미지 102~106 의 폭·높이 (public/sprites/slt_frame/102~106.png) */
  sizes: [
    { width: 11, height: 7 }, { width: 11, height: 7 },
    { width: 12, height: 9 }, { width: 12, height: 9 },
    { width: 13, height: 11 },
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

/**
 * **경기 중 메뉴 "설정"**(0x3c326 → 하위 5, 그리기 0x3cdd0 이 0x593c8 종류 8)은 **작은 판**이다.
 *
 * 경기 장면 초기화 0x3301c 가 skin+0x125 = 1 을 세우고(0x33038, 경기 장면을 나가는 0x332b8 · 메인 메뉴 0x234d4 는 0),
 * 0x593c8 이 그 플래그면 판 높이 [sp+0x88] = **0x82(130)**(0x5940c~0x59422) · 그리는 줄 수 [sp+0x78] = **3**
 * (0x595d0~0x595e4) — 사운드·속도·진동만 있고 **상세 설정·모드 초기화·게임 데이터 관리 줄이 아예 없다**.
 * y0 = H/2 − 130/2 = 95 라 판·제목·줄·OK 가 모두 (95 − 54) = 41 아래로 내려간다(x 는 그대로).
 * 커서 격자는 1열 4행(0x3c3ac `vtbl+0x10(1, 4, 1, 0x20, 0)`) — 셋째 다음 칸이 OK 단추다.
 */
export const IN_GAME_PANEL = { x: PANEL.x, y: SCREEN.height / 2 - 130 / 2, width: PANEL.width, height: 130 } as const
export const IN_GAME_ROW_COUNT = 3

/**
 * OK 단추도 커서 칸이다 — 격자 마지막 칸(열수 × 행수 − 1)이 고른 칸이면 popup 프레임 **0x12(18)**(주황 "OK", 49×23,
 * 원점 −4,−4), 아니면 프레임 0 (0x59de2~0x59e4e). 메인 메뉴 첫 화면 격자는 1×7(진입 0x259fc `vtbl+0x10(1, 7, …)`).
 */
export const OK_SELECTED_FRAME = 18
export const OK_SELECTED_OVERFLOW = 4

/**
 * 상세 설정 (메인 메뉴 상태 0x20 · 페이지 32 — 그리기 0x59e82~0x5a226 의 **4줄 루프** `cmp r6,#4`,
 * 갱신 0x288ac 는 칸 0~3 을 누를 때 값을 `eor #1` 로 뒤집는다 — P7 K2 확정).
 *
 * **확정된 것**
 *  - 줄 아이콘 표 `0xd1afc` = [93, 94, 90, 97]
 *  - 값 = 옵션 +0x2d 투구 · +0xbd 주루 · +0xf4 송구 · +0x3a 전광판
 *  - 값 라벨 첫 번호 표 `0xd1b04` = [74, 76, 76, 78] → 칸 j 는 `StrMAINMENU[첫번호 + j]` 이고
 *    **값 == j 면 흰색(0xcf2e0), 아니면 #7B93D4(0xcf2f0)**
 *  - 다섯째 줄 "터치"(옵션 +0x14c)는 원본이 값만 읽고 **그리지 않는다** → 웹도 안 그린다
 *
 * ⚠️ **근사/추정**: 줄 y·두 칸 자리는 문서에 없다. 같은 공용 페이지(0x593c8 종류 8) 안이라
 * 첫 화면 값 줄(Y_i = 49 + 25i, 막대 프레임 35)과 진동 줄의 OFF/ON 자리를 그대로 빌려 썼다.
 * 좌우 화살(이미지 20)을 상세 줄에도 그리는지는 못 읽어 **안 그린다**.
 * 제목은 img_text **290 "상세 설정"**(46×10) — 그림 글자를 눈으로 확인한 것이라 **유력**
 * (첫 화면 289 "기본 설정" 바로 다음 칸이고, 291 "모드 초기화" · 292 "게임데이터관리" 가 이어진다).
 */
export const DETAIL_TITLE = { frame: 290, x: TITLE.x, y: TITLE.y } as const

export const DETAIL_ROWS = [
  // 이름 StrMAINMENU[69] · 값 [74] 기본 / [75] 게이지 — 기본값 0 = 기본(게이지 OFF)
  { name: '투구', icon: { image: 93, width: 13, height: 13 }, labels: ['기본', '게이지'] },
  // 이름 [70] · 값 [76] 수동 / [77] 자동 — 기본값 1 = 자동
  { name: '주루', icon: { image: 94, width: 12, height: 12 }, labels: ['수동', '자동'] },
  // 이름 [71] · 값 [76] 수동 / [77] 자동 — 기본값 0 = 수동
  { name: '송구', icon: { image: 90, width: 16, height: 11 }, labels: ['수동', '자동'] },
  // 이름 [72] · 값 [78] OFF / [79] ON — 기본값 1 = ON
  { name: '전광판', icon: { image: 97, width: 14, height: 14 }, labels: ['OFF', 'ON'] },
] as const

export const DETAIL_ROW_COUNT = DETAIL_ROWS.length

/** 두 칸 자리 — 진동 줄의 OFF/ON 자리를 그대로 쓴다 (⚠️ 근사) */
export const DETAIL_CHOICES = [VIBRATION.off, VIBRATION.on] as const

/** 값 글 색 — 고른 칸은 흰색, 아닌 칸은 메뉴 줄과 같은 #7B93D4 */
export const DETAIL_COLORS = { selected: '#FFFFFF', unselected: '#7B93D4' } as const

/**
 * 환경설정 → **모드 초기화** (메인 메뉴 상태 0x21 · 공용 페이지 0x593c8 종류 0x21 — 그리기 0x5a316 직접 읽음).
 *
 * ```
 * 제목 img_text 프레임 0x123 = 291 "모드 초기화"(58×10) 를 (x1 − w/2 + 31 = 36, y0 + 5)   ; 0x5a316~0x5a370
 * 줄 i = 0..2, Y_i = y0 + 30·i (첫 화면과 달리 −5 가 없고 간격 0x1e)                      ; 0x5a3ce · 0x5a4e8
 *   글머리 slt_frame 이미지 39 (x0 + 0x18, Y + 0x2c)                                       ; 0x5a3f6
 *   막대 slt_frame 프레임 36(114×18) (x0 + 0x32, Y + 0x25)                                  ; 0x5a42c
 *   이름 StrMAINMENU[0x52 + i] 가운데, 폭 = 프레임 36 폭 (x0 + 0x32, Y + 0x28)             ; 0x5a440 · 0x5a47a
 *     고른 줄 "!C!cffffff%s"(0xcf2e0) 흰색 · 아닌 줄 "!C!c7B93D4%s"(0xcf2f0)
 *   고른 줄: 노란 네모 이미지 38 을 글머리 자리에 (x0 + 0x18, Y + 0x2c)                    ; 0x5a4a4
 *            + 흰 둥근 테두리 0x6aa65 (막대 자리, 둥글기 1)                                  ; 0x5a4de
 * ```
 * 아래 OK 단추는 종류 0x21 갈래에 없다 (0x5a4f6 → 0x5a6f8 끝).
 * 흰 테두리는 첫 화면처럼 깜빡인다 (`isSelectedOutlineShown`, 0x5a4ae).
 */
export const MODE_RESET_TITLE = { frame: 291, x: X1 - 29 + 31, y: PANEL.y + 5 } as const
export const MODE_RESET_ROW_COUNT = 3
export const modeResetRowTopOf = (index: number) => PANEL.y + 30 * index
export const MODE_RESET_ROW = {
  bulletImage: 39,
  selectedBulletImage: 38,
  bullet: { x: PANEL.x + 0x18, dy: 0x2c },
  barFrame: 36,
  bar: { x: PANEL.x + 0x32, dy: 0x25, width: 114, height: 18 },
  name: { x: PANEL.x + 0x32, dy: 0x28, width: 114 },
} as const

/**
 * 고른 줄 흰 테두리의 **깜빡임** — 공용 페이지 0x593c8 머리(0x593ce~0x593ee)가 그릴 때마다 skin+0x410 을 +1 한 뒤
 * `0xca911(카운터, 8) ≤ 3` 이면 [sp+0x9c] = 1 로 두고, 테두리 0x6aa65 는 그 값이 켜졌을 때만 그린다 —
 * 첫 화면(종류 8) 0x598c4 · 상세 설정(0x20) 0x5a1aa · 모드 초기화(0x21) 0x5a4ae. 8 갱신 중 4 갱신 보인다.
 * 판이 펼쳐지는 동안은 0x59548 이 0 으로 끈다 — `nextPanelFold` 참고.
 * ⚠️ 카운터의 시작 위상은 미확인이다 — skin+0x410 은 화면을 건너 이어지는 값인데, 웹은 화면마다 갱신 수를 0 부터 센다.
 */
export const isSelectedOutlineShown = (updates: number) => (updates + 1) % 8 <= 3

/** 머리띠 `0x54d95(skin, 0, 5, 0)` — 제목 0 "2010프로야구" · 바닥 5(되돌아가기). 상태 8·0x20·0x21 그리기 0x2dc90 · 0x2dc48 · 0x2dc00 */
export const SETTINGS_FRAME = { title: '2010프로야구', footer: 5 } as const

/**
 * **판 펼침·접힘** — 공용 페이지 0x593c8 이 그릴 때마다 판 높이 skin+0x90 으로 판을 그리고(0x55e60, 화면 가운데),
 * 그린 **뒤에** 0x5a6fe 가 높이를 한 걸음 옮긴다:
 * ```
 * 펼침(+0x99 = 1): 끝(+0x98)이면 높이 = 목표. 아니면 걸음 +0x94 ×= 4, 높이 += 걸음, 목표 이상이면 목표 · 끝 = 1
 * 접힘(+0x99 = 0): 끝이면 높이 = 1.    아니면 걸음 ×= 4, 높이 −= 걸음, 10 이하면 10 · 끝 = 1
 * ```
 * 들어옴 0x259fc(상태 8, 앞 상태가 0x20~0x22 가 아닐 때) · 경기 중 0x3c3bc 가 높이 0x20 · 걸음 1 · 끝 0 · 펼침 1 로 둔다 →
 * 그려지는 높이는 32 · 36 · 52 · 116 · 목표(212, 경기 중 130).
 * 첫 화면 OK 칸·CLR(0x295e2)은 저장 0x1f1b9 뒤 끝 0 · 걸음 1 · 접힘 으로 두고, 갱신 끝(0x29688~0x296b2)이
 * "접힘이고 끝" 이면 상태 4(처음 메뉴)로 간다 → 212 · 208 · 192 · 128 을 그리고 나간다.
 * 펼치는 동안(높이 < 목표)은 고른 줄 흰 테두리를 끄고(0x59548 `[sp+0x9c] = 0`), 잘라내기 0xbae25 를
 * (x0, H/2 − h/2 + 5, 192, h − 10) 로 좁힌다(0x5951e~0x59544). 다 펴지면 (x0, H/2 − h/2 − 5, 192, h + 10)(0x594d4).
 */
export interface PanelFold {
  readonly isOpening: boolean
  /** 이번에 그릴 판 높이 (skin+0x90) */
  readonly height: number
  /** 걸음 (skin+0x94) */
  readonly step: number
  /** 끝 (skin+0x98) */
  readonly isDone: boolean
}

/** 들어옴 0x259fc · 0x3c3bc — 높이 0x20 · 걸음 1 */
export const PANEL_UNFOLD_START_HEIGHT = 0x20
const FOLD_GROWTH = 4
/** 접힘이 멈추는 높이 (0x5a766 `cmp r3,#0xa`) */
const FOLD_END_HEIGHT = 10

export const openingFold = (): PanelFold => ({ isOpening: true, height: PANEL_UNFOLD_START_HEIGHT, step: 1, isDone: false })
export const openedFold = (fullHeight: number): PanelFold => ({ isOpening: true, height: fullHeight, step: 1, isDone: true })
/** 0x295e2 — 끝 0 · 걸음 1 · 접힘. 높이는 지금 그대로다 */
export const closingFold = (from: PanelFold): PanelFold => ({ isOpening: false, height: from.height, step: 1, isDone: false })

/** 한 번 그린 뒤의 다음 높이 (0x5a6fe~0x5a770) */
export function nextPanelFold(fold: PanelFold, fullHeight: number): PanelFold {
  if (fold.isOpening) {
    if (fold.isDone) return { ...fold, height: fullHeight }
    const step = fold.step * FOLD_GROWTH
    const height = fold.height + step
    return height >= fullHeight ? { isOpening: true, height: fullHeight, step, isDone: true } : { ...fold, height, step }
  }
  if (fold.isDone) return { ...fold, height: 1 }
  const step = fold.step * FOLD_GROWTH
  const height = fold.height - step
  return height <= FOLD_END_HEIGHT
    ? { isOpening: false, height: FOLD_END_HEIGHT, step, isDone: true }
    : { ...fold, height, step }
}

/** 잘라내기 사각형 (0xbae25) — 펼치는 중이면 판 안쪽 5px, 다 펴졌으면 판 바깥 5px */
export function panelClipOf(height: number, fullHeight: number): { readonly y: number; readonly height: number } {
  const top = SCREEN.height / 2 - Math.trunc(height / 2)
  return height < fullHeight ? { y: top + 5, height: height - 10 } : { y: top - 5, height: height + 10 }
}

/** 첫 화면 격자 1열×7행(0x259fc `vtbl+0x10(1, 7, 1, 0x20, 0)`) — 줄 여섯 + OK 칸. 플래그 0x20 = 세로만 감긴다 */
export const MAIN_MENU_CURSOR_COUNT = ROW_COUNT + 1
