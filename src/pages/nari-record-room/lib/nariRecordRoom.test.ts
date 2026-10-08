import { describe, expect, it } from 'vitest'
import { createCareer } from '@/entities/career/model/playerCareer'
import { EMPTY_SEASON_STATS } from '@/entities/career/model/seasonStats'
import { EMPTY_PITCHER_SEASON_STATS, createPitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import {
  BATTER_YEAR_COLUMNS, OPEN_YEAR_RECORD_VIEW, PITCHER_YEAR_COLUMNS, advanceYearSlide, batterYearCellTextOf, batterYearRowsOf,
  nariBatterRankingRecordsOf, pitcherYearCellTextOf, pitcherYearRowsOf, pressYearRecordKey, yearSlideOffsetOf,
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

  it('미는 동안은 키를 통째로 건너뛴다 (0x5587c) · 위아래는 끝에서 멈춘다', () => {
    const sliding = pressYearRecordKey(OPEN_YEAR_RECORD_VIEW, '오른', 3)
    expect(pressYearRecordKey(sliding, '아래', 3)).toBe(sliding)
    expect(pressYearRecordKey(OPEN_YEAR_RECORD_VIEW, '위', 3).cursor).toBe(0)
    const bottom = pressYearRecordKey(pressYearRecordKey(pressYearRecordKey(OPEN_YEAR_RECORD_VIEW, '아래', 3), '아래', 3), '아래', 3)
    expect(bottom.cursor).toBe(2)
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
