import { describe, expect, it } from 'vitest'
import { createCareer } from '@/entities/career/model/playerCareer'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { formatOriginalMoney, purchaseQuestionOf, shopItemId, selectShopItem } from '@/features/shop/model/shopSelection'

const 선수 = (overrides: Partial<PlayerCareer> = {}): PlayerCareer => ({ ...createCareer('테스트'), ...overrides })
const 난수 = createSeededRandom(1)

describe('구매 확인 — StrMODE[79]', () => {
  it('살 수 있는 장착·서브 아이템은 StrMODE[79] — 금액은 0x55cf4 서식("%d"·"%d억"·"%d억%03d", "만" 없음)', () => {
    expect(purchaseQuestionOf(선수({ money: 99999 }), shopItemId('장착', 2, 0))).toBe('!C!cFFFF00소지금 3000!cFFFFFF이 소모됩니다!N구매하겠습니까?')
    expect(purchaseQuestionOf(선수({ money: 99999 }), shopItemId('서브', 1))).toBe('!C!cFFFF00소지금 2억!cFFFFFF이 소모됩니다!N구매하겠습니까?')
  })

  it('원본 금액 서식 — 10050 은 "1억050", 15000 은 "1억5000"', () => {
    expect([formatOriginalMoney(10050), formatOriginalMoney(15000), formatOriginalMoney(20000), formatOriginalMoney(800)]).toEqual(['1억050', '1억5000', '2억', '800'])
  })

  it('GP 아이템은 StrMODE[82]', () => {
    expect(purchaseQuestionOf(선수({ gamePoint: 1000 }), shopItemId('GP', 4))).toBe('!C!cFFFF001000 G포인트!cFFFFFF가 소모됩니다!N구매하시겠습니까?')
  })

  it('막혔거나 이미 가진 장비를 고르면 묻지 않는다 — 바로 알림·장착으로 간다', () => {
    expect(purchaseQuestionOf(선수({ money: 0 }), shopItemId('장착', 0, 0))).toBeNull()
    expect(purchaseQuestionOf(선수({ ownedEquipment: ['0-0'] }), shopItemId('장착', 0, 0))).toBeNull()
    expect(purchaseQuestionOf(선수({ gamePoint: 0 }), shopItemId('GP', 4))).toBeNull()
  })
})

describe('상점 선택 — 0x14a74', () => {
  it('장착 아이템을 사면 "[이름] 구매 완료" (StrMODE[92])', () => {
    const result = selectShopItem(선수({ money: 6000 }), shopItemId('장착', 0, 0), 난수)

    expect(result.notice).toBe('[나이스 헬멧] 구매 완료')
    expect(result.career.equipmentLevels.hit).toBe(1)
  })

  it('상점에서 가진 장비를 고르면 "이미 가지고 있는" 알림뿐이다 (0x13506, 점검 12차)', () => {
    const 보유 = 선수({ ownedEquipment: ['0-0'], equipmentLevels: { hit: 1, power: 0, defense: 0, run: 0 } })

    expect(selectShopItem(보유, shopItemId('장착', 0, 0), 난수)).toMatchObject({ notice: '이미 가지고 있는 아이템입니다', career: 보유 })
  })

  it('장비착용 화면에서는 가진 장비를 끼고, 성공 알림은 없다 — 확인 팝업(81) 뒤 알림 없음 (0x17b66, StrMODE[80])', () => {
    const 보유 = 선수({ ownedEquipment: ['0-0', '0-1'], equipmentLevels: { hit: 2, power: 0, defense: 0, run: 0 } })

    // StrMODE 에 "장착 했습니다" 같은 문구가 없다 — 원본은 확인 팝업 뒤 따로 알리지 않는다 (R12-shop-guards.md 5절)
    expect(selectShopItem(보유, shopItemId('착용', 0, 0), 난수)).toMatchObject({ notice: '' })
    expect(selectShopItem(보유, shopItemId('착용', 0, 0), 난수).career.equipmentLevels.hit).toBe(1)
    expect(selectShopItem(보유, shopItemId('착용', 0, 1), 난수).notice).toBe('현재 장착 중인 장비입니다')
    expect(selectShopItem(보유, shopItemId('착용', 0, 3), 난수).notice).toBe('')
  })

  it('장비착용에서는 끼기 전에 StrMODE[81] 로 묻는다', () => {
    const 보유 = 선수({ ownedEquipment: ['0-0'] })
    expect(purchaseQuestionOf(보유, shopItemId('착용', 0, 0))).toBe('!C[!cFFFF00나이스 헬멧!cFFFFFF] 아이템을!N장착하시겠습니까?')
    expect(purchaseQuestionOf(보유, shopItemId('착용', 0, 1))).toBeNull()
  })

  it('막히면 원문 이유를 알린다', () => {
    expect(selectShopItem(선수({ money: 0 }), shopItemId('장착', 0, 0), 난수).notice).toBe('소지금이 부족합니다')
    expect(selectShopItem(선수({ popularity: 0, money: 99999 }), shopItemId('장착', 0, 1), 난수).notice).toBe('인기도가 부족합니다. 필요한 인기도 : 50')
    expect(selectShopItem(선수({ money: 99999 }), shopItemId('장착', 0, 8), 난수).notice).toBe('아직 구매할 수 없는 아이템입니다. 특별한 조건을 통해 오픈됩니다')
  })

  it('컬렉터가 되면 히든 오픈 알림이 붙는다', () => {
    const 여섯개 = ['0-0', '0-1', '0-2', '0-3', '0-4', '0-5']
    const result = selectShopItem(선수({ money: 999999, popularity: 999, ownedEquipment: 여섯개 }), shopItemId('장착', 0, 6), 난수)

    expect(result.notice).toBe('[하이퍼 헬멧] 구매 완료 · 히든 아이템 오픈!! [검투사 투구] 나만의리그 타자편에서 사용가능합니다')
  })

  it('서브 아이템과 GP 아이템도 산다', () => {
    expect(selectShopItem(선수({ money: 20000 }), shopItemId('서브', 0), 난수).notice).toBe('[표적판] 구매 완료')
    const gp = selectShopItem(선수({ gamePoint: 300, morale: 10 }), shopItemId('GP', 6), 난수)
    expect([gp.notice, gp.career.morale, gp.career.gamePoint]).toEqual(['사기 +40 회복되었습니다', 50, 0])
    expect(selectShopItem(선수({ gamePoint: 0 }), shopItemId('GP', 6), 난수).notice).toBe('G포인트가 부족합니다')
  })
})
