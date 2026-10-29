/** 그림 숫자 — 상자 숫자 · 자리 채운 숫자(0x585ac) · 방어율 · 타율 */
import { BATTER_BOXES, type CardBox, PITCHER_BOXES } from '@/widgets/matchup-cards/lib/matchupCardsLayout/cardBoxes'
import { CARD_COLORS, NUMBER_BASE, NUM_IMAGE_HEIGHT, numImageWidthOf } from '@/widgets/matchup-cards/lib/matchupCardsLayout/cardFrames'
import { type Placed, halfUp } from '@/widgets/matchup-cards/lib/matchupCardsLayout/cardPlacement'
import { type FillRect, fill } from '@/widgets/matchup-cards/lib/matchupCardsLayout/cardRects'

export interface NumberGlyph {
  readonly image: number
  readonly x: number
  readonly y: number
}

const digitsOf = (value: number) => [...String(Math.max(0, Math.trunc(value)))].map(Number)

/**
 * 박스 안 숫자 — `0xba6b8(배치, 박스, 자간, 값, 기준, 글꼴, 정렬, ox, oy)` → `0xba51c` (직접 떴다).
 * 폭 = Σ(글자 폭 + 자간) (마지막 글자 뒤 자간까지), 정렬 0x4 → x += 박스폭 − 폭 · 0x2 → x += (박스폭 − 폭) >> 1 ·
 * 0x20 → y += 세로 가운데(박스높이 − 가장 큰 높이) · 0x40 → 아래. 글자마다 가장 큰 높이에 아래를 맞춘다.
 */
export function boxNumberGlyphsOf(value: number, cardBox: CardBox, origin: Placed, base: number, spacing: number, align: number): NumberGlyph[] {
  const digits = digitsOf(value)
  const total = digits.reduce((sum, digit) => sum + numImageWidthOf(base + digit) + spacing, 0)
  let x = cardBox.x + origin.x
  let y = cardBox.y + origin.y
  if ((align & 0x4) !== 0) x += cardBox.width - total
  if ((align & 0x20) !== 0) y += halfUp(cardBox.height - NUM_IMAGE_HEIGHT)
  if ((align & 0x40) !== 0) y += cardBox.height - NUM_IMAGE_HEIGHT
  if ((align & 0x2) !== 0) x += (cardBox.width - total) >> 1
  return digits.map((digit) => {
    const placed = { image: base + digit, x, y }
    x += numImageWidthOf(base + digit) + spacing
    return placed
  })
}

/**
 * 자리를 채우는 숫자 — `0x585ac(스킨, 글꼴, 기준, 값, x, y, 간격, 자리, 정렬)` (직접 떴다, 0x585ac~0x5873a).
 * 폭은 **셋째 글자부터만** 간격을 더해 센다(0x58620). 정렬 0x1 이면 폭 0 · 0x2 면 폭/2 · 그 밖은 폭 그대로 x 에서 뺀다.
 * 0x40 → y −= 높이 · 0x20 → y −= trunc(높이/2) (높이 = 그림[기준] 높이). 자리가 모자라면 정렬 0x4 일 때 모자란 만큼
 * (그림[기준] 폭 + 간격)씩 더 왼쪽으로 가서 그림[기준]("0")을 먼저 찍는다. 글자마다 폭 + 간격씩 나아간다.
 */
export function paddedNumberGlyphsOf(value: number, x: number, y: number, base: number, gap: number, places: number, align: number): NumberGlyph[] {
  const digits = digitsOf(value)
  const measured = digits.reduce((sum, digit, index) => sum + numImageWidthOf(base + digit) + (index > 1 ? gap : 0), 0)
  const top = paddedTopOf(y, align)
  const missing = places > 0 ? Math.max(0, places - digits.length) : 0
  const padWidth = numImageWidthOf(base) + gap
  let left = x - alignShiftOf(measured, align) - ((align & 0x4) !== 0 ? missing * padWidth : 0)
  const glyphs: NumberGlyph[] = []
  for (let index = 0; index < missing; index += 1) {
    glyphs.push({ image: base, x: left, y: top })
    left += padWidth
  }
  for (const digit of digits) {
    glyphs.push({ image: base + digit, x: left, y: top })
    left += numImageWidthOf(base + digit) + gap
  }
  return glyphs
}

/** 정렬 0x1 이면 폭 0 · 0x2 면 폭/2 · 그 밖은 폭 그대로 x 에서 뺀다 */
function alignShiftOf(measured: number, align: number): number {
  if ((align & 0x1) !== 0) return 0
  return (align & 0x2) !== 0 ? measured >> 1 : measured
}

/** 0x40 → y −= 높이 · 0x20 → y −= trunc(높이/2) */
function paddedTopOf(y: number, align: number): number {
  let top = y
  if ((align & 0x40) !== 0) top = y - NUM_IMAGE_HEIGHT
  if ((align & 0x20) !== 0) top -= Math.trunc(NUM_IMAGE_HEIGHT / 2)
  return top
}

/**
 * 방어율 — `v = 0xb6ce8(투수)` (자책 +0x22 × 2700 / 아웃 +0x20, 9999 상한 = 방어율 × 100).
 * 박스 11 ← trunc(v/100) · 박스 10 ← v % 10 (오른끝) · 그 왼쪽 1px 띄워 trunc(v/10) % 10 — 모두 자간 0 · 정렬 0x24.
 * 점 = 흰 1×2 를 (박스 11 오른끝 + 1, 박스 11 아래 − 3) 에 (0x6a9f0).
 */
export function earnedRunAverageGlyphsOf(value: number, origin: Placed): { glyphs: NumberGlyph[]; point: FillRect } {
  const hundredths = value % 10
  const tenths = Math.trunc(value / 10) % 10
  const intBox = PITCHER_BOXES[11]
  const decimalBox = PITCHER_BOXES[10]
  const tenthsOrigin = { x: origin.x - numImageWidthOf(NUMBER_BASE.stat + hundredths) - 1, y: origin.y }
  return {
    glyphs: [
      ...boxNumberGlyphsOf(Math.trunc(value / 100), intBox, origin, NUMBER_BASE.stat, 0, 0x24),
      ...boxNumberGlyphsOf(hundredths, decimalBox, origin, NUMBER_BASE.stat, 0, 0x24),
      ...boxNumberGlyphsOf(tenths, decimalBox, tenthsOrigin, NUMBER_BASE.stat, 0, 0x24),
    ],
    point: fill(origin.x + intBox.x + intBox.width + 1, origin.y + intBox.y + intBox.height - 3, 1, 2, CARD_COLORS.point),
  }
}

/**
 * 타율 — `v = 0xb8e3c(타자)` (안타 +0x22 × 1000 / 타수 +0x20, 1000 상한).
 * v ≤ 999 (0x453a2 `cmp #0x3e7`): `0x585ac(…, 기준 20, v, x = 박스11 오른끝, y = 박스11 위 + trunc(높이/2) + 1, 간격 1, 자리 3, 정렬 0x24)`.
 * v = 1000: 0xba6b8(박스 11, 자간 1, 정렬 0x24) 네 번 — 1 을 ox − 0x17 · 0 을 ox · ox − 7 · ox − 0xe 에 (0x4544c~0x454cc).
 * 점 = 흰 1×2 를 (박스 11 왼끝 − 2, 아래 − 3) 에.
 */
export function battingAverageGlyphsOf(value: number, origin: Placed): { glyphs: NumberGlyph[]; point: FillRect } {
  const avgBox = BATTER_BOXES[11]
  const point = fill(origin.x + avgBox.x - 2, origin.y + avgBox.y + avgBox.height - 3, 1, 2, CARD_COLORS.point)
  if (value <= 999) {
    const x = origin.x + avgBox.x + avgBox.width
    const y = origin.y + avgBox.y + Math.trunc(avgBox.height / 2) + 1
    return { glyphs: paddedNumberGlyphsOf(value, x, y, NUMBER_BASE.stat, 1, 3, 0x24), point }
  }
  const at = (dx: number) => ({ x: origin.x + dx, y: origin.y })
  return {
    glyphs: [
      ...boxNumberGlyphsOf(1, avgBox, at(-0x17), NUMBER_BASE.stat, 1, 0x24),
      ...boxNumberGlyphsOf(0, avgBox, at(0), NUMBER_BASE.stat, 1, 0x24),
      ...boxNumberGlyphsOf(0, avgBox, at(-7), NUMBER_BASE.stat, 1, 0x24),
      ...boxNumberGlyphsOf(0, avgBox, at(-0xe), NUMBER_BASE.stat, 1, 0x24),
    ],
    point,
  }
}
