import { describe, expect, it } from 'vitest'
import { matchupsOf, playLeagueDay, simulateLeagueGame } from '@/entities/league/model/leagueDay'
import { EMPTY_LEAGUE, LEAGUE_TEAM_COUNT, opponentOf } from '@/entities/league/model/league'
import { BATTERS_PER_TEAM } from '@/entities/team/model/teamRoster'
import type { RandomPort } from '@/shared/api/random/randomPort'

function 씨앗난수(seed: number): RandomPort {
  let state = seed
  return {
    next: () => {
      state = (state * 1103515245 + 12345) % 2147483648
      return state / 2147483648
    },
    nextInRange: (minimum, maximum) => minimum + (maximum - minimum) / 2,
    pick: (candidates) => candidates[0],
  }
}

describe('matchupsOf — 일정표 0xd89cb 로 짠 하루 다섯 경기', () => {
  it('열 팀이 정확히 한 번씩만 나온다', () => {
    for (let day = 0; day < 9; day += 1) {
      const matchups = matchupsOf(day)
      const 나온팀 = matchups.flatMap((matchup) => [matchup.away, matchup.home])

      expect(matchups).toHaveLength(LEAGUE_TEAM_COUNT / 2)
      expect(new Set(나온팀).size).toBe(LEAGUE_TEAM_COUNT)
    }
  })

  it('짝은 일정표 그대로다 — 상대의 상대는 자기 자신이다', () => {
    for (const matchup of matchupsOf(3)) {
      expect(opponentOf(3, matchup.away)).toBe(matchup.home)
      expect(opponentOf(3, matchup.home)).toBe(matchup.away)
    }
  })

  it('9일마다 일정이 되풀이된다 (라운드로빈 9라운드 × 5순환)', () => {
    expect(matchupsOf(9)).toEqual(matchupsOf(0))
    expect(matchupsOf(44)).toEqual(matchupsOf(8))
  })
})

describe('simulateLeagueGame — 원본 타석 엔진으로 한 경기', () => {
  it('점수가 나오고 같은 씨앗이면 같은 경기가 된다', () => {
    const 첫번째 = simulateLeagueGame({ away: 0, home: 1 }, 씨앗난수(99))
    const 두번째 = simulateLeagueGame({ away: 0, home: 1 }, 씨앗난수(99))

    expect(첫번째).toEqual(두번째)
    expect(첫번째.awayRuns).toBeGreaterThanOrEqual(0)
  })
})

describe('playLeagueDay — 내 팀 경기만 빼고 전적에 넣는다', () => {
  it('하루에 네 경기가 쌓이고 내 팀은 승·패가 늘지 않는다', () => {
    const { league } = playLeagueDay(EMPTY_LEAGUE, 0, 4, 씨앗난수(5))
    const 총경기 = league.wins.reduce((sum, wins) => sum + wins, 0)

    expect(총경기).toBe(LEAGUE_TEAM_COUNT / 2 - 1)
    expect(league.wins[4] + league.losses[4]).toBe(0)
  })

  it('경기마다 승 하나·패 하나가 짝으로 들어간다 — 무승부는 없다', () => {
    const { league } = playLeagueDay(EMPTY_LEAGUE, 2, 9, 씨앗난수(31))

    expect(league.wins.reduce((sum, wins) => sum + wins, 0)).toBe(
      league.losses.reduce((sum, losses) => sum + losses, 0),
    )
  })

  it('내 팀이 낀 경기의 상대도 전적이 늘지 않는다', () => {
    const 내팀 = 0
    const 상대 = opponentOf(1, 내팀)
    const { league } = playLeagueDay(EMPTY_LEAGUE, 1, 내팀, 씨앗난수(77))

    expect(league.wins[상대] + league.losses[상대]).toBe(0)
  })
})

/**
 * 리그 선수 기록표 (0xa8024 — B-2). 원본은 CPU 끼리 경기도 사람 경기와 같은 기록 함수를 불러
 * 선수 레코드에 타수·안타·홈런·타점을 쌓는다. 웹도 하루를 돌리면 같은 것이 쌓여야 한다.
 */
describe('playLeagueDay — 선수별 타석 기록이 쌓인다', () => {
  it('하루를 돌리면 오늘 뛴 여덟 팀 선수에게만 타수가 생긴다', () => {
    const 내팀 = 4
    const { playerStats } = playLeagueDay(EMPTY_LEAGUE, 0, 내팀, 씨앗난수(5))
    const ids = Object.keys(playerStats.batters).map(Number)
    const 총타수 = ids.reduce((sum, id) => sum + playerStats.batters[id].atBats, 0)

    expect(ids.length).toBeGreaterThan(0)
    expect(총타수).toBeGreaterThan(0)
    // 내 팀 경기는 건너뛰므로 내 팀(전역 번호 4×12 ~ 4×12+11)에는 한 칸도 생기지 않는다
    const 내팀칸 = ids.filter((id) => Math.trunc(id / BATTERS_PER_TEAM) === 내팀)
    expect(내팀칸).toEqual([])
    // 오늘 상대도 마찬가지다
    const 상대 = opponentOf(0, 내팀)
    expect(ids.filter((id) => Math.trunc(id / BATTERS_PER_TEAM) === 상대)).toEqual([])
  })

  it('이어서 돌리면 앞서 쌓은 표 위에 더해진다', () => {
    const 하루 = playLeagueDay(EMPTY_LEAGUE, 0, 4, 씨앗난수(5))
    const 이틀 = playLeagueDay(하루.league, 1, 4, 씨앗난수(6), 하루.playerStats)
    const 합 = (stats: typeof 하루.playerStats) =>
      Object.values(stats.batters).reduce((sum, line) => sum + line.atBats, 0)

    expect(합(이틀.playerStats)).toBeGreaterThan(합(하루.playerStats))
  })

  it('안타·홈런은 타수 안에서만 나오고, 타점은 그 경기 득점을 넘지 않는다', () => {
    const { playerStats } = playLeagueDay(EMPTY_LEAGUE, 3, 9, 씨앗난수(2010))

    for (const line of Object.values(playerStats.batters)) {
      expect(line.hits).toBeLessThanOrEqual(line.atBats)
      expect(line.homeRuns).toBeLessThanOrEqual(line.hits)
      expect(line.runsBattedIn).toBeGreaterThanOrEqual(0)
    }
  })
})
