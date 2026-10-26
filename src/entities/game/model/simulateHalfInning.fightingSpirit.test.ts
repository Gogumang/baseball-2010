import { describe, expect, it } from 'vitest'
import { facingPitcherOf, withQuickFightingSpirit } from '@/entities/game/model/simulateHalfInning'
import type { HalfInningDefense } from '@/entities/game/model/simulateHalfInning'
import type { QuickAtBatPitcher } from '@/entities/game/model/quickAtBat'

const spirited: QuickAtBatPitcher = { control: 600, velocity: 500, stamina: 300, skillIds: [30] }

describe('간이 엔진의 스킬 14(투지) — 정액 없는 모드 (A-23)', () => {
  it('장착(투수 스킬 30 = 비트 14)과 경기 상태가 함께 서야 제구 · 구속에 v/10', () => {
    expect(withQuickFightingSpirit(spirited, true)).toMatchObject({ control: 660, velocity: 550 })
    expect(withQuickFightingSpirit(spirited, false)).toBe(spirited)
    const plain = { ...spirited, skillIds: [16] }
    expect(withQuickFightingSpirit(plain, true)).toBe(plain)
  })

  it('체력%로 부른 값은 피로 → 투지 차례 — 600 · 체력 40% → 540 → 594 · 이 반 이닝 득점으로 상태가 바뀐다', () => {
    const defense: HalfInningDefense = {
      mound: { pitcherSlot: 0, stamina: 4000, pitches: 0, runsAllowed: 0, usedSlots: [], justChanged: false },
      pitcherSlots: [0],
      pitcherAt: (_slot: number, fightingSpirit?: boolean) => withQuickFightingSpirit(spirited, fightingSpirit),
      staminaAbilityAt: () => 300,
      lead: 0,
      bothTeamsAreCpu: true,
      // 이 반 이닝에 1점 이상 내주면 선다
      fightingSpiritAt: (runs: number) => runs > 0,
    } as unknown as HalfInningDefense
    expect(facingPitcherOf(defense, 0, 40, 0).tired).toEqual({ control: 540, velocity: 450 })
    const after = facingPitcherOf(defense, 0, 40, 1)
    expect(after.control).toBe(660)
    // 피로 540 → 594 · 450 → 495
    expect(after.tired).toEqual({ control: 594, velocity: 495 })
  })
})
