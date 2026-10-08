import { describe, expect, it } from 'vitest'
import { MISSIONS } from '@/shared/config/original/missions'
import type { OriginalMission } from '@/shared/config/original/missions'
import {
  MISSION_NARI_RECORD,
  MISSION_NARI_RECORD_FALLBACK,
  battingRecordAt,
  humanRecordsOf,
  missionHumanTeamIdOf,
  startMissionGame,
} from '@/entities/mission/model/missionGame'
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

describe('미션 타자의 레코드 칸 — 0xb87cc → 0xb53f0(0x80 갈래) · 0xb6394 · 0xb8cb8', () => {
  const N = MISSION_NARI_RECORD

  it('k = 선수 +0xa & 0x1f — 옛 k 를 맨 끝(12)으로 밀고 k 에 넣은 뒤 [시작 타순] ↔ [k]', () => {
    // 시작 타순 3, 나리 팀 칸 1
    expect(humanRecordsOf(3, 1)).toEqual([0, 3, 2, N, 4, 5, 6, 7, 8, 9, 10, 11, 1])
  })

  it('k 가 시작 타순과 같으면 그 마스터 줄만 끝으로 간다', () => {
    expect(humanRecordsOf(3, 3)).toEqual([0, 1, 2, N, 4, 5, 6, 7, 8, 9, 10, 11, 3])
  })

  it('k 가 벤치(9~11)여도 타순 앞 아홉은 시작 타순 칸만 바뀐다', () => {
    expect(humanRecordsOf(0, 10)).toEqual([N, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 11, 10])
  })

  it('k 를 모르면 끝 칸 12 — 예전 근사(시작 타순 ↔ 12)와 같다', () => {
    expect(MISSION_NARI_RECORD_FALLBACK).toBe(12)
    expect(humanRecordsOf(2)).toEqual([0, 1, N, 3, 4, 5, 6, 7, 8, 9, 10, 11, 2])
    expect(humanRecordsOf(2, 31)).toEqual(humanRecordsOf(2))
  })

  it('경기 세우기가 넘긴 k 로 사람 칸 타선을 세운다 — 시작 타순 칸이 미션 타자다', () => {
    const mission = missionOf('타자', 1)
    const game = startMissionGame(mission, { nariRecordSlot: 0 })
    expect(battingRecordAt(game.humanBatting)).toBe(N)
    expect(game.humanBatting.records).toEqual(humanRecordsOf(game.humanBatting.order, 0))
    // 투수 미션은 사람 칸 타선에 아무도 안 넣는다
    expect(startMissionGame(missionOf('투수', 1), { nariRecordSlot: 0 }).humanBatting.records).not.toContain(N)
  })
})
