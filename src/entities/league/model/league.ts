/**
 * 리그 순위표·일정·포스트시즌 (binary.mod 0xb7xxx — 누락 탐색 9차, 바이트 확인).
 *
 * 공개 이름 모음 — 하위 폴더 (`league/`): `schedule`(일정 0xd89cb · 홈/원정 0xb7844) · `standings`(승패 0xb76dc · 0xb77e0 · 새 시즌) ·
 * `pitcherOrders`(투수 레코드 차례 · 로테이션 0xb5ca8) · `ranking`(순위 0xb79d8 · B-36) · `postseasonTypes`(시리즈 꼴) ·
 * `postseasonRotation`(포스트시즌 선발 · 이월 칸) · `postseason`(대진 0xb80a8 · 승 기록 0xb7724 · 준PO 승자 이사) · `otherSlices`(다른 조각)
 */
export { LEAGUE_SIDE_HOME, LEAGUE_TEAM_COUNT, leagueSideOf, opponentOf } from '@/entities/league/model/league/schedule'
export { EMPTY_LEAGUE, nextSeasonLeague, recordLeagueResult, type League } from '@/entities/league/model/league/standings'
export { leagueStarterSlotOf, pitcherOrderOf, rotateLeaguePitchers, UNSHUFFLED_PITCHER_ORDER } from '@/entities/league/model/league/pitcherOrders'
export { rankingOf } from '@/entities/league/model/league/ranking'
export type { PostseasonSeries } from '@/entities/league/model/league/postseasonTypes'
export {
  pitcherOrdersAfterPostseason,
  postseasonGameOf,
  postseasonPitcherOrderOf,
  postseasonRotationTurnsOf,
  postseasonStarterSlotOf,
} from '@/entities/league/model/league/postseasonRotation'
export { advancePostseason, postseasonSideOf, startPostseason, withSemiPlayoffWinner } from '@/entities/league/model/league/postseason'
