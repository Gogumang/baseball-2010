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
  seasonGameOf,
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

  it('경기 번호는 다음 경기(+1)이고 시즌을 다 치렀으면 45 로 둔다', () => {
    expect(seasonGameOf(0)).toBe(1)
    expect(seasonGameOf(44)).toBe(45)
    expect(seasonGameOf(45)).toBe(45)
  })

  it('경기장 띠는 6~15시 0 · 16~19시 1 · 그 밖 2', () => {
    expect([6, 15, 16, 19, 20, 5].map(backgroundFrameOf)).toEqual([0, 0, 1, 1, 2, 2])
  })
})
