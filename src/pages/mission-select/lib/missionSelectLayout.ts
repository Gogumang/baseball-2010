/**
 * 미션 선택 화면 배치 (장면 0x107 상태 1·2 그리기 0x1df08 — P6 2b 확정).
 *
 * ```
 * y0 = H/2 − 109 = 51
 * 창 = 공용 판 (24, 54, 192, 212)
 * 격자 = 0x79ed5([this+0x80], 5, 120, y0 + 28 = 79, 표, 칸 28, 5열, 3행) → 15칸
 * ```
 * 격자 만들기 인자의 `cy` 는 **중심이 아니라 첫 줄 위쪽 y** 다 (S9 확정 — P6 의 "중심" 표기는
 * 그때 인자 이름을 잘못 읽은 것). 왼쪽 x 는 `cx − (Σ칸너비 + (열−1)·가로틈)/2` 로 가운데를 맞춘다.
 */
const SCREEN_WIDTH = 240

export const PANEL = { x: 24, y: 54, width: 192, height: 212 } as const

/** 미션 이름 — 판 윗부분 밝은 제목 띠 위, 글색 #335FCD */
export const TITLE = { x: 24, y: 51 + 7, width: 192, color: '#335FCD' } as const

export const GRID = {
  columns: 5,
  rows: 3,
  cell: 28,
  /** 가로·세로 틈은 원본 인자에 안 나와 0 으로 둔다 */
  gap: 0,
  centerX: SCREEN_WIDTH / 2,
  top: 51 + 28,
} as const

export const GRID_LEFT = GRID.centerX - (GRID.columns * GRID.cell + (GRID.columns - 1) * GRID.gap) / 2

export function cellPositionOf(index: number) {
  const column = index % GRID.columns
  const row = Math.floor(index / GRID.columns)
  return {
    x: GRID_LEFT + column * (GRID.cell + GRID.gap),
    y: GRID.top + row * (GRID.cell + GRID.gap),
  }
}

/** 아래 틀 — slt_frame 프레임 1 (169×78: 꼬리 탭 + 점 5개 + 버튼 두 개) */
export const BOTTOM_FRAME = { frame: 1, x: 34, y: 175 } as const
/** 탭 글씨 — slt_frame 이미지 51 "MISSION" (45×8) */
export const TAB_LABEL = { image: 51, x: 101, y: 179 } as const
/** 설명 상자 0xbb28d(120, 193, 173, 65, 2) — 가운데 기준이라 왼쪽 x = 120 − 173/2 */
export const DESCRIPTION_BOX = { centerX: 120, y: 193, width: 173, height: 65 } as const
/** 설명 글 — 흰 글 (45, 197, 폭 150) */
export const DESCRIPTION_TEXT = { x: 45, y: 197, width: 150 } as const

/** 보상·성공 줄 (y0 + 190 = 241). img_text 88 "보상" · 258 "성공" */
export const REWARD_ROW = {
  y: 241,
  labelFrame: 88,
  valueWidth: 46,
  /** (W/2 − w/2 + 10) — w 는 판 폭 192 */
  labelX: SCREEN_WIDTH / 2 - 192 / 2 + 10,
} as const
export const SUCCESS_ROW = { labelFrame: 258 } as const

/** 미션이 하나도 없을 때 StrMAINMENU[57] */
export const NO_MISSION_TEXT = '미션이 존재하지 않습니다'
