import { describe, expect, it } from 'vitest'
import {
  LOADING_BAR, LOADING_BOX, LOADING_FILL_STRIPES, LOADING_TIP_TEXT, loadingFillWidthOf, loadingRunnerAnchorOf, tipNumberGlyphsOf,
} from '@/widgets/loading-tip/lib/loadingTipLayout'

describe('로딩 판 배치 — 0x53e04', () => {
  it('상자는 ((240 − 170) >> 1, (320 − 147) >> 1) = (35, 86)', () => {
    expect([LOADING_BOX.x, LOADING_BOX.y]).toEqual([35, 86])
  })

  it('팁 글은 상자 안 (10, 30) 폭 150, 막대는 (10, 112) 150×10', () => {
    expect(LOADING_TIP_TEXT).toEqual({ x: 10, y: 30, width: 150 })
    expect([LOADING_BAR.x, LOADING_BAR.y, LOADING_BAR.width, LOADING_BAR.height]).toEqual([10, 112, 150, 10])
    expect(LOADING_FILL_STRIPES.map((stripe) => [stripe.y, stripe.height])).toEqual([[1, 1], [2, 4], [6, 2], [8, 1]])
  })

  it('채움 = 150 − (끝 − 지금) · (150 / 끝) — 0x24 칸이면 한 칸 4px, 첫 그림 10px, 다 차면 150', () => {
    expect(loadingFillWidthOf(1, 0x24)).toBe(150 - 35 * 4)
    expect(loadingFillWidthOf(0x24, 0x24)).toBe(150)
    expect(loadingFillWidthOf(1, 0x25)).toBe(150 - 36 * 4)
  })

  it('선수 기준점은 막대 안 (F + 1, 10)', () => {
    expect(loadingRunnerAnchorOf(10)).toEqual({ x: 21, y: 122 })
  })

  it('팁 번호는 num 90 + 숫자를 (40, 6) 부터 자간 1 로 — "1" 은 4px', () => {
    expect(tipNumberGlyphsOf(17)).toEqual([
      { image: 91, x: 40, y: 6 },
      { image: 97, x: 45, y: 6 },
    ])
    expect(tipNumberGlyphsOf(73).map((glyph) => glyph.x)).toEqual([40, 49])
  })
})
