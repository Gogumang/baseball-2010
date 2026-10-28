import { describe, expect, it } from 'vitest'
import {
  MATCH_INFO_BANNER_COLORS,
  MATCH_INFO_BANNER_OFFSETS,
  MATCH_INFO_VALUE_SETTLED,
  isMatchInfoKeyReadyAt,
  matchInfoBannersOf,
  matchInfoEntryPhaseOf,
  matchInfoValueCellDy,
  matchInfoValueRowsAt,
  matchInfoValueUnfoldAfter,
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
    expect(left.points).toEqual([
      { x: -86, y: 125 },
      { x: 104, y: 125 },
      { x: 64, y: 165 },
      { x: -86, y: 165 },
    ])
    expect(right.points).toEqual([
      { x: 176, y: 106 },
      { x: 326, y: 106 },
      { x: 326, y: 146 },
      { x: 136, y: 146 },
    ])
    expect(left.lines[2]).toEqual({ from: { x: -86, y: 128 }, to: { x: 101, y: 128 }, color: MATCH_INFO_BANNER_COLORS.shade })
  })
})

describe('값 줄 펼침 0x5dcc0 · 키 막음 [skin+0xe4]', () => {
  it('굴릴 때마다 속도 ×4 로 미끄러지다 17n 에 닿으면 한 줄 더 연다 — 여덟 번째에 끝', () => {
    const slides = [1, 2, 3, 4, 5, 6, 7, 8].map((steps) => matchInfoValueUnfoldAfter(steps))
    expect(slides.map((unfold) => unfold.slide)).toEqual([4, 17, 21, 34, 38, 51, 55, 68])
    expect(slides.map((unfold) => unfold.revealFrom)).toEqual([8, 6, 6, 4, 4, 2, 2, 0])
    expect(slides.map((unfold) => unfold.isDone)).toEqual([false, false, false, false, false, false, false, true])
    expect(matchInfoValueUnfoldAfter(30)).toEqual(MATCH_INFO_VALUE_SETTLED)
  })

  it('첫 그림은 칸이 모두 첫 줄 자리에 겹치고, 다 펼치면 제자리', () => {
    const first = matchInfoValueUnfoldAfter(0)
    expect([0, 1, 2, 3, 8, 9].map((cell) => matchInfoValueCellDy(first, cell))).toEqual([0, 0, -17, -17, -68, -68])
    expect([0, 3, 9].map((cell) => matchInfoValueCellDy(MATCH_INFO_VALUE_SETTLED, cell))).toEqual([0, 0, 0])
    // 두 번 굴린 뒤 — 끝줄(칸 8 · 9) 만 한 줄 아래, 칸 6 · 7 은 막 떨어지기 시작
    const second = matchInfoValueUnfoldAfter(2)
    expect([6, 8].map((cell) => matchInfoValueCellDy(second, cell))).toEqual([-51, -51])
  })

  it('들어올 때 연출이면 그림 9 부터 펼치고 그림 16 에 끝나 그다음 갱신부터 키를 받는다', () => {
    expect(matchInfoValueRowsAt(9, true)).toEqual({ unfold: matchInfoValueUnfoldAfter(0), isReady: false })
    expect(matchInfoValueRowsAt(16, true).isReady).toBe(true)
    expect([0, 4, 8, 9, 15].some((draws) => isMatchInfoKeyReadyAt(draws, true))).toBe(false)
    expect(isMatchInfoKeyReadyAt(16, true)).toBe(true)
  })

  it('넷째 인자 0(엔트리에서 돌아옴)이면 앞 펼침이 끝난 채라 첫 그림부터 키를 받는다', () => {
    expect(matchInfoValueRowsAt(0, false)).toEqual({ unfold: MATCH_INFO_VALUE_SETTLED, isReady: true })
    expect(isMatchInfoKeyReadyAt(0, false)).toBe(true)
  })
})
