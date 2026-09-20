import { describe, expect, it } from 'vitest'
import { applyBurstRewards } from '@/entities/career/model/burstReward'
import { createCareer, ORIGINAL_MONEY_UNIT } from '@/entities/career/model/playerCareer'

/** 돌발미션 보상이 내 선수 레코드에 붙는 자리 (0x8e34c 의 r6 = 0x1fa2d, 나만의리그) */

const 선수 = () => ({ ...createCareer('선수'), morale: 50, popularity: 100, reputation: 300, money: 6000 })

describe('applyBurstRewards', () => {
  it('사기·인기도·평판은 그대로 더한다', () => {
    const after = applyBurstRewards(선수(), [
      { name: '사기', amount: 10 },
      { name: '인기도', amount: 20 },
      { name: '평판', amount: -30 },
    ])

    expect([after.morale, after.popularity, after.reputation]).toEqual([60, 120, 270])
  })

  it('소지금만 단위를 맞춘다 — 원본 한 칸이 100만원이라 100을 곱한다', () => {
    const after = applyBurstRewards(선수(), [{ name: '소지금', amount: 5 }])

    expect(after.money).toBe(6000 + 5 * ORIGINAL_MONEY_UNIT)
  })

  it('소지금은 0 아래로 내려가지 않는다', () => {
    expect(applyBurstRewards(선수(), [{ name: '소지금', amount: -999 }]).money).toBe(0)
  })

  it('빈 목록이면 그대로다 (무효 판정)', () => {
    const career = 선수()

    expect(applyBurstRewards(career, [])).toBe(career)
  })
})
