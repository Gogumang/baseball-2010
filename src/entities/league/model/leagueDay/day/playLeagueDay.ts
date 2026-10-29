import { rotateLeaguePitchers } from '@/entities/league/model/league'
import type { League } from '@/entities/league/model/league'
import {
  EMPTY_LEAGUE_PLAYER_STATS,
  recordLeaguePitcherAppearances,
  recordLeaguePlateAppearances,
  recordLeagueStolenBases,
} from '@/entities/league/model/leaguePlayerStats'
import type { LeaguePlayerStats } from '@/entities/league/model/leaguePlayerStats'
import { cpuGameRotationAdvances, SEASON_MODE } from '@/entities/pitcher-career/model/pitcherRotation'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { LeagueAbilityContext } from '@/entities/league/model/leagueDay/ability/abilityContext'
import { playCpuLeagueGame } from '@/entities/league/model/leagueDay/day/cpuLeagueGame'
import type { LeagueDayRun } from '@/entities/league/model/leagueDay/day/cpuLeagueGame'
import { LEAGUE_DAY_NO_SCORE } from '@/entities/league/model/leagueDay/day/leagueDayBoard'
import type { LeagueDayResult } from '@/entities/league/model/leagueDay/day/leagueDayBoard'
import type { LeagueTeamRecord } from '@/entities/league/model/leagueDay/roster/teamRecord'
import { matchupsOf } from '@/entities/league/model/leagueDay/schedule/matchups'

/**
 * 하루치 경기를 리그 전적에 넣는다. `myTeamId` 가 낀 경기는 사람이 직접 치르므로 건너뛴다.
 * 원본에 무승부가 없어 어느 한쪽이 반드시 승이 되고, 점수를 더 낸 **명단**의 팀이 이긴다 — 칸과 명단이 엇갈려
 * 원정 팀 선수가 말 공격을 한다 (`cpuGameSidesOf`, 아래 주석).
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
  /** 팀 번호 → 투수 칸별 시작 스태미나 (`simulateLeagueGame` 의 `startingStaminas`). 안 넘기면 모두 10000 */
  pitcherStaminas: Readonly<Record<number, readonly number[]>> = {},
  /**
   * 마선수 레벨 열 칸 `mgr[0x13a..0x143]` — CPU 끼리 경기에 들어가는 마선수의 능력치 배율 `0xd88aa`.
   * 안 넘기면 모두 Lv1(60%). 앱은 시즌모드·커리어(타자편·투수편) 모두 `useAceLevels().levels` 를 넘긴다.
   */
  aceLevels?: Readonly<Record<number, number>>,
  /**
   * 사람 경기 두 팀의 로테이션을 여기서 돌리는가 (기본 참). 원본은 사람 경기 준비 `0x6548`(670e~673e)이 g ≠ 0 이면
   * 상대와 내 팀(타자편·시즌) 레코드를 한 칸씩 돌린다 — 그 준비가 아직 리그 차례(`pitcherOrders`)를 돌리지 않으므로
   * 하루 한 칸이 빠지지 않게 여기서 대신 돌린다. 투수편 내 팀은 원본이 돌리지 않고 0↔k 를 맞바꾼다(0xa4f60) —
   * 사람 경기 쪽이 차례를 직접 다루게 되면 거짓을 넘긴다.
   */
  rotatesHumanGameTeams: boolean = true,
  /** 경기용 능력치의 모드 갈래 (`LeagueAbilityContext`) — 시즌모드는 `{ mode: 2, teamAbilities, coach }`. 안 넘기면 모드 2 밖 */
  abilityContext?: LeagueAbilityContext,
  /**
   * 팀 번호 → 그 팀 레코드의 선수 배열 (`LeagueTeamRecord`) — 시즌모드는 트레이드로 바뀐 CPU 팀(`SeasonSave.cpuRosters`)만
   * 준다. 원본 하루 경기 0xc2a48 → 준비 0xc239c → 팀 객체 0xb891c·0xb8680 이 시즌 저장의 팀 레코드(0x1f570)를 그대로
   * 읽는다. 안 주거나 undefined 면 붙박이 표다.
   */
  recordOf: (teamId: number) => LeagueTeamRecord | undefined = () => undefined,
): LeagueDayResult {
  const matchups = matchupsOf(day)
  const scoresA = matchups.map(() => LEAGUE_DAY_NO_SCORE)
  const scoresB = matchups.map(() => LEAGUE_DAY_NO_SCORE)
  const isHumanGame = (matchup: { readonly away: number; readonly home: number }) => matchup.away === myTeamId || matchup.home === myTeamId
  // 리그 모드(2·3·4)는 g ≠ 0 이면 경기 준비마다 두 팀 레코드가 한 칸 돈다 — 모드 차이는 내 팀 쪽뿐이라 2 로 묻는다
  const rotates = cpuGameRotationAdvances(SEASON_MODE, day)
  const run: LeagueDayRun = {
    random,
    rotates,
    aceLevels,
    abilityContext,
    recordOf,
    plateAppearances: [],
    stolenBases: [],
    pitcherAppearances: [],
    staminas: { ...pitcherStaminas },
    aceStaminas: {},
    recordAces: {},
  }
  const humanGame = matchups.find(isHumanGame)
  const rotated =
    rotates && rotatesHumanGameTeams && humanGame !== undefined ? rotateLeaguePitchers(league, [humanGame.away, humanGame.home]) : league
  const played = matchups.reduce((before, matchup, slot) => {
    if (isHumanGame(matchup)) return before
    const { league: after, score } = playCpuLeagueGame(before, matchup, run)
    // 점수표 c2b8a·c2b9a — A(홈) 명단이 친 칸 0 점수가 scoreA 다 (`LeagueDayBoard` 주석)
    scoresA[slot] = score.awayRuns
    scoresB[slot] = score.homeRuns
    return after
  }, rotated)

  return {
    board: {
      teamsA: matchups.map((matchup) => matchup.home),
      teamsB: matchups.map((matchup) => matchup.away),
      scoresA,
      scoresB,
    },
    league: played,
    playerStats: recordLeaguePitcherAppearances(
      recordLeagueStolenBases(recordLeaguePlateAppearances(playerStats, run.plateAppearances), run.stolenBases),
      run.pitcherAppearances,
    ),
    pitcherStaminas: run.staminas,
    acePitcherStaminas: run.aceStaminas,
    recordAces: run.recordAces,
  }
}
