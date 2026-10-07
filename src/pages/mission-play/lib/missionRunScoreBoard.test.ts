import { describe, expect, it } from 'vitest'
import { MISSIONS } from '@/shared/config/original/missions'
import { missionRunScoreBoardOf } from '@/pages/mission-play/lib/missionRunScoreBoard'

const missionOf = (side: '타자' | '투수', id: number) => MISSIONS.find((m) => m.side === side && m.id === id)!

describe('미션 득점 점수판 0x41a64 — 0xaa57c 가 레코드 +2 · +3 으로 세운 두 측', () => {
  it('타자 12번 — 사람 칸 1(후공) · 사람 팀 1(+2 윗 4비트) · 상대 외인구단 14(아래 4비트), 4:7 9회말 · 공격 측은 사람 칸', () => {
    const mission = missionOf('타자', 12)
    expect(mission.humanSide).toBe(1)
    expect(mission.sideTeams).toEqual([14, 1])
    expect(mission.start).toMatchObject({ inning: 9, ourScore: 4, opponentScore: 7 })
    expect(missionRunScoreBoardOf(mission, { ours: 4, opponents: 7 })).toEqual({
      sides: [{ team: 14, isComputer: true }, { team: 1, isComputer: false }],
      scores: [7, 4],
      battingSide: 1,
    })
  })

  it('투수 4번 — 사람 칸 0(선공) · 7:5 로 앞선다 · 공격 측은 다른 칸(모드 5)', () => {
    const mission = missionOf('투수', 4)
    expect(mission.humanSide).toBe(0)
    expect(mission.sideTeams).toEqual([1, 5])
    expect(mission.start).toMatchObject({ ourScore: 7, opponentScore: 5 })
    expect(missionRunScoreBoardOf(mission, { ours: 7, opponents: 5 })).toEqual({
      sides: [{ team: 1, isComputer: false }, { team: 5, isComputer: true }],
      scores: [7, 5],
      battingSide: 1,
    })
  })
})
