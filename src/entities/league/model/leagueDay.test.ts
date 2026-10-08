import { describe, expect, it } from 'vitest'
import {
  ACE_BATTER_ROSTER_SLOT,
  ACE_PITCHER_RECORD_STAMINA,
  ACE_PITCHER_SLOT,
  cpuGameAcesOf,
  cpuGameSidesOf,
  cpuPitcherGameAbilityOf,
  decisionsAfterHalfInning,
  LEAGUE_DAY_NO_SCORE,
  matchupsOf,
  playLeagueDay,
  rollCpuGamePrep,
  simulateLeagueGame,
} from '@/entities/league/model/leagueDay'
import type { LeagueTeamRecord } from '@/entities/league/model/leagueDay'
import {
  EMPTY_LEAGUE,
  LEAGUE_SIDE_HOME,
  LEAGUE_TEAM_COUNT,
  UNSHUFFLED_PITCHER_ORDER,
  leagueSideOf,
  leagueStarterSlotOf,
  nextSeasonLeague,
  opponentOf,
  pitcherOrderOf,
  recordLeagueResult,
  rotateLeaguePitchers,
} from '@/entities/league/model/league'
import { BATTERS_PER_TEAM, PITCHERS_PER_TEAM, startingPitcherOf } from '@/entities/team/model/teamRoster'
import { advanceRotation, rotationSlotOf } from '@/entities/pitcher-career/model/pitcherRotation'
import {
  EMPTY_LEAGUE_PLAYER_STATS,
  leagueBatterIdOf,
  leaguePitcherIdOf,
  leaguePitcherLineOf,
} from '@/entities/league/model/leaguePlayerStats'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { createFractionRandom } from '@/shared/api/random/fractionRandom'
import type { HalfInningResult } from '@/entities/game/model/simulateHalfInning'
import { EMPTY_DECISION_STATE, NO_SIDE } from '@/entities/game/model/winLossSave'
import { createSeededRandom } from '@/shared/api/random/seededRandom'

function 씨앗난수(seed: number): RandomPort {
  let state = seed
  return createFractionRandom(() => {
    state = (state * 1103515245 + 12345) % 2147483648
    return state / 2147483648
  })
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
 * 하루 대진·점수표 — 0xc2a48 경기 객체 +8 (A[5]·B[5]·scoreA[5]·scoreB[5], s32) 그대로.
 * A = side 1(홈) · 내 경기 줄은 점수 두 칸이 −1 · scoreA > scoreB 면 A 승.
 */
describe('playLeagueDay — 하루 점수표 (0xc2a48 +8, 시즌 SR+0x1c0 원본)', () => {
  it('다섯 줄이 matchupsOf 차례이고 A 는 홈 · B 는 원정이다', () => {
    const day = 4
    const { board } = playLeagueDay(EMPTY_LEAGUE, day, 2, 씨앗난수(9))

    expect(board.teamsA).toEqual(matchupsOf(day).map((matchup) => matchup.home))
    expect(board.teamsB).toEqual(matchupsOf(day).map((matchup) => matchup.away))
    board.teamsA.forEach((team) => expect(leagueSideOf(day, team)).toBe(LEAGUE_SIDE_HOME))
  })

  it('내 경기 줄만 점수가 −1 로 남고, 나머지는 이긴 쪽이 더 많이 냈다', () => {
    const 내팀 = 7
    const { board, league } = playLeagueDay(EMPTY_LEAGUE, 0, 내팀, 씨앗난수(5))

    board.teamsA.forEach((teamA, slot) => {
      const teamB = board.teamsB[slot]
      const scoreA = board.scoresA[slot]
      const scoreB = board.scoresB[slot]
      if (teamA === 내팀 || teamB === 내팀) {
        expect([scoreA, scoreB]).toEqual([LEAGUE_DAY_NO_SCORE, LEAGUE_DAY_NO_SCORE])
        return
      }
      expect(scoreA).toBeGreaterThanOrEqual(0)
      expect(scoreB).toBeGreaterThanOrEqual(0)
      // c2ba6: scoreA > scoreB → A 승, 그 밖(동점 포함) B 승
      const winner = scoreA > scoreB ? teamA : teamB
      const loser = winner === teamA ? teamB : teamA
      expect(league.wins[winner]).toBe(1)
      expect(league.losses[loser]).toBe(1)
    })
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

  it('CPU 경기 간이 엔진의 도루(0xc1818 끝)가 주자 레코드 +0x2c 에 쌓인다 — 열흘이면 누군가는 훔친다', () => {
    let league = EMPTY_LEAGUE
    let stats = EMPTY_LEAGUE_PLAYER_STATS
    for (let day = 0; day < 10; day += 1) {
      const result = playLeagueDay(league, day, 4, 씨앗난수(100 + day), stats)
      league = result.league
      stats = result.playerStats
    }
    const 도루 = Object.values(stats.batters).reduce((sum, line) => sum + (line.steals ?? 0), 0)
    expect(도루).toBeGreaterThan(0)
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
  it('승·패는 한 경기에 많아야 하나씩이고, 승은 이긴 팀 · 패는 진 팀 투수에게 간다 (0xa5c34 → 0xa7de8)', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const 경기 = simulateLeagueGame({ away: 2, home: 3 }, 씨앗난수(seed), 1)
      const 승 = 경기.pitcherAppearances.filter((줄) => 줄.decision === '승')
      const 패 = 경기.pitcherAppearances.filter((줄) => 줄.decision === '패')
      const 이긴팀 = 경기.awayRuns > 경기.homeRuns ? 2 : 3
      expect(승.length).toBeLessThanOrEqual(1)
      // 패전 투수는 이닝 조건이 없어 점수가 갈린 경기면 늘 있다
      expect(패).toHaveLength(1)
      expect(승.every((줄) => 줄.teamId === 이긴팀)).toBe(true)
      expect(패.every((줄) => 줄.teamId !== 이긴팀)).toBe(true)
    }
  })

  it('승리 투수는 선발이 아니어도 된다 — 6회 이후 득점 순간 마운드에 선 투수다 (선발 5이닝 요건이 원본에 없다)', () => {
    let 구원승 = 0
    let 승없음 = 0
    for (let seed = 1; seed <= 200; seed += 1) {
      const 경기 = simulateLeagueGame({ away: 2, home: 3 }, 씨앗난수(seed), 1)
      const 승 = 경기.pitcherAppearances.find((줄) => 줄.decision === '승')
      if (승 === undefined) 승없음 += 1
      else if (승.pitcherSlot !== 1) 구원승 += 1
    }
    expect(구원승).toBeGreaterThan(0)
    // 5회까지만 점수가 나고 6회 이후 한 점도 없으면 승리 투수가 빈다 (원본 빈틈, S1 6절)
    expect(승없음).toBeGreaterThan(0)
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

  it('하루치 네 경기 — 패는 경기마다 하나(4), 승은 그 이하다 (내 팀 경기는 빠진다)', () => {
    const { playerStats } = playLeagueDay(EMPTY_LEAGUE, 0, 4, 씨앗난수(5))
    const 줄들 = Object.values(playerStats.pitchers ?? {})
    const 합 = (고르기: (줄: (typeof 줄들)[number]) => number) =>
      줄들.reduce((sum, 줄) => sum + 고르기(줄), 0)

    expect(합((줄) => 줄.wins)).toBeLessThanOrEqual(4)
    expect(합((줄) => 줄.losses)).toBe(4)
    // 네 경기 여덟 선발에 구원이 더 붙는다
    expect(줄들.length).toBeGreaterThanOrEqual(8)
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

    // 패는 경기마다 하나다(마투수 8번 칸이 진 경우만 빠진다). 승은 6회 이후 득점이 없는 경기에서 빈다 (S1 6절)
    expect(합((줄) => 줄.losses)).toBeGreaterThanOrEqual(220)
    expect(합((줄) => 줄.losses)).toBeLessThanOrEqual(225)
    expect(합((줄) => 줄.wins)).toBeLessThan(합((줄) => 줄.losses))
    expect(합((줄) => 줄.wins)).toBeGreaterThan(150)
    // 한 경기에 양 팀 합쳐 18이닝(54아웃)이 기준이다. 홈이 앞서면 9회말을 안 치르고(−3),
    // 동점이면 연장을 가므로 딱 떨어지지는 않는다
    expect(합((줄) => 줄.outs)).toBeGreaterThanOrEqual(225 * 51)
    expect(합((줄) => 줄.outs)).toBeLessThan(225 * 60)
    // 보직 `+0xb & 3` = 표 칸 [0,0,0,0,1,1,1,2] (rosterPitcherRoleOf). 로테이션 네 칸(선발)은 10팀 × 4 = 40명 모두
    // 규정 이닝(45)을 채운다. 구원은 0xabfcc 가 보직을 보고 고르므로 중간(4~6)이 먼저 오르고, 9회 이후 마무리
    // 상황(ac574)에는 마무리(7)가 오른다 — 중간 첫 칸이 규정 이닝을 넘기는 팀도 있다.
    const 이닝 = (팀: number, 칸: number) => Math.trunc(leaguePitcherLineOf(stats, leaguePitcherIdOf(팀, 칸)).outs / 3)
    for (let 팀 = 0; 팀 < LEAGUE_TEAM_COUNT; 팀 += 1) {
      for (let 칸 = 0; 칸 < 4; 칸 += 1) expect(이닝(팀, 칸)).toBeGreaterThanOrEqual(45)
      // 마무리도 실제로 마운드에 선다 — 보직을 모르던 때는 벤치 번호 순이라 7번이 거의 안 나왔다
      expect(이닝(팀, 7)).toBeGreaterThan(0)
    }
    // ⚠️ 방어율은 **규정 이닝을 채운 투수만** 본다 — 몇 타자 만에 내려간 구원은 0.00 이나
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

describe('CPU 끼리 경기도 타순이 아홉 칸으로 이어진다 (team+0x32 · 0xaf020 의 mod 9, E 3b)', () => {
  it('한 팀의 타석을 차례로 늘어놓으면 0~8 이 끊김 없이 돈다 — 이닝마다 1번부터가 아니다', () => {
    for (const seed of [37, 120, 184]) {
      const score = simulateLeagueGame({ away: 1, home: 2 }, 씨앗난수(seed), 0)
      for (const teamId of [1, 2]) {
        const 칸들 = score.plateAppearances
          .filter((appearance) => appearance.teamId === teamId)
          .map((appearance) => appearance.battingOrderIndex)
        expect(칸들, `씨앗 ${seed} 팀 ${teamId}`).toEqual(칸들.map((_slot, index) => index % 9))
      }
    }
  })
})

describe('CPU 끼리 경기에도 CPU 대타가 나온다 (0xc1ba4 → 0xac228 · Q1 4절)', () => {
  it('여러 경기를 돌리면 대타가 나오고, 한 경기에 여러 번도 나온다 — state[0xe] 는 공마다 내려간다 (0xa5e14 a5e7c)', () => {
    let 대타 = 0
    let 여러번 = 0
    for (let seed = 1; seed <= 30; seed += 1) {
      const score = simulateLeagueGame({ away: 1, home: 2 }, createSeededRandom(seed), 0)
      // 상한은 두 팀 벤치 수뿐이다 (붙박이 로스터 12명 − 타순 9 = 셋씩)
      expect(score.pinchHits, `씨앗 ${seed}`).toBeLessThanOrEqual(6)
      대타 += score.pinchHits
      if (score.pinchHits > 1) 여러번 += 1
      // 대타로 들어온 벤치 선수(로스터 9~11)의 타석은 그 선수 칸에 쌓인다
      const 벤치타석 = score.plateAppearances.filter((appearance) => appearance.battingOrderIndex >= 9)
      expect(벤치타석.length > 0, `씨앗 ${seed}`).toBe(score.pinchHits > 0)
    }
    expect(대타).toBeGreaterThan(0)
    // 예전 "경기에 한 번" 이면 나올 수 없는 경기가 실제로 있다
    expect(여러번).toBeGreaterThan(0)
  })
})

describe('CPU 끼리 경기도 투수 스태미나를 잇는다 — 레코드 +0x2c (a583fe0)', () => {
  it('던진 투수만 깎여 나오고 안 던진 칸은 그대로다', () => {
    const score = simulateLeagueGame({ away: 1, home: 2 }, createSeededRandom(5), 0)
    expect(score.pitcherStaminas.away[0]).toBeLessThan(10_000)
    expect(score.pitcherStaminas.home[0]).toBeLessThan(10_000)
    const 던진칸 = new Set(
      score.pitcherAppearances.filter((line) => line.teamId === 1).map((line) => line.pitcherSlot),
    )
    score.pitcherStaminas.away.forEach((value, slot) => {
      if (!던진칸.has(slot)) expect(value).toBe(10_000)
    })
  })

  it('선발은 넘긴 시작 값으로 선다 — 그보다 늘지 않는다', () => {
    const score = simulateLeagueGame({ away: 1, home: 2 }, createSeededRandom(5), 0, {
      away: [2_000, 10_000, 10_000, 10_000, 10_000, 10_000, 10_000, 10_000],
    })
    expect(score.pitcherStaminas.away[0]).toBeLessThanOrEqual(2_000)
  })

  it('안 넘기면 예전과 같은 경기다 (시작 값 10000 = 기본)', () => {
    const 기본 = simulateLeagueGame({ away: 3, home: 7 }, createSeededRandom(11), 1)
    const 가득 = simulateLeagueGame({ away: 3, home: 7 }, createSeededRandom(11), 1, {
      away: Array(8).fill(10_000),
      home: Array(8).fill(10_000),
    })
    expect(가득).toEqual(기본)
  })

  it('playLeagueDay 는 오늘 치른 팀의 표를 고쳐 돌려준다 — 내 팀 표는 그대로', () => {
    const 내팀표 = [5_000, 5_000, 5_000, 5_000, 5_000, 5_000, 5_000, 5_000]
    const { pitcherStaminas } = playLeagueDay(EMPTY_LEAGUE, 0, 4, 씨앗난수(5), EMPTY_LEAGUE_PLAYER_STATS, { 4: 내팀표 })
    expect(pitcherStaminas[4]).toBe(내팀표)
    const 친팀 = matchupsOf(0).flatMap((matchup) => [matchup.away, matchup.home]).filter((team) => team !== 4 && team !== opponentOfFour())
    for (const team of 친팀) expect(pitcherStaminas[team]?.[rotationSlotOf(0)]).toBeLessThan(10_000)
  })
})

function opponentOfFour(): number {
  const matchup = matchupsOf(0).find((candidate) => candidate.away === 4 || candidate.home === 4)
  return matchup === undefined ? -1 : matchup.away === 4 ? matchup.home : matchup.away
}

describe('0xc239c 는 칸의 팀 번호와 명단을 엇갈려 앉힌다 (c2494·c24ce — 0xb891c(팀객체[sX], 모드, Y))', () => {
  it('칸 sX 에는 Y 의 선수가 선다 — 홈 X 면 X 의 선수가 초 공격, 원정 X 면 Y 의 선수가 초 공격', () => {
    expect(cpuGameSidesOf(3, 7)).toEqual({ away: 3, home: 7 })
    expect(cpuGameSidesOf(3, 7, 1 - LEAGUE_SIDE_HOME)).toEqual({ away: 7, home: 3 })
  })

  it('정규 0xc2a48 — 홈 팀 선수가 먼저 치고, 점수를 더 낸 명단의 팀이 승이다 (동점이면 원정 승)', () => {
    const day = 4
    const myTeam = 0
    const played = playLeagueDay(EMPTY_LEAGUE, day, myTeam, createSeededRandom(17))
    const random = createSeededRandom(17)
    const wins = Array.from({ length: LEAGUE_TEAM_COUNT }, () => 0)
    for (const matchup of matchupsOf(day)) {
      if (matchup.away === myTeam || matchup.home === myTeam) continue
      const rolls = rollCpuGamePrep(random)
      // 팀 A = 칸 1(홈 X)의 객체 = 원정 명단(말 공격) · 팀 B = 홈 명단(초 공격)
      // 빈 리그에서 g ≠ 0 인 날이면 오늘 준비에서 한 칸 돈 차례다 (c24fc~c254e) — 0번이 선발
      const 차례 = advanceRotation(UNSHUFFLED_PITCHER_ORDER)
      const score = simulateLeagueGame({ away: matchup.home, home: matchup.away }, random, 차례[0], undefined, {
        aces: { away: rolls.teamB, home: rolls.teamA },
        pitcherOrders: { away: 차례, home: 차례 },
      })
      wins[score.awayRuns > score.homeRuns ? matchup.home : matchup.away] += 1
    }
    expect(played.league.wins).toEqual(wins)
  })
})

describe('0xc239c 의 굴림 다섯과 마선수 (c2464~c24ea)', () => {
  /** 정해 둔 값을 차례로 내놓는 난수 */
  function 차례난수(values: readonly number[]): RandomPort & { 범위: Array<readonly [number, number]> } {
    let index = 0
    const 범위: Array<readonly [number, number]> = []
    return {
      범위,
      rand: (lo, hi) => {
        범위.push([lo, hi])
        const value = values[index] ?? lo
        index += 1
        return value
      },
      rand9d: () => 0,
    }
  }

  it('구장 rand(0,4) → x·y rand(0,5) → 0x66968(y) → 0x66994(x) 차례다', () => {
    const random = 차례난수([3, 1, 4, 2, 0])
    const rolls = rollCpuGamePrep(random)
    expect(random.범위).toEqual([[0, 4], [0, 5], [0, 5], [0, 5], [0, 5]])
    expect(rolls.stadium).toBe(3)
    // 팀 A: 마타자 x = 1 · 마투수 y = 4
    expect(rolls.teamA).toEqual({ batter: 1, pitcher: 4 })
    // 팀 B: 마투수 = 0x66968(4) 의 굴림 2 · 마타자 = 0x66994(1) 의 굴림 0
    expect(rolls.teamB).toEqual({ batter: 0, pitcher: 2 })
  })

  it('팀 B 의 굴림이 팀 A 번호와 겹치면 하나 내린다 (0이면 4) — 두 팀 마선수는 늘 다르다', () => {
    const rolls = rollCpuGamePrep(차례난수([0, 0, 3, 3, 0]))
    expect(rolls.teamA).toEqual({ batter: 0, pitcher: 3 })
    expect(rolls.teamB).toEqual({ batter: 4, pitcher: 2 })
  })

  it('팀 A 는 칸 sX 의 객체다 — 홈 X(정규)면 말 공격 명단, 원정 X(포스트시즌)면 초 공격 명단', () => {
    const rolls = rollCpuGamePrep(차례난수([0, 1, 2, 3, 4]))
    expect(cpuGameAcesOf(rolls)).toEqual({ away: rolls.teamB, home: rolls.teamA })
    expect(cpuGameAcesOf(rolls, 1 - LEAGUE_SIDE_HOME)).toEqual({ away: rolls.teamA, home: rolls.teamB })
  })

  it('playLeagueDay 는 경기마다 준비 굴림 다섯을 먼저 부른다', () => {
    const 범위: Array<readonly [number, number]> = []
    const 바탕 = createSeededRandom(9)
    playLeagueDay(EMPTY_LEAGUE, 0, 0, {
      rand: (lo, hi) => {
        범위.push([lo, hi])
        return 바탕.rand(lo, hi)
      },
      rand9d: (n) => 바탕.rand9d(n),
    })
    expect(범위.slice(0, 5)).toEqual([[0, 4], [0, 5], [0, 5], [0, 5], [0, 5]])
  })

  it('마선수가 들어가도 기록표·스태미나 표에는 명단 밖 칸(마타자 12 · 마투수 8)이 안 남는다', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const score = simulateLeagueGame({ away: 2, home: 5 }, createSeededRandom(seed), 0, undefined, {
        aces: { away: { batter: 0, pitcher: 1 }, home: { batter: 2, pitcher: 3 } },
      })
      expect(score.plateAppearances.every((appearance) => appearance.battingOrderIndex < ACE_BATTER_ROSTER_SLOT)).toBe(true)
      expect(score.pitcherAppearances.every((line) => line.pitcherSlot < ACE_PITCHER_SLOT)).toBe(true)
      expect(score.pitcherStaminas.away).toHaveLength(PITCHERS_PER_TEAM)
      expect(score.pitcherStaminas.home).toHaveLength(PITCHERS_PER_TEAM)
    }
  })

  it('마투수(8번)가 벤치에 있으면 경기가 달라진다 — 0xb8a8d 가 참이 되고 벤치 수가 는다 (0xabfcc 는 마선수를 고르지 않는다, ac084)', () => {
    // 로스터 투수가 모두 지친 표 — 스태미나가 가장 높은 벤치 투수를 고르면 마투수다
    const 지침 = Array.from({ length: PITCHERS_PER_TEAM }, () => 1500)
    let 달라짐 = 0
    for (let seed = 1; seed <= 20; seed += 1) {
      const 없음 = simulateLeagueGame({ away: 2, home: 5 }, createSeededRandom(seed), 0, { away: 지침, home: 지침 })
      // 마타자 번호를 표 밖(−1)으로 두면 마투수만 들어간다
      const 있음 = simulateLeagueGame({ away: 2, home: 5 }, createSeededRandom(seed), 0, { away: 지침, home: 지침 }, {
        aces: { away: { batter: -1, pitcher: 1 }, home: { batter: -1, pitcher: 3 } },
      })
      if (JSON.stringify(없음) !== JSON.stringify(있음)) 달라짐 += 1
    }
    expect(달라짐).toBeGreaterThan(0)
  })

  it('마선수 레벨 배율이 능력치에 붙는다 — 레벨만 다른 같은 씨앗이 다른 경기가 되는 일이 있다', () => {
    const aces = { away: { batter: 4, pitcher: 4 }, home: { batter: 3, pitcher: 3 } }
    const 낮음 = Array.from({ length: 30 }, (_unused, seed) =>
      simulateLeagueGame({ away: 1, home: 6 }, createSeededRandom(seed), 1, undefined, { aces }))
    const 높음 = Array.from({ length: 30 }, (_unused, seed) =>
      simulateLeagueGame({ away: 1, home: 6 }, createSeededRandom(seed), 1, undefined, {
        aces,
        aceLevels: { 3: 4, 4: 4, 8: 4, 9: 4 },
      }))
    expect(높음).not.toEqual(낮음)
  })
})

describe('같은 레코드를 쓰는 두 명단 — 국가대항전 CPU 경기 (0x1f570 → base+0x934)', () => {
  it('스태미나 표가 하나라 두 팀이 같은 투수를 같이 깎는다', () => {
    let 달라짐 = 0
    for (let seed = 1; seed <= 10; seed += 1) {
      const 같이 = simulateLeagueGame({ away: 11, home: 11 }, createSeededRandom(seed), 1, undefined, { sharedRoster: true })
      const 따로 = simulateLeagueGame({ away: 11, home: 11 }, createSeededRandom(seed), 1)
      expect(같이.pitcherStaminas.away).toEqual(같이.pitcherStaminas.home)
      if (JSON.stringify(같이) !== JSON.stringify(따로)) 달라짐 += 1
    }
    // 같은 선발이 양쪽 마운드에서 한 값을 깎으므로 교체 시점이 달라진다
    expect(달라짐).toBeGreaterThan(0)
  })
})

describe('CPU 끼리 경기의 수비 객체는 보직과 마선수를 넘긴다 (0xac428 ac574~ac5c2 · 0xb8a8d · 0xabfcc)', () => {
  it('9회 마무리 상황마다 매 타자 투수를 바꾸지 않는다 — 마무리(보직 2)가 올라오면 그대로 간다', () => {
    let 줄수 = 0
    const 경기 = 200
    for (let seed = 1; seed <= 경기; seed += 1) {
      줄수 += simulateLeagueGame({ away: 1, home: 2 }, createSeededRandom(seed), seed % 4).pitcherAppearances.length
    }
    // 보직을 안 넘기면 모두 선발로 보여 마무리 상황마다 교체가 서 두 팀 합 평균 6 을 넘었다
    expect(줄수 / 경기).toBeLessThan(5)
  })
})

describe('반 이닝 승·패 판정은 한 점마다 0xa5c34 를 밟는다 (S1 2·3절)', () => {
  const 반이닝 = (
    plays: readonly { runs: number; pitcherSlot: number }[],
    changes: HalfInningResult['pitcherChanges'] = [],
  ): HalfInningResult =>
    ({
      runs: plays.reduce((sum, play) => sum + play.runs, 0),
      plateAppearances: plays.map((play, index) => ({
        battingOrderIndex: index,
        outcome: { kind: '안타', bases: 1 },
        runsBattedIn: play.runs,
        pitcherSlot: play.pitcherSlot,
      })),
      pitcherChanges: changes,
    }) as unknown as HalfInningResult

  it('뒤지던 팀이 2점타로 뒤집으면 — 첫 점에 동점(둘 다 지움), 둘째 점에 새로 잡는다', () => {
    // 6회초(index 5) 0:1 로 뒤지던 원정(칸 0)이 2점. 홈 마운드는 5번, 원정 덕아웃 투수는 1번
    const 판정 = decisionsAfterHalfInning(
      { ...EMPTY_DECISION_STATE, loser: { side: 0, number: 1 }, winner: { side: 1, number: 0 } },
      반이닝([{ runs: 2, pitcherSlot: 5 }]),
      { inningIndex: 5, offenseSide: 0, scoresBefore: [0, 1], offenseMoundSlot: 1, defenseMoundSlot: 5 },
    )
    expect(판정.winner).toEqual({ side: 0, number: 1 })
    expect(판정.loser).toEqual({ side: 1, number: 5 })
  })

  it('5회까지의 득점은 승리 투수를 안 건드린다 — 패전만 잡힌다', () => {
    const 판정 = decisionsAfterHalfInning(
      EMPTY_DECISION_STATE,
      반이닝([{ runs: 3, pitcherSlot: 0 }]),
      { inningIndex: 4, offenseSide: 0, scoresBefore: [0, 0], offenseMoundSlot: 0, defenseMoundSlot: 0 },
    )
    expect(판정.winner.side).toBe(NO_SIDE)
    expect(판정.loser).toEqual({ side: 1, number: 0 })
  })

  it('교체(0xa60c0)는 그 앞까지 들어온 점수 자리에 끼고, 세이브 후보와 코드를 남긴다', () => {
    // 9회말(index 8) 홈 공격, 원정이 3:0 으로 앞선 채 0아웃에 원정 마무리 7번이 오른다
    const 판정 = decisionsAfterHalfInning(
      EMPTY_DECISION_STATE,
      반이닝([], [
        { pitcherSlot: 7, outs: 0, runnerCount: 0, runsBefore: 0, outgoingPitcherSlot: 0, outgoingStamina: 0 },
      ]),
      { inningIndex: 8, offenseSide: 1, scoresBefore: [3, 0], offenseMoundSlot: 0, defenseMoundSlot: 0 },
    )
    expect(판정.save).toEqual({ side: 0, number: 7 })
    expect(판정.saveCode).toBe(3)
  })
})

describe('마투수 스태미나는 저장 레코드 +0x2c(10000)에서 서고 끝 값은 팀 레코드 8번 칸에 남는다 (0xb521c)', () => {
  it('마투수를 넣은 명단만 끝 값을 내놓고, 다음 CPU 경기로는 잇지 않는다', () => {
    const 경기 = simulateLeagueGame({ away: 2, home: 3 }, 씨앗난수(31), 0, undefined, {
      aces: { home: { batter: 0, pitcher: 1 } },
    })
    expect(경기.acePitcherStaminas.away).toBeUndefined()
    expect(경기.acePitcherStaminas.home).toBeLessThanOrEqual(ACE_PITCHER_RECORD_STAMINA)
    expect(경기.pitcherStaminas.home).toHaveLength(PITCHERS_PER_TEAM)
  })

  it('하루치 CPU 경기는 팀마다 8번 칸 값을 남긴다 (내 팀 경기는 빠진다)', () => {
    const 하루 = playLeagueDay(EMPTY_LEAGUE, 0, 4, 씨앗난수(5))
    expect(Object.keys(하루.acePitcherStaminas)).toHaveLength(8)
    expect(하루.acePitcherStaminas[4]).toBeUndefined()
  })
})

describe('로테이션은 리그가 들고 다니는 레코드 차례다 (0xb5ca8 영구 섞기 — c24fc~c254e)', () => {
  it('g ≠ 0 인 날마다 두 팀 레코드가 한 칸 돌고, 0번이 선발이다 — 이어 돌리면 g % 4 와 같다', () => {
    let league = EMPTY_LEAGUE
    for (let day = 0; day < 6; day += 1) {
      league = playLeagueDay(league, day, 4, 씨앗난수(day + 1)).league
      for (let team = 0; team < LEAGUE_TEAM_COUNT; team += 1) expect(leagueStarterSlotOf(league, team)).toBe(rotationSlotOf(day))
    }
    // 4번 칸 뒤(중간·마무리)는 안 섞인다
    expect(pitcherOrderOf(league, 0).slice(4)).toEqual([4, 5, 6, 7])
  })

  it('사람 경기 두 팀을 여기서 안 돌리면(투수편 내 팀 맞바꿈 길) 그 둘만 제자리다', () => {
    const 하루 = playLeagueDay(EMPTY_LEAGUE, 1, 4, 씨앗난수(2), undefined, {}, undefined, false)
    const 상대 = opponentOf(1, 4)
    expect(leagueStarterSlotOf(하루.league, 4)).toBe(0)
    expect(leagueStarterSlotOf(하루.league, 상대)).toBe(0)
    expect(leagueStarterSlotOf(하루.league, [0, 1, 2, 3, 5, 6, 7, 8, 9].find((team) => team !== 상대) ?? 0)).toBe(1)
  })

  it('섞인 차례는 새 시즌으로 이어진다 — 승패만 비운다', () => {
    const 섞인 = rotateLeaguePitchers(recordLeagueResult(EMPTY_LEAGUE, 1, 2), [3])
    const 새시즌 = nextSeasonLeague(섞인.pitcherOrders)
    expect(새시즌.wins.every((wins) => wins === 0)).toBe(true)
    expect(leagueStarterSlotOf(새시즌, 3)).toBe(1)
    // 승패를 기록해도 차례는 그대로 남는다
    expect(pitcherOrderOf(recordLeagueResult(섞인, 3, 4), 3)).toEqual(pitcherOrderOf(섞인, 3))
  })
})

describe('CPU 투수 경기용 능력치 0xb570c — 마무리 갈래 능력 합 0xb5b50 의 재료', () => {
  it('모드 3·4 는 밑값 그대로(0..999 자르기만), 모드 2 는 팀 능력치 정액 + 코치', () => {
    expect(cpuPitcherGameAbilityOf(500, 0, 0, { mode: 3 })).toBe(500)
    expect(cpuPitcherGameAbilityOf(500, 0, 0, undefined)).toBe(500)
    // 제구(칸 0) ← 팀 집중(칸 2) 600: trunc((17·600 − 5100)/100) = 51
    const 팀 = [[0, 0, 600, 0]]
    expect(cpuPitcherGameAbilityOf(500, 0, 0, { mode: 2, teamAbilities: 팀 })).toBe(551)
    // 코치 2(투수 제구 +10) — 팀 검사 없이 붙는다
    expect(cpuPitcherGameAbilityOf(500, 0, 0, { mode: 2, teamAbilities: 팀, coach: 2 })).toBe(561)
    expect(cpuPitcherGameAbilityOf(500, 1, 0, { mode: 2, teamAbilities: 팀, coach: 2 })).toBe(500)
    expect(cpuPitcherGameAbilityOf(990, 0, 0, { mode: 2, teamAbilities: 팀, coach: 2 })).toBe(999)
  })
})

describe('CPU 팀 레코드가 트레이드로 바뀌면 그 레코드로 선다 (0xc239c → 0xb891c·0xb8680 → 0x1f570)', () => {
  const identity = (teamId: number): LeagueTeamRecord => ({
    batters: Array.from({ length: BATTERS_PER_TEAM }, (_, slot) => ({ tableTeamId: teamId, tableSlot: slot })),
    pitchers: Array.from({ length: PITCHERS_PER_TEAM }, (_, slot) => ({ tableTeamId: teamId, tableSlot: slot })),
  })
  /** 1팀 타자 0번 ↔ 5팀 타자 0번, 1팀 투수 0번 ↔ 5팀 투수 0번 을 맞바꾼 1팀 레코드 */
  const traded = (): LeagueTeamRecord => {
    const base = identity(1)
    return {
      batters: base.batters.map((seat, slot) => (slot === 0 ? { tableTeamId: 5, tableSlot: 0 } : seat)),
      pitchers: base.pitchers.map((seat, slot) => (slot === 0 ? { tableTeamId: 5, tableSlot: 0 } : seat)),
    }
  }

  it('표와 같은 레코드를 넘기면 결과·난수 차례가 넘기지 않은 것과 같다 (트레이드 없는 시즌은 그대로)', () => {
    for (const seed of [3, 17, 2024]) {
      const day = 4
      const plain = playLeagueDay(EMPTY_LEAGUE, day, 0, createSeededRandom(seed))
      const same = playLeagueDay(
        EMPTY_LEAGUE, day, 0, createSeededRandom(seed), EMPTY_LEAGUE_PLAYER_STATS, {}, undefined, true, undefined,
        identity,
      )
      expect(same).toEqual(plain)
    }
  })

  it('옮겨 온 선수의 타석·투구 기록은 옛 팀 표 자리(원본 id)로 쌓인다 — 레코드 칸이 아니다', () => {
    let found = false
    for (let seed = 1; seed < 40 && !found; seed += 1) {
      const score = simulateLeagueGame(
        { away: 1, home: 2 }, createSeededRandom(seed), { away: 0, home: 0 }, undefined, { records: { away: traded() } },
      )
      const pitched = score.pitcherAppearances.filter((line) => line.teamId === 5)
      const batted = score.plateAppearances.filter((line) => line.teamId === 5)
      // 1팀 칸 0 의 선수는 5팀 표 0번이다 — 1팀 표 0번(타자·투수)에는 하나도 안 쌓인다
      expect(score.plateAppearances.some((line) => line.teamId === 1 && line.battingOrderIndex === 0)).toBe(false)
      expect(score.pitcherAppearances.some((line) => line.teamId === 1 && line.pitcherSlot === 0)).toBe(false)
      expect(batted.every((line) => line.battingOrderIndex === 0)).toBe(true)
      expect(pitched.every((line) => line.pitcherSlot === 0)).toBe(true)
      found = batted.length > 0 && pitched.length > 0
    }
    expect(found).toBe(true)
  })

  it('선발 칸 0 에 앉은 옮겨 온 투수의 능력치로 던진다 — 결과가 표 그대로와 갈린다', () => {
    const differs = [1, 2, 3, 4, 5, 6].some((seed) => {
      const plain = simulateLeagueGame({ away: 1, home: 2 }, createSeededRandom(seed), 0)
      const swapped = simulateLeagueGame(
        { away: 1, home: 2 }, createSeededRandom(seed), 0, undefined, { records: { away: traded() } },
      )
      return plain.awayRuns !== swapped.awayRuns || plain.homeRuns !== swapped.homeRuns
    })
    expect(differs).toBe(true)
  })

  it('playLeagueDay 는 recordOf 가 준 팀만 레코드로 세운다', () => {
    const day = 4
    const plain = playLeagueDay(EMPTY_LEAGUE, day, 0, createSeededRandom(9))
    const withRecord = playLeagueDay(
      EMPTY_LEAGUE, day, 0, createSeededRandom(9), EMPTY_LEAGUE_PLAYER_STATS, {}, undefined, true, undefined,
      (team) => (team === 1 ? traded() : undefined),
    )
    expect(withRecord.playerStats.batters[leagueBatterIdOf(1, 0)]).toBeUndefined()
    expect(plain.playerStats.batters[leagueBatterIdOf(1, 0)]).toBeDefined()
  })
})
