import type { PitcherRun } from '@/entities/mission/model/pitcherRun/types'
import type { MissionGameSetup } from '@/entities/mission/model/missionGame'
import { startMissionGame } from '@/entities/mission/model/missionGame'
import { startMissionCpuTeam } from '@/entities/mission/model/missionCpuTeam'
import { createProgress } from '@/entities/mission/model/missionGoal'
import { limitOrNull, missionStartFielderZeroOf } from '@/entities/mission/model/missionRun'
import { missionStartRunnersOf } from '@/entities/mission/model/missionRunners'
import type { OriginalMission } from '@/shared/config/original/missions'

/** `setup` — 마선수 대결이면 사람 칸 팀을 바꾼다 (`missionHumanTeamIdOf`, 0xaa57c aa6dc~aa728) */
export function startPitcherMission(mission: OriginalMission, setup: MissionGameSetup = {}): PitcherRun {
  const cpu = startMissionCpuTeam(mission)
  const game = startMissionGame(mission, setup)
  return {
    mission,
    progress: createProgress(),
    status: '진행중',
    remainingSeconds: limitOrNull(mission.timeLimitSeconds),
    remainingPlateAppearances: limitOrNull(mission.plateAppearanceLimit),
    remainingSwings: null,
    remainingPitches: limitOrNull(mission.pitchLimit),
    perfectGauges: 0,
    bases: mission.start.runners,
    // 시작 주자 — 0xaae7c aafbc → 0xa9a10: 앞선 찬 루부터 CPU 공격 팀 지금 타자 칸에서 거꾸로 1 · 2 · 3 번째 타순 칸
    runners: missionStartRunnersOf({ mission, bases: mission.start.runners, game, cpu }),
    outs: mission.start.outs,
    totalOuts: 0,
    allowed: { runs: 0, hits: 0, walks: 0, baserunner: 0 },
    cpu,
    game,
    fielderZeroRecord: missionStartFielderZeroOf({ mission, game }),
  }
}
