import { describe, expect, it } from 'vitest'
import { createCareer } from '@/entities/career/model/playerCareer'
import { trainingBlockTextOf, trainingOutcomeLinesOf } from '@/entities/career/model/trainingText'
import type { TrainingOutcome } from '@/entities/career/model/training'

const 결과 = (overrides: Partial<TrainingOutcome> = {}): TrainingOutcome => ({
  menuId: '히트',
  gains: { hit: 5 },
  typeBonus: 1,
  moraleLoss: 6,
  specialSwing: null,
  career: createCareer('테스트'),
  ...overrides,
})

describe('훈련 알림 문구', () => {
  it('능력치 훈련은 상승·타입 보너스·사기를 **줄로 나눠** 준다', () => {
    expect(trainingOutcomeLinesOf(결과())).toEqual(['히트 +5 상승하였습니다', '타입 보너스 +1', '사기 -6'])
    expect(trainingOutcomeLinesOf(결과({ typeBonus: 0 }))).toEqual(['히트 +5 상승하였습니다', '사기 -6'])
  })

  it('한 줄이 메시지 칸(170px)을 넘지 않는다 — 넘치면 원본이 잘라 버린다', () => {
    // 11px 글자 기준으로 한 줄에 대략 24자까지 들어간다. 그보다 길면 화면에서 잘린다
    const 최대글자수 = 24
    const 모든줄 = [
      ...trainingOutcomeLinesOf(결과()),
      ...trainingOutcomeLinesOf(결과({ menuId: '필살타법', gains: {}, typeBonus: 0, specialSwing: { sessions: 4, required: 4, isLevelUp: true } })),
    ]

    for (const line of 모든줄) {
      expect(line.length, `너무 긴 줄입니다: ${line}`).toBeLessThanOrEqual(최대글자수)
    }
  })

  it('필살타법은 StrMODE[86] 횟수 또는 [87] 훈련 완료', () => {
    const 진행 = 결과({ menuId: '필살타법', gains: {}, typeBonus: 0, specialSwing: { sessions: 2, required: 4, isLevelUp: false } })
    const 완료 = 결과({ menuId: '필살타법', gains: {}, typeBonus: 0, specialSwing: { sessions: 4, required: 4, isLevelUp: true } })
    expect(trainingOutcomeLinesOf(진행)).toEqual(['[필살타법] 2/4회 훈련', '사기 -6'])
    expect(trainingOutcomeLinesOf(완료)).toEqual(['필살타법 훈련 완료!', '[선수정보]에서 사용 여부 변경 가능', '사기 -6'])
  })

  it('거절 문구는 원문 (StrMODE[193]·[192])', () => {
    expect(trainingBlockTextOf('사기부족', '히트')).toBe('사기가 0일 때는 훈련을 할 수 없습니다')
    expect(trainingBlockTextOf('능력치최대', '수비')).toBe('[수비] 능력치가 최대입니다')
  })
})
