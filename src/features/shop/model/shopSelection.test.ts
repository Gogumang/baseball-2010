import { afterEach, describe, expect, it } from 'vitest'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import { createCareer } from '@/entities/career/model/playerCareer'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { formatOriginalMoney, opensGpDetailWindow, purchaseQuestionOf, shopItemId, selectShopItem } from '@/features/shop/model/shopSelection'

const 선수 = (overrides: Partial<PlayerCareer> = {}): PlayerCareer => ({ ...createCareer('테스트'), ...overrides })
const 난수 = createSeededRandom(1)

describe('구매 확인 — StrMODE[79]', () => {
  it('살 수 있는 장착·서브 아이템은 StrMODE[79] — 금액은 0x55cf4 서식("%d"·"%d억"·"%d억%03d", "만" 없음)', () => {
    expect(purchaseQuestionOf(선수({ money: 99999 }), shopItemId('장착', 2, 0))).toBe('!C!cFFFF00소지금 3000!cFFFFFF이 소모됩니다!N구매하겠습니까?')
    expect(purchaseQuestionOf(선수({ money: 99999 }), shopItemId('서브', 1))).toBe('!C!cFFFF00소지금 2억!cFFFFFF이 소모됩니다!N구매하겠습니까?')
  })

  it('원본 금액 서식 — 10050 은 "1억050", 15000 은 "1억5000"', () => {
    expect([formatOriginalMoney(10050), formatOriginalMoney(15000), formatOriginalMoney(20000), formatOriginalMoney(800)]).toEqual([
      '1억050',
      '1억5000',
      '2억',
      '800',
    ])
  })

  it('GP 아이템은 StrMODE[82]', () => {
    expect(purchaseQuestionOf(선수({ gamePoint: 1000 }), shopItemId('GP', 0))).toBe('!C!cFFFF00300 G포인트!cFFFFFF가 소모됩니다!N구매하시겠습니까?')
  })

  it('엄마의도시락(칸 4)은 최대인 칸마다 [192] + "!N", 그 뒤 "!N" + [82] — 0 칸이어도 "!N" 이 앞에 선다 (0x138ca~0x13998)', () => {
    expect(purchaseQuestionOf(선수({ gamePoint: 1000 }), shopItemId('GP', 4))).toBe(
      '!N!C!cFFFF001000 G포인트!cFFFFFF가 소모됩니다!N구매하시겠습니까?',
    )
    const 히트최대 = 선수({ gamePoint: 1000, ability: { ...선수().ability, hit: 800, run: 800 } })
    expect(purchaseQuestionOf(히트최대, shopItemId('GP', 4))).toBe(
      '!C[!cFFFF00히트!cFFFFFF] 능력치가 최대입니다!N!C[!cFFFF00주루!cFFFFFF] 능력치가 최대입니다!N!N!C!cFFFF001000 G포인트!cFFFFFF가 소모됩니다!N구매하시겠습니까?',
    )
  })

  it('엄마의도시락 네 칸이 다 최대면 줄마다 "!N" 을 붙인 글로 막는다 — 끝 줄 뒤에도 (0x13932 · 0x13998)', () => {
    const 꽉 = 선수({ gamePoint: 1000, ability: { ...선수().ability, hit: 800, power: 800, defense: 800, run: 800 } })
    expect(purchaseQuestionOf(꽉, shopItemId('GP', 4))).toBeNull()
    expect(selectShopItem(꽉, shopItemId('GP', 4), 난수).notice).toBe(
      ['히트', '파워', '수비', '주루'].map((name) => `!C[!cFFFF00${name}!cFFFFFF] 능력치가 최대입니다!N`).join(''),
    )
  })

  it('이글아이(칸 9)는 [224] + "!N!N" + [82] (0x13ab4~0x13ae4)', () => {
    expect(purchaseQuestionOf(선수({ gamePoint: 1000 }), shopItemId('GP', 9))).toBe(
      '!C최대 99회 누적 가능합니다!N!N!C!cFFFF00500 G포인트!cFFFFFF가 소모됩니다!N구매하시겠습니까?',
    )
  })

  it('막혔거나 이미 가진 장비를 고르면 묻지 않는다 — 바로 알림·장착으로 간다', () => {
    expect(purchaseQuestionOf(선수({ money: 0 }), shopItemId('장착', 0, 0))).toBeNull()
    expect(purchaseQuestionOf(선수({ ownedEquipment: ['0-0'] }), shopItemId('장착', 0, 0))).toBeNull()
    expect(purchaseQuestionOf(선수({ gamePoint: 0 }), shopItemId('GP', 4))).toBeNull()
  })
})

describe('상점 선택 — 0x14a74', () => {
  it('장착 아이템을 사면 곧바로 장착 — 구매 완료 창(StrMODE[92])은 없다 (0x14a74 kind 3 0x14aaa~0x14c8a)', () => {
    const result = selectShopItem(선수({ money: 6000 }), shopItemId('장착', 0, 0), 난수)

    expect(result.notice).toBe('')
    expect(result.career.equipmentLevels.hit).toBe(1)
  })

  it('상점에서 가진 장비를 고르면 "이미 가지고 있는" 알림뿐이다 (0x13506, 점검 12차)', () => {
    const 보유 = 선수({ ownedEquipment: ['0-0'], equipmentLevels: { hit: 1, power: 0, defense: 0, run: 0 } })

    expect(selectShopItem(보유, shopItemId('장착', 0, 0), 난수)).toMatchObject({ notice: '!C이미 가지고 있는!N아이템입니다', career: 보유 })
  })

  it('장비착용 화면에서는 가진 장비를 끼고, 성공 알림은 없다 — 확인 팝업(81) 뒤 알림 없음 (0x17b66, StrMODE[80])', () => {
    const 보유 = 선수({ ownedEquipment: ['0-0', '0-1'], equipmentLevels: { hit: 2, power: 0, defense: 0, run: 0 } })

    // StrMODE 에 "장착 했습니다" 같은 문구가 없다 — 원본은 확인 팝업 뒤 따로 알리지 않는다 (R12-shop-guards.md 5절)
    expect(selectShopItem(보유, shopItemId('착용', 0, 0), 난수)).toMatchObject({ notice: '' })
    expect(selectShopItem(보유, shopItemId('착용', 0, 0), 난수).career.equipmentLevels.hit).toBe(1)
    expect(selectShopItem(보유, shopItemId('착용', 0, 1), 난수).notice).toBe('!C현재 장착 중인 장비입니다')
    expect(selectShopItem(보유, shopItemId('착용', 0, 3), 난수).notice).toBe('')
  })

  it('장비착용에서는 끼기 전에 StrMODE[81] 로 묻는다', () => {
    const 보유 = 선수({ ownedEquipment: ['0-0'] })
    expect(purchaseQuestionOf(보유, shopItemId('착용', 0, 0))).toBe('!C[!cFFFF00나이스 헬멧!cFFFFFF] 아이템을!N장착하시겠습니까?')
    expect(purchaseQuestionOf(보유, shopItemId('착용', 0, 1))).toBeNull()
  })

  it('막히면 원문 이유를 알린다', () => {
    expect(selectShopItem(선수({ money: 0 }), shopItemId('장착', 0, 0), 난수).notice).toBe('!C소지금이 부족합니다')
    expect(selectShopItem(선수({ popularity: 0, money: 99999 }), shopItemId('장착', 0, 1), 난수).notice).toBe(
      '!C인기도가 부족합니다.!N!cFFFF00필요한 인기도 : 50',
    )
    expect(selectShopItem(선수({ money: 99999 }), shopItemId('장착', 0, 8), 난수).notice).toBe(
      '!C아직 구매할 수 없는 아이템!N입니다. 특별한 조건을 통해!N오픈됩니다',
    )
  })

  it('장비 구매는 구매 완료 창이 없고(0x14a74 kind 3) 새로 연 컬렉터 k 만 낸다 — 공용 창이 확인 창 뒤에 띄운다', () => {
    const 여섯개 = ['0-0', '0-1', '0-2', '0-3', '0-4', '0-5']
    const result = selectShopItem(선수({ money: 999999, popularity: 999, ownedEquipment: 여섯개 }), shopItemId('장착', 0, 6), 난수)

    expect(result.notice).toBe('')
    expect(result.openedHiddenIds).toEqual([36])
    // 컬렉터가 아니면 창이 하나도 없다
    const 하나 = selectShopItem(선수({ money: 999999, popularity: 999 }), shopItemId('장착', 0, 0), 난수)
    expect(하나.notice).toBe('')
    expect(하나.openedHiddenIds).toEqual([])
    // 이미 열린 k(0x61f5c)면 0x62368 셋째 인자 0 이라 창이 없다
    const 열림 = selectShopItem(
      선수({ money: 999999, popularity: 999, ownedEquipment: 여섯개, openedHiddenIds: [36] }),
      shopItemId('장착', 0, 6),
      난수,
    )
    expect(열림.openedHiddenIds).toEqual([])
  })

  it('서브 아이템과 GP 아이템도 산다', () => {
    expect(selectShopItem(선수({ money: 20000 }), shopItemId('서브', 0), 난수).notice).toBe('!C[!cFFFF00표적판!cFFFFFF] 구매 완료')
    const gp = selectShopItem(선수({ gamePoint: 300, morale: 10 }), shopItemId('GP', 6), 난수)
    // 칸 6 은 알림 대신 상세 결과 창 (0x15030) — 알림 글은 비고 창 재료가 나온다
    expect([gp.notice, gp.career.morale, gp.career.gamePoint]).toEqual(['', 50, 0])
    expect(gp.detail?.itemIndex).toBe(6)
    expect(gp.detail?.before.morale).toBe(10)
    expect(gp.detail?.after).toBe(gp.career)
    expect(selectShopItem(선수({ gamePoint: 0 }), shopItemId('GP', 6), 난수).notice).toBe(ORIGINAL_MODE_TEXT[65]) // StrMODE[65] 원문
  })

  it('GP 결과 창은 칸 0~4·6 만 — 5·7·8·9 는 알림 그대로 (0x14f28 · 0x15030)', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(opensGpDetailWindow)).toEqual([true, true, true, true, true, false, true, false, false, false])
    const sick = selectShopItem(선수({ gamePoint: 500, isSick: true, illnessName: '감기', illnessRemaining: 3 }), shopItemId('GP', 7), 난수)
    expect(sick.detail ?? null).toBeNull()
    expect(sick.notice).toBe('!C부상 및 질병이!N!cFFFF00모두 치료!cFFFFFF 되었습니다')
  })
})

describe('B-99 고친 길 — 1억 이상 나머지는 네 자리', () => {
  afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

  it('1억 50만은 원본 "1억050" · 고친 길 "1억0050"', () => {
    expect(formatOriginalMoney(10_050)).toBe('1억050')
    setBugfixConfigForTests(bugfixConfigWith(['B-99']))
    expect(formatOriginalMoney(10_050)).toBe('1억0050')
    expect(formatOriginalMoney(15_000)).toBe('1억5000')
    expect(formatOriginalMoney(20_000)).toBe('2억')
  })
})
