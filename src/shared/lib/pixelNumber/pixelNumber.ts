/**
 * num.pzx 숫자 글자 배치 (원본 0x63118 계열).
 * 숫자는 1 만 폭 4px 이고 나머지는 6px 이며, 한 글자 전진 = 폭 + 1 이다.
 */
export interface Glyph {
  /** num 그림 번호 */
  readonly frame: number
  readonly width: number
  /** 이 글자 다음 추가 간격 (기본 GLYPH_SPACING) */
  readonly spacing?: number
}

export const GLYPH_SPACING = 1
export const DIGIT_BASE_FRAME = 20
const NARROW_DIGIT_WIDTH = 4
const DIGIT_WIDTH = 6
/** num 그림 — "/" 127 · "%" 106 · "+" 105 · "−" 128 · "억" 104 */
export const SLASH_FRAME = 127
export const PERCENT_FRAME = 106

export function numberGlyphsOf(value: number, baseFrame = DIGIT_BASE_FRAME): Glyph[] {
  return [...String(Math.max(0, Math.trunc(value)))].map((digit) => ({
    frame: baseFrame + Number(digit),
    width: digit === '1' ? NARROW_DIGIT_WIDTH : DIGIT_WIDTH,
  }))
}

/**
 * 하늘색 숫자 글자꼴 (num 90번대) — 순위처럼 작은 숫자에 쓴다.
 * 기본 주황 숫자(20번대, 10px)와 달리 8×8 이고 1 만 4px 이다.
 */
const SKY_BLUE_BASE_FRAME = 90
const SKY_BLUE_NARROW_WIDTH = 4
const SKY_BLUE_WIDTH = 8
export const SKY_BLUE_GLYPH_HEIGHT = 8

export function skyBlueNumberGlyphsOf(value: number): Glyph[] {
  return [...String(Math.max(0, Math.trunc(value)))].map((digit) => ({
    frame: SKY_BLUE_BASE_FRAME + Number(digit),
    width: digit === '1' ? SKY_BLUE_NARROW_WIDTH : SKY_BLUE_WIDTH,
  }))
}

export function glyphsWidthOf(glyphs: readonly Glyph[]): number {
  return glyphs.reduce((total, glyph) => total + glyph.width + (glyph.spacing ?? GLYPH_SPACING), 0)
}

const HUNDRED_MILLION_FRAME = 104
const HUNDRED_MILLION_WIDTH = 9
const HUNDRED_MILLION_SPACING = 3
const TEN_THOUSAND = 10_000

/** 만원 값 → "N억M" 글자 (0x63118). 나머지는 네 자리 중 첫 자리(천)만 0 이면 빼고 그대로 그린다 */
export function moneyGlyphsOf(amountInTenThousandWon: number): Glyph[] {
  if (amountInTenThousandWon < TEN_THOUSAND) return numberGlyphsOf(amountInTenThousandWon)
  const hundredMillions = Math.trunc(amountInTenThousandWon / TEN_THOUSAND)
  const rest = amountInTenThousandWon % TEN_THOUSAND
  const restDigits = String(rest).padStart(4, '0')
  const shown = restDigits.startsWith('0') ? restDigits.slice(1) : restDigits
  return [
    ...numberGlyphsOf(hundredMillions),
    { frame: HUNDRED_MILLION_FRAME, width: HUNDRED_MILLION_WIDTH, spacing: HUNDRED_MILLION_SPACING },
    ...(rest === 0 ? [] : [...shown].flatMap((digit) => numberGlyphsOf(Number(digit)))),
  ]
}
