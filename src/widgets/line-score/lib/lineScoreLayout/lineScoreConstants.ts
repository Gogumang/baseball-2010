export const LINE_SCORE_INNINGS = 9

/** 판 0x5461c 의 폭 · 높이 (41c50 `movs r3, #0x3b` · 41c5a `#0xd6`) */
export const LINE_SCORE_PANEL = { width: 0xd6, height: 0x3b } as const

/** 부르는 곳별 (x, y) — 0x4258c (W/2 − 106, 10) · 0x4fe9c 경기 끝 (W/2 − 106, H − 57 − 0xb) */
export const LINE_SCORE_AT = {
  autoRelay: { x: 14, y: 10 },
  gameEnd: { x: 14, y: 320 - 57 - 0xb },
} as const

/** 칠 색 — 0x1400748(r, g, b) */
export const LINE_SCORE_COLORS = {
  /** 0x5461c 바깥 칠 RGB(8, 0x1c, 0x4a) */
  panelOuter: '#081C4A',
  /** 0x5461c 테 · 점 · 안쪽 칠 RGB(0x33, 0x5f, 0xcd) */
  panelBlue: '#335FCD',
  /** 0x5461c 흰 칠 */
  panelWhite: '#FFFFFF',
  /** 41c7a 둥근 칠 RGB(0x12, 0x23, 0x52) */
  plate: '#122352',
  /** 41dba 칸 칠 RGB(0x1d, 0x35, 0x6e) */
  cell: '#1D356E',
} as const

/** game_ui **이미지**(프레임 아님 — [[+0x1018]+8]+8 의 배열) 번호 */
export const LINE_SCORE_IMAGES = {
  /** "R" (8×10) — 41ce4 `adds r3, #0x88` */
  runsHeader: 34,
  /** 노란 테 (22×20) — 420ae `adds r3, #0x84` */
  cursor: 33,
} as const

/** num 이미지 기준 — 이닝 번호 0x32(50~59) · 점수 0 (0~9). 둘 다 "1" 만 폭 4, 나머지 8 */
export const LINE_SCORE_NUMBER_BASE = { inning: 0x32, runs: 0 } as const

/** 이닝 칸 사이 (칸폭 0x10 + 1) */
export const CELL_STEP = 0x11

export const CELL = { width: 0x10, height: 0xe } as const
