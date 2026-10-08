import { describe, expect, it } from 'vitest'
import {
  LINE_SCORE_AT,
  LINE_SCORE_IMAGES,
  centeredNumberGlyphsOf,
  isLineScoreCursorShown,
  isLineScoreTotalShown,
  lineScorePlacementOf,
  panelRectsOf,
} from '@/widgets/line-score/lib/lineScoreLayout'
import type { LineScoreState } from '@/widgets/line-score/lib/lineScoreLayout'

const empty = (): number[] => Array.from({ length: 9 }, () => 0)

const stateOf = (patch: Partial<LineScoreState> = {}): LineScoreState => ({
  inning: 0,
  offenseSide: 0,
  inningRuns: [empty(), empty()],
  totals: [0, 0],
  isGameOver: false,
  tick: 1,
  ...patch,
})

describe('이닝별 점수판 0x41c18', () => {
  it('부르는 곳 — 중계 0x4258c (14, 10) · 경기 끝 판 0x4fe9c (14, 252)', () => {
    expect(LINE_SCORE_AT.autoRelay).toEqual({ x: 14, y: 10 })
    expect(LINE_SCORE_AT.gameEnd).toEqual({ x: 14, y: 252 })
  })

  it('판 0x5461c — 바깥 칠 · 테 · 네 점 · 흰 칠 · 안쪽 칠 차례', () => {
    const rects = panelRectsOf(14, 10, 0xd6, 0x3b)
    expect(rects[0]).toEqual({ x: 15, y: 10, width: 0xd5, height: 0x3c, color: '#081C4A' })
    // 테 (x+1, y+1, w−2, h−2) 의 윗선은 (x+2 .. R−1, y+1)
    expect(rects[2]).toEqual({ x: 16, y: 11, width: 0xd6 - 3, height: 1, color: '#335FCD' })
    expect(rects[6]).toEqual({ x: 16, y: 12, width: 1, height: 1, color: '#335FCD' })
    expect(rects[rects.length - 1]).toEqual({ x: 18, y: 15, width: 0xd6 - 8 + 1, height: 0x3b - 8 - 1, color: '#335FCD' })
  })

  it('숫자 0x585ad 정렬 2 — x 에서 폭/2 를 뺀다 ("1" 폭 4 · 나머지 8)', () => {
    expect(centeredNumberGlyphsOf(1, 40, 5, 0x32)).toEqual([{ image: 0x33, x: 38, y: 5 }])
    expect(centeredNumberGlyphsOf(12, 40, 5, 0)).toEqual([{ image: 1, x: 34, y: 5 }, { image: 2, x: 38, y: 5 }])
  })

  it('측 0 은 지금 이닝까지, 측 1 은 말일 때만 지금 이닝을 그린다', () => {
    const inningRuns: [number[], number[]] = [empty(), empty()]
    inningRuns[0][2] = 3
    inningRuns[1][2] = 1
    const top = lineScorePlacementOf(14, 10, stateOf({ inning: 2, offenseSide: 0, inningRuns }))
    // 측 0: 이닝 0·1·2 셋 · 측 1: 이닝 0·1 둘
    expect(top.runs.filter((glyph) => glyph.y === 10 + 0x15 + 2)).toHaveLength(3)
    expect(top.runs.filter((glyph) => glyph.y === 10 + 0x24 + 2)).toHaveLength(2)
    const bottom = lineScorePlacementOf(14, 10, stateOf({ inning: 2, offenseSide: 1, inningRuns }))
    expect(bottom.runs.filter((glyph) => glyph.y === 10 + 0x24 + 2)).toHaveLength(3)
    // 이닝 2 측 0 칸 (x + 0x18 + 0x22) 가운데 = 14 + 24 + 34 + 8 − 4
    expect(top.runs.find((glyph) => glyph.image === 3)).toEqual({ image: 3, x: 14 + 0x18 + 0x22 + 8 - 4, y: 10 + 0x17 })
  })

  it('9회를 넘으면 아홉 칸이 밀리고 칸은 이닝 mod 9 를 읽는다', () => {
    const inningRuns: [number[], number[]] = [empty(), empty()]
    inningRuns[0][0] = 5
    const placement = lineScorePlacementOf(14, 10, stateOf({ inning: 9, offenseSide: 0, inningRuns }))
    // 첫 칸은 2회 (이닝 번호 2)
    expect(placement.inningNumbers[0]?.image).toBe(0x32 + 2)
    // 10회(이닝 9) 칸은 마지막 칸 — 9 mod 9 = 칸 0 의 5
    const lastCellCenter = 14 + 0x18 + 0x11 * 8 + 8
    expect(placement.runs.find((glyph) => glyph.y === 10 + 0x17 && glyph.x === lastCellCenter - 4)?.image).toBe(5)
    // 지금 칸 테도 마지막 칸
    expect(placement.images.find((image) => image.image === LINE_SCORE_IMAGES.cursor)).toEqual({
      image: LINE_SCORE_IMAGES.cursor, x: 14 + 0x15 + 0x11 * 8, y: 10 + 0x12,
    })
  })

  it('깜빡임 — 경기 끝이면 합은 8틱에 5틱 · 지금 칸 테는 없다 · 경기 중 테는 10틱에 한 번 꺼진다', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((tick) => isLineScoreTotalShown(true, tick)))
      .toEqual([true, true, true, true, true, false, false, false])
    expect(isLineScoreTotalShown(false, 6)).toBe(true)
    expect(isLineScoreCursorShown(true, 3)).toBe(false)
    expect(isLineScoreCursorShown(false, 10)).toBe(false)
    expect(isLineScoreCursorShown(false, 11)).toBe(true)
    const over = lineScorePlacementOf(14, 252, stateOf({ isGameOver: true, tick: 6, totals: [3, 2] }))
    expect(over.totals).toHaveLength(0)
    expect(over.images.map((image) => image.image)).toEqual([LINE_SCORE_IMAGES.runsHeader])
  })
})
