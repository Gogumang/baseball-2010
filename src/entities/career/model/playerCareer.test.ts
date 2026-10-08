import { pitcherOrdersAfterPostseason } from '@/entities/league/model/league'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { describe, expect, it } from 'vitest'
import { applyGameResult, applySeasonEnd, countGameForSkills, countReputationZeroGame, createCareer, nextOpponentOf, GAMES_PER_SEASON, gamePointRewardOf, nameByteLengthOf, rookieAbilityOf, startNextSeason, leagueGamePitchersOf, applyLeagueDay, countTraining, nariLastGameRecordLineOf, nariRecordLineTextOf } from '@/entities/career/model/playerCareer'
import type { NariLastGame, PlayerCareer } from '@/entities/career/model/playerCareer'
import { EMPTY_LEAGUE, opponentOf, recordLeagueResult } from '@/entities/league/model/league'
import { EMPTY_SEASON_STATS } from '@/entities/career/model/seasonStats'
import type { GameSummary } from '@/entities/game/model/gameSummary'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { EMPTY_LEAGUE_PLAYER_STATS, leagueBatterIdOf } from '@/entities/league/model/leaguePlayerStats'

describe('신인 초기값 — 0x11244', () => {
  it('인기도 0 · 평판 300 · 사기 100 · 소지금 6000만 · 연봉 50 으로 시작한다', () => {
    const career = createCareer('신인')

    expect({
      popularity: career.popularity,
      reputation: career.reputation,
      morale: career.morale,
      money: career.money,
      salary: career.salary,
    }).toEqual({ popularity: 0, reputation: 300, morale: 100, money: 6000, salary: 50 })
  })

  it('시작 능력치는 표 0xcc3fa 의 타입 값에 수비(목록 B=0) 또는 주루(B≠0) +30 이다 (0x16e2c)', () => {
    expect(rookieAbilityOf(0, 0)).toEqual({ hit: 100, power: 100, defense: 130, run: 100 })
    expect(rookieAbilityOf(1, 1)).toEqual({ hit: 80, power: 150, defense: 80, run: 110 })
    expect(createCareer('신인').ability).toEqual(rookieAbilityOf(0, 0))
  })

  it('등록 화면에서 고른 타입·포지션·손을 반영한다 (0x16f28)', () => {
    const career = createCareer('신인', { battingTypeIndex: 1, positionIndex: 1, battingSide: 1, skinIndex: 2 })

    expect(career.ability).toEqual(rookieAbilityOf(1, 1))
    expect([career.battingTypeIndex, career.positionIndex, career.battingSide, career.skinIndex]).toEqual([1, 1, 1, 2])
  })

  it('이름은 한글 4글자·영문 8글자 = 8바이트까지다 (StrMODE[3], 한글 2바이트)', () => {
    expect([nameByteLengthOf('홍길동이'), nameByteLengthOf('ABCDEFGH'), nameByteLengthOf('홍a')]).toEqual([8, 8, 3])
  })

  it('스킬 0 "병아리" 와 8 "의외성" 을 갖고 시작한다 (0x11230, 점검 9차)', () => {
    expect(createCareer('신인').skillIds).toEqual([0, 8])
  })
})

describe('리그 전적 — 0xb76dc · 0xb77e0', () => {
  const 경기 = (overrides = {}) =>
    ({ result: '승', stats: EMPTY_SEASON_STATS, recordIds: [], ourTeamId: 0, opponentTeamId: 3, ...overrides }) as unknown as GameSummary

  it('내 팀 경기 결과를 승·패에 넣는다 — 정산 4f072 에 무승부 갈래가 없다', () => {
    const 이김 = applyGameResult(createCareer('선수'), 경기())
    expect([이김.league.wins[0], 이김.league.losses[3]]).toEqual([1, 1])

    const 짐 = applyGameResult(createCareer('선수'), 경기({ result: '패' }))
    expect([짐.league.wins[3], 짐.league.losses[0]]).toEqual([1, 1])
    expect([짐.wins, 짐.draws, 짐.losses]).toEqual([0, 0, 1])
  })
})

describe('새 시즌 전환 — 0x1b768', () => {
  it('사기를 100 으로 되돌리고 연봉(100만 단위)을 소지금(만원)에 더한다', () => {
    const next = startNextSeason({ ...createCareer('선수'), morale: 20, money: 1000, salary: 50 })

    expect(next.morale).toBe(100)
    expect(next.money).toBe(1000 + 5000)
  })

  it('소지금은 9999×100만 을 넘지 않는다', () => {
    expect(startNextSeason({ ...createCareer('선수'), money: 999_000, salary: 100 }).money).toBe(999_900)
  })

  it('지난 해 시즌 줄을 연도별 칸 S[0xb3] − 1 에 쌓고 시즌 줄을 비운다 (1b7c4~1b834 · 0xb8e28) — 옛 저장은 빈 목록에서', () => {
    const 첫해 = { ...createCareer('선수').stats, atBats: 120, hits: 40, homeRuns: 7 }
    const 둘째해시작 = startNextSeason({ ...createCareer('선수'), stats: 첫해 })
    expect(둘째해시작.yearlyStats).toEqual([첫해])
    expect(둘째해시작.stats.atBats).toBe(0)

    const 둘째해 = { ...둘째해시작.stats, atBats: 90, hits: 20 }
    expect(startNextSeason({ ...둘째해시작, stats: 둘째해 }).yearlyStats).toEqual([첫해, 둘째해])
  })

  it('올해의 목표 플래그 둘을 되돌린다 — +0x1b7(0xa39d0) · +0x1bc(0x1b882)', () => {
    const next = startNextSeason({
      ...createCareer('선수'),
      hasSeenYearGoalWindow: true,
      yearGoalEventDone: true,
    })

    expect([next.hasSeenYearGoalWindow, next.yearGoalEventDone]).toEqual([false, false])
  })

  it('인기도 스냅샷을 지금 인기도로 다시 뜬다 (+0x78 ← 0xb6e78, 0xa39e0)', () => {
    const next = startNextSeason({ ...createCareer('선수'), popularity: 820, popularityAtSeasonStart: 100 })

    expect(next.popularityAtSeasonStart).toBe(820)
  })

  it('리그 순위표와 포스트시즌 대진을 새로 깐다 (리그 객체 S+0x80 초기화, 0xa39ae)', () => {
    const 지난시즌 = {
      ...createCareer('선수'),
      league: recordLeagueResult(EMPTY_LEAGUE, 0, 1),
      postseason: { round: '한국시리즈', teams: [0, 1], wins: [2, 1], winsNeeded: 4 },
    } as unknown as Parameters<typeof startNextSeason>[0]

    const next = startNextSeason(지난시즌)

    // 승패는 비우고 투수 레코드 차례는 잇는다 — 새 시즌 처리는 팀 저장 레코드를 다시 짓지 않는다 (nextSeasonLeague)
    const { pitcherOrders, ...rest } = next.league
    expect({ ...rest }).toEqual(EMPTY_LEAGUE)
    expect(pitcherOrders).toEqual(pitcherOrdersAfterPostseason(지난시즌.postseason!))
    expect(next.postseason).toBeNull()
  })

  it('섞인 투수 레코드 차례는 포스트시즌에 돈 칸까지 얹어 새 시즌으로 넘어간다', () => {
    const 지난시즌 = {
      ...createCareer('선수'),
      league: { ...EMPTY_LEAGUE, pitcherOrders: { 3: [1, 2, 3, 0, 4, 5, 6, 7] } },
      postseason: {
        round: '종료',
        qualifiers: [3, 1, 2, 0],
        teams: [3, 1],
        wins: [4, 0],
        winsNeeded: 4,
        champion: 3,
        rotations: { 3: 3 },
        baseOrders: { 3: [1, 2, 3, 0, 4, 5, 6, 7] },
      },
    } as unknown as Parameters<typeof startNextSeason>[0]
    // 3 칸 더 돈다 — [1,2,3,0] → [0,1,2,3]
    expect(startNextSeason(지난시즌).league.pitcherOrders?.[3]).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
  })

  it('리그 선수 시즌 성적도 0 으로 되돌린다 (0x204e0 — 순위표 재료가 해를 넘기지 않는다)', () => {
    const 지난시즌 = {
      ...createCareer('선수'),
      leaguePlayerStats: { batters: { 7: { atBats: 300, hits: 120, homeRuns: 40, runsBattedIn: 99 } } },
    }

    expect(startNextSeason(지난시즌).leaguePlayerStats).toEqual(EMPTY_LEAGUE_PLAYER_STATS)
  })
})

/**
 * 사람 경기도 원본은 같은 타석 기록 함수 0xa8024 를 부른다 (B-2) —
 * 동료 여덟 타순과 상대 팀 타석이 CPU 끼리 경기와 **한 표**에 쌓여야 한다.
 */
describe('사람 경기의 타석도 리그 선수 기록표에 쌓인다 — 0xa8024', () => {
  const 타석 = (teamId: number, battingOrderIndex: number, outcome: AtBatOutcome, runsBattedIn = 0) =>
    ({ teamId, battingOrderIndex, outcome, runsBattedIn })

  it('동료·상대 타석이 각자의 레코드에 들어간다', () => {
    const summary = {
      result: '승',
      stats: EMPTY_SEASON_STATS,
      recordIds: [],
      ourTeamId: 0,
      opponentTeamId: 3,
      leaguePlateAppearances: [
        타석(0, 1, { kind: '홈런' }, 2),
        타석(0, 1, { kind: '볼넷' }),
        타석(3, 4, { kind: '안타', bases: 2 }, 1),
        타석(3, 4, { kind: '삼진' }),
      ],
    } as unknown as GameSummary

    const career = applyGameResult(createCareer('선수'), summary)

    // 볼넷은 타수에서 빠진다 (countsAsAtBat)
    expect(career.leaguePlayerStats.batters[leagueBatterIdOf(0, 1)]).toEqual({
      atBats: 1, hits: 1, homeRuns: 1, runsBattedIn: 2,
    })
    expect(career.leaguePlayerStats.batters[leagueBatterIdOf(3, 4)]).toEqual({
      atBats: 2, hits: 1, homeRuns: 0, runsBattedIn: 1,
    })
  })

  it('상대 공격 간이 엔진의 도루(+0x2c)도 쌓인다 — 포스트시즌은 0xa56dc 가 거짓이라 안 쌓는다 (c1a42)', () => {
    const summary = {
      result: '승',
      stats: EMPTY_SEASON_STATS,
      recordIds: [],
      ourTeamId: 0,
      opponentTeamId: 3,
      leagueStolenBases: [{ teamId: 3, battingOrderIndex: 4 }, { teamId: 3, battingOrderIndex: 4 }],
    } as unknown as GameSummary

    expect(applyGameResult(createCareer('선수'), summary).leaguePlayerStats.batters[leagueBatterIdOf(3, 4)]?.steals).toBe(2)
    const 가을 = {
      ...createCareer('선수'),
      postseason: { round: '한국시리즈', teams: [0, 3], wins: [0, 0], winsNeeded: 4 } as unknown as PlayerCareer['postseason'],
    }
    expect(applyGameResult(가을, summary).leaguePlayerStats.batters[leagueBatterIdOf(3, 4)]).toBeUndefined()
  })

  it('리그 밖 경기(칸이 없는 요약)는 표를 건드리지 않는다', () => {
    const summary = { result: '승', stats: EMPTY_SEASON_STATS, recordIds: [], ourTeamId: 0, opponentTeamId: 3 } as unknown as GameSummary

    expect(applyGameResult(createCareer('선수'), summary).leaguePlayerStats).toEqual(EMPTY_LEAGUE_PLAYER_STATS)
  })
})

describe('경기 끝 G포인트 — 0x4ea0c', () => {
  it('달성 기록 금액의 합이고 출전·승리 보너스는 없다', () => {
    const summary = { result: '승', recordIds: [0, 15] } as unknown as GameSummary

    expect(gamePointRewardOf(summary)).toBe(110)
    expect(gamePointRewardOf({ ...summary, recordIds: [] })).toBe(0)
  })
})

describe('신인 초기값 — 0x11244 디스어셈 대조', () => {
  it('G포인트는 0 에서 시작한다 — 원본 신인 초기화는 G포인트를 아예 넣지 않는다', () => {
    const 신인 = createCareer('선수')

    // 원본이 쓰는 값은 연봉 50·소지금 60·인기도 0·평판 300·사기 100 뿐이다.
    // 예전 웹판의 300 은 평판 값을 베낀 것이었다.
    expect(신인.gamePoint, `gamePoint was: ${신인.gamePoint}`).toBe(0)
    expect(신인.reputation).toBe(300)
    expect(신인.morale).toBe(100)
  })
})

describe('정규시즌 종료 — 45경기째 (0xb818c)', () => {
  it('45경기 전에는 포스트시즌이 열리지 않는다', () => {
    const 선수 = { ...createCareer('선수'), gamesPlayed: GAMES_PER_SEASON - 1 }

    expect(applySeasonEnd(선수).postseason).toBeNull()
    expect(applySeasonEnd(선수).regularSeasonFirstCount).toBe(0)
  })

  it('45경기째에 준플레이오프 대진이 열린다', () => {
    const 선수 = { ...createCareer('선수'), gamesPlayed: GAMES_PER_SEASON }

    const 정산 = applySeasonEnd(선수)
    expect(정산.postseason?.round).toBe('준플레이오프')
    expect(정산.postseason?.winsNeeded).toBe(3)
  })

  it('내 팀이 1위면 정규시즌 1위 횟수가 는다 — 원본 레코드 +0x7a', () => {
    // 내 팀(0번)만 이겨 놓으면 1위가 된다
    let league = EMPTY_LEAGUE
    for (let win = 0; win < 5; win += 1) league = recordLeagueResult(league, 0, 1)
    const 선수 = { ...createCareer('선수'), gamesPlayed: GAMES_PER_SEASON, teamId: 0, league }

    expect(applySeasonEnd(선수).regularSeasonFirstCount).toBe(1)
  })

  it('이미 포스트시즌이 열려 있으면 두 번 세지 않는다', () => {
    let league = EMPTY_LEAGUE
    for (let win = 0; win < 5; win += 1) league = recordLeagueResult(league, 0, 1)
    const 선수 = { ...createCareer('선수'), gamesPlayed: GAMES_PER_SEASON, teamId: 0, league }

    const 한번 = applySeasonEnd(선수)
    const 두번 = applySeasonEnd(한번)

    expect(두번.regularSeasonFirstCount).toBe(1)
    expect(두번.postseason).toBe(한번.postseason)
  })
})

describe('포스트시즌 경기는 시리즈 승수로 들어간다 (0xb76dc 포스트시즌 분기)', () => {
  const 포스트시즌경기 = (overrides = {}) =>
    ({ result: '승', stats: EMPTY_SEASON_STATS, recordIds: [], ourTeamId: 2, opponentTeamId: 3, ...overrides }) as unknown as GameSummary

  const 포스트시즌선수 = () => {
    const 정산 = applySeasonEnd({ ...createCareer('선수'), gamesPlayed: GAMES_PER_SEASON, teamId: 2 })
    // 준PO 는 3위 vs 4위 — 빈 리그라 순위가 팀 번호 순이므로 팀 2·3 이 붙는다
    expect(정산.postseason?.teams).toContain(2)
    return 정산
  }

  it('이기면 정규시즌 전적이 아니라 시리즈 승수가 는다', () => {
    const before = 포스트시즌선수()
    const after = applyGameResult(before, 포스트시즌경기())

    expect(after.postseason?.wins.reduce((sum, win) => sum + win, 0)).toBe(1)
    // 정규시즌 순위표는 그대로다 — 45경기 뒤 경기가 순위표에 더 쌓이면 안 된다
    expect(after.league).toEqual(before.league)
  })

  it('3승을 채우면 다음 라운드로 올라간다', () => {
    let career = 포스트시즌선수()
    for (let win = 0; win < 3; win += 1) {
      career = applyGameResult(career, 포스트시즌경기())
    }

    expect(career.postseason?.round).toBe('플레이오프')
  })
})

describe('다음 경기 상대 — 일정표와 시리즈 (0xb765c)', () => {
  it('정규시즌에는 일정표가 그날 상대를 정한다', () => {
    const 선수 = { ...createCareer('선수'), teamId: 3, gamesPlayed: 0 }

    expect(nextOpponentOf(선수)).toBe(opponentOf(0, 3))
    expect(nextOpponentOf({ ...선수, gamesPlayed: 5 })).toBe(opponentOf(5, 3))
  })

  it('포스트시즌에는 지금 시리즈의 맞은편이 상대다', () => {
    const 정산 = applySeasonEnd({ ...createCareer('선수'), gamesPlayed: GAMES_PER_SEASON, teamId: 2 })
    const 시리즈 = 정산.postseason!

    // 준PO 는 3위 vs 4위 — 빈 리그라 팀 2·3 이 붙는다
    expect(nextOpponentOf(정산)).toBe(시리즈.teams[0] === 2 ? 시리즈.teams[1] : 시리즈.teams[0])
  })

  it('포스트시즌에 진출하지 못했으면 일정표로 돌아간다', () => {
    const 정산 = applySeasonEnd({ ...createCareer('선수'), gamesPlayed: GAMES_PER_SEASON, teamId: 9 })

    expect(nextOpponentOf(정산)).toBe(opponentOf(GAMES_PER_SEASON, 9))
  })
})

describe('타자에게 체력은 없다 (StrHOWTO 능력치 설명)', () => {
  it('타자 커리어에 stamina 필드가 없다 — 체력은 투수 능력치다', () => {
    // StrHOWTO: "1. 투수 능력치 … 체력 : 투구 수에 영향 / 2. 타자 능력치 : 히트·파워·수비·주루"
    // 관리 메뉴 수치도 사기·인기도·평판·소지금·관중뿐이다.
    expect(Object.keys(createCareer('선수'))).not.toContain('stamina')
  })

  it('타자 능력치는 히트·파워·수비·주루 넷뿐이다', () => {
    expect(Object.keys(createCareer('선수').ability).sort()).toEqual(['defense', 'hit', 'power', 'run'])
  })
})

describe('평판 0 연속 카운터 +0x184 — 0xa4d08 (경기 뒤 평가 116, 0x12c32)', () => {
  it('평판이 0 이면 한 칸 올리고, 아니면 0 으로 되돌린다', () => {
    const counted = countGameForSkills({ ...createCareer('전설'), reputation: 0, reputationZeroGames: 3 }, 0)
    expect(counted.reputationZeroGames).toBe(4)
    expect(countGameForSkills({ ...createCareer('전설'), reputation: 1, reputationZeroGames: 3 }, 0).reputationZeroGames).toBe(0)
  })

  it('바이트 칸이라 255 다음은 0 이다', () => {
    expect(countReputationZeroGame(255, 0)).toBe(0)
    expect(countReputationZeroGame(254, 0)).toBe(255)
  })
})

describe('리그 투수 레코드 — 차례와 스태미나 (0x1c46c · 4f2e8 · 4f268)', () => {
  it('사람 경기 준비는 g ≠ 0 이면 두 팀 차례를 한 칸 돌린 것을, g == 0 이면 열 팀 10000 을 본다', () => {
    const career = {
      ...createCareer('선수'),
      teamId: 0,
      gamesPlayed: 6,
      leaguePitcherStaminas: { 3: [2_500, 10_000, 10_000, 10_000, 10_000, 10_000, 10_000, 10_000] },
    }
    const 차려 = leagueGamePitchersOf(career, 3)
    expect(차려.ourOrder).toEqual([1, 2, 3, 0, 4, 5, 6, 7])
    expect(차려.opponentOrder).toEqual([1, 2, 3, 0, 4, 5, 6, 7])
    expect(차려.opponentStaminas?.[0]).toBe(2_500)
    expect(leagueGamePitchersOf({ ...career, gamesPlayed: 0 }, 3).opponentStaminas).toBeUndefined()
  })

  it('하루 끝은 CPU 경기가 깎은 표에 열 팀 +20% 를 건다', () => {
    const career = { ...createCareer('선수'), teamId: 0, gamesPlayed: 2 }
    const 결과 = applyLeagueDay(career, 0, createSeededRandom(1))
    const 표 = 결과.leaguePitcherStaminas ?? {}
    expect(Object.keys(표).length).toBe(8)
    expect(표[0]).toBeUndefined()
  })

  it('포스트시즌 경기 끝은 CPU 리그 경기를 건너뛴다 (4f268) — 순위표가 그대로고 회복만 돈다', () => {
    const career = {
      ...createCareer('선수'),
      gamesPlayed: 47,
      leaguePitcherStaminas: { 1: [5_000, 10_000, 10_000, 10_000, 10_000, 10_000, 10_000, 10_000] },
      postseason: { round: '플레이오프', qualifiers: [0, 1, 2, 3], teams: [1, 0], wins: [1, 0], winsNeeded: 3, champion: null },
    } as unknown as Parameters<typeof applyLeagueDay>[0]
    const 결과 = applyLeagueDay(career, 0, createSeededRandom(1))
    expect(결과.league).toBe(career.league)
    expect(결과.leaguePitcherStaminas?.[1]?.[0]).toBe(7_000)
  })
})

describe('사람 경기 투수 줄 — 정산 0xa8024 · 경기 끝 0xa7de8 (정규시즌만, 0xa56dc)', () => {
  const 경기 = {
    result: '승',
    stats: EMPTY_SEASON_STATS,
    recordIds: [],
    ourTeamId: 0,
    opponentTeamId: 3,
    leaguePitchers: {
      lines: [
        { teamId: 0, pitcherSlot: 1, outs: 27, runsAllowed: 2, strikeouts: 7, pitches: 120 },
        { teamId: 3, pitcherSlot: 2, outs: 24, runsAllowed: 5, strikeouts: 3, pitches: 130 },
      ],
      decision: { winner: { side: 1, number: 1 }, loser: { side: 0, number: 2 }, save: null },
      sideTeams: [3, 0],
    },
  } as unknown as GameSummary

  it('정규시즌이면 두 팀 투수 줄과 승·패가 리그 기록표에 쌓인다', () => {
    const 표 = applyGameResult(createCareer('선수'), 경기).leaguePlayerStats.pitchers ?? {}
    const 우리 = Object.values(표).find((line) => line.outs === 27)
    const 상대 = Object.values(표).find((line) => line.outs === 24)
    expect(우리).toMatchObject({ runsAllowed: 2, strikeouts: 7, pitches: 120, wins: 1, losses: 0 })
    expect(상대).toMatchObject({ runsAllowed: 5, wins: 0, losses: 1 })
  })

  it('포스트시즌 경기는 쌓지 않는다 — 0xa56dc 의 모드 3·4 갈래가 +0xb4 를 보고 거짓', () => {
    const career = {
      ...createCareer('선수'),
      postseason: { round: '플레이오프', qualifiers: [0, 1, 2, 3], teams: [1, 0], wins: [0, 0], winsNeeded: 3, champion: null },
    } as unknown as Parameters<typeof applyGameResult>[0]
    expect(applyGameResult(career, 경기).leaguePlayerStats.pitchers).toBeUndefined()
  })
})

describe('새 시즌 0x1b882 — memset(S+0x1bc, 0, 4)', () => {
  it('연속 기록 세 칸을 지운다', () => {
    const career = { ...createCareer('연속'), streaks: { multiHit: 4, homeRun: 2, hitless: 1 } }
    expect(startNextSeason(career).streaks).toEqual({ multiHit: 0, homeRun: 0, hitless: 0 })
  })
})

describe('116 경기 뒤 카운터 12bc2~12c84 — 무력감 +0x1c7 · 먹튀 +0x1cd/+0x1c0', () => {
  it('무력감이 없으면 +0x1c7 를 지우지 않고 그대로 둔다 · 있으면 사기 ≥ 90 → +1, 아니면 0', () => {
    const base = { ...createCareer('카운터'), highMoraleStreak: 6, morale: 95 }
    expect(countGameForSkills(base, 0).highMoraleStreak).toBe(6)
    expect(countGameForSkills({ ...base, skillIds: [...base.skillIds, 5] }, 0).highMoraleStreak).toBe(7)
    expect(countGameForSkills({ ...base, skillIds: [...base.skillIds, 5], morale: 89 }, 0).highMoraleStreak).toBe(0)
  })

  it('먹튀가 있으면 경기 수 +1 · 인기도 변화 합, 없으면 둘 다 0', () => {
    const base = { ...createCareer('카운터'), moneyGrubberGames: 2, moneyGrubberPopularityGain: 5 }
    expect(countGameForSkills({ ...base, skillIds: [...base.skillIds, 2] }, -2)).toMatchObject({ moneyGrubberGames: 3, moneyGrubberPopularityGain: 3 })
    expect(countGameForSkills(base, 4)).toMatchObject({ moneyGrubberGames: 0, moneyGrubberPopularityGain: 0 })
  })
})

describe('116 의 +0x1c2 쌓기 12c14~12c30 — s16 합 += s8 +0x4a', () => {
  it('+0x4a 는 s8 로 읽어 −128~127 을 넘는 변화는 잘려 돌고, 합은 s16 으로 돈다', () => {
    const base = createCareer('인기')
    expect(countGameForSkills({ ...base, seasonPopularityGain: 10 }, 5).seasonPopularityGain).toBe(15)
    expect(countGameForSkills({ ...base, seasonPopularityGain: 10 }, 130).seasonPopularityGain).toBe(10 - 126)
    expect(countGameForSkills({ ...base, seasonPopularityGain: 10 }, -129).seasonPopularityGain).toBe(10 + 127)
    expect(countGameForSkills({ ...base, seasonPopularityGain: 32767 }, 1).seasonPopularityGain).toBe(-32768)
  })
})

describe('116 기록 줄 글 — 0x1278c 모드 4 갈래 12958~1299a', () => {
  it('S+0x1d8 [0]~[3] 을 "타수 · 안타 · 타점 · 홈런!N" 으로 잇는다', () => {
    expect(nariRecordLineTextOf({ atBats: 5, hits: 3, runsBattedIn: 4, homeRuns: 2 })).toBe('5타수 3안타 4타점 2홈런!N')
  })

  it('줄이 없던 옛 저장은 그 경기 성적으로 짓는다', () => {
    const stats = { ...createCareer('x').stats, atBats: 4, hits: 1, runsBattedIn: 0, homeRuns: 0 }
    const lastGame = { summary: { stats } } as unknown as NariLastGame
    expect(nariLastGameRecordLineOf(lastGame)).toEqual({ atBats: 4, hits: 1, runsBattedIn: 0, homeRuns: 0 })
    expect(nariLastGameRecordLineOf({ ...lastGame, recordLine: { atBats: 1, hits: 1, runsBattedIn: 1, homeRuns: 1 } }))
      .toEqual({ atBats: 1, hits: 1, runsBattedIn: 1, homeRuns: 1 })
  })
})

describe('몹쓸몸 · 유리몸 훈련 수 +0x75/+0x76 — 0x18b86~0x18bd6', () => {
  it('가진 채 훈련하면 +1, 안 가졌으면 0 으로 되돌린다(u8)', () => {
    const 가짐 = countTraining({ ...createCareer('몸'), skillIds: [3], badBodyTrainings: 2, fragileTrainings: 4 }, '히트')
    expect(가짐.badBodyTrainings).toBe(3)
    expect(가짐.fragileTrainings).toBe(0)
    expect(countTraining({ ...createCareer('몸'), skillIds: [4], fragileTrainings: 255 }, '히트').fragileTrainings).toBe(0)
  })
})
