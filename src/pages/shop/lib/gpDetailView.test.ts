import { describe, expect, it } from 'vitest'
import { createCareer } from '@/entities/career/model/playerCareer'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { abilityLimitOf } from '@/entities/career/model/abilityLimit'
import { equippedAbilityOf } from '@/entities/career/model/condition'
import { createPitcherCareer, equippedPitcherAbilityOf, pitcherAbilityLimitsOf } from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { PITCHER_ABILITY_ORDER } from '@/entities/pitcher-career/model/pitcherAbility'
import { selectShopItem, shopItemId } from '@/features/shop/model/shopSelection'
import { selectPitcherShopItem } from '@/features/shop/model/pitcherShopSelection'
import { batterGpDetailViewOf, pitcherGpDetailViewOf } from '@/pages/shop/lib/gpDetailView'
import { createSeededRandom } from '@/shared/api/random/seededRandom'

/** 상점 GP 결과 창 — 0x14a74 의 창 갈래 (0x14e8e~0x15180) */

const 난수 = createSeededRandom(1)
const 선수 = (overrides: Partial<PlayerCareer> = {}): PlayerCareer => ({ ...createCareer('테스트'), gamePoint: 9999, ...overrides })
const 투수 = (overrides: Partial<PitcherCareer> = {}): PitcherCareer => ({ ...createPitcherCareer('투수'), gamePoint: 9999, ...overrides })

const 사기 = (rows: readonly { current: number; maximum: number; change: number }[]) => rows[4]

describe('타자편 GP 결과 창', () => {
  it('칸 0(장어구이) — 히트 칸만 변화량 10, 현재값은 효과 뒤 실효 능력치, 최대값은 타입 한계', () => {
    const bought = selectShopItem(선수(), shopItemId('GP', 0), 난수)
    const view = batterGpDetailViewOf(bought.detail!)!
    const limits = abilityLimitOf(bought.career.battingTypeIndex)
    const current = equippedAbilityOf(bought.career)
    expect(view.rows.map((row) => row.labelFrame)).toEqual([336, 337, 338, 339, 84])
    expect(view.rows.map((row) => row.change)).toEqual([10, 0, 0, 0, 0])
    expect(view.rows.map((row) => row.current)).toEqual([current.hit, current.power, current.defense, current.run, bought.career.morale])
    expect(view.rows.map((row) => row.maximum)).toEqual([limits.hit, limits.power, limits.defense, limits.run, 100])
    expect(view.rows.every((row) => row.bonus === 0)).toBe(true)
    expect(view.messages).toEqual(['[장어구이] 구매', '효과 : 히트 능력치 + 10'])
  })

  it('칸 4(엄마의도시락) — 한계에 닿은 칸은 변화량 0 (한계 > 효과 전 기본값일 때만 10)', () => {
    const before = 선수()
    const limits = abilityLimitOf(before.battingTypeIndex)
    const bought = selectShopItem(선수({ ability: { ...before.ability, power: limits.power } }), shopItemId('GP', 4), 난수)
    const view = batterGpDetailViewOf(bought.detail!)!
    expect(view.rows.map((row) => row.change)).toEqual([10, 0, 10, 10, 0])
    expect(view.messages).toEqual(['[엄마의도시락] 구매', '효과 : 모든 능력치 + 10'])
  })

  it('칸 6(영지버섯) — 사기 변화량 40, 사기 현재값은 효과 **전** 값 (원본 그대로)', () => {
    const bought = selectShopItem(선수({ morale: 30 }), shopItemId('GP', 6), 난수)
    expect(bought.career.morale).toBe(70)
    const view = batterGpDetailViewOf(bought.detail!)!
    expect(사기(view.rows)).toMatchObject({ current: 30, maximum: 100, change: 40 })
    expect(view.rows.slice(0, 4).every((row) => row.change === 0)).toBe(true)
    expect(view.messages).toEqual(['[영지버섯] 구매', '효과 : 사기 회복 + 40'])
  })
})

describe('투수편 GP 결과 창', () => {
  it('이름표 340~343, 최대값 pitcherAbilityLimitsOf, 효과 글은 StrMODE[40+k]', () => {
    const bought = selectPitcherShopItem(투수(), shopItemId('GP', 1), 난수)
    expect(bought.notice).toBe('')
    const view = pitcherGpDetailViewOf(bought.detail!)!
    const limits = pitcherAbilityLimitsOf(bought.career)
    const current = equippedPitcherAbilityOf(bought.career)
    expect(view.rows.map((row) => row.labelFrame)).toEqual([340, 341, 342, 343, 84])
    expect(view.rows.map((row) => row.change)).toEqual([0, 10, 0, 0, 0])
    expect(view.rows.slice(0, 4).map((row) => row.maximum)).toEqual(PITCHER_ABILITY_ORDER.map((key) => limits[key]))
    expect(view.rows.slice(0, 4).map((row) => row.current)).toEqual(PITCHER_ABILITY_ORDER.map((key) => current[key]))
    expect(view.messages[0]).toBe('[붕붕드링크] 구매')
    expect(view.messages[1]).toMatch(/^효과 : .+ 능력치 \+ 10$/)
  })

  it('칸 9(십전대보탕)는 창 없이 알림', () => {
    const bought = selectPitcherShopItem(투수(), shopItemId('GP', 9), 난수)
    expect(bought.detail ?? null).toBeNull()
  })
})
