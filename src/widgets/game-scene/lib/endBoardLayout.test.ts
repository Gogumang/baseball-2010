import { describe, expect, it } from 'vitest'
import {
  PITCHER_NAME_PLATE_X,
  PITCHER_ROW_X,
  SCORE_SLOTS,
  endScoreGlyphsOf,
  pitcherLabelPositionOf,
  pitcherNameBoxOf,
  pitcherRowTopOf,
} from '@/widgets/game-scene/lib/endBoardLayout'

describe('경기 끝 결과 판 0x4fe9c 배치', () => {
  it('점수는 num 이미지 0x46~ 큰 숫자 — 0x585ad(…, x, y, 간격 6, 자리 0, 정렬 2)', () => {
    // 한 자리 "5"(폭 30): x − 15
    expect(endScoreGlyphsOf(5, SCORE_SLOTS.away)).toEqual([{ image: 0x4b, x: 56 - 15, y: 153 }])
    // 두 자리 "12"(22 + 29 = 51, 간격은 셋째 글자부터): x − 25, 다음 글자는 폭 + 간격 6
    expect(endScoreGlyphsOf(12, SCORE_SLOTS.home)).toEqual([
      { image: 0x47, x: 187 - 25, y: 153 },
      { image: 0x48, x: 187 - 25 + 22 + 6, y: 153 },
    ])
  })

  it('세 줄 — 딱지 칸 (W/2 − 54 − 2) · 이름 칸 W/2 · 딱지 그림 · 이름 글 자리 (50120~502c4)', () => {
    expect(PITCHER_ROW_X).toBe(64)
    expect(PITCHER_NAME_PLATE_X).toBe(120)
    expect([0, 1, 2].map(pitcherRowTopOf)).toEqual([193, 209, 225])
    // 120 − 54 + 27 − trunc(w/2) − 2, 줄 위 + 3
    expect(pitcherLabelPositionOf(0)).toEqual({ x: 70, y: 196 })
    expect(pitcherLabelPositionOf(1)).toEqual({ x: 70, y: 212 })
    expect(pitcherLabelPositionOf(2)).toEqual({ x: 76, y: 228 })
    // 0xba269(글, W/2, 줄 위 + 2, 폭 54, −1)
    expect(pitcherNameBoxOf(1)).toEqual({ x: 120, y: 211, width: 54 })
  })
})
