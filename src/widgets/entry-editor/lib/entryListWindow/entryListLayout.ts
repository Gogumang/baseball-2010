export const ENTRY_LIST_LAYOUT = {
  panel: { x: 15, y: 55, width: 210, height: 220, topBand: 0x12 },
  /** W/2 − 100 · H/2 − 102 */
  originX: 20,
  headerY: 58,
  /** 머리 아래 y += 15 + 10 */
  firstRowY: 83,
  rowStep: 18,
  cellHeight: 15,
  /** ▲▼ slt_frame 이미지 0x20 · 0x21 (13×8) */
  arrowX: 114,
  upArrowY: 45,
  downArrowY: 277,
  upArrowImage: 0x20,
  downArrowImage: 0x21,
  /** 옆 화살 slt_frame 20 (5×8) — y + 4 */
  sideArrowY: 62,
  sideArrowImage: 20,
  sideArrowWidth: 5,
  /** 0xbae25 자르기 높이 */
  clipHeight: 221,
} as const

/** ▲▼ · 옆 화살 깜빡 — [ed+0x40c] % 8 ≤ 4 ? 2 : 0 (5ca52~5ca6c) */
export const entryArrowBlinkOf = (keyPresses: number) => (((keyPresses % 8) + 8) % 8 <= 4 ? 2 : 0)

/** 커서 꼴 — [ed+0x40c] % 8 ≤ 3 이면 안쪽 반투명 (0x56316~0x56332) */
export const entryCursorIsInsetOf = (keyPresses: number) => ((keyPresses % 8) + 8) % 8 <= 3

/** 줄 y — 윗줄 기준 */
export const entryRowYOf = (rowIndex: number, top: number) => ENTRY_LIST_LAYOUT.firstRowY + (rowIndex - top) * ENTRY_LIST_LAYOUT.rowStep

/** 첫 넘기는 열(수비 · 보직 딱지)의 폭 — 커서 둘째 칸 +0x3f8. 그 열은 처음 그림(첫 열 0)에 늘 그려져 칸이 남는다 */
export const ENTRY_BADGE_WIDTH = 36
