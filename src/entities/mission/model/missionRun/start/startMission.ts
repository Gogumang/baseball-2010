import type { OriginalMission } from '@/shared/config/original/missions'
import { createProgress } from '@/entities/mission/model/missionGoal'
import { startMissionCpuTeam } from '@/entities/mission/model/missionCpuTeam'
import { startMissionGame, type MissionGameSetup } from '@/entities/mission/model/missionGame'
import { missionBoardFielderZeroOf, missionStartRunnersOf } from '@/entities/mission/model/missionRunners'
import { missionFirstHalfIsHuman } from '@/entities/mission/model/missionRun/start/batterUp'
import type { MissionRun } from '@/entities/mission/model/missionRun/types'

/** 첫 0x18 판이 서면(`missionFirstHalfIsHuman`) 0x3fac4 가 칸 0 의 +0xec 에 적는 레코드, 안 서면 null (`missionBoardFielderZeroOf`) */
export function missionStartFielderZeroOf(run: Pick<MissionRun, 'mission' | 'game'>): number | null {
  return missionFirstHalfIsHuman(run) ? missionBoardFielderZeroOf(run) : null
}

/** 원본 레코드는 0 으로 "제한 없음"을 나타낸다. */
export function limitOrNull(limit: number): number | null {
  return limit > 0 ? limit : null
}

/** `setup` — 마선수 대결이면 사람 칸 팀을 바꾼다 (`missionHumanTeamIdOf`, 0xaa57c aa6dc~aa728) */
export function startMission(mission: OriginalMission, setup: MissionGameSetup = {}): MissionRun {
  const cpu = startMissionCpuTeam(mission)
  const game = startMissionGame(mission, setup)
  return {
    mission,
    progress: createProgress(),
    status: '진행중',
    remainingSeconds: limitOrNull(mission.timeLimitSeconds),
    remainingPlateAppearances: limitOrNull(mission.plateAppearanceLimit),
    remainingSwings: limitOrNull(mission.swingLimit),
    bases: mission.start.runners,
    // 시작 주자 — 0xaae7c aafbc → 0xa9a10: 앞선 찬 루부터 지금 타자 칸에서 거꾸로 1 · 2 · 3 번째 타순 칸
    runners: missionStartRunnersOf({ mission, bases: mission.start.runners, game, cpu }),
    outs: mission.start.outs,
    cpu,
    game,
    fielderZeroRecord: missionStartFielderZeroOf({ mission, game }),
  }
}
