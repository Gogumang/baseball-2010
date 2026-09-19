import { describe, expect, it } from 'vitest'
import {
  GAMES_PER_SEASON,
  applyGameResult,
  applyLeagueDay,
  applyPostseasonProgress,
  applySeasonEnd,
  createCareer,
  nextOpponentOf,
} from '@/entities/career/model/playerCareer'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { LEAGUE_TEAM_COUNT, rankingOf } from '@/entities/league/model/league'
import { EMPTY_SEASON_STATS } from '@/entities/career/model/seasonStats'
import type { GameSummary } from '@/entities/game/model/gameSummary'
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

/** 경기 하나를 정산까지 태운다 — `useCareerSession` 이 하는 순서 그대로다 */
function 경기하루(career: PlayerCareer, result: '승' | '패', random: RandomPort): PlayerCareer {
  const summary = {
    result,
    stats: EMPTY_SEASON_STATS,
    recordIds: [],
    ourTeamId: career.teamId,
    opponentTeamId: nextOpponentOf(career),
  } as unknown as GameSummary

  return applyPostseasonProgress(
    applySeasonEnd(applyLeagueDay(applyGameResult(career, summary), summary.ourTeamId, random)),
    random,
  )
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

  it('45경기째에 포스트시즌이 열리고 내 차례이거나 우승이 정해져 있다', () => {
    const career = 한시즌(777)

    expect(career.postseason).not.toBeNull()
    const series = career.postseason!
    const 내차례 = series.teams[0] === career.teamId || series.teams[1] === career.teamId
    expect(내차례 || series.round === '종료', `라운드 ${series.round}, 팀 ${series.teams}`).toBe(true)
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
