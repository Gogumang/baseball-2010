import { afterEach, describe, expect, it } from 'vitest'
import { cpuPitcherGameAbilityOf } from '@/entities/league/model/leagueDay'
import {
  isLiveGameFightingSpiritSituation,
  resetLiveGameState,
  setLiveGameInningIndex,
  setLiveGameSides,
} from '@/shared/lib/liveGameState/liveGameState'

describe('CPU 끼리 간이 엔진의 스킬 14(투지) — 0xc11f0 · 0xc1818 의 0xb570c 가 전역 상태(마지막 사람 경기)를 읽는다 (A-23)', () => {
  afterEach(() => {
    resetLiveGameState()
    setLiveGameSides({ ourTeamId: 0, opponentTeamId: 0, ourScore: 0, opponentScore: 0, playerSide: 0 })
  })

  it('정액 모드는 팀 정액 뒤 · 코치 앞 — 코치 2(제구 +10)면 600 → 660 → 670, 칸 3 은 빠진다', () => {
    const context = { mode: 2, teamAbilities: [[0, 0, 0, 0]], coach: 2 }
    expect(cpuPitcherGameAbilityOf(600, 0, 0, context, false)).toBe(610)
    expect(cpuPitcherGameAbilityOf(600, 0, 0, context, true)).toBe(670)
    expect(cpuPitcherGameAbilityOf(600, 3, 0, { mode: 3 }, true)).toBe(600)
  })

  it('마지막 사람 경기가 원정 승리로 끝났으면 +0x28(원정) 팀이 아닌 모든 팀이 측 1 = 지는 측이다', () => {
    // 사람(팀 3) 후공 · 4:6 으로 짐 — 측 0(팀 7) 6 · 측 1(팀 3) 4
    setLiveGameSides({ ourTeamId: 3, opponentTeamId: 7, ourScore: 4, opponentScore: 6, playerSide: 1 })
    setLiveGameInningIndex(8)
    expect(isLiveGameFightingSpiritSituation(3)).toBe(true)
    expect(isLiveGameFightingSpiritSituation(5)).toBe(true)
    expect(isLiveGameFightingSpiritSituation(7)).toBe(false)
    // 앱을 새로 켜거나(0xb6814) 경기 전이면 +0x6b = 0 이라 안 선다
    resetLiveGameState()
    expect(isLiveGameFightingSpiritSituation(5)).toBe(false)
  })
})
