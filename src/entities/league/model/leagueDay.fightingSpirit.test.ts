import { afterEach, describe, expect, it } from 'vitest'
import { cpuPitcherGameAbilityOf, leagueFightingSpiritOf } from '@/entities/league/model/leagueDay'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
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

  describe('B-107 — CPU 경기가 마지막 사람 경기의 상태를 읽는다', () => {
    afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))
    /** 원정 팀 5 · 홈 팀 6, 7회초(인덱스 6) 앞 점수 2:1 — 원정 공격 */
    const game = { inningIndex: 6, sideTeamIds: [5, 6] as const, scoresBefore: [2, 1] as const, offenseSide: 0 as const }

    it('원본: 이 경기 점수와 상관없이 마지막 사람 경기(원정 승리)를 본다 — +0x28 팀 말고 모두 지는 측', () => {
      setLiveGameSides({ ourTeamId: 3, opponentTeamId: 7, ourScore: 4, opponentScore: 6, playerSide: 1 })
      setLiveGameInningIndex(8)
      expect(leagueFightingSpiritOf(game, 0, 5)).toBe(true)
      expect(leagueFightingSpiritOf(game, 0, 6)).toBe(true)
    })

    it('고친 길: 이 경기 자신의 이닝 · 팀 · 점수(이번 반 이닝 득점 포함)로 지는 측만', () => {
      setBugfixConfigForTests(bugfixConfigWith(['B-107']))
      setLiveGameSides({ ourTeamId: 3, opponentTeamId: 7, ourScore: 4, opponentScore: 6, playerSide: 1 })
      setLiveGameInningIndex(8)
      // 2:1 — 홈(6)이 진다
      expect(leagueFightingSpiritOf(game, 0, 5)).toBe(false)
      expect(leagueFightingSpiritOf(game, 0, 6)).toBe(true)
      // 같은 점수는 측 0(원정)이 지는 측이다 (0xb6a4c — 측 1 이 적을 때만 1)
      expect(leagueFightingSpiritOf({ ...game, scoresBefore: [1, 1] }, 0, 5)).toBe(true)
      // 홈 공격 중 2점 — 1:3 이면 원정이 진다
      expect(leagueFightingSpiritOf({ ...game, scoresBefore: [1, 1], offenseSide: 1 }, 2, 5)).toBe(true)
      expect(leagueFightingSpiritOf({ ...game, scoresBefore: [1, 1], offenseSide: 1 }, 2, 6)).toBe(false)
      // 5회(인덱스 4)까지는 안 선다
      expect(leagueFightingSpiritOf({ ...game, inningIndex: 4 }, 0, 6)).toBe(false)
      // 사람 경기를 한 번도 안 했어도(전역 +0x6b = 0) 이 경기 상태로 선다
      resetLiveGameState()
      expect(leagueFightingSpiritOf(game, 0, 6)).toBe(true)
    })
  })
})
