import { describe, expect, it } from 'vitest'
import {
  inGameFightingSpiritStateOf,
  isFightingSpiritSituationOf,
  sideFightingSpiritStateOf,
} from '@/shared/lib/liveGameState/liveGameState'

describe('스킬 14(투지) 갈래의 경기 상태 — 0xb570c b5a4c~b5a66 (A-23)', () => {
  const teams = { ourTeamId: 3, opponentTeamId: 7 }

  it('경기 중에는 지금 판의 이닝 · 측별 팀 · 점수를 본다 — +0x6b > 4(6회부터)', () => {
    // 우리 선공(측 0) · 6회(인덱스 5) · 우리가 지고 있다 → 측 0 이 지는 측(0xb6a4c = 0) == 우리 측 0
    const losing = inGameFightingSpiritStateOf(teams, { inning: 6, ourScore: 1, opponentScore: 2, playerSide: 0 })
    expect(isFightingSpiritSituationOf(losing, 3)).toBe(true)
    expect(isFightingSpiritSituationOf(losing, 7)).toBe(false)
    // 5회(인덱스 4)는 안 선다 (`cmp #4 ; ble`)
    const early = inGameFightingSpiritStateOf(teams, { inning: 5, ourScore: 1, opponentScore: 2, playerSide: 0 })
    expect(isFightingSpiritSituationOf(early, 3)).toBe(false)
  })

  it('동점이면 측 0(선공)이 "지는 측" 이다 — 0xb6a4c = +0x7f < +0x7e ? 1 : 0', () => {
    const tied = inGameFightingSpiritStateOf(teams, { inning: 7, ourScore: 2, opponentScore: 2, playerSide: 1 })
    // 우리 후공(측 1) — 동점이면 상대(측 0) 쪽에 선다
    expect(isFightingSpiritSituationOf(tied, 7)).toBe(true)
    expect(isFightingSpiritSituationOf(tied, 3)).toBe(false)
  })

  it('+0x28 팀이 아니면 측 1 — 두 측 어디에도 없는 팀도 측 1 (0xb6be8)', () => {
    // 측 1 이 지고 있다(측 1 점수 < 측 0 점수)
    const state = sideFightingSpiritStateOf(8, [3, 7], [4, 1])
    expect(isFightingSpiritSituationOf(state, 7)).toBe(true)
    expect(isFightingSpiritSituationOf(state, 11)).toBe(true)
    expect(isFightingSpiritSituationOf(state, 3)).toBe(false)
  })

  it('자동진행 중 이번 반 이닝 득점은 공격 쪽 점수에 얹고 99 에서 자른다 (0xb6a9c)', () => {
    const base = { inning: 9, ourScore: 3, opponentScore: 3, playerSide: 0 as const }
    // 상대가 공격해 2점 — 우리(측 0)가 지는 측
    expect(isFightingSpiritSituationOf(inGameFightingSpiritStateOf(teams, base, { runs: 2, offenseIsOurs: false }), 3)).toBe(true)
    // 우리가 공격해 2점 — 이제 측 1(상대)이 진다
    expect(isFightingSpiritSituationOf(inGameFightingSpiritStateOf(teams, base, { runs: 2, offenseIsOurs: true }), 7)).toBe(true)
    expect(sideFightingSpiritStateOf(0, [0, 1], [150, -2]).sideScores).toEqual([99, 0])
  })
})
