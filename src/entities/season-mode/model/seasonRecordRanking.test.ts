import { describe, expect, it } from 'vitest'
import { EMPTY_LEAGUE_RECORD } from '@/entities/awards/model/leaderboard'
import type { LeagueRecord } from '@/entities/awards/model/leaderboard'
import {
  BATTER_RANKING_CATEGORIES, PITCHER_RANKING_CATEGORIES, moveRankingPage, originalDecimalTextOf, rankSeasonRecords,
  seasonQualificationOf, seasonRankingValueTextOf,
} from '@/entities/season-mode/model/seasonRecordRanking'

const 줄 = (덮어쓰기: Partial<LeagueRecord>): LeagueRecord => ({ ...EMPTY_LEAGUE_RECORD, ...덮어쓰기 })

describe('기록순위 0xdb — 종류표 0xd1a4c · 0xd1a60 와 쪽 옮기기 0x5787c', () => {
  it('타자 [12 타율, 8 안타, 9 홈런, 10 도루, 11 타점] · 투수 [4 방어율, 1 승, 2 패, 3 세이브, 5 실점, 6 삼진]', () => {
    expect(BATTER_RANKING_CATEGORIES.map((category) => category.kind)).toEqual([12, 8, 9, 10, 11])
    expect(PITCHER_RANKING_CATEGORIES.map((category) => category.kind)).toEqual([4, 1, 2, 3, 5, 6])
  })

  it('끝에서 감기지 않는다 — 타자 마지막 쪽 4 · 투수 5', () => {
    expect(moveRankingPage('타자', 0, -1)).toBe(0)
    expect(moveRankingPage('타자', 4, 1)).toBe(4)
    expect(moveRankingPage('투수', 4, 1)).toBe(5)
    expect(moveRankingPage('투수', 2, -1)).toBe(1)
  })
})

describe('순위 객체 0x9d789 (다섯째 인자 0)', () => {
  it('규정 문턱 = 경기 수 g 로 — 타수 trunc((23g + 9) / 10) · 이닝 g', () => {
    expect(seasonQualificationOf(10)).toEqual({ atBats: 23, innings: 10 })
    expect(seasonQualificationOf(0)).toEqual({ atBats: 0, innings: 0 })
  })

  it('타율은 규정 타수가 안 되면 빠지고, 같은 값이면 먼저 들어온 줄이 앞', () => {
    const records = [
      줄({ name: 'A', atBatsOrOuts: 20, hits: 10 }), // 22.3 타수 미달
      줄({ name: 'B', atBatsOrOuts: 30, hits: 9 }),
      줄({ name: 'C', atBatsOrOuts: 30, hits: 9 }),
      줄({ name: 'D', atBatsOrOuts: 40, hits: 16 }),
    ]
    expect(rankSeasonRecords(records, 12, 10).map((entry) => entry.record.name)).toEqual(['D', 'B', 'C'])
  })

  it('방어율만 작은 쪽이 앞 · 아웃 0 인 줄은 빠진다 · 실점(5)은 +0x22', () => {
    const records = [
      줄({ name: 'A', atBatsOrOuts: 30, earnedRuns: 5, hits: 5 }),
      줄({ name: 'B', atBatsOrOuts: 30, earnedRuns: 2, hits: 2 }),
      줄({ name: 'C', atBatsOrOuts: 0, earnedRuns: 0, hits: 9 }),
    ]
    expect(rankSeasonRecords(records, 4, 10).map((entry) => entry.record.name)).toEqual(['B', 'A'])
    expect(rankSeasonRecords(records, 5, 10).map((entry) => entry.record.name)).toEqual(['A', 'B'])
  })

  it('상위 10명만', () => {
    const records = Array.from({ length: 15 }, (_unused, index) => 줄({ name: String(index), atBatsOrOuts: 3, wins: index }))
    const ranked = rankSeasonRecords(records, 1, 10)
    expect(ranked).toHaveLength(10)
    expect(ranked[0].value).toBe(14)
  })
})

describe('숫자 찍기 0x6aff8 소수 갈래', () => {
  it('타율 · 방어율 글', () => {
    expect(seasonRankingValueTextOf(12, 315)).toBe('.315')
    expect(seasonRankingValueTextOf(12, 1000)).toBe('1.00')
    expect(seasonRankingValueTextOf(4, 345)).toBe('3.45')
    expect(seasonRankingValueTextOf(4, 50)).toBe('0.50')
    expect(seasonRankingValueTextOf(4, 1234)).toBe('12.3')
    expect(seasonRankingValueTextOf(9, 12)).toBe('12')
    expect(originalDecimalTextOf(7, 0)).toBe('.007')
  })
})
