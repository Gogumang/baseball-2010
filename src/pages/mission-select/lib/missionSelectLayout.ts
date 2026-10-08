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

/**
 * 미션 고르기 격자 [this+0x70] 의 꼴 — 장면 진입 0x1d9a4 가 `new` → 0x6c219(vtable 0xd2ea0) 뒤
 * `vt+0x14(0, 0)` · `vt+0x1c(격자, 5열, 3줄, 숫자키 꼴 1, 꼴 0x330)`(0x1d9cc~0x1d9f6) 로 짓는다.
 * 0x330 = 0x10 · 0x20(두 축 다 감기) + 0x100 · 0x200(감기면 다른 축 한 칸) — **15칸을 칸 번호 순으로 감으며 넘긴다**
 * (→ 칸 4 → 5 · 칸 14 → 0, ↓ 칸 10 → 1 · 칸 14 → 0, ← 칸 0 → 14). 숫자키 꼴 1 이라 '2' '4' '6' '8' 은 ↑ ← → ↓, '5' 는 OK.
 * 칸 14 는 이벤트(다운로드) 미션 칸이다 — `EVENT_MISSION_CELL`.
 */
export const MISSION_GRID_SHAPE = {
  columns: GRID.columns, rows: GRID.rows,
  wrapsColumns: true, wrapsRows: true, carriesRowOnColumnWrap: true, carriesColumnOnRowWrap: true,
} as const

/** 이벤트 미션 칸 — 키 0x1daa4 의 0x1db06 `칸 == 14` */
export const EVENT_MISSION_CELL = 14

/**
 * 이벤트 미션 창 (0x741a1 높이 0x64 · 그리기 0x1dd58 — W 240 · H 320 기준 좌표).
 * 글 0x6ef4c 는 문자열 앞 `!C` 로 폭 안 가운데 맞춤이다.
 */
export const EVENT_MISSION_WINDOW = {
  height: 100,
  /** 0x741a0 의 [창+0x212] = 6 */
  openStartHeight: 6,
  /** StrMAINMENU[56] — (W/2 − 0x58, H/2 − 0x23, 폭 0xb0) */
  text: {
    raw: '!C!cFFFFFF어떤 메뉴를 실행하시!N겠습니까? [!cFFFF00미션다운!cFFFFFF] 시!N소량의 통화료가 부과됩니다',
    x: SCREEN_WIDTH / 2 - 0x58, y: 320 / 2 - 0x23, width: 0xb0,
  },
  /** 0xcd6f0 / 고름 0xcd718 — (W/2 − 0x50, H/2 + 0x14, 폭 0x50) */
  run: { raw: '!C!cFFFFFF미션실행', selectedRaw: '!C!cFFFF00미션실행', x: SCREEN_WIDTH / 2 - 0x50, y: 320 / 2 + 0x14, width: 0x50 },
  /** 0xcd704 / 고름 0xcd72c — (W/2, H/2 + 0x14, 폭 0x50) */
  download: { raw: '!C!cFFFFFF미션다운', selectedRaw: '!C!cFFFF00미션다운', x: SCREEN_WIDTH / 2, y: 320 / 2 + 0x14, width: 0x50 },
} as const

/**
 * 미션실행을 골랐는데 받은 이벤트 미션이 없을 때([미션+0xa4] == 0) — 하위 상태 3(0x1dc00)이
 * `0x74ef5(창, 0xcd6c8, 종류 1)` 알림을 띄우고 하위 4 → 0 으로 목록에 돌아온다. 웹은 받을 길(통신)이 없어 늘 이 글이다.
 */
export const EVENT_MISSION_EMPTY_TEXT = '!C!cffffff이벤트 미션을 다운로드하세요'
