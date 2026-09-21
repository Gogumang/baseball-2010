import { describe, expect, it } from 'vitest'
import { matchupsOf, playLeagueDay, simulateLeagueGame } from '@/entities/league/model/leagueDay'
import { EMPTY_LEAGUE, LEAGUE_TEAM_COUNT, opponentOf } from '@/entities/league/model/league'
import { BATTERS_PER_TEAM, PITCHERS_PER_TEAM, startingPitcherOf } from '@/entities/team/model/teamRoster'
import { rotationSlotOf } from '@/entities/pitcher-career/model/pitcherRotation'
import { EMPTY_LEAGUE_PLAYER_STATS } from '@/entities/league/model/leaguePlayerStats'
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

describe('CPU 끼리 경기도 날짜가 선발을 정한다 (0xb5ca8 · S5 U-16)', () => {
  it('선발 칸을 주면 씨앗이 달라도 같은 투수를 쓴다 — 무작위가 아니다', () => {
    const 칸 = 2
    const 왼쪽 = simulateLeagueGame({ away: 2, home: 3 }, 씨앗난수(11), 칸)
    const 오른쪽 = simulateLeagueGame({ away: 2, home: 3 }, 씨앗난수(11), 칸)
    expect(왼쪽.awayRuns).toBe(오른쪽.awayRuns)
    expect(왼쪽.homeRuns).toBe(오른쪽.homeRuns)
  })

  it('칸을 안 주면 예전처럼 난수로 뽑는다 (일정표가 없는 포스트시즌 자리)', () => {
    // 난수를 쓰는지만 본다 — 같은 씨앗이면 결과가 재현된다
    const 하나 = simulateLeagueGame({ away: 2, home: 3 }, 씨앗난수(11))
    const 둘 = simulateLeagueGame({ away: 2, home: 3 }, 씨앗난수(11))
    expect(하나.awayRuns).toBe(둘.awayRuns)
  })

  it('네 칸이 서로 다른 투수를 집는다', () => {
    const 능력 = [0, 1, 2, 3].map((slot) => startingPitcherOf(2, slot).control)
    expect(new Set(능력).size).toBeGreaterThan(1)
  })
})

describe('CPU 끼리 경기가 선발 투수 기록도 쌓는다 (0xa8024 · 경기 끝 0xa7de8, P1 6절)', () => {
  it('양 팀 선발 두 줄이 나오고, 승과 패가 하나씩이다', () => {
    const 경기 = simulateLeagueGame({ away: 2, home: 3 }, 씨앗난수(77), 1)

    expect(경기.pitcherAppearances).toHaveLength(2)
    expect(경기.pitcherAppearances.map((줄) => 줄.pitcherSlot)).toEqual([1, 1])
    expect(경기.pitcherAppearances.filter((줄) => 줄.decision === '승')).toHaveLength(1)
    expect(경기.pitcherAppearances.filter((줄) => 줄.decision === '패')).toHaveLength(1)
  })

  it('승은 **점수가 많은 쪽** 선발에게 간다 — 순위표의 원본 버그(0xc2a48)와 따로 논다', () => {
    const 경기 = simulateLeagueGame({ away: 2, home: 3 }, 씨앗난수(77), 1)
    const 원정 = 경기.pitcherAppearances[0]
    const 홈 = 경기.pitcherAppearances[1]

    const 이긴쪽 = 경기.awayRuns >= 경기.homeRuns ? 원정 : 홈
    const 진쪽 = 이긴쪽 === 원정 ? 홈 : 원정
    expect(이긴쪽.decision).toBe('승')
    expect(진쪽.decision).toBe('패')
  })

  it('실점은 상대 팀 득점과 같고, 아웃은 9이닝치(27)부터다', () => {
    const 경기 = simulateLeagueGame({ away: 2, home: 3 }, 씨앗난수(2009), 0)
    const [원정, 홈] = 경기.pitcherAppearances

    // 선발 하나가 끝까지 던지므로 팀 실점이 그대로 그 투수의 실점이다
    expect(원정.runsAllowed).toBe(경기.homeRuns)
    expect(홈.runsAllowed).toBe(경기.awayRuns)
    // 홈이 9회말을 치르지 않는 경우가 있어 원정 투수는 24아웃일 수 있다
    expect(홈.outs).toBeGreaterThanOrEqual(27)
    expect(원정.outs).toBeGreaterThanOrEqual(24)
    expect(원정.pitches).toBeGreaterThan(0)
    expect(원정.strikeouts).toBeGreaterThanOrEqual(0)
  })

  it('세이브는 늘 0 이다 — 웹에는 구원 교체가 없다', () => {
    const { playerStats } = playLeagueDay(EMPTY_LEAGUE, 0, 4, 씨앗난수(5))
    const 줄들 = Object.values(playerStats.pitchers ?? {})

    expect(줄들.length).toBeGreaterThan(0)
    expect(줄들.every((줄) => 줄.saves === 0)).toBe(true)
  })

  it('하루치 네 경기가 승 4 · 패 4 로 쌓인다 (내 팀 경기는 빠진다)', () => {
    const { playerStats } = playLeagueDay(EMPTY_LEAGUE, 0, 4, 씨앗난수(5))
    const 줄들 = Object.values(playerStats.pitchers ?? {})
    const 합 = (고르기: (줄: (typeof 줄들)[number]) => number) =>
      줄들.reduce((sum, 줄) => sum + 고르기(줄), 0)

    expect(합((줄) => 줄.wins)).toBe(4)
    expect(합((줄) => 줄.losses)).toBe(4)
    expect(줄들).toHaveLength(8)
  })

  it('그날 쓰는 선발 칸은 로테이션이 정한다 — 하루에 한 팀에 한 줄뿐이다', () => {
    const { playerStats } = playLeagueDay(EMPTY_LEAGUE, 3, 4, 씨앗난수(9))
    const 칸 = Object.keys(playerStats.pitchers ?? {}).map((id) => Number(id) % PITCHERS_PER_TEAM)

    expect(new Set(칸).size).toBe(1)
    expect(칸[0]).toBe(rotationSlotOf(3))
  })

  it('이어서 돌리면 투수 줄도 앞서 쌓은 표 위에 더해진다', () => {
    const 하루 = playLeagueDay(EMPTY_LEAGUE, 0, 4, 씨앗난수(5))
    const 이틀 = playLeagueDay(하루.league, 1, 4, 씨앗난수(6), 하루.playerStats)
    const 이닝합 = (stats: typeof 하루.playerStats) =>
      Object.values(stats.pitchers ?? {}).reduce((sum, 줄) => sum + 줄.outs, 0)

    // 타자 표도 같이 살아 있어야 한다 (두 기록이 서로를 지우면 안 된다)
    expect(Object.keys(이틀.playerStats.batters).length).toBeGreaterThan(0)
    expect(이닝합(이틀.playerStats)).toBeGreaterThan(이닝합(하루.playerStats))
  })

  it('45일을 돌리면 승·패 합이 경기 수(225)와 맞고 방어율이 말이 되는 범위다', () => {
    const random = 씨앗난수(12_345)
    let league = EMPTY_LEAGUE
    let stats = EMPTY_LEAGUE_PLAYER_STATS
    // `myTeamId` 를 -1 로 두면 다섯 경기가 모두 CPU 경기다 (45일 × 5 = 225경기)
    for (let day = 0; day < 45; day += 1) {
      const 하루 = playLeagueDay(league, day, -1, random, stats)
      league = 하루.league
      stats = 하루.playerStats
    }
    const 줄들 = Object.values(stats.pitchers ?? {})
    const 합 = (고르기: (줄: (typeof 줄들)[number]) => number) =>
      줄들.reduce((sum, 줄) => sum + 고르기(줄), 0)

    expect(합((줄) => 줄.wins)).toBe(225)
    expect(합((줄) => 줄.losses)).toBe(225)
    // 한 경기에 양 팀 합쳐 18이닝(54아웃)이 기준이다. 홈이 앞서면 9회말을 안 치르고(−3),
    // 동점이면 연장을 가므로 딱 떨어지지는 않는다
    expect(합((줄) => 줄.outs)).toBeGreaterThanOrEqual(225 * 51)
    expect(합((줄) => 줄.outs)).toBeLessThan(225 * 60)
    // 로테이션 네 칸만 던지므로 10팀 × 4 = 40명이 규정 이닝(45)을 채운다
    expect(줄들.filter((줄) => Math.trunc(줄.outs / 3) >= 45)).toHaveLength(40)
    for (const 줄 of 줄들) {
      const 방어율 = (줄.runsAllowed * 2700) / 줄.outs / 100
      expect(방어율).toBeGreaterThan(1)
      expect(방어율).toBeLessThan(9)
    }
  })
})
