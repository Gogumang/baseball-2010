import { describe, expect, it } from 'vitest'
import { createCareer } from '@/entities/career/model/playerCareer'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { BATTER_GP_ITEMS, abilityLimitOf, gpItemNoticeOf, lotteryPrizeOf, applyGpItem, purchaseGpItem } from '@/entities/career/model/gpItems'
import type { RandomPort } from '@/shared/api/random/randomPort'

const 선수 = (overrides: Partial<PlayerCareer> = {}): PlayerCareer => ({ ...createCareer('테스트'), ...overrides })
/** nextInRange(0, 10000) 이 roll 을 돌려준다 */
const 고정난수 = (roll: number): RandomPort => ({
  next: () => roll / 10000,
  nextInRange: (minimum, maximum) => minimum + (roll / 10000) * (maximum - minimum),
  pick: (candidates) => candidates[0],
})
const 보통 = 고정난수(0)

describe('GP 아이템 (타자, 0xa4488)', () => {
  it('타자편 목록은 StrITEM[98~106]·[108] 순서다', () => {
    expect(BATTER_GP_ITEMS.map((item) => item.name)).toEqual([
      '장어구이', '붕붕드링크', '빌리언XZ', '고려인삼', '엄마의도시락', '또또상품권', '영지버섯', '종합건강진단', '최면요법', '이글아이',
    ])
  })

  it('가격은 표 0xcc41b × 100 G — 300·300·300·300·1000·300·300·500·2000·500', () => {
    expect(BATTER_GP_ITEMS.map((item) => item.price)).toEqual([300, 300, 300, 300, 1000, 300, 300, 500, 2000, 500])
  })

  it('사면 G포인트를 쓰고 바로 효과가 난다, 모자라면 거절한다', () => {
    const bought = purchaseGpItem(선수({ gamePoint: 1000, morale: 10 }), 6, 보통)

    expect(bought.kind === '구입' && [bought.result.career.gamePoint, bought.result.career.morale]).toEqual([700, 50])
    expect(purchaseGpItem(선수({ gamePoint: 299 }), 6, 보통)).toEqual({ kind: '거절', reason: 'G포인트부족' })
  })

  it('알림은 원문 조각으로 만든다 — StrMODE[35+k]+[83], [122], 복권은 [116]/[117]', () => {
    expect(gpItemNoticeOf(1, null)).toBe('파워 +10 상승하였습니다')
    expect(gpItemNoticeOf(6, null)).toBe('사기 +40 회복되었습니다')
    expect(gpItemNoticeOf(5, 1)).toBe('1등 당첨!! [1억] 획득!')
    expect(gpItemNoticeOf(5, '우정상')).toBe('우정상 당첨!! [영지버섯] 획득!')
    expect(gpItemNoticeOf(5, '아차상', 2)).toBe('아차상 당첨!! [빌리언XZ] 획득!')
  })

  it('능력치 아이템은 히트·파워·수비·주루 +10, 엄마의도시락은 모두 +10', () => {
    const base = { hit: 100, power: 100, defense: 100, run: 100 }
    expect(applyGpItem(선수({ ability: base }), 2, 보통).career.ability).toEqual({ ...base, defense: 110 })
    expect(applyGpItem(선수({ ability: base }), 4, 보통).career.ability).toEqual({ hit: 110, power: 110, defense: 110, run: 110 })
  })

  it('실효 능력치가 타입 한계치(표 0xd80c6)를 넘으면 기본값을 한계로 둔다 — 이미 넘었던 값도 내린다 (0xa4528, 점검 11차)', () => {
    expect(abilityLimitOf(0)).toEqual({ hit: 800, power: 800, defense: 800, run: 800 })
    const 장타 = 선수({ battingTypeIndex: 1, skillIds: [], ability: { hit: 795, power: 845, defense: 745, run: 900 } })
    expect(applyGpItem(장타, 4, 보통).career.ability).toEqual({ hit: 800, power: 850, defense: 750, run: 750 })
  })

  it('한계 비교는 장비·스킬을 뺀 기본값으로 한다 — 장비가 있어도 기본값을 깎지 않는다 (0xa4488)', () => {
    const 장비 = 선수({ skillIds: [], ability: { hit: 700, power: 100, defense: 100, run: 100 }, equipmentLevels: { hit: 5, power: 0, defense: 0, run: 0 } })
    // 기본값 700 + 10 = 710 은 한계 800 아래라 그대로 오른다 (앞서는 장비 보너스 탓에 800 으로 깎였다)
    expect(applyGpItem(장비, 0, 보통).career.ability.hit).toBe(710)
  })

  it('기본값이 한계를 넘으면 한계로 내린다', () => {
    const 한계초과 = 선수({ skillIds: [], ability: { hit: 795, power: 100, defense: 100, run: 100 }, equipmentLevels: { hit: 0, power: 0, defense: 0, run: 0 } })
    expect(applyGpItem(한계초과, 0, 보통).career.ability.hit).toBe(800)
  })

  it('영지버섯 사기 +40 (상한 100) · 종합건강진단은 부상·질병 치료 · 이글아이는 20경기(상한 99)', () => {
    expect(applyGpItem(선수({ morale: 30 }), 6, 보통).career.morale).toBe(70)
    expect(applyGpItem(선수({ isInjured: true, isSick: true, illnessName: '감기' }), 7, 보통).career).toMatchObject({
      isInjured: false, isSick: false, illnessName: null, illnessCooldown: 20,
    })
    expect(applyGpItem(선수({ eagleEyeGamesRemaining: 90 }), 9, 보통).career.eagleEyeGamesRemaining).toBe(99)
  })

  it('최면요법은 마이너스 스킬만 지운다 (StrMODE[124])', () => {
    expect(applyGpItem(선수({ skillIds: [0, 5, 8, 17] }), 8, 보통).career.skillIds).toEqual([0, 8])
  })

  it('또또상품권은 누적 2·5·10·20·40·70% 로 1~6등, 그 뒤 엄마상·메디카상·우정상·아차상 (표 0xd80b1)', () => {
    expect([0, 199, 200, 499, 999, 1999, 3999, 6999].map(lotteryPrizeOf)).toEqual([1, 1, 2, 2, 3, 4, 5, 6])
    expect([7000, 7099, 7100, 7499, 7500, 8499, 8500, 9999].map(lotteryPrizeOf)).toEqual([
      '엄마상', '엄마상', '메디카상', '메디카상', '우정상', '우정상', '아차상', '아차상',
    ])
  })

  it('또또상품권 1등은 소지금 +1억(100×100만)이고 1등 횟수·구매 횟수가 는다', () => {
    const result = applyGpItem(선수({ money: 0 }), 5, 고정난수(0))

    expect(result.career.money).toBe(10_000)
    expect([result.career.lotteryFirstPrizes, result.career.lotteryPurchases]).toEqual([1, 1])
    expect(result.lotteryPrize).toBe(1)
  })

  it('아차상은 능력치 아이템 0~3 중 하나다 — bfa55(0,4) (0xa46ec)', () => {
    const base = { hit: 100, power: 100, defense: 100, run: 100 }
    const 아차 = { ...고정난수(9999), next: () => 0.9999 }
    expect(applyGpItem(선수({ ability: base, skillIds: [] }), 5, 아차).career.ability).toEqual({ ...base, run: 110 })
  })

  it('또또상품권 우정상은 영지버섯 효과(사기 +40)', () => {
    expect(applyGpItem(선수({ morale: 10 }), 5, 고정난수(8000)).career.morale).toBe(50)
  })
})
