import { describe, expect, it } from 'vitest'
import {
  EMPTY_LEAGUE_PITCHER_LINE,
  EMPTY_LEAGUE_PLAYER_STATS,
  leaguePitcherIdOf,
  leaguePitcherLineOf,
  recordLeaguePitcherAppearances,
  recordLeaguePlateAppearances,
} from '@/entities/league/model/leaguePlayerStats'
import type {
  LeaguePitcherAppearance,
  LeaguePlayerStats,
} from '@/entities/league/model/leaguePlayerStats'
import { PITCHERS_PER_TEAM } from '@/entities/team/model/teamRoster'

const 등판 = (덮기: Partial<LeaguePitcherAppearance> = {}): LeaguePitcherAppearance => ({
  teamId: 2,
  pitcherSlot: 1,
  outs: 27,
  runsAllowed: 3,
  strikeouts: 7,
  pitches: 110,
  decision: '승',
  ...덮기,
})

describe('리그 투수 줄 (선수 레코드 +0x20~+0x2f, P1 6절)', () => {
  it('투수 전역 번호는 팀 × 8 + 칸이다 (투수 명단 0xb51fd)', () => {
    expect(leaguePitcherIdOf(0, 0)).toBe(0)
    expect(leaguePitcherIdOf(3, 2)).toBe(3 * PITCHERS_PER_TEAM + 2)
    // 칸이 8 을 넘어도 나머지로 돌려 쓴다
    expect(leaguePitcherIdOf(1, PITCHERS_PER_TEAM)).toBe(PITCHERS_PER_TEAM)
  })

  it('등판을 쌓으면 아웃·실점·탈삼진·투구·승이 더해진다', () => {
    const 쌓음 = recordLeaguePitcherAppearances(EMPTY_LEAGUE_PLAYER_STATS, [등판(), 등판({ decision: '패' })])
    const 줄 = leaguePitcherLineOf(쌓음, leaguePitcherIdOf(2, 1))

    expect(줄.outs).toBe(54)
    expect(줄.runsAllowed).toBe(6)
    expect(줄.strikeouts).toBe(14)
    expect(줄.pitches).toBe(220)
    expect(줄.wins).toBe(1)
    expect(줄.losses).toBe(1)
    // 세이브는 웹에 구원 교체가 없어 늘 0 이다
    expect(줄.saves).toBe(0)
  })

  it('투구 수는 원본처럼 9999 에서 자른다 (+0x28)', () => {
    const 쌓음 = recordLeaguePitcherAppearances(EMPTY_LEAGUE_PLAYER_STATS, [
      등판({ pitches: 9000 }),
      등판({ pitches: 9000 }),
    ])

    expect(leaguePitcherLineOf(쌓음, leaguePitcherIdOf(2, 1)).pitches).toBe(9999)
  })

  it('한 번도 안 던진 투수는 0 줄이다 (순위표가 아웃 ≤ 0 으로 빼는 자리)', () => {
    expect(leaguePitcherLineOf(EMPTY_LEAGUE_PLAYER_STATS, 999)).toEqual(EMPTY_LEAGUE_PITCHER_LINE)
  })

  it('⚠️ 투수 칸이 없던 옛 저장도 그대로 읽힌다 — `pitchers` 가 없어도 터지지 않는다', () => {
    const 옛저장: LeaguePlayerStats = { batters: { 5: { atBats: 3, hits: 1, homeRuns: 0, runsBattedIn: 1 } } }

    expect(leaguePitcherLineOf(옛저장, 0)).toEqual(EMPTY_LEAGUE_PITCHER_LINE)
    const 쌓음 = recordLeaguePitcherAppearances(옛저장, [등판()])
    expect(leaguePitcherLineOf(쌓음, leaguePitcherIdOf(2, 1)).outs).toBe(27)
    // 타자 줄은 그대로 남는다
    expect(쌓음.batters[5]?.atBats).toBe(3)
  })

  it('타자 줄을 쌓아도 투수 줄이 지워지지 않는다 (두 표가 한 칸에 산다)', () => {
    const 투수쌓음 = recordLeaguePitcherAppearances(EMPTY_LEAGUE_PLAYER_STATS, [등판()])
    const 타자쌓음 = recordLeaguePlateAppearances(투수쌓음, [
      { teamId: 1, battingOrderIndex: 0, outcome: { kind: '안타', bases: 1 }, runsBattedIn: 1 },
    ])

    expect(leaguePitcherLineOf(타자쌓음, leaguePitcherIdOf(2, 1)).outs).toBe(27)
    expect(Object.keys(타자쌓음.batters)).toHaveLength(1)
  })
})
