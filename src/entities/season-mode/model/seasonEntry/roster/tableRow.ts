import type { RosterPlayer } from '@/shared/config/original/roster'
import { HALL_OF_FAME_FIRST_ID, tableTeamOf } from '@/entities/season-mode/model/playerRecruit'
import type { SeasonPlayer } from '@/entities/season-mode/model/playerRecruit'
import { teamBatters, teamPitchers } from '@/entities/season-mode/model/seasonEntry/otherSlices'

/** 리그 선수(id < 0xb4)의 붙박이 표 행 — 그 선수의 표 팀(`tableTeamOf`, 트레이드로 옮겨 온 선수는 옛 팀)의 id 번째. 표 밖 선수면 없다 */
export function tableRowOf(teamId: number, player: SeasonPlayer, isPitcher: boolean): RosterPlayer | undefined {
  const team = tableTeamOf(player, teamId)
  if (player.id >= HALL_OF_FAME_FIRST_ID) return undefined
  return (isPitcher ? teamPitchers(team) : teamBatters(team))[player.id]
}
