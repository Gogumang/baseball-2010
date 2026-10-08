import { createConstantRandom } from '@/shared/api/random/fractionRandom'
import { describe, expect, it } from 'vitest'
import { createPitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import { FULL_STAMINA } from '@/entities/pitcher-career/model/pitcherStamina'
import {
  PITCHER_GP_ICON_FRAMES,
  PITCHER_GP_ITEMS,
  PITCHER_SUB_ITEMS,
  applyPitcherGpItem,
  pitcherGpItemBlockReasonOf,
  pitcherGpItemNoticeOf,
  purchasePitcherGpItem,
} from '@/entities/pitcher-career/model/pitcherItems'
import { BATTER_GP_ITEMS } from '@/entities/career/model/gpItems'
import { SUB_ITEMS } from '@/entities/career/model/subItems'
import type { RandomPort } from '@/shared/api/random/randomPort'

const 투수 = (overrides: Partial<PitcherCareer> = {}): PitcherCareer => ({
  ...createPitcherCareer('투수'),
  morale: 50,
  gamePoint: 5000,
  ...overrides,
})

const 고정 = (position: number): RandomPort => createConstantRandom(position)
const 안씀: RandomPort = {
  rand: () => { throw new Error('난수를 쓰면 안 된다') },
  rand9d: () => { throw new Error('난수를 쓰면 안 된다') },
}

describe('투수 서브 아이템 (창 종류 1 — 0x1364e · 0x14c8c 모드 갈림 없음)', () => {
  it('이름·가격은 타자편 그대로, 칸 0~3 설명만 StrMODE[40+k] 이름이다 (0x82938)', () => {
    expect(PITCHER_SUB_ITEMS.map((item) => item.price)).toEqual(SUB_ITEMS.map((item) => item.price))
    expect(PITCHER_SUB_ITEMS.map((item) => item.name)).toEqual(SUB_ITEMS.map((item) => item.name))
    expect(PITCHER_SUB_ITEMS.slice(0, 4).map((item) => item.effectText)).toEqual([
      '제구 훈련 시 +2', '구속 훈련 시 +2', '변화 훈련 시 +2', '체력 훈련 시 +2',
    ])
    expect(PITCHER_SUB_ITEMS[4].effectText).toBe('훈련 시 사기 감소량 -1')
  })
})

describe('투수 GP 아이템 (창 종류 2)', () => {
  it('가격은 0xcc41b 앞 10칸(타자 블록과 같은 값), 칸 9 만 십전대보탕이다 (StrITEM[107] · [171])', () => {
    expect(PITCHER_GP_ITEMS.map((item) => item.price)).toEqual(BATTER_GP_ITEMS.map((item) => item.price))
    expect(PITCHER_GP_ITEMS[9]).toMatchObject({ name: '십전대보탕', effectText: '스태미나 100% 회복', price: 500 })
    expect(PITCHER_GP_ITEMS[0].effectText).toBe('제구 능력치 + 10')
    expect(PITCHER_GP_ITEMS[4].effectText).toBe('모든 능력치 + 10')
    // 아이콘 표 0xd4676 — 칸 9 만 20 (타자 이글아이는 19)
    expect(PITCHER_GP_ICON_FRAMES[9]).toBe(20)
  })

  it('능력치 아이템은 투수 칸을 +10 하고 보직 한계(0xd80be)로 자른다 — 구원 체력은 600', () => {
    const 구원 = 투수({ role: PITCHER_ROLE.relief, ability: { control: 100, velocity: 845, breaking: 100, stamina: 595 } })

    expect(applyPitcherGpItem(구원, 1, 안씀).career.ability.velocity).toBe(850)
    expect(applyPitcherGpItem(구원, 3, 안씀).career.ability.stamina).toBe(600)
    expect(applyPitcherGpItem(구원, 4, 안씀).career.ability).toEqual({
      control: 110, velocity: 850, breaking: 110, stamina: 600,
    })
  })

  it('십전대보탕은 스태미나를 10000 으로 채운다 (0xa49ec)', () => {
    expect(applyPitcherGpItem(투수({ stamina: 1234 }), 9, 안씀).career.stamina).toBe(FULL_STAMINA)
  })

  it('영지버섯·종합건강진단·최면요법은 타자편과 같은 코드다', () => {
    expect(applyPitcherGpItem(투수({ morale: 80 }), 6, 안씀).career.morale).toBe(100)
    const 아픈 = 투수({ isInjured: true, injuryRemaining: 3, isSick: true, illnessName: '감기', illnessRemaining: 2 })
    expect(applyPitcherGpItem(아픈, 7, 안씀).career).toMatchObject({ isInjured: false, isSick: false, illnessCooldown: 20 })
    const 마이너스 = 투수({ skillIds: [0, 3], equippedSkillIds: [0, 3] })
    const 지움 = applyPitcherGpItem(마이너스, 8, 안씀).career
    expect(지움.skillIds).toEqual([0])
    expect(지움.removedMinusSkillIds).toEqual([3])
  })

  it('또또상품권은 투수 기록에도 +0x186 구매 · +0x185 1등을 센다', () => {
    const 결과 = applyPitcherGpItem(투수({ money: 0 }), 5, 고정(0))

    expect(결과.lotteryPrize).toBe(1)
    expect(결과.career).toMatchObject({ money: 10_000, lotteryPurchases: 1, lotteryFirstPrizes: 1 })
  })

  it('아차상(bfa55(0,4))은 투수 능력치 아이템 0~3 이다', () => {
    // 첫 굴림 0.99 → 9999 아차상, 둘째 굴림 0.99 → 칸 3 체력
    const 결과 = applyPitcherGpItem(투수(), 5, 고정(0.99))

    expect(결과.lotteryPrize).toBe('아차상')
    expect(결과.prizeItemId).toBe(3)
    expect(결과.career.ability.stamina).toBe(투수().ability.stamina + 10)
    expect(pitcherGpItemNoticeOf(5, 결과.lotteryPrize, 결과.prizeItemId)).toBe('아차상 당첨!! [고려인삼] 획득!')
  })

  it('사면 G 를 먼저 뺀다 — 모자라면 거절', () => {
    expect(purchasePitcherGpItem(투수({ gamePoint: 499 }), 9, 안씀)).toEqual({ kind: '거절', reason: 'G포인트부족' })
    const 산 = purchasePitcherGpItem(투수({ gamePoint: 1000, stamina: 0 }), 9, 안씀)
    expect(산.kind === '구입' && 산.result.career).toMatchObject({ gamePoint: 500, stamina: FULL_STAMINA })
  })
})

describe('투수 GP 가드 (0x13460 kind 2)', () => {
  it('능력치 아이템은 기본 능력치가 보직 한계 이상이면 StrMODE[192] — 이름은 StrMODE[40+k]', () => {
    const 꽉 = 투수({ ability: { control: 800, velocity: 100, breaking: 100, stamina: 800 } })

    expect(pitcherGpItemBlockReasonOf(꽉, 0)).toBe('[제구] 능력치가 최대입니다')
    expect(pitcherGpItemBlockReasonOf(꽉, 1)).toBeNull()
    // 도시락은 넷 다 최대일 때만 막는다
    expect(pitcherGpItemBlockReasonOf(꽉, 4)).toBeNull()
  })

  it('십전대보탕은 스태미나가 10000 이면 StrMODE[211]', () => {
    expect(pitcherGpItemBlockReasonOf(투수({ stamina: FULL_STAMINA }), 9)).toBe('스태미나가 최대입니다 구매 할 수 없습니다')
    expect(pitcherGpItemBlockReasonOf(투수({ stamina: FULL_STAMINA - 1 }), 9)).toBeNull()
  })

  it('영지버섯 91 · 건강진단 208 · 최면요법 209 는 타자편과 같다', () => {
    expect(pitcherGpItemBlockReasonOf(투수({ morale: 100 }), 6)).toBe('사기 최고 상태입니다')
    expect(pitcherGpItemBlockReasonOf(투수(), 7)).toBe('건강한 상태입니다 구매 할 수 없습니다')
    expect(pitcherGpItemBlockReasonOf(투수({ skillIds: [0] }), 8)).toBe('마이너스 스킬이 없습니다 구매 할 수 없습니다')
    expect(pitcherGpItemBlockReasonOf(투수({ skillIds: [17] }), 8)).toBeNull()
  })
})

describe('투수 GP 알림 (0xa4488)', () => {
  it('능력치 이름은 StrMODE[40+k], 모든능력치는 [39] — 숫자 6·8 은 원본 그대로', () => {
    expect(pitcherGpItemNoticeOf(1, null)).toBe('구속 6 상승하였습니다')
    expect(pitcherGpItemNoticeOf(4, null)).toBe('모든능력치 8 상승하였습니다')
  })

  it('십전대보탕은 StrMODE[125]', () => {
    expect(pitcherGpItemNoticeOf(9, null)).toBe('스태미나가 100% 회복되었습니다')
  })
})
