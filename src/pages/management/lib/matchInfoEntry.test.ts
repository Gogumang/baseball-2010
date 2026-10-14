import { describe, expect, it } from 'vitest'
import {
  MATCH_INFO_BANNER_COLORS, MATCH_INFO_BANNER_OFFSETS, matchInfoBannersOf, matchInfoEntryPhaseOf,
} from '@/pages/management/lib/matchInfoEntry'

describe('경기 준비 들어올 때 연출 (0x63b14 넷째 인자 · 0x54790)', () => {
  it('배너 D 는 120 · 116 · 100 · 36 (속도 ×4)', () => {
    expect(MATCH_INFO_BANNER_OFFSETS).toEqual([120, 116, 100, 36])
  })

  it('그림 0~4 는 머리띠가 내려오는 중이라 비우고, 5~8 은 배너, 9 부터 본문', () => {
    expect(matchInfoEntryPhaseOf(0, true)).toEqual({ kind: '숨김' })
    expect(matchInfoEntryPhaseOf(4, true)).toEqual({ kind: '숨김' })
    expect(matchInfoEntryPhaseOf(5, true)).toEqual({ kind: '배너', offset: 120 })
    expect(matchInfoEntryPhaseOf(8, true)).toEqual({ kind: '배너', offset: 36 })
    expect(matchInfoEntryPhaseOf(9, true)).toEqual({ kind: '본문' })
  })

  it('143 에서 돌아오면(넷째 인자 0) 처음부터 본문', () => {
    expect(matchInfoEntryPhaseOf(0, false)).toEqual({ kind: '본문' })
  })

  it('배너 꼭짓점 — y0 = 145 → r = 125 · 왼 A 는 x − D · 오른 B 는 x + D', () => {
    const [left, right] = matchInfoBannersOf(36)
    expect(left.points).toEqual([{ x: -86, y: 125 }, { x: 104, y: 125 }, { x: 64, y: 165 }, { x: -86, y: 165 }])
    expect(right.points).toEqual([{ x: 176, y: 106 }, { x: 326, y: 106 }, { x: 326, y: 146 }, { x: 136, y: 146 }])
    expect(left.lines[2]).toEqual({ from: { x: -86, y: 128 }, to: { x: 101, y: 128 }, color: MATCH_INFO_BANNER_COLORS.shade })
  })
})
