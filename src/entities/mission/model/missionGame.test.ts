import { describe, expect, it } from 'vitest'
import { MISSIONS } from '@/shared/config/original/missions'
import type { OriginalMission } from '@/shared/config/original/missions'
import { missionHumanTeamIdOf, startMissionGame } from '@/entities/mission/model/missionGame'
import { startMission } from '@/entities/mission/model/missionRun'
import { startPitcherMission } from '@/entities/mission/model/pitcherRun'

const missionOf = (side: OriginalMission['side'], id: number): OriginalMission => {
  const found = MISSIONS.find((mission) => mission.side === side && mission.id === id)
  if (found === undefined) throw new Error(`${side} ${id}`)
  return found
}

describe('사람 칸 팀 — 0xaa57c aa6c2~aa734 (마선수 대결이면 그 편 나리 저장의 팀)', () => {
  it('보통 미션은 레코드 +2 의 사람 칸 팀이다', () => {
    const mission = missionOf('타자', 16)
    expect(missionHumanTeamIdOf(mission)).toBe(mission.sideTeams[mission.humanSide === 0 ? 0 : 1])
  })

  it('g[0xf6] ∈ 2..4 면 저장 레코드 +1 의 팀으로 바꾼다 — 다른 칸(CPU 팀)은 그대로다', () => {
    const mission = missionOf('타자', 16)
    const game = startMissionGame(mission, { aceMatch: { originalMode: 4, savedTeamId: 3 } })
    expect(game.humanBatting.teamId).toBe(3)
    expect(game.humanPitching?.teamId).toBe(3)
    expect(game.cpuAutoBatting?.teamId).toBe(mission.sideTeams[mission.humanSide === 0 ? 1 : 0])
    expect(startMission(mission, { aceMatch: { originalMode: 4, savedTeamId: 3 } }).game.humanBatting.teamId).toBe(3)
  })

  it('투수편 대결(g[0xf6] = 3)도 같은 길 — 사람 칸 팀이 치는 자동진행 타선이 그 팀이다', () => {
    const mission = missionOf('투수', 16)
    const run = startPitcherMission(mission, { aceMatch: { originalMode: 3, savedTeamId: 7 } })
    expect(run.game.humanBatting.teamId).toBe(7)
    // CPU 수비(자동진행 반 이닝)는 레코드의 다른 칸 팀
    expect(run.game.cpuAutoPitching?.teamId).toBe(mission.sideTeams[mission.humanSide === 0 ? 1 : 0])
  })

  it('g[0xf6] 가 2..4 밖이면(aa708 · aa70e) 레코드 팀 그대로다', () => {
    const mission = missionOf('타자', 17)
    const recordTeam = missionHumanTeamIdOf(mission)
    expect(missionHumanTeamIdOf(mission, { originalMode: 5, savedTeamId: 2 })).toBe(recordTeam)
    expect(missionHumanTeamIdOf(mission, { originalMode: 1, savedTeamId: 2 })).toBe(recordTeam)
    expect(missionHumanTeamIdOf(mission, { originalMode: 2, savedTeamId: 2 })).toBe(2)
  })
})
