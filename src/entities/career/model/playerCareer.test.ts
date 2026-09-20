import { describe, expect, it } from 'vitest'
import { applyGameResult, applySeasonEnd, createCareer, nextOpponentOf, GAMES_PER_SEASON, gamePointRewardOf, nameByteLengthOf, rookieAbilityOf, startNextSeason } from '@/entities/career/model/playerCareer'
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

  it('내 팀 경기 결과를 승·패에 넣는다 — 무승부는 어느 쪽도 세지 않는다', () => {
    const 이김 = applyGameResult(createCareer('선수'), 경기())
    expect([이김.league.wins[0], 이김.league.losses[3]]).toEqual([1, 1])

    const 짐 = applyGameResult(createCareer('선수'), 경기({ result: '패' }))
    expect([짐.league.wins[3], 짐.league.losses[0]]).toEqual([1, 1])

    expect(applyGameResult(createCareer('선수'), 경기({ result: '무' })).league).toEqual(EMPTY_LEAGUE)
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

    expect(next.league).toEqual(EMPTY_LEAGUE)
    expect(next.postseason).toBeNull()
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
