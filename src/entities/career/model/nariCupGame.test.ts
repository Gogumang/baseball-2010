import { describe, expect, it } from 'vitest'
import { nariCupGameResultOf, settleNariCupGame } from '@/entities/career/model/nariCupGame'

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

describe('대회 사람 경기의 커리어 몫 — 0x4ea0c 4ebaa~4ec7c · 4f156 · 4f344 · 4f374', () => {
  const 바탕 = {
    gamePoint: 99_990,
    hasActedThisCycle: true,
    isInjured: true,
    injuredGamesPlayed: 3,
    illnessCooldown: 1,
    eagleEyeGamesRemaining: 0,
  }

  it('기록 G 는 99999 에서 자르고 · 행동함을 내리고 · 부상 경기 수 +1 · 쿨다운과 이글아이는 0 아래로 안 간다', () => {
    expect(settleNariCupGame(바탕, 50)).toEqual({
      gamePoint: 99_999,
      hasActedThisCycle: false,
      isInjured: true,
      injuredGamesPlayed: 4,
      illnessCooldown: 0,
      eagleEyeGamesRemaining: 0,
    })
  })

  it('이글아이 칸이 없는 투수편 커리어는 그 칸을 만들지 않는다', () => {
    const { eagleEyeGamesRemaining: _없음, ...투수 } = 바탕
    const settled = settleNariCupGame({ ...투수, isInjured: false }, 0)
    expect(settled).toEqual({ ...투수, isInjured: false, hasActedThisCycle: false, illnessCooldown: 0 })
    expect('eagleEyeGamesRemaining' in settled).toBe(false)
  })
})
