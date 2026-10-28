import { describe, expect, it } from 'vitest'
import {
  CHANCE_SLOTS,
  DETAIL_DESCRIPTION,
  DETAIL_OK,
  DETAIL_ROW_Y,
  SMALL_DESCRIPTION,
  TAB,
  TITLE,
  baseLabelPointOf,
  centeredLeftOf,
  detailCellBoxOf,
  detailCellOutlineOf,
  detailDownArrowYOf,
  detailNumberCenterOf,
  detailUpArrowYOf,
  isSettingsBlinkOn,
  listCursorOf,
  listRowTopOf,
  OUTLINE_COLOR,
} from '@/pages/match-settings/lib/matchSettingsLayout'

/** 그리기 0x6042c 를 그 함수만 돌려 받아 적은 인자와 맞춘다 (matchSettingsLayout 머리말) */

describe('종류 · 찬스 · 이닝 (판 24, 80, 192, 160)', () => {
  it('제목 357(폭 41) 은 (49, 85) · 상세에서는 (49, 59)', () => {
    expect([centeredLeftOf(TITLE.centerX, 41), TITLE.smallY, TITLE.detailY]).toEqual([49, 85, 59])
  })

  it('줄 k 는 slt_frame 15 를 (70, 110 + 26k) 에, 이름(폭 53)은 (94, 114 + 26k) — 커서는 (70, y, 100, 17)', () => {
    expect([0, 1, 2].map(listRowTopOf)).toEqual([110, 136, 162])
    expect(centeredLeftOf(70 + (101 >> 1), 53)).toBe(94)
    expect(listCursorOf(2)).toEqual({ x: 70, y: 162, width: 100, height: 17, color: OUTLINE_COLOR.커서 })
  })

  it('꼬리 탭 이미지 40 은 (120, 86) · 이름은 (159, 88) — 상세는 (120, 60) · (159, 62)', () => {
    expect([TAB.x, TAB.smallY, TAB.labelX, TAB.smallLabelY]).toEqual([120, 86, 159, 88])
    expect([TAB.detailY, TAB.detailLabelY]).toEqual([60, 62])
  })

  it('찬스 두 칸 popup 19 (54, 120) · 20 (151, 120), 이름 352 (60, 162) · 338 (157, 162)', () => {
    expect(CHANCE_SLOTS.map((slot) => [slot.frame, slot.x, slot.y, slot.label, slot.labelX, slot.labelY])).toEqual([
      [19, 54, 120, 352, 60, 162],
      [20, 151, 120, 338, 157, 162],
    ])
  })

  it('설명 칸 (29, 195, 182, 40) · 글 (24, 202, 폭 192) — 상세는 (29, 199) · (34, 206, 폭 172)', () => {
    expect(SMALL_DESCRIPTION.box).toEqual({ x: 29, y: 195, width: 182, height: 40 })
    expect([SMALL_DESCRIPTION.text.x, SMALL_DESCRIPTION.text.y, SMALL_DESCRIPTION.text.width]).toEqual([24, 202, 192])
    expect([DETAIL_DESCRIPTION.box.y, DETAIL_DESCRIPTION.text.x, DETAIL_DESCRIPTION.text.y, DETAIL_DESCRIPTION.text.width]).toEqual([
      199, 34, 206, 172,
    ])
  })
})

describe('상세 (판 24, 54, 192, 212)', () => {
  it('화살 ▲ (114, 42 / 44) · ▼ (114, 270 / 268) — 깜빡이면 2px 바깥으로', () => {
    expect([detailUpArrowYOf(2), detailUpArrowYOf(0), detailDownArrowYOf(2), detailDownArrowYOf(0)]).toEqual([42, 44, 270, 268])
  })

  it('줄 Y 88 · 127 · 147 · 187 — 9칸 줄은 (29 + 20i, Y + 11), 3칸 줄은 (107 + 34i, Y − 6)', () => {
    expect(DETAIL_ROW_Y).toEqual([88, 127, 147, 187])
    expect(detailCellBoxOf(0, 3)).toEqual({ x: 89, y: 99, width: 19, height: 15 })
    expect(detailCellBoxOf(2, 8)).toEqual({ x: 189, y: 158, width: 19, height: 15 })
    expect(detailCellBoxOf(1, 2)).toEqual({ x: 175, y: 121, width: 33, height: 15 })
    expect(detailCellBoxOf(3, 0)).toEqual({ x: 107, y: 181, width: 33, height: 15 })
  })

  it('숫자 가운데 — 9칸 줄 (x + 9, y + 8) · 주자 줄 (x + 13, y + 8), "루" (x + 18, y + 3)', () => {
    expect(detailNumberCenterOf(0, 0)).toEqual({ x: 38, y: 107 })
    expect(detailNumberCenterOf(1, 0)).toEqual({ x: 120, y: 129 })
    expect(detailNumberCenterOf(3, 2)).toEqual({ x: 188, y: 189 })
    expect(baseLabelPointOf(1, 1)).toEqual({ x: 159, y: 124 })
  })

  it('칸 테 0x6aa64 는 (x, y, w − 1, h − 1)', () => {
    expect(detailCellOutlineOf(1, 0, OUTLINE_COLOR.켜짐)).toEqual({ x: 107, y: 121, width: 32, height: 14, color: '#80FFFF' })
  })

  it('확인 단추 popup 0 은 (100, 244)', () => {
    expect([DETAIL_OK.x, DETAIL_OK.y]).toEqual([100, 244])
  })
})

it('깜빡임은 [skin+0x40c] 를 1 올린 뒤 % 8 ≤ 4 — 8 번에 5 번 켜진다', () => {
  expect([1, 2, 3, 4, 5, 6, 7, 8].map(isSettingsBlinkOn)).toEqual([true, true, true, true, false, false, false, true])
})
