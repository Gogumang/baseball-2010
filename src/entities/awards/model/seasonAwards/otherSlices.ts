/**
 * 시상이 쓰는 **다른 조각**(육성 선수 · 올해의 목표 · 리그 팀 수와 선수 기록표 · 팀 명단)의 값 — 조각 경계를 넘는 import 를
 * 이 파일 한 곳에 모은다(`lint.boundaries-baseline.js` 의 cross-slice 예외는 이 파일 하나).
 */
export type { PlayerCareer } from '@/entities/career/model/playerCareer'
export { yearGoalsOf } from '@/entities/career/model/seasonFlow'
export { LEAGUE_TEAM_COUNT } from '@/entities/league/model/league'
export {
  leagueBatterIdOf,
  leagueBatterLineOf,
  leaguePitcherIdOf,
  leaguePitcherLineOf,
  type LeaguePlayerStats,
} from '@/entities/league/model/leaguePlayerStats'
export { teamBatters, teamPitchers } from '@/entities/team/model/teamRoster'
