import { LEAGUE_TEAM_COUNT, opponentOf, recordLeagueResult } from '@/entities/league/model/league'
import type { League } from '@/entities/league/model/league'
import { simulateHalfInning } from '@/entities/game/model/simulateHalfInning'
import type { HalfInningResult } from '@/entities/game/model/simulateHalfInning'
import { batterAt, startingPitcherOf } from '@/entities/team/model/teamRoster'
import { rotationSlotOf } from '@/entities/pitcher-career/model/pitcherRotation'
import {
  EMPTY_LEAGUE_PLAYER_STATS,
  recordLeaguePlateAppearances,
} from '@/entities/league/model/leaguePlayerStats'
import type {
  LeaguePlateAppearance,
  LeaguePlayerStats,
} from '@/entities/league/model/leaguePlayerStats'
import type { RandomPort } from '@/shared/api/random/randomPort'

/**
 * 하루치 리그 경기 (binary.mod 0xc2a48).
 * 원본은 팀 전력으로 점수를 뽑지 않는다 — 오늘의 다섯 대진을 짜고, 내 팀 경기만 빼고
 * 나머지를 **사람 경기와 같은 타석 엔진**으로 끝까지 돌린 뒤 최종 점수를 읽어 승패를 기록한다.
 *
 * **무승부가 없다.** 리그 구조체에 무승부 칸 자체가 없어서, 점수가 같으면 한쪽이 승으로 들어간다.
 */
export const REGULAR_INNINGS = 9
/**
 * **원본에는 연장 상한이 없다** (E 3d 확정): 이닝 증가 0xb6b6c 에 막는 값이 없고, 경기 끝 판정
 * 0xb68fc 는 동점이면 절대 끝내지 않으며, 점수판 0xb6988 은 `이닝 mod 9` 로 칸을 돌려 쓴다.
 * 여기 값은 무한 루프를 막는 **우리 쪽 안전망**일 뿐이라 원본 동작이 아니다 — 실제로 걸리는 일은 거의 없다.
 * (0xc262c 의 이닝 14 는 상한이 아니라 "15회에 스윙 강제" 였다. `quickAtBat.ts` 참고)
 */
export const MAXIMUM_INNINGS = 30

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
  /**
   * 이 경기에서 나온 **선수별 타석 결과**. 원본은 CPU 끼리 경기도 사람 경기와 같은 기록 함수
   * 0xa8024 를 불러 선수 레코드에 타수·안타·홈런·타점을 쌓는다 (B-2 확정) — 웹도 여기서
   * 결과를 버리지 않고 내보내, `playLeagueDay` 가 리그 선수 기록표에 쌓는다.
   */
  readonly plateAppearances: readonly LeaguePlateAppearance[]
}

/**
 * 한 경기를 9이닝(동점이면 연장)까지 돌린다.
 *
 * `startingPitcherSlot` 을 주면 **양 팀 모두 그 칸**이 선발이다 — 정규 리그는 날짜로 도는
 * 4인 로테이션(`0xb5ca8`), 국가대항전은 `L+0x32 % 4`(`0xb6c2d`) 라 둘 다 날짜가 정한다.
 * 안 주면 예전처럼 `rand(0,4)` 로 뽑는다 — 일정표가 없는 포스트시즌(0xc2760) 자리다.
 */
export function simulateLeagueGame(
  matchup: LeagueMatchup,
  random: RandomPort,
  startingPitcherSlot?: number,
): LeagueGameScore {
  // 선발은 경기를 세울 때 로스터 앞 4명 중 하나로 정해진다 (0x3107a·0x31090, S13 1-4b)
  const awayPitcher = startingPitcherOf(matchup.away, startingPitcherSlot ?? random)
  const homePitcher = startingPitcherOf(matchup.home, startingPitcherSlot ?? random)
  let awayRuns = 0
  let homeRuns = 0
  let awayOrder = 0
  let homeOrder = 0
  const plateAppearances: LeaguePlateAppearance[] = []
  /** 반 이닝이 내놓은 타석 결과를 공격 팀 것으로 적어 둔다 — 판정에는 손대지 않는다 */
  const collect = (teamId: number, half: HalfInningResult) => {
    for (const appearance of half.plateAppearances) {
      plateAppearances.push({ teamId, ...appearance })
    }
  }

  for (let inning = 1; inning <= MAXIMUM_INNINGS; inning += 1) {
    const top = simulateHalfInning(awayOrder, (order) => batterAt(matchup.away, order), homePitcher, inning, random)
    awayRuns += top.runs
    awayOrder = top.nextBattingOrderIndex
    collect(matchup.away, top)

    // 홈이 이미 앞서 있으면 9회말은 치르지 않는다
    if (inning >= REGULAR_INNINGS && homeRuns > awayRuns) break

    const bottom = simulateHalfInning(homeOrder, (order) => batterAt(matchup.home, order), awayPitcher, inning, random)
    homeRuns += bottom.runs
    homeOrder = bottom.nextBattingOrderIndex
    collect(matchup.home, bottom)

    if (inning >= REGULAR_INNINGS && awayRuns !== homeRuns) break
  }

  return { awayRuns, homeRuns, plateAppearances }
}

/** 하루치 경기가 남긴 것 — 순위표와 **선수 기록표** 두 벌이다 */
export interface LeagueDayResult {
  readonly league: League
  readonly playerStats: LeaguePlayerStats
}

/**
 * 하루치 경기를 리그 전적에 넣는다. `myTeamId` 가 낀 경기는 사람이 직접 치르므로 건너뛴다.
 * 원본에 무승부가 없어 어느 한쪽이 반드시 승이 되고, **원본은 진 팀에 승을 준다** (아래 주석).
 *
 * 원본은 이 경기들도 사람 경기와 같은 기록 함수 0xa8024 를 부르므로 **선수별 성적이 함께 쌓인다**
 * (B-2 확정). 그래서 `playerStats` 를 받아 쌓은 것을 돌려준다 — 이 표가 개인 타이틀·MVP·
 * 연봉협상 등급의 유일한 재료다. 안 넘기면 빈 표에서 시작한다.
 */
export function playLeagueDay(
  league: League,
  day: number,
  myTeamId: number,
  random: RandomPort,
  playerStats: LeaguePlayerStats = EMPTY_LEAGUE_PLAYER_STATS,
): LeagueDayResult {
  const plateAppearances: LeaguePlateAppearance[] = []
  const played = matchupsOf(day).reduce((current, matchup) => {
    if (matchup.away === myTeamId || matchup.home === myTeamId) return current
    // 하루가 끝날 때마다 팀마다 로테이션이 한 칸 돈다 (0xb5ca8, S5 U-16) — 날짜가 선발을 정한다
    const score = simulateLeagueGame(matchup, random, rotationSlotOf(day))
    plateAppearances.push(...score.plateAppearances)
    // ⚠️ 원본 버그를 그대로 옮긴 것 (0xc2a48, R1 확정 · DECISIONS 2026-09-20 ①):
    //    `원정 득점 > 홈 득점` 이면 **홈** 에 승을, 아니면 **원정** 에 승을 준다 — 늘 진 팀이 이긴다.
    //    상대전적도 같이 뒤집히고, 동점이면 원정 승이다.
    //    포스트시즌 0xc2760 은 같은 함수를 쓰면서도 정상이라, 목록 포인터를 엇갈려 넘긴 실수 하나로 설명된다.
    return score.awayRuns > score.homeRuns
      ? recordLeagueResult(current, matchup.home, matchup.away)
      : recordLeagueResult(current, matchup.away, matchup.home)
  }, league)

  return { league: played, playerStats: recordLeaguePlateAppearances(playerStats, plateAppearances) }
}
