import { describe, expect, it } from 'vitest'
import { frameSlideOf } from '@/widgets/screen-frame/lib/frameSlide'
import {
  COMMAND_SLOTS,
  COMMAND_MENUS,
  commandSlotYAt,
  slidePositionAt,
  PARENT_SLOT_TARGET,
  sineOf,
  glyphsWidthOf,
  backgroundFrameOf,
  moneyGlyphsOf,
  moraleGaugeColumnsOf,
  moraleGaugeFrameOf,
  numberGlyphsOf,
  messageGameNumberOf,
  messageLineLayoutOf,
  nameBandSplitOf,
  commandLabelAlignOf,
  commandLabelLeftOf,
} from '@/pages/management/lib/managementLayout'

describe('하위 메뉴 · 등장 애니메이션 — 0x7e84c · 0x7ff8c (layout-re 2차)', () => {
  it('선수정보·트레이닝·아이템 하위 메뉴는 표 0xd4758 칸에 놓인다', () => {
    expect(COMMAND_MENUS.트레이닝.map((item) => [item.x, item.y, item.icon, item.labelFrame])).toEqual([
      [44, 245, 11, 98], [82, 245, 12, 103], [122, 236, 13, 108], [161, 236, 14, 113], [199, 236, 15, 115],
    ])
    expect(COMMAND_MENUS.아이템.map((item) => item.id)).toEqual(['장착', '서브', 'GP'])
    expect(COMMAND_MENUS.선수정보.map((item) => item.labelFrame)).toEqual([96, 228, 101, 115, 297])
  })

  it('사인표 0xd310c — 90° 넘으면 대칭, 180° 넘으면 부호가 바뀐다', () => {
    expect([0, 30, 90, 110, 200, -30].map(sineOf)).toEqual([0, 50, 100, 94, -34, -50])
  })

  it('커맨드 칸은 y170 에서 내려와 조금 넘친 뒤 제자리에 선다', () => {
    expect(Array.from({ length: 9 }, (_unused, t) => commandSlotYAt(245, t))).toEqual([170, 196, 214, 230, 242, 248, 249, 245, 245])
    expect(Array.from({ length: 9 }, (_unused, t) => commandSlotYAt(236, t))).toEqual([170, 192, 208, 222, 233, 238, 239, 236, 236])
  })

  it('부모 칸은 제자리에서 (6,245) 로 같은 곡선으로 미끄러진다 (0x8003c, 점검 12차)', () => {
    expect(PARENT_SLOT_TARGET).toEqual({ x: 6, y: 245 })
    expect(slidePositionAt(44, 6, 0)).toBe(44)
    expect(slidePositionAt(44, 6, 8)).toBe(6)
    expect(slidePositionAt(170, 245, 3)).toBe(commandSlotYAt(245, 3))
  })

  it('머리띠·바닥띠는 갱신마다 두 배로 30 까지 미끄러진다 (시작값 1 은 추정)', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map(frameSlideOf)).toEqual([1, 2, 4, 8, 16, 30, 30])
  })
})

describe('관리 화면 배치 — 0x7d34c · 0x7e418', () => {
  it('커맨드 6칸은 왼쪽 셋이 y245, 오른쪽 셋이 y236 인 계단형이다 (표 0xd4740)', () => {
    expect(COMMAND_SLOTS.map((slot) => [slot.x, slot.y])).toEqual([
      [6, 245], [44, 245], [82, 245], [122, 236], [161, 236], [199, 236],
    ])
    expect(COMMAND_SLOTS.map((slot) => [slot.id, slot.icon, slot.labelFrame])).toEqual([
      ['선수정보', 0, 90], ['트레이닝', 1, 91], ['휴식', 2, 92], ['외출', 3, 93], ['아이템', 4, 94], ['다음경기', 5, 89],
    ])
  })

  it('사기 게이지 열 수 = 사기 × 40 / 100, 색은 ≤30 빨강 · ≤74 주황 · 그 밖 초록', () => {
    expect([0, 50, 70, 100].map(moraleGaugeColumnsOf)).toEqual([0, 20, 28, 40])
    expect([30, 31, 74, 75].map(moraleGaugeFrameOf)).toEqual([12, 13, 13, 14])
  })

  it('숫자는 num 20~29 이고 1 만 폭이 4px 다', () => {
    expect(numberGlyphsOf(105)).toEqual([
      { frame: 21, width: 4 },
      { frame: 20, width: 6 },
      { frame: 25, width: 6 },
    ])
  })

  it('소지금·연봉은 만원 값이 10000 이상이면 "억" (num 104) 을 끼우고 나머지가 0 이면 생략한다 (0x63118)', () => {
    expect(moneyGlyphsOf(6000).map((glyph) => glyph.frame)).toEqual([26, 20, 20, 20])
    expect(moneyGlyphsOf(20000).map((glyph) => glyph.frame)).toEqual([22, 104])
    expect(moneyGlyphsOf(15000).map((glyph) => glyph.frame)).toEqual([21, 104, 25, 20, 20, 20])
  })

  it('억 뒤는 천의 자리 0 하나만 빼고 그대로 그린다 — 10050 은 "1억050" (점검 10차)', () => {
    expect(moneyGlyphsOf(10050).map((glyph) => glyph.frame)).toEqual([21, 104, 20, 25, 20])
    expect(moneyGlyphsOf(10001).map((glyph) => glyph.frame)).toEqual([21, 104, 20, 20, 21])
  })

  it('억 글자 다음 전진은 폭 + 3 이다 (0x632f6)', () => {
    const glyphs = moneyGlyphsOf(20000)
    expect(glyphsWidthOf(glyphs)).toBe(6 + 1 + 9 + 3)
  })

  it('경기 번호 0x7d120 — g + 1, g == 0 이고 포스트시즌이면 45, 둘째 인자가 서면 1 보다 클 때 −1', () => {
    expect(messageGameNumberOf(0, false)).toBe(1)
    expect(messageGameNumberOf(44, false)).toBe(45)
    // 45 로 자르지 않는다 — 정규시즌 g 가 45 면 46 이다
    expect(messageGameNumberOf(45, false)).toBe(46)
    // 포스트시즌 g 는 그 시리즈에서 치른 경기 수 — 0 일 때만 45 로 그린다
    expect(messageGameNumberOf(0, true)).toBe(45)
    expect(messageGameNumberOf(2, true)).toBe(3)
    expect(messageGameNumberOf(3, false, true)).toBe(3)
    expect(messageGameNumberOf(0, false, true)).toBe(1)
  })

  it('메시지줄 "/" 는 0xb9d35 oy 1 · 세로 가운데 내림이라 y 210 — 나머지 자리는 dx 를 줄여 간다', () => {
    expect(messageLineLayoutOf(12)).toEqual({
      gameLabelLeft: 81, totalRight: 79, slashLeft: 58, slashTop: 210, gameRight: 56,
      yearLabelLeft: 28, yearRight: 26, labelTop: 209,
    })
  })

  it('메시지줄은 다른 사각형에도 — 경기 평가 변화 창 0x86c90 이 (37, 57, 62×3 − 8, 11) 을 넘긴다', () => {
    const layout = messageLineLayoutOf(12, { x: 37, y: 57, width: 178, height: 11 })
    // 오른쪽 끝 215 에서 dx −5 · "경기" 폭 19 · 글 세로 가운데 올림((11 − 10)/2) = 1
    expect(layout.gameLabelLeft).toBe(215 - 5 - 19)
    expect(layout.labelTop).toBe(58)
    expect(layout.slashTop).toBe(57 + 1 + 1)
  })

  it('이름 띠가 꺾이는 x — 나만의리그 W/2 − 45 = 75 · 시즌 W/2 − 28 = 92 (0x7d43c)', () => {
    expect(nameBandSplitOf(false)).toBe(75)
    expect(nameBandSplitOf(true)).toBe(92)
  })

  it('경기장 띠는 6~15시 0 · 16~19시 1 · 그 밖 2', () => {
    expect([6, 15, 16, 19, 20, 5].map(backgroundFrameOf)).toEqual([0, 0, 1, 1, 2, 2])
  })
})

describe('커맨드 줄 이름표 정렬 — 0x7e666~0x7e67e', () => {
  it('하위 메뉴의 칸 2·3 만 왼쪽(0x21), 그 밖은 가운데(0x22)', () => {
    expect([0, 1, 2, 3, 4].map((index) => commandLabelAlignOf(true, index))).toEqual([0x22, 0x22, 0x21, 0x21, 0x22])
    expect([0, 2, 3, 5].map((index) => commandLabelAlignOf(false, index))).toEqual([0x22, 0x22, 0x22, 0x22])
  })

  it('왼쪽이면 칸 x 에 글자가 붙는다 — 테두리 그림은 1px 앞', () => {
    expect(commandLabelLeftOf(122, 50, 0x21)).toBe(121)
    expect(commandLabelLeftOf(122, 20, 0x22)).toBe(122 + 6 - 1)
  })
})
