import { TEAMS } from '@/shared/config/original/teams'

/**
 * **팀 레코드 사기** — 모드별 팀 레코드 s16 `+2` (XlsTEAM_DATA 행의 둘째 u16). 표에서는 전 팀이 100 이다.
 *
 * 스태미나 용량 `0x66e44(V, P, f)` 의 `V[+2]` 가 이 칸이다 — `V = 0x1f9a8(전역, 모드 = state[1], 팀+0x25)` 로 **그 투수 팀의**
 * 레코드를 찾으므로(0xaeb08, P1 3-2) 상대 팀 투수는 상대 팀 레코드의 사기를 쓴다. 모드 3·4(나리)는 `0x1f940`(전역+0xb8) 의
 * 팀 레코드다. 투수편 내 팀 사기(`pitcherGameOptions.teamMoraleOf`)도 같은 칸이다.
 *
 * ⚠️ 미확인: 모드 3·4 에서 팀 레코드 `+2` 를 경기 사이에 바꾸는 곳은 찾아보지 않았다 — 웹은 내 팀 · 상대 팀 모두 표값을 쓴다.
 */
const TEAM_MORALE_VALUE_INDEX = 1
export const DEFAULT_TEAM_MORALE = 100

export function teamRecordMoraleOf(teamId: number): number {
  return TEAMS[teamId]?.values[TEAM_MORALE_VALUE_INDEX] ?? DEFAULT_TEAM_MORALE
}
