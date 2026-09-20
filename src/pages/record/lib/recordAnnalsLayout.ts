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
 * 탭 이름·커서의 x 는 탭 막대 프레임의 **박스**가 정한다 (0x94a65).
 * 박스 값은 아직 못 뽑아 막대를 다섯 칸으로 고르게 나눠 쓴다 (배치 근사).
 */
export const TAB_SLOT_WIDTH = TAB_BAR.width / TAB_COUNT
export const tabSlotXOf = (tab: number) => TAB_BAR.x + TAB_SLOT_WIDTH * tab

/** 탭 커서 프레임 9 (72×17) — 고른 탭 박스 x, y = y0 + 박스y − 2 */
export const TAB_CURSOR = { frame: 9, width: 72, height: 17, y: TAB_BAR.y + 1 } as const

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

/** 위·아래 스크롤 표시 — 프레임 24 ▲ (42×11) · 23 ▼ */
export const SCROLL_MARKS = {
  up: { frame: 24, y: PANEL.y + 20 },
  down: { frame: 23, y: PANEL.y + 116 },
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

/** 진행도 줄 — 프레임 14 (67×18) 을 오른쪽 끝, img_text 275 "진행도" */
export const PROGRESS_ROW = {
  frame: 14,
  frameX: PANEL.x - 67 + 184,
  bulletX: SCREEN_WIDTH / 2 - 83,
  labelFrame: 275,
  labelX: SCREEN_WIDTH / 2 - 73,
  y: 208,
} as const

/** 스킬 설명 — 꼬리 탭 프레임 2 (91×15) + 설명 상자 0xbb28d(120, …, 173, 60) */
export const SKILL_DESCRIPTION = {
  tabFrame: 2,
  tabX: SCREEN_WIDTH / 2 - 86,
  tabY: 176,
  box: { centerX: 120, y: 190, width: 173, height: 60 },
  text: { x: 45, y: 196, width: 150 },
} as const

/** 기록·통계 탭의 목록 격자 — `0x79ed5(…, 120, 90, 표, 줄높이 18, 1열, 8줄)` */
export const LIST_GRID = { x: PANEL.x + 8, firstY: PANEL.y + 36, step: 18, rows: 8, width: 176 } as const
