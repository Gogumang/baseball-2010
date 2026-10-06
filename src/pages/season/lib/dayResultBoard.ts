import type { SeasonDayBoard } from '@/entities/season-mode/model/seasonRecord'
import { GLYPH_SPACING, glyphsWidthOf, numberGlyphsOf } from '@/shared/lib/pixelNumber/pixelNumber'

/**
 * 경기 뒤 마무리 판 — 장면 0x105 상태 **0xf1** 의 그림 **0xb400** (직접 떴다).
 *
 * 같은 날 리그의 다른 네 경기 결과를 SR+0x1c0 표(`SeasonDayBoard`, 0xc2a48 이 복사)에서 줄마다 그린다.
 * 배치는 mode_ui **프레임 69**(`[[this+0xc8]+0xc]` 의 프레임 목록 +0x114) 박스 그대로이고, 줄마다 박스 0 의 높이(56)만큼 내려간다.
 * ```
 * 줄 r = 0..3, dy = r × 56 (박스 0 높이):                                ; b44e~b578
 *   박스 0 ← 0xba0bd 둥글기 1 검정 · (+1,+1,−2,−2) 0xba0bd 둥글기 1 흰색
 *            · (+1,+1,−1,−1) 0xb9f75 #335FCD                              ; 왼·위에만 흰 테가 남는다
 *   박스 1·2 ← 0x860dc 로고 칸 (아래 `LOGO_PANEL_*`)
 *   프레임 69 를 (0, dy) 에 (vtable+0x10) — "VS" 와 점수 칸 바탕 그림
 * 경기 k (skip = 0):                                                      ; b5a0~b778
 *   k < 4 동안: scoreA[k] == −1 이면 skip = 1 (한 번 서면 계속) → 줄 k 에 경기 k + skip 을 그린다
 *   박스 1 ← 0x66431 로고 A (박스 x + 2, y + 2) · 박스 2 ← 로고 B
 *   박스 3 ← scoreA > scoreB ? 그림 56 "WIN" : 그림 57 "LOSE"   (가운데 0x22, mode_ui 그림 목록)
 *   박스 4 ← scoreA < scoreB ? WIN : LOSE                         ⚠️ 동점이면 둘 다 LOSE (원본 그대로)
 *   박스 5 ← 0xba719 scoreA (기준 20 = num 주황 숫자, 가운데 0x22) · 박스 6 ← scoreB
 * 끝: 0x7f4ec 머리띠
 * ```
 * - **skip 은 줄 k 의 scoreA 만 본다**(경기 k + skip 이 아니라). 내 경기 줄은 하루 한 줄뿐이라 결과는 늘 "내 경기를 뺀 넷" 이다.
 */
export interface BoardBox {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

const box = (x: number, y: number, width: number, height: number): BoardBox => ({ x, y, width, height })

/** mode_ui 프레임 69 박스 0~6 (`public/sprites/mode_ui/frames/boxes.json` 의 "069") */
export const BOARD_FRAME = {
  folder: './sprites/mode_ui/frames',
  frame: 69,
  /** 박스 0 — 한 줄 판 (높이 56 이 줄 간격) */
  row: box(24, 49, 193, 56),
  logoA: box(30, 57, 39, 38),
  logoB: box(171, 57, 39, 38),
  resultA: box(70, 69, 29, 9),
  resultB: box(142, 69, 29, 9),
  scoreA: box(71, 80, 25, 15),
  scoreB: box(144, 80, 25, 15),
} as const

/** 줄 수 — `[sp+0x30] = 3` 에서 0 까지 (b43e·b574) */
export const BOARD_ROW_COUNT = 4
/** 한 줄 간격 = 박스 0 높이 (b434 `ldrsh [box, #6]`) */
export const BOARD_ROW_STEP = BOARD_FRAME.row.height

/** 줄 판 색 — 0x1400748(r, g, b) 차례 */
export const ROW_PANEL = {
  border: '#000000',
  highlight: '#FFFFFF',
  fill: '#335FCD',
} as const

/**
 * 로고 칸 0x860dc(ui, 박스) — 직접 떴다:
 * ```
 * (x, y, w−1, h−1)          0xba0bd 둥글기 1 검정
 * (x+1, y+1, w−2, h−2)      0xb9f75 #2033AA
 * (x+2, y+2, w−3, h')       0xb9f75 #3045CD     ; h' = (h−2) − trunc((h−2)/2) — 위 절반 밝은 띠
 * ```
 */
export const LOGO_PANEL = {
  border: '#000000',
  fill: '#2033AA',
  shine: '#3045CD',
} as const

export interface PanelRect extends BoardBox {
  readonly color: string
  /** 0xba0bd 의 둥글기 (0 이면 0xb9f75 네모 칠) */
  readonly round: number
}

/** 줄 판 세 겹 (박스 0) */
export function rowPanelRectsOf(row: BoardBox): readonly PanelRect[] {
  const inner = box(row.x + 1, row.y + 1, row.width - 2, row.height - 2)
  return [
    { ...row, color: ROW_PANEL.border, round: 1 },
    { ...inner, color: ROW_PANEL.highlight, round: 1 },
    { ...box(inner.x + 1, inner.y + 1, inner.width - 1, inner.height - 1), color: ROW_PANEL.fill, round: 0 },
  ]
}

/** 로고 칸 세 겹 (0x860dc) */
export function logoPanelRectsOf(cell: BoardBox): readonly PanelRect[] {
  const innerHeight = cell.height - 2
  return [
    { ...box(cell.x, cell.y, cell.width - 1, cell.height - 1), color: LOGO_PANEL.border, round: 1 },
    { ...box(cell.x + 1, cell.y + 1, cell.width - 2, innerHeight), color: LOGO_PANEL.fill, round: 0 },
    {
      ...box(cell.x + 2, cell.y + 2, cell.width - 3, innerHeight - Math.trunc(innerHeight / 2)),
      color: LOGO_PANEL.shine,
      round: 0,
    },
  ]
}

/** 로고 안쪽 여백 — 0x66431 인자 (박스 x + 2, 박스 y + 2) */
export const LOGO_INSET = 2

/** WIN · LOSE — mode_ui **그림** 56 · 57 (`[[this+0xc8]+8]+8` 목록, 0x38·0x39) */
export const RESULT_IMAGE = {
  folder: './sprites/mode_ui',
  win: { image: 56, width: 19, height: 9 },
  lose: { image: 57, width: 29, height: 9 },
} as const

/** 한 줄에 그릴 경기 */
export interface BoardRow {
  readonly teamA: number
  readonly teamB: number
  readonly scoreA: number
  readonly scoreB: number
}

/** b5a0~b5d6 그대로 — 내 경기 줄(scoreA == −1)을 건너뛴 네 줄 */
export function boardRowsOf(board: SeasonDayBoard): readonly BoardRow[] {
  const rows: BoardRow[] = []
  let skip = 0
  for (let row = 0; row < BOARD_ROW_COUNT; row += 1) {
    if (board.scoresA[row] === -1) skip = 1
    const game = row + skip
    rows.push({
      teamA: board.teamsA[game] ?? 0,
      teamB: board.teamsB[game] ?? 0,
      scoreA: board.scoresA[game] ?? 0,
      scoreB: board.scoresB[game] ?? 0,
    })
  }
  return rows
}

/** 박스 3 (A 쪽) — scoreA > scoreB 면 WIN (b676) */
export const isWinA = (row: BoardRow) => row.scoreA > row.scoreB
/** 박스 4 (B 쪽) — scoreA < scoreB 면 WIN (b6c4). 동점이면 둘 다 LOSE */
export const isWinB = (row: BoardRow) => row.scoreA < row.scoreB

/** 박스를 줄 r 만큼 내린다 */
export function shifted(cell: BoardBox, row: number): BoardBox {
  return { ...cell, y: cell.y + row * BOARD_ROW_STEP }
}

/**
 * 그림 가운데(0xb9d35 → 0xb9c5c, 정렬 0x22) — `nationalCupLayout.imageCenterOf` 와 같은 식이다:
 * 가로 d = 박스폭 − 그림폭 → `x + trunc(d/2) + d % 2`, 세로 `y + trunc((박스높이 − 그림높이)/2)`.
 */
export function imageCenterOf(cell: BoardBox, width: number, height: number): { readonly x: number; readonly y: number } {
  const dx = cell.width - width
  return { x: cell.x + Math.trunc(dx / 2) + (dx % 2), y: cell.y + Math.trunc((cell.height - height) / 2) }
}

/**
 * 점수 숫자 (0xba719, 기준 20 = num 주황 숫자) 를 박스 가운데에 — `SpriteNumber` 에 넘길 오른쪽 끝.
 * ⚠️ 0xba719 의 가운데 맞춤 반올림은 안 읽었다 — 글자 폭(마지막 간격 뺌)을 박스 안에서 내림으로 가운데 둔다(**근사**).
 */
export function scoreRightOf(cell: BoardBox, score: number): number {
  const glyphs = numberGlyphsOf(score)
  const advance = glyphsWidthOf(glyphs)
  const left = cell.x + Math.trunc((cell.width - (advance - GLYPH_SPACING)) / 2)
  return left + advance
}
