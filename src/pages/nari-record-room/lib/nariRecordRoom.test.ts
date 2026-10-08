import { describe, expect, it } from 'vitest'
import { createCareer } from '@/entities/career/model/playerCareer'
import { EMPTY_SEASON_STATS } from '@/entities/career/model/seasonStats'
import { EMPTY_PITCHER_SEASON_STATS, createPitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import {
  BATTER_YEAR_COLUMNS, OPEN_YEAR_RECORD_VIEW, PITCHER_YEAR_COLUMNS, advanceYearSlide, batterYearCellTextOf, batterYearRowsOf,
  nariBatterRankingRecordsOf, pitcherYearCellTextOf, pitcherYearRowsOf, pressYearRecordKey, yearSlideOffsetOf,
  visibleYearRowCountOf, yearArrowBlinkOf, yearCellDrawingOf, yearCursorIsInsetOf, yearLabelOffsetOf, yearNumberGlyphsOf,
} from '@/pages/nari-record-room/lib/nariRecordRoom'
import type { YearRecordView } from '@/pages/nari-record-room/lib/nariRecordRoom'

describe('124 첫 갈래 — 연도별 기록 (0x5761c · 0x5c984)', () => {
  it('줄은 지난 해 칸들(0x1fa8c) 뒤 올해 레코드 — 옛 저장은 올해 한 줄', () => {
    const 첫해 = { ...EMPTY_SEASON_STATS, atBats: 100 }
    const career = { ...createCareer('선수'), yearlyStats: [첫해], stats: { ...EMPTY_SEASON_STATS, atBats: 7 } }
    expect(batterYearRowsOf(career).map((row) => row.atBats)).toEqual([100, 7])
    expect(batterYearRowsOf(createCareer('선수'))).toHaveLength(1)
    expect(pitcherYearRowsOf(createPitcherCareer('투수'))).toHaveLength(1)
  })

  it('열 표 — 타자 0xd1a08 여덟 · 투수 0xd1a28 아홉, 머리 글은 0x56dd4 의 img_text', () => {
    expect(BATTER_YEAR_COLUMNS.map((column) => column.bit)).toEqual([0, 0x10, 1, 2, 4, 8, 0x20, 0x40])
    expect(BATTER_YEAR_COLUMNS.map((column) => column.labelFrame)).toEqual([172, 61, 207, 208, 209, 210, 62, 211])
    expect(PITCHER_YEAR_COLUMNS.map((column) => column.bit)).toEqual([0x100, 0x200, 0x400, 0x800, 0x1000, 0x2000, 0x4000, 0x8000, 0x10000])
    expect(PITCHER_YEAR_COLUMNS.map((column) => column.labelFrame)).toEqual([171, 213, 214, 215, 216, 217, 181, 218, 219])
  })

  it('타자 칸 — 타율은 소수(v > 999 ? 3 : 0) · 그 밖은 레코드 값 그대로 · 도루는 웹이 안 세어 빈 칸', () => {
    const stats = { ...EMPTY_SEASON_STATS, atBats: 200, hits: 63, doubles: 11, triples: 2, homeRuns: 9, runsBattedIn: 40 }
    expect(batterYearCellTextOf(stats, 0)).toBe('.315')
    expect(batterYearCellTextOf({ ...stats, hits: 200 }, 0)).toBe('1.00')
    expect([0x10, 1, 2, 4, 8, 0x20].map((bit) => batterYearCellTextOf(stats, bit))).toEqual(['9', '200', '63', '11', '2', '40'])
    expect(batterYearCellTextOf(stats, 0x40)).toBeNull()
  })

  it('투수 칸 — 방어율은 소수((v > 100 ? v × 10 : v), 3) · 이닝은 아웃 / 3 · 사사구는 +0x2a', () => {
    const stats = { ...EMPTY_PITCHER_SEASON_STATS, outs: 100, runsAllowed: 13, wins: 7, losses: 3, saves: 1, strikeouts: 55, pitches: 1500, walks: 21 }
    // 13 × 2700 / 100 = 351 → 3510 → "3.51"
    expect(pitcherYearCellTextOf(stats, 0x100)).toBe('3.51')
    expect([0x200, 0x400, 0x800, 0x1000, 0x2000, 0x4000, 0x8000].map((bit) => pitcherYearCellTextOf(stats, bit)))
      .toEqual(['33', '13', '7', '3', '1', '55', '1500'])
    expect(pitcherYearCellTextOf(stats, 0x10000)).toBe('21')
    // 옛 저장(칸 없음)은 0
    const { walks: _walks, ...old } = stats
    expect(pitcherYearCellTextOf(old, 0x10000)).toBe('0')
  })
})

describe('124 첫 갈래 키 — 0x55864 보기 전용 · [편집기+0x337] 열 밀기', () => {
  const 밀기끝까지 = (view: YearRecordView, count: number) => {
    const offsets: number[] = []
    let held = view
    while (held.slide !== null) {
      offsets.push(yearSlideOffsetOf(held, count))
      held = advanceYearSlide(held, count)
    }
    return { offsets, view: held }
  }

  it('오른 키는 표 0xd1bbc 로 여섯 그림에 걸쳐 왼쪽으로 민 뒤 첫 열 + 1', () => {
    const pressed = pressYearRecordKey(OPEN_YEAR_RECORD_VIEW, '오른', 2)
    const { offsets, view } = 밀기끝까지(pressed, 8)
    expect(offsets).toEqual([-1, -3, -6, -13, -25, -39])
    expect(view.firstColumn).toBe(1)
  })

  it('왼 키는 오른쪽으로 민 뒤 첫 열 − 1 — 첫 열 0 이면 그 그림에서 그만둔다', () => {
    const atStart = 밀기끝까지(pressYearRecordKey(OPEN_YEAR_RECORD_VIEW, '왼', 2), 8)
    expect(atStart.offsets).toEqual([0])
    expect(atStart.view.firstColumn).toBe(0)

    const moved = 밀기끝까지(pressYearRecordKey({ ...OPEN_YEAR_RECORD_VIEW, firstColumn: 2 }, '왼', 2), 8)
    expect(moved.offsets).toEqual([1, 3, 6, 13, 25, 39])
    expect(moved.view.firstColumn).toBe(1)
  })

  it('첫 열 + 보이는 열 4 가 열 수에 닿으면 오른 키도 그만둔다 — 타자 4 · 투수 5 가 끝', () => {
    expect(밀기끝까지(pressYearRecordKey({ ...OPEN_YEAR_RECORD_VIEW, firstColumn: 4 }, '오른', 2), 8).view.firstColumn).toBe(4)
    expect(밀기끝까지(pressYearRecordKey({ ...OPEN_YEAR_RECORD_VIEW, firstColumn: 4 }, '오른', 2), 9).view.firstColumn).toBe(5)
  })

  it('미는 동안은 키를 건너뛰고 [+0x40c] 만 센다 (0x55868 · 0x5587c) · 위아래는 꼴 0x20 이라 끝에서 감는다', () => {
    const sliding = pressYearRecordKey(OPEN_YEAR_RECORD_VIEW, '오른', 3)
    const held = pressYearRecordKey(sliding, '아래', 3)
    expect(held).toEqual({ ...sliding, keyPresses: 2 })
    expect(pressYearRecordKey(OPEN_YEAR_RECORD_VIEW, '위', 3).cursor).toBe(2)
    const wrapped = [1, 2, 3].reduce((view) => pressYearRecordKey(view, '아래', 3), OPEN_YEAR_RECORD_VIEW)
    expect(wrapped.cursor).toBe(0)
    expect(pressYearRecordKey(OPEN_YEAR_RECORD_VIEW, '기타', 3)).toEqual({ ...OPEN_YEAR_RECORD_VIEW, keyPresses: 1 })
  })

  it('윗줄은 커서가 보이는 10줄을 벗어날 때만 옮긴다 (0x6c2bd) — 감아 내려가면 맨 위 · 감아 올라가면 끝 10줄', () => {
    const up = pressYearRecordKey(OPEN_YEAR_RECORD_VIEW, '위', 15)
    expect([up.cursor, up.top]).toEqual([14, 5])
    // 14 → 13 은 보이는 줄 [5, 15) 안이라 윗줄 그대로 (웹 편집기의 "커서 − 9" 가 아니다)
    const inside = pressYearRecordKey(up, '위', 15)
    expect([inside.cursor, inside.top]).toEqual([13, 5])
    const down = pressYearRecordKey(up, '아래', 15)
    expect([down.cursor, down.top]).toEqual([0, 0])
    expect(visibleYearRowCountOf(3)).toBe(3)
  })
})

describe('124 칸 그림 — 0x5c984 · 0x5658c · 0x56ebc · 0x6aff8 · 0xba51c', () => {
  it('번호 열 — num 0x1e + 숫자를 25 칸 가운데 (x += (25 − 합) >> 1)', () => {
    expect(yearNumberGlyphsOf(1)).toEqual([{ frame: 31, x: 10 }])
    expect(yearNumberGlyphsOf(12)).toEqual([{ frame: 31, x: 7 }, { frame: 32, x: 11 }])
  })

  it('넘기는 칸 숫자 — 자릿수 −1 은 오른쪽 자리(x + 24)부터 7 씩 왼쪽으로, 0 도 한 자리', () => {
    expect(yearCellDrawingOf({ value: 0, digits: -1, isDecimal: false })).toEqual({ glyphs: [{ frame: 20, x: 24 }], dots: [] })
    expect(yearCellDrawingOf({ value: 105, digits: -1, isDecimal: false }).glyphs)
      .toEqual([{ frame: 25, x: 24 }, { frame: 20, x: 17 }, { frame: 21, x: 10 }])
  })

  it('소수점 갈래 — 타율 315 는 ".315" · 1000 은 "1.00" · 방어율 3510 은 "3.51" (점은 그 자리 왼쪽 3, 뒤 자리 3 더 밀림)', () => {
    expect(yearCellDrawingOf({ value: 315, digits: 0, isDecimal: true })).toEqual({
      glyphs: [{ frame: 25, x: 24 }, { frame: 21, x: 17 }, { frame: 23, x: 10 }], dots: [{ x: 7, y: 11 }],
    })
    expect(yearCellDrawingOf({ value: 1000, digits: 3, isDecimal: true })).toEqual({
      glyphs: [{ frame: 20, x: 24 }, { frame: 20, x: 17 }, { frame: 21, x: 7 }], dots: [{ x: 14, y: 11 }],
    })
    expect(yearCellDrawingOf({ value: 3510, digits: 3, isDecimal: true }).glyphs.map((glyph) => glyph.frame - 20)).toEqual([1, 5, 3])
  })

  it('머리 글은 (x, 56, 폭, 15) 가운데 — 가로 내림 · 세로 올림', () => {
    expect(yearLabelOffsetOf(25, 20, 10)).toEqual({ x: 2, y: 3 })
    expect(yearLabelOffsetOf(36, 21, 10)).toEqual({ x: 7, y: 3 })
  })

  it('화살 깜빡 · 커서 꼴은 키 수 [+0x40c] % 8 을 본다 (≤ 4 · ≤ 3)', () => {
    const at = (keyPresses: number) => ({ ...OPEN_YEAR_RECORD_VIEW, keyPresses })
    expect([0, 4, 5, 7, 8].map((n) => yearArrowBlinkOf(at(n)))).toEqual([2, 2, 0, 0, 2])
    expect([0, 3, 4, 8].map((n) => yearCursorIsInsetOf(at(n)))).toEqual([true, true, false, true])
  })
})

describe('124 둘째 갈래 — 나리 판 순위 재료', () => {
  it('타자편은 열 팀 명단 차례에 내 선수를 내 팀 끝에 끼우고, 리그 표의 도루(+0x2c)까지 채운다', () => {
    const career = createCareer('선수')
    const records = nariBatterRankingRecordsOf(career)
    expect(records.filter((record) => record.isMine)).toHaveLength(1)
    expect(records.every((record) => record.batterExtra === 0)).toBe(true)
  })
})
