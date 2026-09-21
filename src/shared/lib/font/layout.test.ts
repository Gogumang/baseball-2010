import { describe, expect, it } from 'vitest'
import {
  ASCII_WIDTH,
  FONT_SPACING,
  HANGUL_WIDTH,
  LINE_HEIGHT,
  layoutPixelText,
  measurePixelTextWidth,
} from '@/shared/lib/font/layout'

/** 원본 글자 그리기 0x9c068 의 전진·줄바꿈 규칙 (R5 5절) */
describe('글자 배치', () => {
  it('원본 칸 크기와 두 글꼴 객체의 자간·줄간', () => {
    expect([HANGUL_WIDTH, ASCII_WIDTH, LINE_HEIGHT]).toEqual([9, 5, 11])
    // 앱 전역 글꼴 0x6b330 → 한글 10px · 영문 6px · 줄 14px
    expect(FONT_SPACING.app).toEqual({ letterGap: 1, lineGap: 3 })
    // 글상자 글꼴 0x679d4 → 한글 11px · 영문 7px · 줄 13px
    expect(FONT_SPACING.textBox).toEqual({ letterGap: 2, lineGap: 2 })
  })

  it('한글은 9+자간, 영문·공백은 5+자간 전진한다', () => {
    const layout = layoutPixelText('가 A', { letterGap: 1 })
    // 가(초성·중성) → x 0, 공백은 그림 없음, A → x 16
    expect(layout.pieces.map((piece) => piece.x)).toEqual([0, 0, 16])
    expect(layout.pieces.at(-1)?.atlas).toBe('ascii')
    expect(layout.width).toBe(9 + 1 + 5 + 1 + 5)
    expect(layout.height).toBe(11)
    expect(layout.lineCount).toBe(1)
  })

  it('자간 2 로 그리면 한 글자당 1px 씩 더 벌어진다', () => {
    expect(layoutPixelText('가나', { letterGap: 1 }).pieces.map((p) => p.x)).toEqual([0, 0, 10, 10])
    expect(layoutPixelText('가나', { letterGap: 2 }).pieces.map((p) => p.x)).toEqual([0, 0, 11, 11])
  })

  it('2350자 밖 글자는 자리도 차지하지 않는다', () => {
    const 있는대로 = layoutPixelText('가나', { letterGap: 1 })
    const 끼워넣기 = layoutPixelText('가뷁나', { letterGap: 1 })
    expect(끼워넣기.pieces).toEqual(있는대로.pieces)
    expect(끼워넣기.width).toBe(있는대로.width)
  })

  it('\\n 은 줄높이 11 + 줄간만큼 내린다', () => {
    const layout = layoutPixelText('A\nB', { letterGap: 1, lineGap: 3 })
    expect(layout.pieces.map((piece) => [piece.x, piece.y])).toEqual([[0, 0], [0, 14]])
    expect(layout.height).toBe(14 + 11)
    expect(layout.lineCount).toBe(2)
  })

  it('한글은 글자마다 폭을 넘으면 줄을 바꾼다', () => {
    const layout = layoutPixelText('가나다', { letterGap: 1, lineGap: 3, maxWidth: 20 })
    expect(layout.pieces.map((piece) => [piece.x, piece.y])).toEqual([
      [0, 0], [0, 0], [10, 0], [10, 0], [0, 14], [0, 14],
    ])
    expect(layout.lineCount).toBe(2)
  })

  it('영문은 낱말 단위로 줄을 바꾼다', () => {
    const layout = layoutPixelText('abc defg', { letterGap: 1, lineGap: 3, maxWidth: 30 })
    // abc 는 첫 줄, defg 는 통째로 다음 줄
    expect(layout.pieces.map((piece) => [piece.x, piece.y])).toEqual([
      [0, 0], [6, 0], [12, 0], [0, 14], [6, 14], [12, 14], [18, 14],
    ])
  })

  it('한 낱말이 한 줄보다 길면 원본대로 그냥 넘친다', () => {
    const layout = layoutPixelText('abcdefgh', { letterGap: 1, maxWidth: 20 })
    expect(layout.lineCount).toBe(1)
    expect(layout.pieces.at(-1)?.x).toBe(42)
  })

  it('줄머리 공백 버리기 플래그', () => {
    expect(layoutPixelText('  가', { letterGap: 1 }).pieces[0].x).toBe(12)
    expect(layoutPixelText('  가', { letterGap: 1, skipLeadingSpace: true }).pieces[0].x).toBe(0)
  })

  it('폭 재기는 원본 버그대로 못 그리는 글자도 자간만큼 더한다', () => {
    // 그리기 쪽은 뷁을 0px 로 넘기는데 폭 재기(0x9c52c)는 자간 1px 을 더한다 — 원본 버그다
    expect(measurePixelTextWidth('가나', { letterGap: 1 })).toBe(19)
    expect(measurePixelTextWidth('가뷁나', { letterGap: 1 })).toBe(20)
    expect(layoutPixelText('가뷁나', { letterGap: 1 }).width).toBe(19)
  })
})
