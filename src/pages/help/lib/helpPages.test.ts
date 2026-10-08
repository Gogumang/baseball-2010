import { describe, expect, it } from 'vitest'
import {
  helpPageCountOf,
  helpPageRawOf,
  helpScrollKnobTopOf,
  helpScrollMetricsOf,
  helpStringIndexOf,
  isHelpRatingPage,
  wrapHelpText,
} from '@/pages/help/lib/helpPages'

const 글 = (lines: ReturnType<typeof wrapHelpText>) => lines.map((line) => line.segments.map((s) => s.text).join(''))

describe('쪽 — 표 0xd0b18 그대로 (빈 StrHOWTO[33] 포함)', () => {
  it('장 6 은 4쪽이고 둘째 쪽(StrHOWTO[33])은 등급표 0x54330 이다', () => {
    expect(helpPageCountOf(6)).toBe(4)
    expect(helpStringIndexOf(6, 1)).toBe(33)
    expect(isHelpRatingPage(6, 1)).toBe(true)
    expect(helpPageRawOf(6, 1)).toBe('')
    expect(helpPageRawOf(6, 2)).toContain('<주의사항>')
  })

  it('StrHOWTO[32] 의 %s 는 버전이다', () => {
    expect(helpPageRawOf(6, 0)).toContain('V 1.0')
  })
})

describe('줄 나누기 0x6ef4c — 글자 단위, 한글 9 · 영문 5 · 자간 1, 폭 162', () => {
  it('!N 으로 줄을 나누고 끝의 !N 은 빈 줄을 더 만들지 않는다 · 빈 글은 0줄', () => {
    expect(글(wrapHelpText('가!N나!N'))).toEqual(['가', '나'])
    expect(글(wrapHelpText('가!N!N나'))).toEqual(['가', '', '나'])
    expect(wrapHelpText('')).toHaveLength(0)
  })

  it('한글 16자(9 + 15×10 = 159)는 한 줄, 17자째는 다음 줄로 간다', () => {
    expect(글(wrapHelpText('가'.repeat(16)))).toEqual(['가'.repeat(16)])
    expect(글(wrapHelpText('가'.repeat(17)))).toEqual(['가'.repeat(16), '가'])
  })

  it('글자 폭은 0x9c52c 한 글자 폭 — 못 그리는 기호는 0(줄 첫 글자가 아니면 자간 1 만), \'·\' 은 영문 \'.\' 폭 5', () => {
    // 159 + 3×(0 + 1) = 162 ≤ 162
    expect(글(wrapHelpText('가'.repeat(16) + '★★★'))).toEqual(['가'.repeat(16) + '★★★'])
    // 9 + 14×10 = 149 · '·' 둘 = 161 · 셋째 167 > 162
    expect(글(wrapHelpText('가'.repeat(15) + '··'))).toEqual(['가'.repeat(15) + '··'])
    expect(글(wrapHelpText('가'.repeat(15) + '···'))).toEqual(['가'.repeat(15) + '··', '·'])
  })

  it('영문도 낱말이 아니라 글자에서 끊는다 (5 + 26×6 = 161 → 27자, 28자째 다음 줄)', () => {
    expect(글(wrapHelpText('a'.repeat(28)))).toEqual(['a'.repeat(27), 'a'])
  })

  it('!C 정렬과 !c 색은 다음 표시까지 이어진다', () => {
    const lines = wrapHelpText('!C가!N!cFFFF00나!L다')
    expect(lines[0].align).toBe('가운데')
    expect(lines[1].segments).toEqual([{ text: '나', color: '#FFFF00' }, { text: '다', color: '#FFFF00' }])
    expect(lines[1].align).toBe('왼')
  })
})

describe('스크롤 막대 0x61c54(뷰어, 161, 11, 줄수)', () => {
  it('11줄 이하면 손잡이가 막대 전체(159)이고 걸음 0', () => {
    expect(helpScrollMetricsOf(11)).toEqual({ knobLength: 159, step: 0, maxTop: 0 })
  })

  it('남는 줄 e 마다 손잡이가 14 씩 짧아지고 한 줄에 14 씩 내려간다', () => {
    expect(helpScrollMetricsOf(14)).toEqual({ knobLength: 159 - 3 * 14, step: 14, maxTop: 3 })
    expect(helpScrollKnobTopOf(14, 3)).toBe(42)
  })

  it('손잡이가 14 보다 짧아지면 161 − 3e − 2 · 걸음 3 이다', () => {
    expect(helpScrollMetricsOf(11 + 11)).toEqual({ knobLength: 161 - 33 - 2, step: 3, maxTop: 11 })
  })
})
