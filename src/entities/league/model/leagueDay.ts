import { LEAGUE_TEAM_COUNT, opponentOf, recordLeagueResult } from '@/entities/league/model/league'
import type { League } from '@/entities/league/model/league'
import { simulateHalfInning } from '@/entities/game/model/simulateHalfInning'
import { batterAt, startingPitcherOf } from '@/entities/team/model/teamRoster'
import type { RandomPort } from '@/shared/api/random/randomPort'

/**
 * 하루치 리그 경기 (binary.mod 0xc2a48).
 * 원본은 팀 전력으로 점수를 뽑지 않는다 — 오늘의 다섯 대진을 짜고, 내 팀 경기만 빼고
 * 나머지를 **사람 경기와 같은 타석 엔진**으로 끝까지 돌린 뒤 최종 점수를 읽어 승패를 기록한다.
 *
 * **무승부가 없다.** 리그 구조체에 무승부 칸 자체가 없어서, 점수가 같으면 한쪽이 승으로 들어간다.
 */
export const REGULAR_INNINGS = 9
/** 0xc262c 가 이닝 14 를 특별히 다루는 것으로 보아 연장 상한으로 본다 (추정) */
export const MAXIMUM_INNINGS = 14

export interface LeagueMatchup {
  /** 먼저 공격하는 쪽 */
  readonly away: number
  readonly home: number
}

/**
 * 오늘 치르는 다섯 경기. 일정표 0xd89cb 를 팀 번호가 작은 쪽부터 훑어 짝을 짓는다.
 * 원본은 홈/원정을 0xb7844 (일차 패리티 + 22일차 반전)로 정하는데, 승패 기록에는
 * 영향이 없어 여기서는 번호가 작은 쪽을 먼저 공격하게 둔다 (추정).
 */
export function matchupsOf(day: number): readonly LeagueMatchup[] {
  const matchups: LeagueMatchup[] = []
  const scheduled = new Set<number>()
  for (let team = 0; team < LEAGUE_TEAM_COUNT; team += 1) {
    if (scheduled.has(team)) continue
    const opponent = opponentOf(day, team)
    scheduled.add(team)
    scheduled.add(opponent)
    matchups.push({ away: team, home: opponent })
  }
  return matchups
}

export interface LeagueGameScore {
  readonly awayRuns: number
  readonly homeRuns: number
}

/** 한 경기를 9이닝(동점이면 연장)까지 돌린다 */
export function simulateLeagueGame(matchup: LeagueMatchup, random: RandomPort): LeagueGameScore {
  const awayPitcher = startingPitcherOf(matchup.away)
  const homePitcher = startingPitcherOf(matchup.home)
  let awayRuns = 0
  let homeRuns = 0
  let awayOrder = 0
  let homeOrder = 0

  for (let inning = 1; inning <= MAXIMUM_INNINGS; inning += 1) {
    const top = simulateHalfInning(awayOrder, (order) => batterAt(matchup.away, order), homePitcher, inning, random)
    awayRuns += top.runs
    awayOrder = top.nextBattingOrderIndex

    // 홈이 이미 앞서 있으면 9회말은 치르지 않는다
    if (inning >= REGULAR_INNINGS && homeRuns > awayRuns) break

    const bottom = simulateHalfInning(homeOrder, (order) => batterAt(matchup.home, order), awayPitcher, inning, random)
    homeRuns += bottom.runs
    homeOrder = bottom.nextBattingOrderIndex

    if (inning >= REGULAR_INNINGS && awayRuns !== homeRuns) break
  }

  return { awayRuns, homeRuns }
}

/**
 * 하루치 경기를 리그 전적에 넣는다. `myTeamId` 가 낀 경기는 사람이 직접 치르므로 건너뛴다.
 * 점수가 같으면 홈 팀 승으로 넣는다 — 원본에 무승부가 없어서 어느 한쪽이 반드시 승이 된다 (추정).
 */
export function playLeagueDay(
  league: League,
  day: number,
  myTeamId: number,
  random: RandomPort,
): League {
  return matchupsOf(day).reduce((current, matchup) => {
    if (matchup.away === myTeamId || matchup.home === myTeamId) return current
    const score = simulateLeagueGame(matchup, random)
    return score.awayRuns > score.homeRuns
      ? recordLeagueResult(current, matchup.away, matchup.home)
      : recordLeagueResult(current, matchup.home, matchup.away)
  }, league)
}
