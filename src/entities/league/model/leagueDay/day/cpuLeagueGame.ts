import { pitcherOrderOf, recordLeagueResult, rotateLeaguePitchers } from '@/entities/league/model/league'
import type { League } from '@/entities/league/model/league'
import type { LeaguePitcherAppearance, LeaguePlateAppearance, LeagueStolenBase } from '@/entities/league/model/leaguePlayerStats'
import { rollSimulatorInit } from '@/entities/game/model/simulatorInit'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { LeagueAbilityContext } from '@/entities/league/model/leagueDay/ability/abilityContext'
import { cpuGameAcesOf, rollCpuGamePrep } from '@/entities/league/model/leagueDay/aces/cpuGamePrep'
import { simulateLeagueGame } from '@/entities/league/model/leagueDay/game/simulateLeagueGame'
import type { LeagueTeamRecord } from '@/entities/league/model/leagueDay/roster/teamRecord'
import { cpuGameSidesOf } from '@/entities/league/model/leagueDay/schedule/matchups'
import type { LeagueMatchup } from '@/entities/league/model/leagueDay/schedule/matchups'
import type { LeagueGameAces } from '@/entities/league/model/leagueDay/types/leagueGameExtras'
import type { LeagueGameScore } from '@/entities/league/model/leagueDay/types/leagueGameScore'

/** 하루치 CPU 경기들이 함께 쓰는 재료와 모음 칸 — `playLeagueDay` 가 한 번 세운다 */
export interface LeagueDayRun {
  readonly random: RandomPort
  /** g ≠ 0 이면 경기 준비마다 두 팀 레코드가 한 칸 돈다 */
  readonly rotates: boolean
  readonly aceLevels: Readonly<Record<number, number>> | undefined
  readonly abilityContext: LeagueAbilityContext | undefined
  readonly recordOf: (teamId: number) => LeagueTeamRecord | undefined
  readonly plateAppearances: LeaguePlateAppearance[]
  readonly stolenBases: LeagueStolenBase[]
  readonly pitcherAppearances: LeaguePitcherAppearance[]
  readonly staminas: Record<number, readonly number[]>
  readonly aceStaminas: Record<number, number>
  readonly recordAces: Record<number, LeagueGameAces>
}

/**
 * 오늘 대진 한 칸의 CPU 끼리 경기 — 준비 0xc239c(굴림 · 로테이션 · 마선수) → 경기 → 모음 칸 · 리그 전적.
 * 돌려주는 것은 전적을 적은 리그와 그 경기 점수다.
 */
export function playCpuLeagueGame(
  before: League,
  matchup: LeagueMatchup,
  day: LeagueDayRun,
): { readonly league: League; readonly score: LeagueGameScore } {
  // ⚠️ 칸과 명단이 엇갈린다 (0xc239c, 직접 떴다 — `cpuGameSidesOf` 주석): 홈 팀(A목록 X)의 **선수**가 칸 0
  //    (초 공격)에, 원정 팀(Y)의 선수가 칸 1(말 공격)에 선다. 그래서 X 명단을 먼저 공격으로 돌린다.
  const sides = cpuGameSidesOf(matchup.home, matchup.away)
  // c2b54 — 경기마다 간이 시뮬 초기화 0xc0dac 의 rand(0, 2) 가 준비 0xc239c(c2b66)보다 먼저다
  rollSimulatorInit(day.random)
  // 경기 준비의 굴림 다섯 — 구장 · 양 팀 마타자·마투수 (c2464~c24ea). 팀 A = 칸 1(X = 홈)의 객체 = 원정 명단
  const rolls = rollCpuGamePrep(day.random)
  // 굴림 뒤 c24fc~c254e: g ≠ 0 이면 두 팀 레코드를 0xb5ca8 로 한 칸 돌린다(영구) — 0번 레코드가 오늘의 선발이다
  const current = day.rotates ? rotateLeaguePitchers(before, [sides.away, sides.home]) : before
  const orders = { away: pitcherOrderOf(current, sides.away), home: pitcherOrderOf(current, sides.home) }
  // 명단 쪽 마선수 — 그 명단 팀의 레코드에 들어간다(0xb8680 은 팀 객체 +0x25 = 명단 팀으로 레코드를 고른다)
  const aces = cpuGameAcesOf(rolls)
  if (aces.away !== undefined) day.recordAces[sides.away] = aces.away
  if (aces.home !== undefined) day.recordAces[sides.home] = aces.home
  const score = simulateLeagueGame(
    sides,
    day.random,
    { away: orders.away[0] ?? 0, home: orders.home[0] ?? 0 },
    { away: day.staminas[sides.away], home: day.staminas[sides.home] },
    {
      aces,
      aceLevels: day.aceLevels,
      pitcherOrders: orders,
      abilityContext: day.abilityContext,
      records: { away: day.recordOf(sides.away), home: day.recordOf(sides.home) },
    },
  )
  collectCpuGame(day, sides, score)
  // 기록 c2b80~c2bca (R1 항목 3): `score(칸 0) > score(칸 1)` 이면 A(X = 홈)에 승, 아니면 B(Y = 원정)에 승 —
  // 동점이면 원정 승. R1 은 이것을 "진 팀에 승" 으로 읽었지만 칸 0 에서 친 것은 **X 의 선수**라
  // (위 엇갈림) **점수를 더 낸 명단의 팀이 이긴다**. 상대전적도 같은 쪽으로 쌓인다.
  const homeWins = score.awayRuns > score.homeRuns
  const league = homeWins ? recordLeagueResult(current, matchup.home, matchup.away) : recordLeagueResult(current, matchup.away, matchup.home)
  return { league, score }
}

/** 경기 끝 스태미나 · 마투수 칸 · 기록을 하루 모음 칸에 */
function collectCpuGame(day: LeagueDayRun, sides: LeagueMatchup, score: LeagueGameScore): void {
  day.staminas[sides.away] = score.pitcherStaminas.away
  day.staminas[sides.home] = score.pitcherStaminas.home
  if (score.acePitcherStaminas.away !== undefined) day.aceStaminas[sides.away] = score.acePitcherStaminas.away
  if (score.acePitcherStaminas.home !== undefined) day.aceStaminas[sides.home] = score.acePitcherStaminas.home
  day.plateAppearances.push(...score.plateAppearances)
  day.stolenBases.push(...score.stolenBases)
  day.pitcherAppearances.push(...score.pitcherAppearances)
}
