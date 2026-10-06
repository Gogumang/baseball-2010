/**
 * 기록연감 배치 (메인 메뉴 상태 30, 그리기 0x2e29c~0x2fc12 — P6 2c 확정).
 *
 * ```
 * 창 = 공용 판 (24, 54, 192, 212) · x0 = W/2 − 96 = 24 · y0 = H/2 − 106 = 54
 * 탭 막대 = slt_frame 프레임 4 + 탭 (192×19) 을 (24, H/2 − 108 = 52)
 * 탭 커서 = 프레임 9 (72×17)
 * ```
 * 그림은 모두 `ui/slt_frame.pzx`(this+0x9c)와 `ui/num.pzx`, 전역 `img_text` 다.
 */
const SCREEN_WIDTH = 240

export const PANEL = { x: 24, y: 54, width: 192, height: 212 } as const

/** 탭 막대 — 고른 탭만 넓고 흰 칸이라 탭마다 프레임이 다르다 (표 0xcedcc = [4,5,6,7,8]) */
export const TAB_BAR = { firstFrame: 4, x: 24, y: 52, width: 192, height: 19 } as const
/** 탭 이름 — img_text 276 기록 · 277 진행 · 278 스킬 · 279 닉네임 · 280 통계 (표 0xcedb8) */
export const TAB_NAME_FRAMES = [276, 277, 278, 279, 280] as const
export const TAB_NAMES = ['기록', '진행', '스킬', '닉네임', '통계'] as const
export const TAB_COUNT = TAB_NAME_FRAMES.length

/**
 * 탭 이름·커서의 x 는 탭 막대 프레임의 **박스**가 정한다 (0x94a65 → 0x94fe1,
 * 박스 한 칸 = 8바이트 i16 x,y,w,h). slt_frame 프레임 4~8 의 **박스 0** 을 직접 읽은 값이다 (S12 1절 확정):
 *
 * ```
 * 탭 0 (2, 2, 72, 17) · 1 (31, …) · 2 (60, …) · 3 (89, …) · 4 (118, 2, 72, 17)
 * ```
 * x 간격은 **29** 다 — 막대 폭 192 를 5 로 나눈 38.4 가 아니다.
 * 박스는 프레임 왼쪽 위가 원점이라 화면 좌표는 막대 x0 = **24** 를 더한다.
 */
export const TAB_SLOT_BOX_XS = [2, 31, 60, 89, 118] as const
export const TAB_SLOT_WIDTH = 72
export const TAB_SLOT_HEIGHT = 17
/** 고른 탭 박스의 화면 x — 26 · 55 · 84 · 113 · 142 (0x2e51c 가 읽는 박스 0) */
export const tabSlotXOf = (tab: number) => TAB_BAR.x + TAB_SLOT_BOX_XS[tab]

/**
 * 박스는 **고른 탭의 글씨 칸**이다. 안 고른 탭은 아이콘만 든 29px 칸이고 그림은 막대 프레임에 붙어 있다
 * (프레임 파트 배치 — 안 고른 탭 i 의 x = `29i`(i < 고른탭) · `29i + 46`(i > 고른탭), 고른 탭은 폭 75).
 */
export const TAB_ICON_STEP = 29
export const TAB_ICON_WIDTH = 29
export const TAB_SELECTED_WIDTH = 75
export const TAB_SELECTED_GAP = 46
export function tabIconXOf(tab: number, selected: number): number {
  const base = TAB_BAR.x + TAB_ICON_STEP * tab
  return tab > selected ? base + TAB_SELECTED_GAP : base
}
export const tabIconWidthOf = (tab: number, selected: number) =>
  (tab === selected ? TAB_SELECTED_WIDTH : TAB_ICON_WIDTH)

/** 탭 커서 프레임 9 (72×17) — `x = 24 + 박스x`, `y = 54 + 박스y − 2 = 54` (0x2e5ca~0x2e618) */
export const TAB_CURSOR = { frame: 9, width: TAB_SLOT_WIDTH, height: TAB_SLOT_HEIGHT, y: 54 } as const

/**
 * 탭 이름 (img_text 276+탭) — `x = 24 + 박스x + (박스w − 이름폭)/2`, `y = 54 + 박스y + 2 = 58`
 * (0x2e568~0x2e5ba). 원본은 **고른 탭의 이름 하나만** 그린다 — 안 고른 탭은 막대 그림의 아이콘이다.
 */
export const TAB_NAME_Y = 58
export const tabNameXOf = (tab: number, nameWidth: number) =>
  tabSlotXOf(tab) + Math.trunc((TAB_SLOT_WIDTH - nameWidth) / 2)

/** 쪽 수가 있는 탭 (표 0xce8dc s8) — 기록 6쪽 · 닉네임 3쪽 · 통계 2쪽 */
export const TAB_PAGE_COUNTS = [6, 0, 0, 3, 2] as const

/** 쪽 번호·화살 (W/2 ± …, y0 + 22 = 76) */
export const PAGER = {
  numberX: SCREEN_WIDTH / 2 + 52,
  totalX: SCREEN_WIDTH / 2 + 66,
  y: 76,
  leftArrow: { image: 20, x: SCREEN_WIDTH / 2 + 35, y: 77 },
  rightArrow: { image: 20, x: SCREEN_WIDTH / 2 + 79, y: 77 },
} as const

/** 쪽 제목 줄 — 노란 네모 이미지 38 (34, 78) + 제목 (42, 76) */
export const PAGE_TITLE = { bulletImage: 38, bulletX: 34, bulletY: 78, x: 42, y: 76 } as const

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

/** 아래 합계 줄 — 프레임 15 (101×18) + 노란 네모 38 + img_text 269 "전체합계", 값은 노랑 */
export const TOTAL_ROW = {
  frame: 15,
  frameX: PANEL.x - 101 + 182,
  bulletX: PANEL.x + 16,
  labelFrame: 269,
  labelX: PANEL.x + 26,
  y: 242,
} as const

/**
 * **탭 1 진행 = 엔딩 칸 20개** (그리기 0x2ead8~0x2ef6a, 칸 값은 0x58b5c 가 채운다 — 둘 다 직접 떴다).
 * ```
 * 0x58b5c(skin): skin+0x1dc..+0x1ef = 0
 *   i = 0..14: 전역기록 [+0xa8 + i] ≠ 0 → skin[+0x1dc + i] = 1, 나리 n++        ; 나리 엔딩 15칸
 *   j = 0..4 : 전역기록 [+0xa0 + j] ≠ 0 → skin[+0x1eb + j] = 1, 시즌 s++        ; 시즌 엔딩 5칸 (칸 15~19)
 *   skin[+0x1f0] = n·100 / 15 (0xca7b5) · skin[+0x1f1] = s·20                    ; 진행도 두 줄
 * 칸 i (0x2ec88): i ≤ 19 이면 skin[+0x1dc + i], 아니면 0
 *   0  → 프레임 18(회색) + slt_frame 이미지 111 "?" 두 개 (x+10, y+7) · (x+20, y+7)
 *   ≠0 → 프레임 (i ∈ {8,9,14,18,19} → 20 · i ∈ {0,1,10,15} → 19 · 그 밖 17) (0x2ecfa~0x2ed3c)
 *        + 이름 StrMAINMENU[0xbd + i] = [189 + i] 검정 (x, y+7) · 흰 (x−1, y+6), 폭 41 (0x2ed6e~0x2edcc)
 * ```
 */
export const ENDING_CELL_NAMES = [
  '부상', '방출', '관중', '코치', '단장', '결번', '명예', '감독', '총장', '전설', // StrMAINMENU[189~198]
  '솔로', '연인', '양다리', '승리자', '정복자', // [199~203]
  '비인기', '지역구', '국내', '세계', '최강', // [204~208]
] as const
/** 칸 0~14 = 나리 엔딩(전역기록 +0xa8 + i) — 그 뒤 15~19 = 시즌 엔딩(+0xa0 + (i − 15)) */
export const NARI_ENDING_CELL_COUNT = 15
export const SEASON_ENDING_CELL_COUNT = 5

/** 얻은 엔딩 칸의 프레임 (0x2ecfa~0x2ed3c) */
export function endingCellFrameOf(index: number): number {
  if (index === 8 || index === 9 || index === 14 || index === 18 || index === 19) return 20
  if (index === 0 || index === 1 || index === 10 || index === 15) return 19
  return 17
}

/**
 * 진행도 두 줄 (0x2ee10~0x2ef68) — 칸 격자 뒤 y = y0 + 10 = 64 에서 줄마다 +20:
 * ```
 * 노란 네모 slt_frame 이미지 38 (x0 + 13, y + 0x92)
 * 모드 이름 img_text 표 0xced84 = [12 "나만의리그", 15 "시즌모드"] (x0 + 23, y + 0x91)
 * img_text 275 "진행도" (x0 + 23 + 모드폭 + 2, y + 0x91)
 * slt_frame 프레임 14 (67×18) (x0 − 67 + 184, y + 0x8d) · 값 "!C!cffffff%d%%"(0xcf940) 를 그 폭 가운데 (…, y + 0x91)
 * ```
 * 값은 skin[+0x1f0 + 줄](s8) — 나리 n·100/15 · 시즌 s·20.
 */
export const PROGRESS_ROW = {
  frame: 14,
  frameX: PANEL.x - 67 + 184,
  frameWidth: 67,
  bulletImage: 38,
  bulletX: PANEL.x + 13,
  modeFrames: [12, 15],
  modeLabelX: PANEL.x + 23,
  labelFrame: 275,
  /** "진행도" 는 모드 이름 오른쪽 끝에서 2px 뒤 (x0 + 모드폭 + 0x19) */
  labelGap: 2,
  /** 모드 이름·"진행도"·값 글의 y — y0 + 10 + 0x91 */
  firstY: PANEL.y + 10 + 0x91,
  step: 20,
  /** 노란 네모는 글보다 1 아래(+0x92), 프레임 14 는 4 위(+0x8d) */
  bulletDy: 1,
  frameDy: -4,
} as const

/** 진행도 값 — 나리 줄 = 얻은 칸 수 × 100 / 15 (0xca7b5, 버림) · 시즌 줄 = 얻은 칸 수 × 20 */
export const endingProgressOf = (row: number, gained: number) =>
  (row === 0 ? Math.trunc((gained * 100) / NARI_ENDING_CELL_COUNT) : gained * 20)

/** 스킬 설명 — 꼬리 탭 프레임 2 (91×15) + 설명 상자 0xbb28d(120, …, 173, 60) */
export const SKILL_DESCRIPTION = {
  tabFrame: 2,
  tabX: SCREEN_WIDTH / 2 - 86,
  tabY: 176,
  box: { centerX: 120, y: 190, width: 173, height: 60 },
  /**
   * 글 칸 — 상자(34~207) 안쪽에 3px 여백만 남기고 **폭을 150 → 168 로 넓혔다**.
   * 글꼴을 11px 로 올리니 150px 에서는 스킬 40개 중 5개가 상자(54px) 밖으로 흘러
   * 아래 쪽번호 줄을 덮었다. 폭을 넓혀 줄 수를 줄이면 40개 모두 52px 안에 들어온다
   * (브라우저에서 40개를 다 재서 확인했다). 원본 글 칸 좌표는 미해독이라 **근사다**.
   */
  text: { x: 37, y: 196, width: 168 },
} as const

/** 기록·통계 탭의 목록 격자 — `0x79ed5(…, 120, 90, 표, 줄높이 18, 1열, 8줄)` */
export const LIST_GRID = { x: PANEL.x + 8, firstY: PANEL.y + 36, step: 18, rows: 8, width: 176 } as const

/**
 * **탭 0 기록의 칸 이름** — 격자 종류 1 칸 그리기 0x7a916 이 칸 번호 n(= 쪽 × 8 + 줄)의 이름을 글 표 `[격자+0x90]` 의
 * `n + 8` 번(0x7a964~0x7a970)으로 찍는다 = StrGAME[8 + n]. 0~39 는 경기 기록(`RECORD_NAMES`), 40~47 은 아래 여덟
 * (StrGAME[48~55] — 끝 공백도 원본 글 그대로)이다.
 */
export const SPECIAL_RECORD_NAMES = [
  '시즌모드 리그 1위 1회', '시즌모드 리그 1위 5회', '시즌모드 리그 1위 10회', '미션모드 모두 성공',
  '기록달성 모두 성공 ', '스킬 모두 수집 ', '닉네임 모두 수집 ', '엔딩 모두 수집 ',
] as const
/** 달성 표시 칸이 시작하는 칸 번호 — 0x7a08c 의 `n > 0x27` 갈래 (`0x22db4(mgr, n − 0x28)`) */
export const SPECIAL_RECORD_FIRST_CELL = 0x28

/**
 * **달성 표시** — 0x7a08c(격자, x, y + 2, 칸너비, n) 의 종류 0·1 갈래(0x7a102~0x7a156, 직접 떴다):
 * ```
 * 0x22db4(mgr, n − 0x28) == 0 → 아무것도 안 그림
 * w = 0xba815([격자+0x94], 0x47, 0) 의 너비          ; slt_frame 이미지 71 (28×18)
 * 0xba759([격자+0x94], 0x47, 0, x + 칸너비 − w − 1, (y + 2) − 3, …)
 * ```
 * 곧 칸 오른쪽 끝에서 1px 안쪽에 오른쪽을 맞추고, 칸 위쪽보다 1px 위에 그린다.
 */
export const ACHIEVEMENT_MARK = { image: 71, width: 28, dx: -1, dy: -1 } as const

/**
 * **달성 횟수** — 같은 0x7a08c 의 `n ≤ 0x27` 갈래(0x7a0d0~0x7a0fc, 직접 떴다):
 * ```
 * sprintf(buf, "!R!cffff00%d", (u8)[[mgr+0xc8] + 4 + n])      ; 0xd4140
 * 0xba269(buf, x + 3, (y + 2) + 1, 칸너비 − 10, −1, 0)            ; 노랑 오른쪽 맞춤
 * ```
 * 달성 표시와 같은 기준(줄 위 = (y + 2) − 2)이라 글은 줄 위에서 3px 아래, 칸 왼쪽 3px 안에서 폭 − 10 칸 오른쪽에 붙는다.
 * 0 도 그대로 찍는다.
 */
export const RECORD_COUNT = { dx: 3, dy: 3, widthInset: 10 } as const
