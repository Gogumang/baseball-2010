import { describe, expect, it } from 'vitest'
import {
  EMPTY_LEAGUE_PITCHER_LINE,
  EMPTY_LEAGUE_PLAYER_STATS,
  leaguePitcherAppearancesOf,
  leaguePitcherIdOf,
  leaguePitcherLineOf,
  recordLeaguePitcherAppearances,
  recordLeaguePlateAppearances,
  recordLeagueStolenBases,
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

describe('경기 끝 판정 붙이기 — 사람 경기 요약도 같은 길 (0xa7de8)', () => {
  const 줄 = (teamId: number, pitcherSlot: number) => ({
    teamId,
    pitcherSlot,
    outs: 3,
    runsAllowed: 0,
    strikeouts: 1,
    pitches: 12,
  })
  const 칸팀 = (side: number) => (side === 0 ? 7 : 2)

  it('측을 팀으로 바꿔 그 투수 줄에 승·패를 붙인다', () => {
    const 등판들 = leaguePitcherAppearancesOf(
      [줄(2, 0), 줄(7, 1), 줄(7, 5)],
      { winner: { side: 0, pitcherSlot: 5 }, loser: { side: 1, pitcherSlot: 0 }, save: null },
      칸팀,
    )
    expect(등판들.find((등판) => 등판.teamId === 7 && 등판.pitcherSlot === 5)?.decision).toBe('승')
    expect(등판들.find((등판) => 등판.teamId === 2 && 등판.pitcherSlot === 0)?.decision).toBe('패')
    expect(등판들.find((등판) => 등판.pitcherSlot === 1)?.decision).toBeNull()
  })

  it('줄이 없는 투수·이미 판정을 받은 줄이면 0 줄을 더 붙인다 — 레코드 칸은 따로 오른다', () => {
    const 등판들 = leaguePitcherAppearancesOf(
      [줄(2, 0)],
      { winner: { side: 1, pitcherSlot: 0 }, loser: { side: 1, pitcherSlot: 0 }, save: null },
      칸팀,
    )
    const 쌓음 = recordLeaguePitcherAppearances(EMPTY_LEAGUE_PLAYER_STATS, 등판들)
    const 기록 = leaguePitcherLineOf(쌓음, leaguePitcherIdOf(2, 0))
    expect(등판들).toHaveLength(2)
    expect(기록.wins).toBe(1)
    expect(기록.losses).toBe(1)
    expect(기록.outs).toBe(3)
  })

  it('세이브 판정이 오면 +0x24 를 올린다 — 원본 판정은 이것을 내지 않는다 (S1 4-1)', () => {
    const 등판들 = leaguePitcherAppearancesOf([줄(2, 7)], { winner: null, loser: null, save: { side: 1, pitcherSlot: 7 } }, 칸팀)
    expect(leaguePitcherLineOf(recordLeaguePitcherAppearances(EMPTY_LEAGUE_PLAYER_STATS, 등판들), leaguePitcherIdOf(2, 7)).saves).toBe(1)
  })

  it('건너뛸 칸(마투수 8번)은 줄도 판정도 안 쌓는다', () => {
    const 등판들 = leaguePitcherAppearancesOf(
      [줄(2, 8)],
      { winner: { side: 1, pitcherSlot: 8 }, loser: null, save: null },
      칸팀,
      (_teamId, pitcherSlot) => pitcherSlot === 8,
    )
    expect(등판들).toHaveLength(0)
  })
})

describe('표 밖 선수(영입한 명전·나리)의 줄 — 원본 id 열쇠 (recordBatters · recordPitchers)', () => {
  it('recordId 가 있으면 표 밖 줄에, 없으면 붙박이 표 줄에 쌓는다', () => {
    const stats = recordLeaguePlateAppearances(EMPTY_LEAGUE_PLAYER_STATS, [
      { teamId: 0, battingOrderIndex: -1, recordId: 0xfe, outcome: { kind: '홈런' }, runsBattedIn: 1 },
      { teamId: 0, battingOrderIndex: 2, outcome: { kind: '홈런' }, runsBattedIn: 1 },
    ])
    expect(stats.recordBatters).toEqual({ 0xfe: { atBats: 1, hits: 1, homeRuns: 1, runsBattedIn: 1 } })
    expect(Object.keys(stats.batters)).toEqual(['2'])
    const pitched = recordLeaguePitcherAppearances(EMPTY_LEAGUE_PLAYER_STATS, [
      { teamId: 0, pitcherSlot: -1, recordId: 0xb4, outs: 3, runsAllowed: 0, strikeouts: 1, pitches: 12, decision: '승' },
    ])
    expect(pitched.recordPitchers?.[0xb4]).toMatchObject({ outs: 3, wins: 1 })
    expect(pitched.pitchers).toEqual({})
  })

  it('표 밖 선수가 없으면 칸을 만들지 않는다 — 예전 저장과 같은 모양', () => {
    const stats = recordLeaguePlateAppearances(EMPTY_LEAGUE_PLAYER_STATS, [
      { teamId: 1, battingOrderIndex: 0, outcome: { kind: '홈런' }, runsBattedIn: 1 },
    ])
    expect(stats).not.toHaveProperty('recordBatters')
    expect(recordLeaguePitcherAppearances(stats, [])).not.toHaveProperty('recordPitchers')
  })

  it('판정은 같은 원본 id 의 줄에 붙는다', () => {
    const appearances = leaguePitcherAppearancesOf(
      [{ teamId: 0, pitcherSlot: -1, recordId: 0xb4, outs: 27, runsAllowed: 0, strikeouts: 5, pitches: 100 }],
      { winner: { side: 1, pitcherSlot: -1, recordId: 0xb4 }, loser: null, save: null },
      () => 0,
      (_teamId, slot, recordId) => recordId === undefined && slot < 0,
    )
    expect(appearances).toHaveLength(1)
    expect(appearances[0]).toMatchObject({ recordId: 0xb4, decision: '승' })
  })
})

describe('recordLeagueStolenBases — 도루 +0x2c (0xa8380 · 0xc1a98)', () => {
  it('주자마다 +1, 표 밖 선수는 원본 id 로, 타석 기록은 그대로', () => {
    const 타석 = recordLeaguePlateAppearances(EMPTY_LEAGUE_PLAYER_STATS, [
      { teamId: 1, battingOrderIndex: 2, outcome: { kind: '볼넷' }, runsBattedIn: 0 },
    ])
    const 쌓음 = recordLeagueStolenBases(타석, [
      { teamId: 1, battingOrderIndex: 2 },
      { teamId: 1, battingOrderIndex: 2 },
      { teamId: 0, battingOrderIndex: -1, recordId: 0xb4 },
    ])
    expect(쌓음.batters[14]?.steals).toBe(2)
    expect(쌓음.batters[14]?.atBats).toBe(0)
    expect(쌓음.recordBatters?.[0xb4]?.steals).toBe(1)
    // 다음 타석이 와도 도루는 남는다
    const 이어 = recordLeaguePlateAppearances(쌓음, [
      { teamId: 1, battingOrderIndex: 2, outcome: { kind: '볼넷' }, runsBattedIn: 0 },
    ])
    expect(이어.batters[14]?.steals).toBe(2)
  })
})

describe('2루타 +0x24 · 3루타 +0x26 (0xa8024 a8520~a85ac)', () => {
  it('루타 2 면 +0x24, 3 이면 +0x26 — 1루타·홈런은 안 센다', () => {
    const 쌓음 = recordLeaguePlateAppearances(EMPTY_LEAGUE_PLAYER_STATS, [
      { teamId: 1, battingOrderIndex: 2, outcome: { kind: '안타', bases: 2 }, runsBattedIn: 0 },
      { teamId: 1, battingOrderIndex: 2, outcome: { kind: '안타', bases: 3 }, runsBattedIn: 1 },
      { teamId: 1, battingOrderIndex: 2, outcome: { kind: '안타', bases: 2 }, runsBattedIn: 0 },
      { teamId: 1, battingOrderIndex: 2, outcome: { kind: '안타', bases: 1 }, runsBattedIn: 0 },
      { teamId: 1, battingOrderIndex: 2, outcome: { kind: '홈런' }, runsBattedIn: 1 },
    ])
    expect(쌓음.batters[14]).toMatchObject({ hits: 5, doubles: 2, triples: 1, homeRuns: 1, runsBattedIn: 2 })
  })
})
