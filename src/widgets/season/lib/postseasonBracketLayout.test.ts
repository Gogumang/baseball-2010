import { describe, expect, it } from 'vitest'
import {
  RANK_TAGS, rankDigitBoxTopOf, rankDigitRightOf, rankGlyphsOf, rankUnitPositionOf,
} from '@/widgets/season/lib/postseasonBracketLayout'

/** 대진표 0x853ac 의 순위 딱지 — 0x854c8~0x85524 직접 떴다 */
describe('순위 딱지', () => {
  it('숫자는 num 0~9(기준 0) · 자간 0 — "1" 만 4px', () => {
    expect(rankGlyphsOf(4)).toEqual([{ frame: 4, width: 8, spacing: 0 }])
    expect(rankGlyphsOf(1)).toEqual([{ frame: 1, width: 4, spacing: 0 }])
  })

  it('숫자는 박스 x + 8 에 왼쪽 붙임, 세로는 oy 1 뒤 올림 가운데 (0xba51c 정렬 0x21)', () => {
    const tag = RANK_TAGS[0] // 4위 (26, 243, 39, 15)
    // 오른쪽 끝 = 26 + 8 + 8 → 숫자 왼쪽 = 34
    expect(rankDigitRightOf(tag, 4)).toBe(42)
    expect(rankDigitBoxTopOf(tag)).toBe(244)
  })

  it('"위"(img_text 307, 9×10) 는 오른쪽 맞춤 ox −6 · 세로 ceil((15 − 10)/2) (0xb9d74 정렬 0x24)', () => {
    expect(rankUnitPositionOf(RANK_TAGS[0])).toEqual({ x: 26 - 6 + 39 - 9, y: 243 + 3 })
  })
})
