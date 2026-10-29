import { boxNumberGlyphsOf, numImageWidthOf } from '@/widgets/matchup-cards/lib/matchupCardsLayout'
import type { CardBox } from '@/widgets/matchup-cards/lib/matchupCardsLayout'
import { YEAR_GOAL_DIGIT_BASE, YEAR_GOAL_DOT_FRAME } from './goalWindowSpec'
import type { YearGoalNumberPiece, YearGoalTextPiece } from './goalWindowSpec'

/** img_text 프레임 크기 (PNG 를 읽어 적었다 — 높이는 모두 10) */
const TEXT_WIDTH: Readonly<Record<number, number>> = {
  47: 20,
  330: 21,
  359: 41,
  84: 20,
  331: 22,
  358: 56,
  87: 22,
  148: 21,
  318: 21,
  58: 21,
  180: 20,
  319: 21,
  327: 30,
  316: 20,
  328: 20,
  124: 10,
  317: 21,
  407: 39,
}
const TEXT_HEIGHT = 10

const DOT_SIZE = { width: 1, height: 2 }
const NUMBER_SPACING = 1
const NUMBER_ALIGN = 0x24
const NUMBER_OX = -4
/** 소수점 oy — 0x8633c · 0x86248 이 0xb9d35 에 넘기는 5 */
const DOT_OY = 5

/** 승률 숫자 ox · "%" (num 106, 6×8) 자리 — 0x86788~0x867e6 · 0x86ade~0x86b24 */
const WIN_RATE_OX = -10
export const YEAR_GOAL_PERCENT_FRAME = 106
const PERCENT_SIZE = { width: 6, height: 8 }
const PERCENT_OFFSET = { x: -2, y: 1 }

const halfUp = (difference: number) => (difference >> 1) + (difference % 2)

/** img_text 0xb9e05 → 0xb9d74: 0x2 → x += (w − W) >> 1 · 0x4 → x += w − W · 0x20 → y += 올림((h − H)/2) */
export function textPieceOf(frame: number, area: CardBox, align: number, palette: 0 | 3): YearGoalTextPiece {
  const width = TEXT_WIDTH[frame] ?? 0
  let x = area.x
  let y = area.y
  if ((align & 0x2) !== 0) x += (area.width - width) >> 1
  if ((align & 0x4) !== 0) x += area.width - width
  if ((align & 0x20) !== 0) y += halfUp(area.height - TEXT_HEIGHT)
  return { frame, x, y, palette }
}

/** 0xba719 — 자간 1 · 주황 · 정렬 0x24 · ox (기본 −4) */
export function numberPiecesOf(value: number, area: CardBox, ox = NUMBER_OX): YearGoalNumberPiece[] {
  return boxNumberGlyphsOf(value, area, { x: ox, y: 0 }, YEAR_GOAL_DIGIT_BASE, NUMBER_SPACING, NUMBER_ALIGN).map((glyph) => ({
    frame: glyph.image,
    x: glyph.x,
    y: glyph.y,
  }))
}

/** num 한 장 0xb9d35(그림, 박스, 정렬 0x24, ox, oy) → 0xb9c5c: x += w − W · y += trunc((h − H)/2) */
function imagePieceOf(
  frame: number,
  size: { readonly width: number; readonly height: number },
  area: CardBox,
  ox: number,
  oy: number,
): YearGoalNumberPiece {
  return {
    frame,
    x: area.x + ox + area.width - size.width,
    y: area.y + oy + Math.trunc((area.height - size.height) / 2),
  }
}

/** 소수점 0xb9d35(num 103, 박스, 정렬 0x24, ox, oy 5) */
function dotPieceOf(area: CardBox, ox: number): YearGoalNumberPiece {
  return imagePieceOf(YEAR_GOAL_DOT_FRAME, DOT_SIZE, area, ox, DOT_OY)
}

/** 승률 — 숫자를 ox −10 에, "%"(num 106)를 ox −2 · oy 1 에 */
export function winRateGlyphsOf(value: number, area: CardBox): YearGoalNumberPiece[] {
  return [...numberPiecesOf(value, area, WIN_RATE_OX), imagePieceOf(YEAR_GOAL_PERCENT_FRAME, PERCENT_SIZE, area, PERCENT_OFFSET.x, PERCENT_OFFSET.y)]
}

/** 한 자리 칸 = num 기준(0) 그림 폭 + 1 — 0x8633c · 0x86248 이 `[num+0x50]`(프레임 20)의 폭으로 잰다 */
const DIGIT_STEP = numImageWidthOf(YEAR_GOAL_DIGIT_BASE) + 1

/** 0x6c804(v, 10) — 몫이 0 이 될 때까지 10 으로 나눈 횟수 (0 → 0) */
function extraDigitsOf(value: number): number {
  let count = 0
  for (let rest = Math.trunc(value / 10); rest !== 0; rest = Math.trunc(rest / 10)) count += 1
  return count
}

/**
 * 타율 0x8633c(w, 값 ×1000, 박스, ox) — 오른쪽부터 찍는다:
 * ```
 *   s = 폭(num 20) + 1 ; f = 값 % 1000 ; n = 0x6c804(f, 10) + 1
 *   f 를 ox 에 · k = 0 .. 3 − n − 1: "0" 을 ox − s·n − s·k 에          ; 세 자리로 채운다
 *   소수점을 ox − 3s − 1 에 (oy 5) · 값 / 1000 을 ox − 3s − 2 에
 * ```
 * 칸 간격을 "0" 폭으로 재므로 "1"(폭 4)이 끼면 틈이 생긴다 — 원본 그대로.
 */
export function averageGlyphsOf(value: number, area: CardBox, ox = NUMBER_OX): YearGoalNumberPiece[] {
  const fraction = value % 1000
  const digits = extraDigitsOf(fraction) + 1
  const pieces = numberPiecesOf(fraction, area, ox)
  for (let k = 0; k < 3 - digits; k += 1) pieces.push(...numberPiecesOf(0, area, ox - DIGIT_STEP * digits - DIGIT_STEP * k))
  pieces.push(dotPieceOf(area, ox - 3 * DIGIT_STEP - 1))
  pieces.push(...numberPiecesOf(Math.trunc(value / 1000), area, ox - 3 * DIGIT_STEP - 2))
  return pieces
}

/**
 * 방어율 0x86248(w, 값 ×100, 박스, ox):
 * ```
 *   s = 폭(num 20) + 1 ; 0x6c804(값, 10) 는 부르고 버린다
 *   값 % 100 을 ox 에 · 그것이 ≤ 9 면 "0" 을 ox − s 에
 *   소수점을 ox − 2s − 1 에 (oy 5) · 값 / 100 을 ox − 2s − 2 에
 * ```
 */
export function earnedRunAverageGlyphsOf(value: number, area: CardBox, ox = NUMBER_OX): YearGoalNumberPiece[] {
  const fraction = value % 100
  const pieces = numberPiecesOf(fraction, area, ox)
  if (fraction <= 9) pieces.push(...numberPiecesOf(0, area, ox - DIGIT_STEP))
  pieces.push(dotPieceOf(area, ox - 2 * DIGIT_STEP - 1))
  pieces.push(...numberPiecesOf(Math.trunc(value / 100), area, ox - 2 * DIGIT_STEP - 2))
  return pieces
}

/** img_text 한 장을 박스에 정렬해 놓는다 (0xb9e05 — ox 는 [sp+8]) — 다른 이벤트 창도 쓴다 */
export function placedTextOf(frame: number, area: CardBox, align: number, palette: 0 | 3, ox = 0): YearGoalTextPiece {
  const piece = textPieceOf(frame, area, align, palette)
  return { ...piece, x: piece.x + ox }
}

/** 0xba719 — 자간 1 · 주황(기준 0x14) · 정렬 0x24 · ox — 다른 이벤트 창도 쓴다 */
export function placedNumberOf(value: number, area: CardBox, ox: number): YearGoalNumberPiece[] {
  return numberPiecesOf(value, area, ox)
}
