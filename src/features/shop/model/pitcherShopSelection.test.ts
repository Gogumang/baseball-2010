import { describe, expect, it } from 'vitest'
import { createPitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { pitcherPurchaseQuestionOf, selectPitcherShopItem } from '@/features/shop/model/pitcherShopSelection'
import { shopItemId } from '@/features/shop/model/shopSelection'

/** 투수편 상점 고르기 — 타자편과 같은 StrMODE 글(76·77·78·62·79·80·81·92) */

const 투수 = (overrides: Partial<PitcherCareer> = {}): PitcherCareer => ({
  ...createPitcherCareer('투수'),
  money: 50_000,
  popularity: 999,
  ...overrides,
})

describe('투수 장비 상점', () => {
  it('살 수 있는 칸은 StrMODE[79] 로 묻는다 — 금액은 0x55cf4 서식', () => {
    expect(pitcherPurchaseQuestionOf(투수(), shopItemId('장착', 0, 0)))
      .toBe('!C!cFFFF00소지금 4000!cFFFFFF이 소모됩니다!N구매하겠습니까?')
    expect(pitcherPurchaseQuestionOf(투수({ money: 300_000, openedHiddenIds: [26] }), shopItemId('장착', 1, 10)))
      .toBe('!C!cFFFF00소지금 21억!cFFFFFF이 소모됩니다!N구매하겠습니까?')
    expect(pitcherPurchaseQuestionOf(투수(), shopItemId('장착', 1, 6)))
      .toBe('!C!cFFFF00소지금 4억5000!cFFFFFF이 소모됩니다!N구매하겠습니까?')
  })

  it('막힌 칸은 묻지 않고, 고르면 그 문구만 낸다', () => {
    const 가난 = 투수({ money: 0 })
    expect(pitcherPurchaseQuestionOf(가난, shopItemId('장착', 0, 0))).toBeNull()
    expect(selectPitcherShopItem(가난, shopItemId('장착', 0, 0))).toEqual({ career: 가난, notice: '소지금이 부족합니다' })
    expect(selectPitcherShopItem(투수({ popularity: 0 }), shopItemId('장착', 0, 1)).notice)
      .toBe('인기도가 부족합니다. 필요한 인기도 : 50')
    expect(selectPitcherShopItem(투수(), shopItemId('장착', 0, 7)).notice)
      .toBe('아직 구매할 수 없는 아이템입니다. 특별한 조건을 통해 오픈됩니다')
  })

  it('사면 구매 완료(StrMODE[92]) 알림과 함께 장착된다', () => {
    const { career, notice } = selectPitcherShopItem(투수(), shopItemId('장착', 2, 0))
    expect(notice).toBe('[나이스 아대] 구매 완료')
    expect(career.equipmentLevels.breaking).toBe(1)
    expect(career.money).toBe(46_000)
  })

  it('일곱째를 사면 컬렉터 히든 오픈 알림이 붙는다', () => {
    const 여섯 = 투수({ money: 999_000, ownedEquipment: ['3-0', '3-1', '3-2', '3-3', '3-4', '3-5'] })
    expect(selectPitcherShopItem(여섯, shopItemId('장착', 3, 6)).notice)
      .toBe('[하이퍼 신발] 구매 완료 · 히든 아이템 오픈!! [선장의 신발] 나만의리그 투수편에서 사용가능합니다')
  })
})

describe('투수 장비착용 (121)', () => {
  const 둘 = 투수({ ownedEquipment: ['0-0', '0-2'], equipmentLevels: { control: 3, velocity: 0, breaking: 0, stamina: 0 } })

  it('장착 중이면 StrMODE[80] 만 — 묻지도 않는다', () => {
    expect(pitcherPurchaseQuestionOf(둘, shopItemId('착용', 0, 2))).toBeNull()
    expect(selectPitcherShopItem(둘, shopItemId('착용', 0, 2)).notice).toBe('현재 장착 중인 장비입니다')
  })

  it('가진 다른 것은 StrMODE[81] 로 묻고 바꿔 낀다', () => {
    expect(pitcherPurchaseQuestionOf(둘, shopItemId('착용', 0, 0)))
      .toBe('!C[!cFFFF00나이스 모자!cFFFFFF] 아이템을!N장착하시겠습니까?')
    expect(selectPitcherShopItem(둘, shopItemId('착용', 0, 0)).career.equipmentLevels.control).toBe(1)
  })

  it('없는 것은 아무 일도 없다', () => {
    expect(selectPitcherShopItem(둘, shopItemId('착용', 0, 1))).toEqual({ career: 둘, notice: '' })
  })
})
