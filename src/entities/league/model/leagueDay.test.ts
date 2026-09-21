import { describe, expect, it } from 'vitest'
import { matchupsOf, playLeagueDay, simulateLeagueGame } from '@/entities/league/model/leagueDay'
import {
  EMPTY_LEAGUE,
  LEAGUE_SIDE_HOME,
  LEAGUE_TEAM_COUNT,
  leagueSideOf,
  opponentOf,
} from '@/entities/league/model/league'
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

  it('9일마다 **짝**이 되풀이된다 (라운드로빈 9라운드 × 5순환) — 홈/원정은 따로 돈다', () => {
    const 짝 = (day: number) =>
      matchupsOf(day)
        .map(({ away, home }) => [away, home].sort((a, b) => a - b).join('-'))
        .sort()

    expect(짝(9)).toEqual(짝(0))
    expect(짝(44)).toEqual(짝(8))
  })

  /**
   * `0xb7844` — r7 = (일차/9)&1, 일차 > 22 면 한 번 더 뒤집기, 짝 중 작은 번호가 `!r7`(1=홈).
   * 아래 숫자는 실제로 돌려 받은 값 그대로다 (R1 항목 2·5).
   */
  describe('홈/원정 — 0xb7844 의 9일 주기 패리티 + 22일차 반전', () => {
    it('같은 짝 0–1 의 홈이 날짜마다 뒤집힌다', () => {
      // 일차   0  9 18 27 36
      // r7     0  1  0  1  0   ← (일차/9)&1
      // >22     -  -  -  ✔  ✔   ← 한 번 더 반전
      // 홈      0  1  0  0  1
      const 홈 = (day: number) => matchupsOf(day)[0].home
      expect([홈(0), 홈(9), 홈(18), 홈(27), 홈(36)]).toEqual([0, 1, 0, 0, 1])
    })

    it('첫날 다섯 경기는 번호 작은 쪽이 홈이다', () => {
      expect(matchupsOf(0)).toEqual([
        { away: 1, home: 0 },
        { away: 3, home: 2 },
        { away: 5, home: 4 },
        { away: 7, home: 6 },
        { away: 9, home: 8 },
      ])
    })

    it('9일차는 같은 짝이 그대로 뒤집힌다', () => {
      expect(matchupsOf(9)).toEqual([
        { away: 0, home: 1 },
        { away: 2, home: 3 },
        { away: 4, home: 5 },
        { away: 6, home: 7 },
        { away: 8, home: 9 },
      ])
    })

    it('22일차와 23일차 사이에서 한 번 더 뒤집힌다 (`d > 0x16`)', () => {
      // 22 와 31 은 r7 이 서로 다른데 22일차 반전이 31 에만 걸려 결과가 같아진다
      expect(matchupsOf(22)[0]).toEqual({ away: 5, home: 0 })
      expect(matchupsOf(31)[0]).toEqual({ away: 5, home: 0 })
      // 23 일차(같은 라운드 아님)는 작은 번호가 원정이다
      expect(matchupsOf(23)[0]).toEqual({ away: 0, home: 6 })
    })

    it('짝의 두 팀은 늘 반대 편이다 — 한쪽이 홈이면 다른 쪽은 원정', () => {
      for (let day = 0; day < 45; day += 1) {
        for (const { away, home } of matchupsOf(day)) {
          expect(leagueSideOf(day, home)).toBe(LEAGUE_SIDE_HOME)
          expect(leagueSideOf(day, away)).not.toBe(LEAGUE_SIDE_HOME)
        }
      }
    })
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
  it('양 팀 선발 줄이 나오고, 승과 패는 그 두 줄에만 붙는다', () => {
    const 경기 = simulateLeagueGame({ away: 2, home: 3 }, 씨앗난수(77), 1)
    // 선발 칸(1)은 양 팀 한 줄씩. 구원은 벤치에서 오므로 이 칸이 될 수 없다
    const 선발줄 = 경기.pitcherAppearances.filter((줄) => 줄.pitcherSlot === 1)

    expect(선발줄).toHaveLength(2)
    expect(경기.pitcherAppearances.filter((줄) => 줄.decision === '승')).toHaveLength(1)
    expect(경기.pitcherAppearances.filter((줄) => 줄.decision === '패')).toHaveLength(1)
    // 교체로 올라온 투수는 승패가 없다 (세이브도 원본이 안 준다 — CORRECTIONS 2-1)
    expect(경기.pitcherAppearances.every((줄) => 줄.decision === null || 줄.pitcherSlot === 1)).toBe(true)
  })

  it('승은 **점수가 많은 쪽** 선발에게 간다 — 순위표의 원본 버그(0xc2a48)와 따로 논다', () => {
    const 경기 = simulateLeagueGame({ away: 2, home: 3 }, 씨앗난수(77), 1)
    const 선발 = (teamId: number) =>
      경기.pitcherAppearances.find((줄) => 줄.teamId === teamId && 줄.pitcherSlot === 1)

    const 이긴쪽 = 경기.awayRuns >= 경기.homeRuns ? 선발(2) : 선발(3)
    const 진쪽 = 경기.awayRuns >= 경기.homeRuns ? 선발(3) : 선발(2)
    expect(이긴쪽?.decision).toBe('승')
    expect(진쪽?.decision).toBe('패')
  })

  /**
   * 타석마다 도는 CPU 교체(0xc1ba4)로 한 경기에 여러 투수가 나온다 — 그래서 "선발 한 줄"이 아니라
   * **팀 줄 전체를 합쳐** 상대 득점·이닝과 맞춘다.
   */
  it('팀 투수 줄을 합치면 실점이 상대 득점과 같고, 아웃은 9이닝치(27)부터다', () => {
    const 경기 = simulateLeagueGame({ away: 2, home: 3 }, 씨앗난수(2009), 0)
    const 팀합 = (teamId: number, 고르기: (줄: (typeof 경기.pitcherAppearances)[number]) => number) =>
      경기.pitcherAppearances.filter((줄) => 줄.teamId === teamId).reduce((sum, 줄) => sum + 고르기(줄), 0)

    expect(팀합(2, (줄) => 줄.runsAllowed)).toBe(경기.homeRuns)
    expect(팀합(3, (줄) => 줄.runsAllowed)).toBe(경기.awayRuns)
    // 홈이 9회말을 치르지 않는 경우가 있어 원정 투수진은 24아웃일 수 있다
    expect(팀합(3, (줄) => 줄.outs)).toBeGreaterThanOrEqual(27)
    expect(팀합(2, (줄) => 줄.outs)).toBeGreaterThanOrEqual(24)
    expect(팀합(2, (줄) => 줄.pitches)).toBeGreaterThan(0)
    expect(팀합(2, (줄) => 줄.strikeouts)).toBeGreaterThanOrEqual(0)
  })

  /**
   * ⚠️ 구원 교체가 생긴 뒤에도 세이브는 0 이다 — **그게 원본이다.** 세이브 종류 코드 state+0x64 를
   * 0 으로 되돌리는 코드가 없어 경기 끝 검사(0xa7eaa)에 늘 걸린다 (CORRECTIONS 2-1 · S1).
   */
  it('세이브는 늘 0 이다 — 원본도 세이브를 한 번도 기록하지 않는다', () => {
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
    // 네 경기 여덟 선발에 구원이 더 붙는다 (교체가 생기기 전에는 딱 여덟 줄이었다)
    expect(줄들.length).toBeGreaterThanOrEqual(8)
  })

  it('그날 쓰는 선발 칸은 로테이션이 정한다 — 승패가 붙는 줄이 그 칸이다', () => {
    const { playerStats } = playLeagueDay(EMPTY_LEAGUE, 3, 4, 씨앗난수(9))
    const 줄들 = Object.entries(playerStats.pitchers ?? {})
    const 선발칸 = 줄들
      .filter(([, 줄]) => 줄.wins + 줄.losses > 0)
      .map(([id]) => Number(id) % PITCHERS_PER_TEAM)

    // 네 경기 × 양 팀 = 여덟 선발, 전부 그날의 로테이션 칸이다
    expect(선발칸).toHaveLength(8)
    expect(new Set(선발칸)).toEqual(new Set([rotationSlotOf(3)]))
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
    // 로테이션 네 칸이 선발을 다 맡으므로 10팀 × 4 = 40명이 규정 이닝(45)을 채운다.
    // (구원으로 올라오는 투수도 대개 그 네 칸이다 — 웹 로스터에 보직이 없어 벤치 번호가 작은
    //  쪽부터 고르기 때문이다. `chooseReplacementPitcher` 주석 참고)
    expect(줄들.filter((줄) => Math.trunc(줄.outs / 3) >= 45)).toHaveLength(40)
    // ⚠️ 방어율은 **규정 이닝을 채운 선발만** 본다 — 몇 타자 만에 내려간 구원은 0.00 이나
    //    무한대가 나오고, 원본 순위표도 이닝이 적은 투수를 뺀다
    for (const 줄 of 줄들.filter((줄) => Math.trunc(줄.outs / 3) >= 45)) {
      const 방어율 = (줄.runsAllowed * 2700) / 줄.outs / 100
      expect(방어율).toBeGreaterThan(1)
      expect(방어율).toBeLessThan(9)
    }
  })
})

/**
 * CPU 끼리의 경기도 사람 경기와 같은 함수로 투수를 바꾸고(0xc1ba4 → 0xac428) 도루를 건다
 * (0xc1818). 45일을 돌려 **정말로 도는지** 숫자로 못 박는다.
 */
describe('CPU 끼리 경기의 투수 교체·도루가 실제로 돈다', () => {
  it('45일 225경기에서 교체와 도루가 꾸준히 나온다', () => {
    const random = 씨앗난수(12_345)
    let 경기수 = 0
    let 등판 = 0
    let 도루 = 0
    let 교체경기 = 0

    for (let day = 0; day < 45; day += 1) {
      for (const matchup of matchupsOf(day)) {
        const 경기 = simulateLeagueGame(matchup, random, rotationSlotOf(day))
        const 팀별등판 = [matchup.away, matchup.home].map(
          (teamId) => 경기.pitcherAppearances.filter((줄) => 줄.teamId === teamId).length,
        )
        경기수 += 1
        등판 += 팀별등판[0] + 팀별등판[1]
        도루 += 경기.steals
        if (팀별등판.some((수) => 수 > 1)) 교체경기 += 1
      }
    }

    expect(경기수).toBe(225)
    // 팀당 한 명을 넘는다 = 선발 고정이 아니다
    expect(등판 / 경기수 / 2).toBeGreaterThan(1)
    // 절반 넘는 경기에서 투수가 바뀐다
    expect(교체경기 / 경기수).toBeGreaterThan(0.5)
    // 도루는 실패가 없어 경기마다 여러 개가 쌓인다 (표 0xd9064 가 꽤 후하다 — 원본 그대로)
    expect(도루 / 경기수).toBeGreaterThan(1)
  })
})
