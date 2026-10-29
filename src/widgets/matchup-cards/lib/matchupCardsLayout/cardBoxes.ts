/** 소개 판(0x44944)의 화면 · 밀림 거리 · 판 위치 · 투수 / 타자 판 상자 표 */
export interface CardBox {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export const box = (x: number, y: number, width: number, height: number): CardBox => ({ x, y, width, height })

/** 타석 화면 W × H (0x14008b8 · 0x14008c8) */
export const MATCHUP_SCREEN = { width: 240, height: 320 } as const

/** 밀림 폭·판 기준 폭 0x8c (0x4496e `movs r4,#0x8c`) */
export const SLIDE_DISTANCE = 0x8c

/** 판 위 = H − 0xe6 (투수, 0x44a6a) · H − 0x5f (타자, 0x45134) */
export const PITCHER_CARD_TOP = MATCHUP_SCREEN.height - 0xe6

export const BATTER_CARD_TOP = MATCHUP_SCREEN.height - 0x5f

/** game_ui 프레임 1 박스 0~11 — 투수 판 */
export const PITCHER_BOXES: readonly CardBox[] = [
  box(0, 0, 137, 62),
  box(7, 4, 37, 7),
  box(65, 6, 17, 13),
  box(84, 6, 49, 13),
  box(8, 25, 23, 12),
  box(8, 44, 22, 12),
  box(34, 43, 30, 13),
  box(75, 23, 26, 13),
  box(106, 24, 27, 13),
  box(75, 43, 56, 13),
  box(48, 24, 16, 13),
  box(36, 24, 11, 13),
]

/** game_ui 프레임 2 박스 0~11 — 타자 판 */
export const BATTER_BOXES: readonly CardBox[] = [
  box(0, 0, 137, 62),
  box(7, 4, 37, 7),
  box(65, 7, 17, 13),
  box(84, 6, 49, 13),
  box(8, 25, 23, 12),
  box(8, 44, 22, 12),
  box(34, 43, 30, 13),
  box(75, 23, 26, 13),
  box(106, 24, 27, 13),
  box(104, 43, 29, 13),
  box(78, 43, 22, 13),
  box(43, 24, 21, 13),
]
