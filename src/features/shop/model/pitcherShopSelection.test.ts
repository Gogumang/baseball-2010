import { describe, expect, it } from 'vitest'
import { createPitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { pitcherPurchaseQuestionOf, selectPitcherShopItem } from '@/features/shop/model/pitcherShopSelection'
import { shopItemId } from '@/features/shop/model/shopSelection'
import type { RandomPort } from '@/shared/api/random/randomPort'

/** 장비·서브는 난수를 안 쓴다 — 쓰면 터지게 둔다 */
const 무작위: RandomPort = {
  next: () => { throw new Error('난수를 쓰면 안 된다') },
  nextInRange: () => { throw new Error('난수를 쓰면 안 된다') },
  pick: () => { throw new Error('난수를 쓰면 안 된다') },
}

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
    expect(selectPitcherShopItem(가난, shopItemId('장착', 0, 0), 무작위)).toEqual({ career: 가난, notice: '소지금이 부족합니다' })
    expect(selectPitcherShopItem(투수({ popularity: 0 }), shopItemId('장착', 0, 1), 무작위).notice)
      .toBe('인기도가 부족합니다. 필요한 인기도 : 50')
    expect(selectPitcherShopItem(투수(), shopItemId('장착', 0, 7), 무작위).notice)
      .toBe('아직 구매할 수 없는 아이템입니다. 특별한 조건을 통해 오픈됩니다')
  })

  it('사면 구매 완료(StrMODE[92]) 알림과 함께 장착된다', () => {
    const { career, notice } = selectPitcherShopItem(투수(), shopItemId('장착', 2, 0), 무작위)
    expect(notice).toBe('[나이스 아대] 구매 완료')
    expect(career.equipmentLevels.breaking).toBe(1)
    expect(career.money).toBe(46_000)
  })

  it('일곱째를 사면 컬렉터 히든 오픈 알림이 붙는다', () => {
    const 여섯 = 투수({ money: 999_000, ownedEquipment: ['3-0', '3-1', '3-2', '3-3', '3-4', '3-5'] })
    expect(selectPitcherShopItem(여섯, shopItemId('장착', 3, 6), 무작위).notice)
      .toBe('[하이퍼 신발] 구매 완료 · 히든 아이템 오픈!! [선장의 신발] 나만의리그 투수편에서 사용가능합니다')
  })
})

describe('투수 장비착용 (121)', () => {
  const 둘 = 투수({ ownedEquipment: ['0-0', '0-2'], equipmentLevels: { control: 3, velocity: 0, breaking: 0, stamina: 0 } })

  it('장착 중이면 StrMODE[80] 만 — 묻지도 않는다', () => {
    expect(pitcherPurchaseQuestionOf(둘, shopItemId('착용', 0, 2))).toBeNull()
    expect(selectPitcherShopItem(둘, shopItemId('착용', 0, 2), 무작위).notice).toBe('현재 장착 중인 장비입니다')
  })

  it('가진 다른 것은 StrMODE[81] 로 묻고 바꿔 낀다', () => {
    expect(pitcherPurchaseQuestionOf(둘, shopItemId('착용', 0, 0)))
      .toBe('!C[!cFFFF00나이스 모자!cFFFFFF] 아이템을!N장착하시겠습니까?')
    expect(selectPitcherShopItem(둘, shopItemId('착용', 0, 0), 무작위).career.equipmentLevels.control).toBe(1)
  })

  it('없는 것은 아무 일도 없다', () => {
    expect(selectPitcherShopItem(둘, shopItemId('착용', 0, 1), 무작위)).toEqual({ career: 둘, notice: '' })
  })
})

describe('투수 서브·GP 아이템 (0x13460 kind 1·2 → 0x14a74)', () => {
  const 고정 = (position: number): RandomPort => ({
    next: () => position,
    nextInRange: (minimum, maximum) => minimum + position * (maximum - minimum),
    pick: (candidates) => candidates[0],
  })

  it('서브: 살 수 있으면 StrMODE[79] 로 묻고, 사면 소지금이 줄고 보유가 선다', () => {
    expect(pitcherPurchaseQuestionOf(투수(), shopItemId('서브', 1)))
      .toBe('!C!cFFFF00소지금 2억!cFFFFFF이 소모됩니다!N구매하겠습니까?')
    const { career, notice } = selectPitcherShopItem(투수(), shopItemId('서브', 1), 무작위)
    expect(notice).toBe('[1톤 바벨] 구매 완료')
    expect(career.money).toBe(30_000)
    expect(career.subItemIds).toEqual([1])
  })

  it('서브: 보유(78) → 소지금(77) 차례로 막는다', () => {
    expect(selectPitcherShopItem(투수({ subItemIds: [1], money: 0 }), shopItemId('서브', 1), 무작위).notice)
      .toBe('이미 가지고 있는 아이템입니다')
    expect(selectPitcherShopItem(투수({ money: 0 }), shopItemId('서브', 1), 무작위).notice).toBe('소지금이 부족합니다')
    expect(pitcherPurchaseQuestionOf(투수({ money: 0 }), shopItemId('서브', 1))).toBeNull()
  })

  it('GP: G 부족(65)이 가장 먼저다 — 스태미나가 최대여도 G 부족 글이 뜬다', () => {
    const 빈G = 투수({ gamePoint: 0 })
    expect(selectPitcherShopItem(빈G, shopItemId('GP', 9), 무작위)).toEqual({ career: 빈G, notice: 'G포인트가 부족합니다' })
    expect(selectPitcherShopItem(투수({ gamePoint: 1000 }), shopItemId('GP', 9), 무작위).notice)
      .toBe('스태미나가 최대입니다 구매 할 수 없습니다')
  })

  it('GP: 십전대보탕 확인창엔 이글아이 안내줄(224)이 안 붙는다 (0x13ab4 는 모드 4 만)', () => {
    expect(pitcherPurchaseQuestionOf(투수({ gamePoint: 1000, stamina: 10 }), shopItemId('GP', 9)))
      .toBe('!C!cFFFF00500 G포인트!cFFFFFF가 소모됩니다!N구매하시겠습니까?')
  })

  it('GP: 사면 G 를 빼고 곧바로 쓴다', () => {
    const { career, notice } = selectPitcherShopItem(투수({ gamePoint: 1000, stamina: 10 }), shopItemId('GP', 9), 고정(0))
    expect(notice).toBe('스태미나가 100% 회복되었습니다')
    expect(career).toMatchObject({ gamePoint: 500, stamina: 10_000 })
  })
})
