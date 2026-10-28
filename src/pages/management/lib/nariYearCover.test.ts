import { screenEffectFrameAt } from '@/entities/story/model/screenEffect'
import { describe, expect, it } from 'vitest'
import {
  YEAR_COVER_CLIP,
  YEAR_COVER_ORIGIN,
  resumeCoverUnderlayAt,
  resumeLeftFrameCoverOpacityAt,
  yearCoverDigitsOf,
  yearCoverRollOf,
  yearCoverStepAt,
} from '@/pages/management/lib/nariYearCover'

describe('137 "N년차" 표지 그리기 0x1cc4c', () => {
  it('"년차" 는 (W/2, H/2 − h/2) = (120, 155) · 자르기 (0, 154, 240, 22)', () => {
    expect(YEAR_COVER_ORIGIN).toEqual({ x: 120, y: 155 })
    expect(YEAR_COVER_CLIP).toEqual({ x: 0, y: 154, width: 240, height: 22 })
  })

  it('밀림 — c ≤ 0x14 는 0, 0x15~0x32 는 c − 0x15, 그 뒤 0x1e (1cd30~1cd3e)', () => {
    expect([0, 20, 21, 22, 50, 51, 81].map(yearCoverRollOf)).toEqual([0, 0, 0, 1, 29, 30, 30])
  })

  it('1 → 2 년차: 지난 숫자 1 이 위로, 새 숫자 2 가 30 아래에서 올라온다 (x = 120 − 0x12)', () => {
    expect(yearCoverDigitsOf(1, 0)).toEqual([
      { image: 21, x: 102, y: 155 },
      { image: 22, x: 102, y: 185 },
    ])
    expect(yearCoverDigitsOf(1, 60)).toEqual([
      { image: 21, x: 102, y: 125 },
      { image: 22, x: 102, y: 155 },
    ])
  })

  it('9 → 10 년차: 새 0 과 열 자리 "1"(num 21) 이 함께 올라온다 (1cd88~1cda4)', () => {
    expect(yearCoverDigitsOf(9, 60)).toEqual([
      { image: 29, x: 102, y: 125 },
      { image: 20, x: 102, y: 155 },
      { image: 21, x: 91, y: 155 },
    ])
  })

  it('10 → 11 년차: 열 자리 "1" 은 먼저 제자리에 서고 일의 자리만 0 → 1 로 구른다 (1ccfc~1cd1e)', () => {
    expect(yearCoverDigitsOf(10, 0)).toEqual([
      { image: 21, x: 91, y: 155 },
      { image: 20, x: 102, y: 155 },
      { image: 21, x: 102, y: 185 },
    ])
  })
})

describe('137 틀 차례 — 0x1b768 효과기 → 137 → 0x12190 → 105', () => {
  it('앞 화면이 아홉 틀 어두워지고, 열째 틀은 137 예약과 밝아짐 칠하기 0', () => {
    expect(yearCoverStepAt(0, null)).toEqual({ kind: '앞화면', fadeOutFrame: 0, fadeInFrame: null })
    expect(yearCoverStepAt(8, null)).toEqual({ kind: '앞화면', fadeOutFrame: 8, fadeInFrame: null })
    expect(yearCoverStepAt(9, null)).toEqual({ kind: '앞화면', fadeOutFrame: null, fadeInFrame: 0 })
  })

  it('137 첫 틀은 밝아짐 칠하기 1 · c = 0, 효과기를 비우는 t = 8 그리기 뒤부터 키를 받는다', () => {
    const first = yearCoverStepAt(10, null)
    expect(first).toMatchObject({ kind: '표지', tick: 0, counter: 0, fadeInFrame: 1, fadeOutFrame: null, acceptsKey: false })
    expect(yearCoverStepAt(17, null)).toMatchObject({ tick: 7, fadeInFrame: 8, acceptsKey: false })
    expect(yearCoverStepAt(18, null)).toMatchObject({ tick: 8, fadeInFrame: null, acceptsKey: true })
  })

  it('기다림만으로는 t = 81 에 어두워지기 시작해 t = 90 이 105 를 예약하고 t = 91 이 105', () => {
    expect(yearCoverStepAt(10 + 80, null)).toMatchObject({ counter: 80, fadeOutFrame: null, acceptsKey: true })
    expect(yearCoverStepAt(10 + 81, null)).toMatchObject({ counter: 81, fadeOutFrame: 0, acceptsKey: false })
    expect(yearCoverStepAt(10 + 89, null)).toMatchObject({ fadeOutFrame: 8, isLeaving: false })
    expect(yearCoverStepAt(10 + 90, null)).toMatchObject({ fadeOutFrame: null, fadeInFrame: 0, isLeaving: true })
    expect(yearCoverStepAt(10 + 91, null)).toEqual({ kind: '관리' })
  })

  it('키 0x106a4 — 받은 틀에 c = 0x51 이라 숫자가 끝자리로 뛰고 그 틀에 어두워지기 시작한다', () => {
    expect(yearCoverStepAt(10 + 19, 20)).toMatchObject({ counter: 19, fadeOutFrame: null })
    expect(yearCoverStepAt(10 + 20, 20)).toMatchObject({ counter: 0x51, fadeOutFrame: 0 })
    expect(yearCoverStepAt(10 + 21, 20)).toMatchObject({ counter: 0x52, fadeOutFrame: 1 })
    expect(yearCoverStepAt(10 + 29, 20)).toMatchObject({ isLeaving: true })
    expect(yearCoverStepAt(10 + 30, 20)).toEqual({ kind: '관리' })
  })
})

describe('이어하기 길의 137 — 100 · 1 · 100 · 1 · 105 · 115 · 114 를 지나 9 틀째 연초 114 틀이 +0x289 를 받는다', () => {
  it('앞 화면: 그리기가 없는 100 · 1 은 남은 앞 판(상태 1 의 검정 덮기가 쌓인다), 105 한 틀은 관리 판(0x19da4), 115 는 상태판 · 114 는 그 위에 대화창', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(resumeCoverUnderlayAt)).toEqual([
      '앞판',
      '앞판',
      '앞판',
      '앞판',
      '관리',
      '상태판',
      '대화',
      '대화',
      '대화',
      '대화',
    ])
  })

  it('남은 앞 판의 덮개 — 0 틀은 없고, 상태 1(틀 1 · 3)의 단계 4 덮기(4/16 남김)와 앞 틀들의 효과기가 곱으로 쌓인다', () => {
    const effectorAt = (k: number) => screenEffectFrameAt('검정에서밝아짐', '검정', k)?.overlay?.opacity ?? 0
    expect(resumeLeftFrameCoverOpacityAt(0)).toBe(0)
    expect(resumeLeftFrameCoverOpacityAt(1)).toBeCloseTo(1 - (1 - effectorAt(0)) / 4)
    expect(resumeLeftFrameCoverOpacityAt(2)).toBeCloseTo(1 - ((1 - effectorAt(0)) * (1 - effectorAt(1))) / 4)
    expect(resumeLeftFrameCoverOpacityAt(3)).toBeCloseTo(1 - ((1 - effectorAt(0)) * (1 - effectorAt(1)) * (1 - effectorAt(2))) / 16)
  })

  it('표지 차례는 다른 길과 같다 — 아홉 틀 어두워진 뒤 9 틀째에 종류 2 를 새로 건다', () => {
    expect(yearCoverStepAt(8, null)).toEqual({ kind: '앞화면', fadeOutFrame: 8, fadeInFrame: null })
    expect(yearCoverStepAt(9, null)).toEqual({ kind: '앞화면', fadeOutFrame: null, fadeInFrame: 0 })
    expect(yearCoverStepAt(10, null).kind).toBe('표지')
  })
})
