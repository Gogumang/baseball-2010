/**
 * 나리 팀 레코드가 쓰는 **다른 조각**(리그 팀 수 · 마타자 칸 · 붙박이 팀 명단 · 간이 경기 명단 · 대타 빈 기록 · 마선수 표)의 값 —
 * 조각 경계를 넘는 import 를 이 파일 한 곳에 모은다(`lint.boundaries-baseline.js` 의 cross-slice 예외는 이 파일 하나).
 */
export { LEAGUE_TEAM_COUNT } from '@/entities/league/model/league'
export { ACE_BATTER_ROSTER_SLOT } from '@/entities/league/model/leagueDay'
export { teamBatters } from '@/entities/team/model/teamRoster'
export { QUICK_LINEUP_SIZE, renumberedRecordSlotsOf, rosterSlotAt, type QuickLineup } from '@/entities/game/model/quickLineup'
export { EMPTY_BATTER_GAME_RECORD } from '@/entities/batting/model/pinchHitAi'
export { ACE_BATTERS } from '@/entities/game/model/aceOpponent'
