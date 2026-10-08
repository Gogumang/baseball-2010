import { describe, expect, it } from 'vitest'
import {
  GAMES_PER_SEASON,
  applyGameResult,
  applyLeagueDay,
  applySeasonEnd,
  createCareer,
  nextOpponentOf,
  startNextSeason,
} from '@/entities/career/model/playerCareer'
import { EMPTY_LEAGUE_PLAYER_STATS } from '@/entities/league/model/leaguePlayerStats'
import { LEADER_KIND, QUALIFIED_AT_BATS, leaderOf } from '@/entities/awards/model/leaderboard'
import {
  MAXIMUM_SALARY_RANK,
  careerLeagueRecordsOf,
  judgeSeasonAwards,
  salaryNegotiationRankOf,
} from '@/entities/awards/model/seasonAwards'
import { SALARY_FIRM_EVENT_ID, salaryResultEventId } from '@/entities/career/model/seasonFlow'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { LEAGUE_TEAM_COUNT, rankingOf } from '@/entities/league/model/league'
import { EMPTY_SEASON_STATS } from '@/entities/career/model/seasonStats'
import type { GameSummary } from '@/entities/game/model/gameSummary'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { createFractionRandom } from '@/shared/api/random/fractionRandom'
import { playLeagueDay } from '@/entities/league/model/leagueDay'
import { createSeededRandom } from '@/shared/api/random/seededRandom'

function 씨앗난수(seed: number): RandomPort {
  let state = seed
  return createFractionRandom(() => {
    state = (state * 1103515245 + 12345) % 2147483648
    return state / 2147483648
  })
}

/** 경기 하나를 정산까지 태운다 — `useCareerSession` 이 하는 순서 그대로다 */
function 경기하루(career: PlayerCareer, result: '승' | '패', random: RandomPort): PlayerCareer {
  const summary = {
    result,
    stats: EMPTY_SEASON_STATS,
    recordIds: [],
    ourTeamId: career.teamId,
    opponentTeamId: nextOpponentOf(career),
  } as unknown as GameSummary

  // CPU 끼리의 포스트시즌 경기는 경기 뒤가 아니라 대진 화면 128 의 [확인](0x13da0)에서 돈다
  return applySeasonEnd(applyLeagueDay(applyGameResult(career, summary), summary.ourTeamId, random))
}

describe('한 시즌 통째로 — 경기 정산 흐름이 이어지는가', () => {
  const 한시즌 = (seed: number) => {
    const random = 씨앗난수(seed)
    let career: PlayerCareer = { ...createCareer('통합'), teamId: 0 }
    for (let game = 0; game < GAMES_PER_SEASON; game += 1) {
      career = 경기하루(career, game % 2 === 0 ? '승' : '패', random)
    }
    return career
  }

  it('45경기를 치르면 열 팀 전적이 모두 쌓인다 — 예전에는 내 팀만 쌓였다', () => {
    const career = 한시즌(2010)

    for (let team = 0; team < LEAGUE_TEAM_COUNT; team += 1) {
      const played = career.league.wins[team] + career.league.losses[team]
      expect(played, `${team}번 팀이 한 경기도 안 치렀습니다`).toBeGreaterThan(0)
    }
  })

  it('리그 전체 승 수와 패 수가 같다 — 경기마다 한 쪽씩 들어간다', () => {
    const { league } = 한시즌(7)
    const 합 = (values: readonly number[]) => values.reduce((sum, value) => sum + value, 0)

    expect(합(league.wins)).toBe(합(league.losses))
  })

  it('내 팀은 45경기 중 정규시즌 경기만큼만 쌓인다', () => {
    const career = 한시즌(42)
    const 내팀경기 = career.league.wins[0] + career.league.losses[0]

    // 45번째 경기에서 포스트시즌이 열리므로 정규시즌 전적은 45 이하다
    expect(내팀경기).toBeGreaterThan(0)
    expect(내팀경기).toBeLessThanOrEqual(GAMES_PER_SEASON)
  })

  it('45경기째에 포스트시즌 대진(준플레이오프 3위 대 4위)이 열리고, CPU 경기는 아직 안 돌았다', () => {
    const career = 한시즌(777)

    expect(career.postseason).not.toBeNull()
    const series = career.postseason!
    expect(series.round).toBe('준플레이오프')
    expect(series.wins).toEqual([0, 0])
    expect(series.teams).toEqual([series.qualifiers[2], series.qualifiers[3]])
  })

  it('순위는 승이 많은 팀이 앞이다', () => {
    const { league } = 한시즌(31337)
    const ranking = rankingOf(league)

    for (let rank = 1; rank < ranking.length; rank += 1) {
      const 앞 = league.wins[ranking[rank - 1]]
      const 뒤 = league.wins[ranking[rank]]
      expect(앞, `${rank}위(${뒤}승)가 ${rank - 1}위(${앞}승)보다 많이 이겼습니다`).toBeGreaterThanOrEqual(뒤)
    }
  })

  /**
   * 개인 타이틀·MVP·연봉협상 등급의 재료 (0xa8024 → 0x9d789 → 0xa4d78, B-2·B-3·B-5).
   * 45경기를 치르면 리그 선수 전원에게 시즌 성적이 있어야 한다.
   */
  it('45경기를 치르면 리그 선수 기록표가 차고, 규정 타수(104)를 넘는 선수가 나온다', () => {
    const career = 한시즌(2010)
    const lines = Object.values(career.leaguePlayerStats.batters)

    expect(lines.length).toBeGreaterThan(0)
    expect(lines.reduce((sum, line) => sum + line.homeRuns, 0)).toBeGreaterThan(0)
    expect(lines.filter((line) => line.atBats >= QUALIFIED_AT_BATS).length).toBeGreaterThan(0)
  })

  it('그 표로 만든 순위표에 홈런·타점 1위가 실제로 나온다 — 예전에는 재료가 없어 수상이 없었다', () => {
    const career = 한시즌(2010)
    const records = careerLeagueRecordsOf(career)

    expect(leaderOf(records, LEADER_KIND.홈런)).not.toBeNull()
    expect(leaderOf(records, LEADER_KIND.타점)).not.toBeNull()
    expect(leaderOf(records, LEADER_KIND.타율)).not.toBeNull()
  })

  it('새 시즌이 되면 기록표가 0 으로 돌아간다 (0x204e0)', () => {
    const 지난시즌 = 한시즌(2010)

    expect(Object.keys(지난시즌.leaguePlayerStats.batters).length).toBeGreaterThan(0)
    expect(startNextSeason(지난시즌).leaguePlayerStats).toEqual(EMPTY_LEAGUE_PLAYER_STATS)
  })

  /**
   * B-5 등급표의 꼭대기 — 3관왕 + MVP = k 5 → 강경 384(+30%) · 정중 388(+20%).
   * 리그 선수 기록표가 실제로 판정을 움직이는지 한 시즌 돌린 표 위에서 확인한다.
   */
  it('3관왕 + MVP 면 k = 5 가 나온다', () => {
    const 지난시즌 = 한시즌(2010)
    const 리그최고 = (pick: (line: { atBats: number; hits: number; homeRuns: number; runsBattedIn: number }) => number) =>
      Object.values(지난시즌.leaguePlayerStats.batters).reduce((best, line) => Math.max(best, pick(line)), 0)

    // 리그 누구보다 잘 친 성적 + 올해의 목표를 전부 채운 인기도 → 세 부문 1위와 MVP 조건을 모두 넘긴다
    const 최강 = {
      ...지난시즌,
      popularity: 4000,
      popularityAtSeasonStart: 0,
      stats: {
        ...EMPTY_SEASON_STATS,
        atBats: QUALIFIED_AT_BATS + 100,
        hits: QUALIFIED_AT_BATS + 100,
        homeRuns: 리그최고((line) => line.homeRuns) + 1,
        runsBattedIn: 리그최고((line) => line.runsBattedIn) + 1,
      },
    }
    const awards = judgeSeasonAwards(최강, careerLeagueRecordsOf(최강))

    expect(awards.wonCount).toBe(3)
    expect(awards.isMostValuablePlayer).toBe(true)
    expect(salaryNegotiationRankOf(최강)).toBe(MAXIMUM_SALARY_RANK)
    expect(salaryResultEventId(SALARY_FIRM_EVENT_ID, salaryNegotiationRankOf(최강))).toBe(384)
  })

  it('상대는 일정표대로 돌아 한 시즌에 아홉 팀을 고루 만난다', () => {
    let career: PlayerCareer = { ...createCareer('통합'), teamId: 0 }
    const 상대들 = new Set<number>()
    for (let game = 0; game < GAMES_PER_SEASON; game += 1) {
      상대들.add(nextOpponentOf(career))
      career = { ...career, gamesPlayed: career.gamesPlayed + 1 }
    }

    expect(상대들.size).toBe(LEAGUE_TEAM_COUNT - 1)
  })
})

describe('같은 날 CPU 끼리 경기는 전역 마선수 레벨을 본다 (0xc2a48 · 0xd88aa)', () => {
  it('applyLeagueDay 가 넘긴 레벨을 playLeagueDay 에 그대로 건넨다', () => {
    const 레벨 = { 0: 4, 1: 4, 2: 4, 3: 4, 4: 4, 5: 4, 6: 4, 7: 4, 8: 4, 9: 4 }
    const career: PlayerCareer = { ...createCareer('레벨'), teamId: 0, gamesPlayed: 3 }
    for (let seed = 1; seed <= 10; seed += 1) {
      const 결과 = applyLeagueDay(career, 0, createSeededRandom(seed), 레벨)
      const 기대 = playLeagueDay(career.league, 2, 0, createSeededRandom(seed), career.leaguePlayerStats, {}, 레벨)
      expect(결과.league).toEqual(기대.league)
      expect(결과.leaguePlayerStats).toEqual(기대.playerStats)
    }
  })
})
