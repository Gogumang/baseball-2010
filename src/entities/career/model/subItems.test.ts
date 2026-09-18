import { describe, expect, it } from 'vitest'
import { createCareer } from '@/entities/career/model/playerCareer'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import {
  SUB_ITEMS,
  applyOutingSubItems,
  hasSubItem,
  purchaseSubItem,
  subItemBlockReasonOf,
  subItemTrainingBonus,
  subItemMoraleRelief,
} from '@/entities/career/model/subItems'

const 선수 = (overrides: Partial<PlayerCareer> = {}): PlayerCareer => ({ ...createCareer('테스트'), ...overrides })

describe('서브 아이템 10종 — StrITEM[88~97], 가격 표 0xcc430', () => {
  it('이름과 가격(만원)이 원본 표 그대로다', () => {
    expect(SUB_ITEMS.map((item) => item.name)).toEqual([
      '표적판', '1톤 바벨', '모래주머니', '하드타이어', '자동안마기', '화보집', '외식회원증', '보험증서', '야구교본', '명품정장',
    ])
    expect(SUB_ITEMS.map((item) => item.price)).toEqual([15000, 20000, 15000, 15000, 10000, 25000, 20000, 10000, 20000, 20000])
  })

  it('사면 소지금이 줄고 영구히 갖는다', () => {
    const bought = purchaseSubItem(선수({ money: 20000 }), 0)

    expect(bought.money).toBe(5000)
    expect(hasSubItem(bought, 0)).toBe(true)
  })

  it('소지금이 모자라거나 이미 있으면 막는다 (StrITEM 문구 [77]·[78])', () => {
    expect(subItemBlockReasonOf(선수({ money: 14999 }), 0)).toBe('소지금부족')
    expect(subItemBlockReasonOf(선수({ money: 99999, subItemIds: [0] }), 0)).toBe('이미보유')
    expect(() => purchaseSubItem(선수({ money: 0 }), 0)).toThrow('소지금부족')
  })

  it('표적판·1톤 바벨·모래주머니·하드타이어는 히트·파워·수비·주루 훈련 +2 (StrITEM[148])', () => {
    const 선수들 = 선수({ subItemIds: [0, 3] })
    expect(['hit', 'power', 'defense', 'run'].map((ability) => subItemTrainingBonus(선수들, ability as 'hit'))).toEqual([2, 0, 0, 2])
  })

  it('자동안마기는 훈련 사기 감소 −1 (StrITEM[149])', () => {
    expect(subItemMoraleRelief(선수({ subItemIds: [4] }))).toBe(1)
    expect(subItemMoraleRelief(선수())).toBe(0)
  })

  it('외출 보정 — 팬미팅 인기도 +2 · 외식 사기 +4 · 입원 무료·사기 +1 · 야구교실 인기도·평판 +1 · CF +400만 (StrITEM[150~154])', () => {
    const 전부 = 선수({ subItemIds: [5, 6, 7, 8, 9] })
    const effect = { moneyCost: 200, moraleGain: 0, popularityGain: 0, reputationGain: 0, healsInjury: false }

    expect(applyOutingSubItems(전부, '팬미팅', effect).popularityGain).toBe(2)
    expect(applyOutingSubItems(전부, '외식', effect).moraleGain).toBe(4)
    expect(applyOutingSubItems(전부, '입원', effect)).toMatchObject({ moneyCost: 0, moraleGain: 1 })
    expect(applyOutingSubItems(전부, '야구교실', effect)).toMatchObject({ popularityGain: 1, reputationGain: 1 })
    expect(applyOutingSubItems(전부, 'CF촬영', { ...effect, moneyCost: -800 }).moneyCost).toBe(-1200)
    expect(applyOutingSubItems(선수(), '팬미팅', effect)).toEqual(effect)
  })
})
