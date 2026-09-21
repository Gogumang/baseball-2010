import { describe, expect, it } from 'vitest'
import { glyphsWidthOf } from '@/shared/lib/pixelNumber/pixelNumber'
import { rankGlyphsOf, valueGlyphsOf, winningPercentOf } from '@/widgets/standings/lib/standingsLayout'

describe('winningPercentOf', () => {
  it('승률은 **승×1000/(승+패)** 세 자리 숫자다 — 5할이면 500 (P6 4a-2)', () => {
    expect(winningPercentOf(30, 14)).toBe(681)
    expect(winningPercentOf(22, 22)).toBe(500)
    expect(winningPercentOf(15, 29)).toBe(340)
  })

  it('한 경기도 치르지 않았으면 0 이다 (0 으로 나누지 않는다)', () => {
    expect(winningPercentOf(0, 0)).toBe(0)
  })
})

describe('rankGlyphsOf', () => {
  it('하늘색 순위 숫자는 num 90번대를 쓴다', () => {
    expect(rankGlyphsOf(1).map((glyph) => glyph.frame)).toEqual([91])
    expect(rankGlyphsOf(10).map((glyph) => glyph.frame)).toEqual([91, 90])
  })

  it('순위 숫자는 주황 숫자보다 넓다 — "1" 만 같고 나머지는 8px 이다', () => {
    // 한 글자 전진 = 폭 + 1
    expect(glyphsWidthOf(rankGlyphsOf(1))).toBe(5)
    expect(glyphsWidthOf(rankGlyphsOf(10))).toBe(14)
    expect(glyphsWidthOf(valueGlyphsOf(10))).toBe(12)
  })
})
