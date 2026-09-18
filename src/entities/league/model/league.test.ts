import { describe, expect, it } from 'vitest'
import {
  EMPTY_LEAGUE,
  advancePostseason,
  opponentOf,
  rankingOf,
  recordLeagueResult,
  startPostseason,
} from '@/entities/league/model/league'

describe('리그 일정 — 표 0xd89cb (9일 라운드로빈)', () => {
  it('일차 mod 9 줄에서 팀의 상대를 고른다', () => {
    expect([0, 1, 4, 8, 9].map((day) => opponentOf(day, 0))).toEqual([1, 2, 5, 9, 1])
    expect(opponentOf(2, 2)).toBe(8)
  })
})

describe('승패 반영 — 0xb76dc · 0xb77e0', () => {
  it('승리는 승·연승·최다 연승·상대 전적, 패배는 패·연패', () => {
    let league = recordLeagueResult(EMPTY_LEAGUE, 0, 1)
    league = recordLeagueResult(league, 0, 2)
    league = recordLeagueResult(league, 3, 0)

    expect([league.wins[0], league.losses[0], league.streak[0], league.bestStreak[0], league.losingStreak[0]]).toEqual([2, 1, 0, 2, 1])
    expect([league.headToHead[0][1], league.headToHead[3][0]]).toEqual([1, 1])
  })
})

describe('순위 — 0xb79d8', () => {
  it('승 많은 순 → 패 적은 순 → 상대 전적', () => {
    let league = EMPTY_LEAGUE
    league = recordLeagueResult(league, 2, 5)
    league = recordLeagueResult(league, 3, 6)
    league = recordLeagueResult(league, 3, 2)
    league = recordLeagueResult(league, 7, 8)
    league = recordLeagueResult(league, 9, 8)
    // 3 은 2승. 2·7·9 는 1승인데 2 는 1패라 뒤로. 7·9 는 0패·상대 전적 0:0 이라 팀 번호 순 (추정)
    expect(rankingOf(league).slice(0, 4)).toEqual([3, 7, 9, 2])
  })
})

describe('포스트시즌 — 0xb80a8 계단식', () => {
  const 순위 = [4, 1, 6, 0, 2, 3, 5, 7, 8, 9]

  it('준PO 3위 vs 4위 5전3선승 → PO 2위 5전3선승 → KS 1위 7전4선승', () => {
    let series = startPostseason(순위)
    expect(series).toMatchObject({ round: '준플레이오프', teams: [6, 0], winsNeeded: 3 })

    for (let game = 0; game < 3; game += 1) series = advancePostseason(series, 0)
    expect(series).toMatchObject({ round: '플레이오프', teams: [1, 0], winsNeeded: 3, wins: [0, 0] })

    for (let game = 0; game < 3; game += 1) series = advancePostseason(series, 1)
    expect(series).toMatchObject({ round: '한국시리즈', teams: [4, 1], winsNeeded: 4 })

    for (let game = 0; game < 4; game += 1) series = advancePostseason(series, 4)
    expect(series).toMatchObject({ round: '종료', champion: 4 })
  })

  it('시리즈 중간에는 승수만 는다', () => {
    const series = advancePostseason(advancePostseason(startPostseason(순위), 6), 0)
    expect(series).toMatchObject({ round: '준플레이오프', wins: [1, 1] })
  })

  it('4위 이내면 진출이다', () => {
    expect(startPostseason(순위).qualifiers).toEqual([4, 1, 6, 0])
  })
})
