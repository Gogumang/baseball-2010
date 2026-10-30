/** 팀경기 0x21 운동장 그림(0x4258c 머리 425bc~42812)의 자리 · 프레임 — `ui/TeamRelayFigures` */

/** 화면 240×320 */
const SCREEN_WIDTH = 240
const SCREEN_HEIGHT = 320

/** 기준점 — 425d8 r6 = W >> 1 · 425f2 r7 = (H >> 1) + 0x1e */
export const RELAY_FIGURES_CENTER = { x: SCREEN_WIDTH >> 1, y: (SCREEN_HEIGHT >> 1) + 0x1e } as const

/** 주자 자리 표 0xd0028 — 1루 (+87, −10) · 2루 (0, −80) · 3루 (−87, −10) */
export const RELAY_BASE_OFFSETS = [
  { x: 87, y: -10 },
  { x: 0, y: -80 },
  { x: -87, y: -10 },
] as const

/** 주자 프레임 — 0x79d10(…, 프레임 0) = defender 000 (앞보고 서기) */
export const RUNNER_FRAME = 0
/** 투수 프레임 — 0x79b48(…, 프레임 0): 보통 · 타자 마선수 그림은 +17, 투수 마선수 그림(a ≠ 0)은 날값 */
export const PITCHER_FRAME = 0
/** 포수 프레임 — 0x79b48(…, b, 0x49) → +17 = 90 (마스크 쓴 포수) */
export const CATCHER_FRAME = 0x49
/** 포수 자리 — (W/2, 기준 y + 0x55) */
export const CATCHER_DY = 0x55
/** 타자 — 좌타면 (W/2 + 0x16, 기준 y + 0x47) 에 프레임 7, 우타면 (W/2 − 0x16, …) 에 프레임 10 (0x79d10, 날값) */
export const BATTER_DX = 0x16
export const BATTER_DY = 0x47
export const BATTER_LEFT_FRAME = 7
export const BATTER_RIGHT_FRAME = 0xa
