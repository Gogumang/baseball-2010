import { describe, expect, it } from 'vitest'
import { nariCupGameResultOf } from '@/entities/career/model/nariCupGame'

describe('나리 국가대항전 사람 경기 승패 — 0x4ea0c 4f072~4f136', () => {
  it('후공(측 1) 점수가 더 많을 때만 후공 승', () => {
    expect(nariCupGameResultOf({ mySide: 1, myTeam: 10, opponentTeam: 11, myScore: 3, opponentScore: 2 }))
      .toEqual({ winner: 10, loser: 11 })
    expect(nariCupGameResultOf({ mySide: 1, myTeam: 10, opponentTeam: 11, myScore: 2, opponentScore: 3 }))
      .toEqual({ winner: 11, loser: 10 })
  })

  it('동점이면 선공(측 0) 승 — 풀리그(대한민국 후공)는 대한민국 패', () => {
    expect(nariCupGameResultOf({ mySide: 1, myTeam: 10, opponentTeam: 12, myScore: 4, opponentScore: 4 }))
      .toEqual({ winner: 12, loser: 10 })
  })

  it('동점이면 선공(측 0) 승 — 결승에서 대한민국이 2위(선공)면 대한민국 승', () => {
    expect(nariCupGameResultOf({ mySide: 0, myTeam: 10, opponentTeam: 13, myScore: 1, opponentScore: 1 }))
      .toEqual({ winner: 10, loser: 13 })
    expect(nariCupGameResultOf({ mySide: 0, myTeam: 10, opponentTeam: 13, myScore: 1, opponentScore: 2 }))
      .toEqual({ winner: 13, loser: 10 })
  })
})
