import { describe, expect, it } from 'vitest'
import { MISSIONS } from '@/shared/config/original/missions'
import type { OriginalMission } from '@/shared/config/original/missions'
import {
  MISSION_START_INNING_RUNS,
  clearMissionInningRuns,
  missionStartInningRunsOf,
  scoreMissionRuns,
} from '@/entities/mission/model/missionScoreboard'
import { flipMissionHalf, startMissionGame, withMissionScore } from '@/entities/mission/model/missionGame'
import { missionKeyOf } from '@/entities/mission/model/missionGoal'

const missionOf = (side: OriginalMission['side'], id: number): OriginalMission => {
  const found = MISSIONS.find((mission) => mission.side === side && mission.id === id)
  if (found === undefined) throw new Error(`${side} ${id}`)
  return found
}

const empty = () => Array.from({ length: 9 }, () => 0)

describe('이닝별 점수 칸 st[0x6c..] — 0xaa57c aa608 · 0xb6a9c · 0xb6b6c', () => {
  it('레코드 +0x8e 아홉 칸씩의 합이 생성기의 시작 점수(사람 칸 = 우리)와 같다 — 모든 미션', () => {
    for (const mission of MISSIONS) {
      const rows = missionStartInningRunsOf(mission)
      const sums = rows.map((row) => row.reduce((sum, runs) => sum + runs, 0))
      const human = mission.humanSide === 0 ? 0 : 1
      expect([sums[human], sums[1 - human]], missionKeyOf(mission)).toEqual([mission.start.ourScore, mission.start.opponentScore])
    }
    expect(Object.keys(MISSION_START_INNING_RUNS).every((key) => MISSIONS.some((mission) => missionKeyOf(mission) === key))).toBe(true)
  })

  it('경기 세우기가 칸을 싣는다 — 타자 12 (측 0 7점 · 측 1 4점, 9회말)', () => {
    const game = startMissionGame(missionOf('타자', 12))
    expect(game.inningRuns).toEqual([[0, 2, 1, 0, 0, 1, 0, 3, 0], [0, 0, 1, 0, 2, 0, 0, 1, 0]])
    expect(game.scores).toEqual([7, 4])
  })

  it('득점은 지금 이닝 칸(이닝 mod 9)과 합을 함께 — 98 이하일 때만 오른다', () => {
    const board = scoreMissionRuns({ inningRuns: [empty(), empty()], scores: [0, 97] }, 10, 1, 3)
    expect(board.inningRuns[1][1]).toBe(3)
    expect(board.scores).toEqual([0, 99])
    const game = withMissionScore(startMissionGame(missionOf('투수', 1)), 1, 2)
    expect(game.inningRuns[1][8]).toBe(2)
  })

  it('말이 끝나 이닝이 오르면 새 이닝 두 칸을 지운다 — 초 끝은 안 지운다', () => {
    const start = startMissionGame(missionOf('투수', 9))
    // 투수 9: 1회초 시작, 측 1 의 2회 칸에 3 이 미리 들어 있다
    expect(start.inning).toBe(0)
    expect(start.inningRuns[1][1]).toBe(3)
    const bottom = flipMissionHalf({ ...start, offenseSide: 0 })
    expect(bottom.inningRuns[1][1]).toBe(3)
    const next = flipMissionHalf(bottom)
    expect(next.inning).toBe(1)
    expect(next.inningRuns[1][1]).toBe(0)
    // 합은 건드리지 않는다 (원본 그대로)
    expect(next.scores).toEqual(start.scores)
    expect(clearMissionInningRuns([[1, 2], [3, 4]], 10)).toEqual([[1, 0], [3, 0]])
  })
})
