import { afterEach, describe, expect, it } from 'vitest'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
import { BATTER_SLOT, gameAbilityOf } from '@/features/play-team-game/model/gameAbilities'
import { cpuBatterGameAbilityOf, cpuPitcherGameAbilityOf } from '@/entities/league/model/leagueDay'

afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

/** 팀 능력치 정액이 0 인 열 팀 — 코치만 본다 */
const 영 = Array.from({ length: 10 }, () => [0, 0, 0, 0])

// 코치 5 = 타자 히트 +8 · 코치 2 = 투수 제구 +10
const 타자 = (isMyTeam: boolean) => gameAbilityOf({
  mode: 2, base: 500, isPitcher: false, slot: BATTER_SLOT.히트, isMyTeam, season: { illness: 0, morale: 100, coach: 5 },
})

describe('B-21 코치 보너스가 상대 팀에도 붙음', () => {
  it('원본: 상대 팀 선수 · CPU 끼리 경기에도 붙는다', () => {
    expect(타자(true)).toBe(508)
    expect(타자(false)).toBe(508)
    expect(cpuPitcherGameAbilityOf(500, 0, 3, { mode: 2, teamAbilities: 영, coach: 2, coachTeamId: 0 })).toBe(510)
  })

  it('고침: 내 팀 선수에게만 — CPU 끼리 경기는 코치를 채용한 팀이 아니면 안 붙는다', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-21']))
    expect(타자(true)).toBe(508)
    expect(타자(false)).toBe(500)
    expect(cpuPitcherGameAbilityOf(500, 0, 3, { mode: 2, teamAbilities: 영, coach: 2, coachTeamId: 0 })).toBe(500)
    expect(cpuPitcherGameAbilityOf(500, 0, 0, { mode: 2, teamAbilities: 영, coach: 2, coachTeamId: 0 })).toBe(510)
    expect(cpuBatterGameAbilityOf(500, 0, 3, { mode: 2, teamAbilities: 영, coach: 5 })).toBe(500)
  })
})
