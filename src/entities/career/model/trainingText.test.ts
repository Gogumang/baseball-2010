import { describe, expect, it } from 'vitest'
import { createCareer } from '@/entities/career/model/playerCareer'
import { trainingBlockTextOf, trainingOutcomeTextOf } from '@/entities/career/model/trainingText'
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
  it('능력치 훈련은 "히트 +5 상승하였습니다" + 타입 보너스 + 사기 감소', () => {
    expect(trainingOutcomeTextOf(결과())).toBe('히트 +5 상승하였습니다 · 타입 보너스 +1 · 사기 -6')
    expect(trainingOutcomeTextOf(결과({ typeBonus: 0 }))).toBe('히트 +5 상승하였습니다 · 사기 -6')
  })

  it('필살타법은 StrMODE[86] 횟수 또는 [87] 훈련 완료', () => {
    const 진행 = 결과({ menuId: '필살타법', gains: {}, typeBonus: 0, specialSwing: { sessions: 2, required: 4, isLevelUp: false } })
    const 완료 = 결과({ menuId: '필살타법', gains: {}, typeBonus: 0, specialSwing: { sessions: 4, required: 4, isLevelUp: true } })
    expect(trainingOutcomeTextOf(진행)).toBe('[필살타법] 2/4회 훈련 · 사기 -6')
    expect(trainingOutcomeTextOf(완료)).toBe('필살타법 훈련 완료! [선수정보]에서 사용 여부 변경 가능 · 사기 -6')
  })

  it('거절 문구는 원문 (StrMODE[193]·[192])', () => {
    expect(trainingBlockTextOf('사기부족', '히트')).toBe('사기가 0일 때는 훈련을 할 수 없습니다')
    expect(trainingBlockTextOf('능력치최대', '수비')).toBe('[수비] 능력치가 최대입니다')
  })
})
