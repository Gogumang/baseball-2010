import { describe, expect, it } from 'vitest'
import {
  cpuPitchStatsOf,
  hasFightingSpiritBit,
  pitcherGameStatOf,
  pitcherGameStatsOf,
  withPitcherFightingSpirit,
} from '@/entities/pitching/model/pitcherGameStats'
import type { PitcherAbility } from '@/entities/pitching/model/pitch'
import { pitcherGameAbilityPartsOf, TEAM_GAME_MODE } from '@/features/play-team-game/model/gameAbilities'

describe('0xb570c 스킬 14(투지) 갈래 b5a16~b5a72 — 피로 → 팀 정액 → v += v/10 → 코치 → 자르기 (A-23)', () => {
  it('팀 정액 뒤 · 코치 앞에 선다 — 600 · 체력 40% → 540 + 팀 17 = 557 → 612 → 코치 10 → 622', () => {
    expect(pitcherGameStatOf(600, 40, 27, 10, false)).toBe(567)
    expect(pitcherGameStatOf(600, 40, 27, 10, true)).toBe(622)
  })

  it('자르기는 맨 끝 — 950 이 1045 가 되면 999', () => {
    expect(pitcherGameStatOf(950, 100, 0, 0, true)).toBe(999)
  })

  it('세 칸 재료(`coachBonusAfterFatigue` · `fightingSpirit`)를 그대로 따른다', () => {
    const stats = pitcherGameStatsOf(
      {
        beforeFatigue: { control: 500, velocity: 600, breaking: 700 },
        bonusAfterFatigue: { control: 20, velocity: 20, breaking: 20 },
        coachBonusAfterFatigue: { control: 10, velocity: 0, breaking: 0 },
        fightingSpirit: true,
      },
      100,
    )
    // 제구 (500 + 10) → 561 → +10 = 571 · 구속 620 → 682 · 변화 720 → 792
    expect(stats).toEqual({ control: 571, velocity: 682, breaking: 792 })
  })

  it('시즌 팀 경기 재료 — 코치 몫을 갈라 든다 (`pitcherGameAbilityPartsOf`)', () => {
    const parts = pitcherGameAbilityPartsOf([500, 600, 700, 300], {
      mode: TEAM_GAME_MODE.시즌,
      isMyTeam: true,
      teamAbilities: [400, 300, 300, 300],
      season: { illness: 0, morale: 100, coach: 1 },
      fightingSpirit: true,
    })
    expect(parts.fightingSpirit).toBe(true)
    // 코치 1 = 구속 +9
    expect(parts.coachBonusAfterFatigue).toEqual({ control: 0, velocity: 9, breaking: 0 })
    // 구속: 600 + 팀 투구 400 → +17 = 617 → 678 → +9 = 687
    expect(pitcherGameStatsOf(parts, 100).velocity).toBe(687)
    const off = pitcherGameAbilityPartsOf([500, 600, 700, 300], { mode: TEAM_GAME_MODE.시즌, isMyTeam: true })
    expect(off.fightingSpirit).toBeUndefined()
  })

  it('사람 타석 CPU 투수 — 비트 14 와 경기 상태가 함께 서야 싣는다 · 실투 구속(체력 인자 90)도 먹는다', () => {
    const pitcher: PitcherAbility = {
      control: 50,
      velocity: 70,
      gameAbility: { beforeFatigue: { control: 500, velocity: 700, breaking: 600 } },
      skillBits: 1 << 14,
    }
    expect(hasFightingSpiritBit(pitcher.skillBits)).toBe(true)
    expect(withPitcherFightingSpirit(pitcher, false)).toBe(pitcher)
    expect(withPitcherFightingSpirit({ ...pitcher, skillBits: 0 }, true).gameAbility?.fightingSpirit).toBeUndefined()
    const raised = cpuPitchStatsOf(withPitcherFightingSpirit(pitcher, true))
    expect(raised.control).toBe(550)
    expect(raised.velocity).toBe(770)
    expect(raised.mistakeVelocity).toBe(770)
  })
})
