import { describe, expect, it } from 'vitest'
import {
  BATTER_BOXES, BATTER_CARD_TOP, PITCHER_BOXES, PITCHER_CARD_TOP,
  batterPositionBadgeOf, battingAverageGlyphsOf, boxNumberGlyphsOf, cardOriginsAt, earnedRunAverageGlyphsOf,
  framePlacementOf, paddedNumberGlyphsOf, pitcherRoleBadgeOf, recentResultChipsOf, roundFillRectsOf, slideOffsetAt,
  staminaGaugeRectsOf,
} from '@/widgets/matchup-cards/lib/matchupCardsLayout'

describe('밀림 (0x44944 머리 — sin 표 0x6c7c0)', () => {
  it('틱 0 은 화면 밖, 1 부터 sin 으로 들어와 살짝 넘쳤다가 틱 7 에 멈춘다', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 30].map(slideOffsetAt)).toEqual([139, 93, 57, 27, 6, -6, -8, 0, 0, 0])
  })

  it('우타(0): 투수 판은 왼쪽(−o − 3), 타자 판은 오른쪽(W + o − 0x8c + 3)', () => {
    expect(cardOriginsAt(7, 0)).toEqual({
      pitcher: { x: -3, y: PITCHER_CARD_TOP },
      batter: { x: 240 - 140 + 3, y: BATTER_CARD_TOP },
    })
    expect(cardOriginsAt(0, 0).pitcher.x).toBe(-139 - 3)
  })

  it('좌타(1): 자리가 바뀌고 쪽(+0x17e1 > 0)이라 투수 +5 · 타자 −3', () => {
    expect(cardOriginsAt(7, 1)).toEqual({
      pitcher: { x: 240 - 140 + 5, y: PITCHER_CARD_TOP },
      batter: { x: -3, y: BATTER_CARD_TOP },
    })
  })

  it('판 위는 H − 0xe6 · H − 0x5f', () => {
    expect(PITCHER_CARD_TOP).toBe(90)
    expect(BATTER_CARD_TOP).toBe(225)
  })
})

describe('그림 맞춤 0xb9d74', () => {
  it('0x22 는 가로 (차 >> 1) · 세로 올림 반', () => {
    expect(framePlacementOf(PITCHER_BOXES[4], { x: 0, y: 0, width: 20, height: 10 }, 0x22, { x: 0, y: 0 })).toEqual({ x: 9, y: 26 })
  })
  it('0x11 은 박스 왼쪽 위 그대로', () => {
    expect(framePlacementOf(PITCHER_BOXES[1], { x: 0, y: 0, width: 39, height: 5 }, 0x11, { x: 10, y: 20 })).toEqual({ x: 17, y: 24 })
  })
})

describe('숫자', () => {
  it('0xba51c 정렬 0x24 — 폭에 마지막 자간까지 넣고 오른끝에 붙인다', () => {
    // 박스 6 (34, 43, 30, 13), "12" 자간 1 → 폭 (4+1)+(6+1) = 12
    expect(boxNumberGlyphsOf(12, PITCHER_BOXES[6], { x: 0, y: 0 }, 20, 1, 0x24)).toEqual([
      { image: 21, x: 52, y: 45 },
      { image: 22, x: 57, y: 45 },
    ])
  })

  it('0x585ac — 자리 3 이 모자라면 0 을 앞에 찍고, 폭은 셋째 글자부터 간격을 센다', () => {
    expect(paddedNumberGlyphsOf(5, 64, 31, 20, 1, 3, 0x24)).toEqual([
      { image: 20, x: 44, y: 26 },
      { image: 20, x: 51, y: 26 },
      { image: 25, x: 58, y: 26 },
    ])
    // 305: 폭 6+6+6+1 = 19 → 64 − 19 = 45 부터 7 씩
    expect(paddedNumberGlyphsOf(305, 64, 31, 20, 1, 3, 0x24).map((glyph) => glyph.x)).toEqual([45, 52, 59])
  })

  it('방어율 3.45 → 박스 11 에 3, 박스 10 에 4·5, 점은 박스 11 오른끝 + 1', () => {
    const { glyphs, point } = earnedRunAverageGlyphsOf(345, { x: 0, y: 0 })
    expect(glyphs.map((glyph) => glyph.image)).toEqual([23, 25, 24])
    expect(glyphs[1].x).toBe(48 + 16 - 6)
    expect(glyphs[2].x).toBe(48 + 16 - 6 - 1 - 6)
    expect(point).toMatchObject({ x: 36 + 11 + 1, y: 24 + 13 - 3, width: 1, height: 2 })
  })

  it('타율 1000 은 네 번 따로 찍는다 (0x4544c)', () => {
    const { glyphs, point } = battingAverageGlyphsOf(1000, { x: 0, y: 0 })
    expect(glyphs.map((glyph) => glyph.image)).toEqual([21, 20, 20, 20])
    expect(glyphs.map((glyph) => glyph.x)).toEqual([64 - 5 - 23, 64 - 7, 64 - 7 - 7, 64 - 7 - 14])
    expect(point).toMatchObject({ x: 43 - 2, y: 24 + 13 - 3 })
  })
})

describe('칸', () => {
  it('보직 0x545e8 — 0 선발 · 1 중계 · 2 구원, 그 밖은 칸 0 과 PLAYER/COM 글자가 남는다', () => {
    expect([0, 1, 2, 3].map((role) => pitcherRoleBadgeOf(role, 158))).toEqual([
      { chip: 4, label: 49 }, { chip: 7, label: 170 }, { chip: 5, label: 182 }, { chip: 0, label: 158 },
    ])
  })

  it('수비 0x54590 — 0 은 안 그리고 9 보다 크면 남은 값', () => {
    expect(batterPositionBadgeOf(0, 4, 157)).toEqual({ chip: -1, label: -1 })
    expect(batterPositionBadgeOf(6, 4, 157)).toEqual({ chip: 5, label: 184 })
    expect(batterPositionBadgeOf(12, 4, 157)).toEqual({ chip: 4, label: 157 })
  })

  it('오늘 타석 기록은 마지막 넷을 판 아래 33 간격으로', () => {
    const chips = recentResultChipsOf([7, 0, 1, 4, 8], { x: 10, y: 225 })
    expect(chips.map((chip) => chip.label)).toEqual([361, 58, 61, 362])
    expect(chips.map((chip) => chip.x)).toEqual([11, 44, 77, 110])
    expect(chips[0].y).toBe(225 + 62 + 1)
    // 글자 21×10 → 32×15 칸 가운데 (+5, +3)
    expect(chips[0]).toMatchObject({ labelX: 16, labelY: 225 + 63 + 3 })
  })

  it('체력 막대 — 길이 = 값 × 폭 / 최대, 붉은 막대 = 비율로 줄인 뒤 /10 − 2', () => {
    const rects = staminaGaugeRectsOf({ lengthValue: 1249, maxValue: 1249, percent: 100 }, { x: 0, y: 0 })
    const gaugeBox = PITCHER_BOXES[9]
    expect(rects[0]).toMatchObject({ x: gaugeBox.x, y: gaugeBox.y - 1, width: 56, height: 14 })
    expect(rects[3]).toMatchObject({ x: gaugeBox.x + 2, y: gaugeBox.y + 1, width: 55 - 2, height: 1 })
    expect(rects.slice(3).map((rect) => rect.height)).toEqual([1, 5, 5, 1])
  })

  it('타자 판 박스 11 은 타율 (43, 24, 21, 13)', () => {
    expect(BATTER_BOXES[11]).toEqual({ x: 43, y: 24, width: 21, height: 13 })
  })
})

describe('둥근 칠 0x6b7d4 — 사각 칠 하나와 선 넷 (둥글기 ≤ 3 · 4~7 두 모양)', () => {
  /** 칠한 칸 집합 */
  const cellsOf = (rects: readonly { x: number; y: number; width: number; height: number }[]) => {
    const cells = new Set<string>()
    for (const rect of rects) {
      for (let x = rect.x; x < rect.x + rect.width; x += 1) {
        for (let y = rect.y; y < rect.y + rect.height; y += 1) cells.add(`${x},${y}`)
      }
    }
    return cells
  }

  it('둥글기 5 는 (w+1)×(h+1) 을 덮고 모서리마다 ㄱ자 세 칸을 비운다', () => {
    const cells = cellsOf(roundFillRectsOf({ x: 0, y: 0, width: 6, height: 4, round: 5 }))
    expect(cells.size).toBe(7 * 5 - 4 * 3)
    for (const missing of ['0,0', '1,0', '0,1', '6,0', '5,0', '6,1', '0,4', '1,4', '0,3', '6,4', '5,4', '6,3']) {
      expect(cells.has(missing)).toBe(false)
    }
    expect(cells.has('1,1')).toBe(true)
  })

  it('둥글기 1 은 모서리 한 칸씩만 비운다 — 7 보다 크면 7 로 자른다', () => {
    const cells = cellsOf(roundFillRectsOf({ x: 10, y: 10, width: 4, height: 3, round: 1 }))
    expect(cells.size).toBe(5 * 4 - 4)
    expect(['10,10', '14,10', '10,13', '14,13'].some((cell) => cells.has(cell))).toBe(false)
    expect(cellsOf(roundFillRectsOf({ x: 0, y: 0, width: 6, height: 4, round: 99 })))
      .toEqual(cellsOf(roundFillRectsOf({ x: 0, y: 0, width: 6, height: 4, round: 5 })))
  })
})
