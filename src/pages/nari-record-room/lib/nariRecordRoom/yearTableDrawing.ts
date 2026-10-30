/** 124 목록 칸 배치 · 깜빡 · 번호 · 숫자 찍기 0x6aff8 */
import type { YearCellNumber } from '@/pages/nari-record-room/lib/nariRecordRoom/yearColumns'
import type { YearRecordView } from '@/pages/nari-record-room/lib/nariRecordRoom/yearRecordView'

/**
 * **124 목록 칸 배치** (0x5c984 · 0x5658c · 0x56ebc · 0x5650c · 0x55d6c 직접 떴다). 칸 그림은 편집기 [+0x324] = 장면 +0xfc =
 * **ui/game_ui.pzx**(0x13fee, 팔레트 game_ui.mpl) 프레임, 화살은 [편집기+0xa8] = 장면 +0xf8 = **ui/slt_frame.pzx** 이미지
 * (0x14098~0x140ae 가 편집기 +0xa4 game_ui · +0xa8 slt_frame · +0xb0 team_logo · +0xb8 = 장면 +0xf0 **ui/num.pzx** 를 넣는다).
 * ```
 * 판 0x55e60(…, W/2 = 120, H/2 + 5, 210, 220)                      → (15, 55, 210, 220)
 * 머리 줄 y = H/2 − 0x66 = 58 · 첫 열 x = W/2 − 0x64 = 20
 * 고정 열 0x5658c: 머리 칸 0x5650c — 프레임 0x17(25×15)은 **크기만** 재고 그리지 않는다 · 글 img_text 391 을 (x, y − 2, 25, 15) 가운데(0x22)
 *   y += 15 + 10 → 83 · 줄마다 프레임 0x1b(25×15) (x, y) · 번호 0xba51c(x, y + 3, 25, 15, 틈 0, i + 1, num 0x1e + 숫자, 꼴 2 = 가로 가운데)
 *   · y += 15 + 3. 돌려준 폭 25 → 다음 x = 20 + 25 + 3 = 48
 * 넘기는 열: x0 = 48 + [+0x33e](0x5761c 가 15) = 63 · 보이는 폭 0x55d6c = Σ(36 + 3) × 4 = 156
 *   첫 열 ≠ 0 이면 slt_frame 20(◀ 5×8) (x0 − 깜빡 − 5, 62) · 첫 열 + 4 ≠ 열 수면 같은 그림 뒤집어(0x11) (x0 + 156 + 깜빡 − 5, 62)
 *   자르기 0xbae25(63, 58, 156, 221) · 열 i 는 x = 63 + (i − 첫 열)·39 + 밀림 (첫 열 − 1 부터 그린다)
 *   0x56ebc: 머리 0x5650c(프레임 0x22 36×15 크기만 · 글 0x56dd4) · 줄마다 프레임 0x23(36×15) (x, y) · 숫자 0x6aff8(x + 24, y + 3, …)
 * 위아래 화살: 목록 줄 수 > 1 이면 slt_frame 0x20(▲ 13×8) (114, 45 − 깜빡) · 0x21(▼) (114, 277 + 깜빡)
 *   깜빡 = [+0x40c] % 8 ≤ 4 ? 2 : 0 (5ca52~5ca6c)
 * 커서 0x56234: 0x5658c 가 커서 줄에서 [+0x3ec] = (x 20, y, 0xc1, 15) — 폭은 [+0x438] = 0 이라 193 + 0 + 3 = 196.
 *   [+0x40c] % 8 ≤ 3 이면 0x6aa65(x + 1, y + 1, 194, 13, 둥글기 1, 0x80ffff00 반투명 노랑) · 아니면 (x, y, 196, 15, 1, 노랑 0xffff00)
 * ```
 */
export const YEAR_TABLE_LAYOUT = {
  panel: { x: 15, y: 55, width: 210, height: 220 },
  headerY: 58,
  numberX: 20,
  numberWidth: 25,
  cellHeight: 15,
  firstRowY: 83,
  rowStep: 18,
  statX: 63,
  statWidth: 36,
  columnStep: 39,
  clip: { x: 63, y: 58, width: 156, height: 221 },
  /**
   * 머리 글 칸 — 0x5650c 가 0xb9d74(글, x, y − 2, 폭, 15, 0x22, …, dy [sp+0x14] = 2) 로 부르므로 칸은 결국 (x, y, 폭, 15) 다
   * (r89 — unicorn 으로 0x5cfec 를 돌려 글 그리기 vt+0x10 의 y = 61 을 받았다. 예전 56 은 dy 2 를 빠뜨렸다)
   */
  labelY: 58,
  upArrowY: 45,
  downArrowY: 277,
  arrowX: 114,
  sideArrowY: 62,
  cursorWidth: 196,
} as const

/** 0x5c984 의 화살 깜빡 [sp+0x40] — [+0x40c] % 8 ≤ 4 ? 2 : 0 */
export function yearArrowBlinkOf(view: YearRecordView): number {
  return view.keyPresses % 8 <= 4 ? 2 : 0
}

/** 0x56234 의 커서 꼴 — [+0x40c] % 8 ≤ 3 이면 안쪽 반투명, 아니면 바깥 불투명 */
export function yearCursorIsInsetOf(view: YearRecordView): boolean {
  return view.keyPresses % 8 <= 3
}

/** 숫자 그림 하나 — num.pzx 이미지 번호와 칸 왼쪽 기준 x */
export interface NumberGlyphPlacement {
  readonly frame: number
  readonly x: number
}

/** num.pzx 숫자 폭 — '1' 만 4, 그 밖 6 (이미지 20~29 · 30~39) */
const digitWidthOf = (digit: number) => (digit === 1 ? 4 : 6)

/**
 * 번호 열 0xba51c(x, y + 3, 25, 15, 틈 0, 값, 이미지 0x1e + 숫자, num, 꼴 2) — 숫자를 왼쪽부터 늘어놓고
 * 꼴 비트 1 이라 x += (25 − 합 폭) >> 1.
 */
export function yearNumberGlyphsOf(value: number): readonly NumberGlyphPlacement[] {
  const digits = [...String(Math.max(0, Math.trunc(value)))].map(Number)
  const total = digits.reduce((sum, digit) => sum + digitWidthOf(digit), 0)
  let x = (YEAR_TABLE_LAYOUT.numberWidth - total) >> 1
  return digits.map((digit) => {
    const placed = { frame: 0x1e + digit, x }
    x += digitWidthOf(digit)
    return placed
  })
}

/** 0x6aff8 이 찍는 것 — 숫자 그림(칸 왼쪽 기준)과 점(흰 1×2, 칸 왼쪽 기준 x · 칸 위 기준 y) */
export interface YearCellDrawing {
  readonly glyphs: readonly NumberGlyphPlacement[]
  readonly dots: readonly { readonly x: number; readonly y: number }[]
}

/** 0x56ebc 가 숫자를 찍는 자리 — 칸 x + 0x18 · y + 3 */
const CELL_DIGIT_X = 0x18
const CELL_DIGIT_Y = 3
/** 숫자 한 칸 걸음 — 이미지 20 폭 6 + 틈 1 */
const CELL_DIGIT_STEP = 7
/** 점 자리 — 숫자 높이 10 − 2 */
const CELL_DOT_DY = 8

/**
 * **숫자 찍기 0x6aff8**(직접 떴다, 0x6aff8~0x6b26a) — 0x56ebc 는 앵커 4 로 불러 x 를 고치지 않고 **오른쪽 자리부터 왼쪽으로** 찍는다.
 * 한 자리마다 이미지 0x14 + (v % (u·10)) / u 를 x 에 · x −= 이미지 20 폭 + 1 · u ×= 10.
 * - 자릿수 −1: v / u > 0 이거나 u == 1 인 동안.
 * - 소수점 갈래: v > 99999 → u = 1000 · 점 자리 3 / > 9999 → 100 · 2 / > 999 → 10 · 1 / 그 밖은 자릿수 0 이면 3 · 점 0,
 *   자릿수 3 이면 점 1. 셈 [sp+8] = 2 에서 한 자리마다 −1, 셈 == 점 자리인 자리를 찍은 뒤 흰 점 두 개를 (x − 3, y + 8 · y + 9)에
 *   찍고 x −= 3 을 더 한다 — ".315" · "1.00" · "3.51" 꼴.
 */
export function yearCellDrawingOf(cell: YearCellNumber): YearCellDrawing {
  const glyphs: NumberGlyphPlacement[] = []
  const dots: { x: number; y: number }[] = []
  const value = cell.value
  const start = cell.isDecimal ? decimalStartOf(value, cell.digits) : { unit: 1, digits: cell.digits, dotAt: 0 }
  const placeCount = start.digits === -1 ? significantPlaceCountOf(value, start.unit) : start.digits
  let x = CELL_DIGIT_X
  let unit = start.unit
  let countdown = cell.isDecimal ? 2 : 0
  for (let placed = 0; placed < placeCount; placed += 1) {
    const digit = Math.trunc((value % (unit * 10)) / unit)
    glyphs.push({ frame: 0x14 + digit, x })
    if (cell.isDecimal && countdown === start.dotAt) {
      dots.push({ x: x - 3, y: CELL_DIGIT_Y + CELL_DOT_DY })
      x -= 3
    }
    if (cell.isDecimal) countdown -= 1
    x -= CELL_DIGIT_STEP
    unit *= 10
  }
  return { glyphs, dots }
}

/** 소수점 갈래의 첫 자리 단위 · 자릿수 · 점 자리 — v > 99999 · > 9999 · > 999 · 자릿수 0 · 자릿수 3 */
function decimalStartOf(value: number, digits: number): { readonly unit: number; readonly digits: number; readonly dotAt: number } {
  if (value > 99999) return { unit: 1000, digits, dotAt: 3 }
  if (value > 9999) return { unit: 100, digits, dotAt: 2 }
  if (value > 999) return { unit: 10, digits, dotAt: 1 }
  if (digits === 0) return { unit: 1, digits: 3, dotAt: 0 }
  if (digits === 3) return { unit: 1, digits, dotAt: 1 }
  return { unit: 1, digits, dotAt: 0 }
}

/** 자릿수 −1 — v / u > 0 이거나 u == 1 인 동안 찍는다 (u 는 자리마다 ×10) */
function significantPlaceCountOf(value: number, firstUnit: number): number {
  let count = 0
  for (let unit = firstUnit; Math.trunc(value / unit) > 0 || unit === 1; unit *= 10) count += 1
  return count
}

/** 0x5650c · 0xb9d75 꼴 0x22 — (칸 x, 56, 폭, 15) 안 가운데: x += (폭 − w) >> 1 · y += 올림((15 − h) / 2) */
export function yearLabelOffsetOf(boxWidth: number, imageWidth: number, imageHeight: number): { readonly x: number; readonly y: number } {
  const dy = YEAR_TABLE_LAYOUT.cellHeight - imageHeight
  return { x: (boxWidth - imageWidth) >> 1, y: (dy >> 1) + (dy - (((dy + (dy < 0 ? 1 : 0)) >> 1) << 1)) }
}
