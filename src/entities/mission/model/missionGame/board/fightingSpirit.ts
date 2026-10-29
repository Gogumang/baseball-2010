import type { OriginalMission } from '@/shared/config/original/missions'
import { isFightingSpiritSituationOf, sideFightingSpiritStateOf } from '@/shared/lib/liveGameState/liveGameState'
import { cpuSideOf, humanSideOf, missionTeamIdsOf } from '@/entities/mission/model/missionGame/start/sides'
import type { MissionGame } from '@/entities/mission/model/missionGame/types'

/**
 * 미션 경기의 **스킬 14(투지) 갈래 경기 상태** (0xb570c b5a4c~b5a66) — 미션 장면도 전역 상태 [0x1552d0c] 를 굴린다: +0x6b = st[0x6b]
 * (`game.inning`), +0x28 = 0xaa57c aa72a 의 0xb6bd4 가 적은 두 팀(`missionTeamIdsOf`), +0x7e = `game.scores`. 팀은 0xb570c 첫 인자
 * 팀 레코드 +0 (A-23)
 */
export function missionFightingSpiritOf(
  run: { readonly mission: OriginalMission; readonly game: Pick<MissionGame, 'humanBatting' | 'inning' | 'scores'> },
  teamId: number,
): boolean {
  const ids = missionTeamIdsOf(run)
  const sideTeams: [number, number] = [0, 0]
  sideTeams[humanSideOf(run.mission)] = ids.human
  sideTeams[cpuSideOf(run.mission)] = ids.cpu
  return isFightingSpiritSituationOf(sideFightingSpiritStateOf(run.game.inning, sideTeams, run.game.scores), teamId)
}
