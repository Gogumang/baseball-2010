import { describe, expect, it } from 'vitest'
import {
  RANKING_BLINK_AT_REST, rankingColumnXOf, rankingRowYOf, rankingSideArrowXOf, rankingValueDrawingOf,
} from '@/pages/nari-record-room/lib/rankingBoard'

describe('순위 판 0x5796c', () => {
  it('칸 폭은 game_ui 프레임 25 · 54 · 75 · 36, 사이 3 — 칸 x 20 · 48 · 105 · 183', () => {
    expect([0, 1, 2, 3].map(rankingColumnXOf)).toEqual([20, 48, 105, 183])
  })

  it('머리 58 + 15 + 9 = 82 에서 줄마다 15 + 4', () => {
    expect([0, 1, 9].map(rankingRowYOf)).toEqual([82, 101, 253])
  })

  it('쪽 화살 — 카운터 0 이면 ◀ 183 − 2 − 7 · ▶ 222 + 2 − 3', () => {
    expect(rankingSideArrowXOf('left', RANKING_BLINK_AT_REST)).toBe(174)
    expect(rankingSideArrowXOf('right', RANKING_BLINK_AT_REST)).toBe(221)
    expect(rankingSideArrowXOf('left', { drawCount: 5, keyCount: 6 })).toBe(178)
  })

  it('값 0x6aff8 — 칸 x + 0x19 에서 오른쪽부터, 타율은 점', () => {
    const hits = rankingValueDrawingOf(8, 123)
    expect(hits.glyphs.map((glyph) => glyph.x)).toEqual([25, 18, 11])
    expect(hits.dots).toEqual([])
    const average = rankingValueDrawingOf(12, 315)
    expect(average.glyphs.map((glyph) => glyph.frame - 0x14)).toEqual([5, 1, 3])
    expect(average.dots).toHaveLength(1)
  })
})
