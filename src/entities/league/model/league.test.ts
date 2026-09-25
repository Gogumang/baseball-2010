import { describe, expect, it } from 'vitest'
import {
  EMPTY_LEAGUE,
  advancePostseason,
  leagueSideOf,
  opponentOf,
  postseasonSideOf,
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

describe('leagueSideOf — 홈/원정 배정 (0xb7844, R1 1절)', () => {
  it('짝을 이룬 두 팀은 늘 반대 값이다', () => {
    for (let day = 0; day < 45; day += 1) {
      for (let team = 0; team < 10; team += 1) {
        expect(leagueSideOf(day, team)).toBe(1 - leagueSideOf(day, opponentOf(day, team)))
      }
    }
  })

  it('9일 주기가 한 바퀴 돌 때마다 뒤집힌다', () => {
    expect(leagueSideOf(0, 0)).toBe(1 - leagueSideOf(9, 0))
    expect(leagueSideOf(0, 0)).toBe(leagueSideOf(18, 0))
  })

  it('23일째부터 한 번 더 뒤집는다 (`d > 0x16`)', () => {
    // 22 와 31 은 같은 요일(주기 위치)인데 22 는 뒤집기 전, 31 은 뒤집은 뒤다
    expect(leagueSideOf(22, 0)).toBe(1 - leagueSideOf(22 + 18, 0))
  })

  it('짝 중 번호가 큰 쪽이 r7 을 받는다 — 첫날은 번호 큰 쪽이 원정이다', () => {
    const 상대 = opponentOf(0, 0)
    const 큰쪽 = Math.max(0, 상대)

    expect(leagueSideOf(0, 큰쪽)).toBe(0)
  })
})

describe('postseasonSideOf — 포스트시즌 홈/원정 (0xb7844 의 리그+0x34 가지)', () => {
  const 순위 = [4, 1, 6, 0, 2, 3, 5, 7, 8, 9]

  it('윗 시드(대진 칸 0)가 홈, 아랫 시드가 원정이다', () => {
    const 준PO = startPostseason(순위)

    expect(준PO.teams).toEqual([6, 0])
    expect(postseasonSideOf(준PO, 6)).toBe(1)
    expect(postseasonSideOf(준PO, 0)).toBe(0)
  })

  it('시리즈 몇 차전인지에 따라 홈이 돌지 않는다 — 원본에 그 규칙이 없다', () => {
    let series = startPostseason(순위)
    const 첫판 = postseasonSideOf(series, series.teams[0])
    series = advancePostseason(series, 6)
    series = advancePostseason(series, 0)

    expect(series.round).toBe('준플레이오프')
    expect(postseasonSideOf(series, series.teams[0])).toBe(첫판)
  })

  it('올라온 팀은 다음 라운드에서 아랫 시드(원정)가 된다 (0xb7724 가 칸 1 에 넣는다)', () => {
    let series = startPostseason(순위)
    for (let game = 0; game < 3; game += 1) series = advancePostseason(series, 0)

    expect(series).toMatchObject({ round: '플레이오프', teams: [1, 0] })
    expect(postseasonSideOf(series, 0)).toBe(0)
    expect(postseasonSideOf(series, 1)).toBe(1)
  })
})
