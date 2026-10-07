import { describe, expect, it } from 'vitest'
import type { RandomPort } from '@/shared/api/random/randomPort'
import {
  applySeasonTraining, rollSeasonTraining, scrollSeasonTrainingMessages, seasonTrainingMessagesOf, seasonTrainingResultOf,
} from '@/widgets/season/lib/seasonTrainingResult'

/** 차례로 값을 내는 난수 — 굴림 차례를 못박는다 */
const 차례난수 = (values: readonly number[]): RandomPort & { calls: number } => {
  const port = { calls: 0, next: () => values[port.calls++] ?? 0 }
  return port as RandomPort & { calls: number }
}

const 아이템없음 = { trainingSubItems: [false, false, false, false], massager: false }

describe('굴림 0xc074 — 난수 차례', () => {
  it('칸 0~3 은 상승 bfa55(4,7) 다음 감소 bfa55(6,9)', () => {
    const random = 차례난수([0.99, 0])
    const roll = rollSeasonTraining(random, 2, 아이템없음)
    expect(roll.gains).toEqual([0, 0, 6, 0])
    expect(roll.moraleLoss).toBe(6)
    expect(random.calls).toBe(2)
  })

  it('지옥훈련은 감소 bfa55(10,14) 를 먼저, 그다음 네 칸 bfa55(7,11)', () => {
    const roll = rollSeasonTraining(차례난수([0.99, 0, 0.25, 0.5, 0.99]), 4, 아이템없음)
    expect(roll.moraleLoss).toBe(13)
    expect(roll.gains).toEqual([7, 8, 9, 10])
  })

  it('보정은 훈련한 칸의 서브 아이템만 +2, 안마기는 사기 −1', () => {
    const items = { trainingSubItems: [true, true, false, false], massager: true }
    expect(rollSeasonTraining(차례난수([0, 0]), 1, items)).toMatchObject({ bonuses: [0, 2, 0, 0], moraleBonus: -1 })
    expect(rollSeasonTraining(차례난수([0, 0, 0, 0, 0]), 4, items).bonuses).toEqual([2, 2, 0, 0])
  })
})

describe('적용 0xa2f24 · 결과 창 0x872a0', () => {
  it('능력치는 999 로, 사기는 0..100 으로 자르고 안마기는 감소를 1 줄인다', () => {
    const roll = { gains: [5, 0, 0, 0], bonuses: [2, 0, 0, 0], moraleLoss: 8, moraleBonus: -1 }
    expect(applySeasonTraining([995, 10, 10, 10], 5, roll)).toEqual({ abilities: [999, 10, 10, 10], teamMorale: 0 })
    expect(applySeasonTraining([100, 10, 10, 10], 50, roll).teamMorale).toBe(43)
  })

  it('현재 = 적용 뒤 · 변화 = 굴린 값(사기는 −감소) · 넷째 칸 = 보정', () => {
    const items = { trainingSubItems: [true, false, false, false], massager: true }
    const roll = { gains: [5, 0, 0, 0], bonuses: [2, 0, 0, 0], moraleLoss: 8, moraleBonus: -1 }
    const result = seasonTrainingResultOf(0, items, roll, { abilities: [107, 10, 10, 10], teamMorale: 43 })
    expect(result.current).toEqual({ ability: [107, 10, 10, 10], morale: 43 })
    expect(result.change).toEqual({ ability: [5, 0, 0, 0], morale: -8 })
    expect(result.bonus).toEqual({ ability: [2, 0, 0, 0], morale: -1 })
  })

  it('글 줄 — "[아이템] 능력+2" · "[자동안마기] 사기감소-1", 보정 없으면 빈 글', () => {
    expect(seasonTrainingMessagesOf(1, { trainingSubItems: [false, true, false, false], massager: true })).toEqual([
      '!cFFFFFF[!cFFFF00피칭머신!cFFFFFF] 타격+2',
      '!cFFFFFF[!cFFFF00자동안마기!cFFFFFF] 사기감소-1',
    ])
    expect(seasonTrainingMessagesOf(0, { trainingSubItems: [false, true, false, false], massager: false })).toEqual([])
  })
})

describe('결과 팝업 키 0xf2c8 — 글 상자 첫 줄', () => {
  it('위는 0 밑으로 가면 줄 수 − 4 로, 아래는 줄 수 − 4 를 넘으면 0 으로 돈다', () => {
    expect(scrollSeasonTrainingMessages(0, 5, -1)).toBe(1)
    expect(scrollSeasonTrainingMessages(1, 5, 1)).toBe(0)
    expect(scrollSeasonTrainingMessages(0, 5, 1)).toBe(1)
    expect(scrollSeasonTrainingMessages(0, 2, -1)).toBe(0)
    expect(scrollSeasonTrainingMessages(0, 2, 1)).toBe(0)
  })
})
