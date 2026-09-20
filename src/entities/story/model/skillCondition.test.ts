import { describe, expect, it } from 'vitest'
import { createCareer } from '@/entities/career/model/playerCareer'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { meetsSkillAcquireCondition, meetsSkillReleaseCondition } from '@/entities/story/model/skillCondition'

const 선수 = (overrides: Partial<PlayerCareer> = {}): PlayerCareer => ({ ...createCareer('테스트'), ...overrides })
/** 조건 값은 스킬 번호 + 1 이다 */
const 값 = (skillId: number) => skillId + 1

describe('조건 20 — 스킬 획득 (0xad1ba)', () => {
  it('이미 가진 스킬이면 뜨지 않는다', () => {
    expect(meetsSkillAcquireCondition(선수({ skillIds: [6] }), 값(6), undefined)).toBe(false)
  })

  it('추가 조건이 없는 스킬(6 행운·8 의외성·9 베테랑·17 하락세)은 안 가졌으면 통과한다', () => {
    const career = 선수({ skillIds: [] })
    expect([6, 8, 9, 17].map((id) => meetsSkillAcquireCondition(career, 값(id), undefined))).toEqual([
      true, true, true, true,
    ])
  })

  it('한 번 해제한 마이너스 스킬은 다시 얻지 못한다 (+0x1d0)', () => {
    const career = 선수({ skillIds: [], removedMinusSkillIds: [17] })
    expect(meetsSkillAcquireCondition(career, 값(17), undefined)).toBe(false)
  })

  it('5 무력감은 사기 ≤ 20 · 연차 인덱스 ≥ 3 · 30% 를 본다', () => {
    const 항상 = { next: () => 0, nextInRange: () => 99, pick: <T,>(c: readonly T[]) => c[0] }
    const 절대 = { next: () => 0, nextInRange: () => 0, pick: <T,>(c: readonly T[]) => c[0] }
    const 지친선수 = 선수({ skillIds: [], morale: 20, season: 4 })

    expect(meetsSkillAcquireCondition(지친선수, 값(5), 항상)).toBe(true)
    expect(meetsSkillAcquireCondition(지친선수, 값(5), 절대)).toBe(false)
    expect(meetsSkillAcquireCondition(선수({ skillIds: [], morale: 21, season: 4 }), 값(5), 항상)).toBe(false)
    expect(meetsSkillAcquireCondition(선수({ skillIds: [], morale: 20, season: 3 }), 값(5), 항상)).toBe(false)
  })

  it('아직 카운터를 못 옮긴 스킬은 통과시키지 않는다 (2 먹튀·7 전설 등)', () => {
    const career = 선수({ skillIds: [] })
    expect([2, 7, 10].map((id) => meetsSkillAcquireCondition(career, 값(id), undefined))).toEqual([
      false, false, false,
    ])
  })

  it('20 에러왕 — 연차 ≥ 3 · 수비 실효 ≤ 400 · 30경기째 · 이번 시즌 수비 훈련 0', () => {
    const 기본 = { skillIds: [], season: 4, gamesPlayed: 30, ability: { hit: 400, power: 400, defense: 400, run: 400 } }
    expect(meetsSkillAcquireCondition(선수(기본), 값(20), undefined)).toBe(true)
    // 29경기째에는 보지 않는다 — 원본은 경기 수를 같음(==)으로 본다
    expect(meetsSkillAcquireCondition(선수({ ...기본, gamesPlayed: 29 }), 값(20), undefined)).toBe(false)
    // 이번 시즌에 수비를 한 번이라도 훈련했으면 안 걸린다
    const 훈련함 = 선수({ ...기본, trainingCounts: { 수비: 1 }, seasonStartTrainingCounts: {} })
    expect(meetsSkillAcquireCondition(훈련함, 값(20), undefined)).toBe(false)
    // 지난 시즌 훈련은 세지 않는다 (통산 − 새 시즌 사본)
    const 작년훈련 = 선수({ ...기본, trainingCounts: { 수비: 5 }, seasonStartTrainingCounts: { 수비: 5 } })
    expect(meetsSkillAcquireCondition(작년훈련, 값(20), undefined)).toBe(true)
  })
})

describe('조건 21 — 스킬 해제', () => {
  it('가지고 있지 않으면 뜨지 않는다', () => {
    expect(meetsSkillReleaseCondition(선수({ skillIds: [] }), 값(6))).toBe(false)
  })

  it('표에 없는 스킬은 가지고 있으면 통과한다', () => {
    expect(meetsSkillReleaseCondition(선수({ skillIds: [6] }), 값(6))).toBe(true)
    expect(meetsSkillReleaseCondition(선수({ skillIds: [16] }), 값(16))).toBe(true)
  })

  it('3 몹쓸몸은 그 스킬을 가진 채로 훈련 6회를 해야 풀린다 (+0x75 > 5)', () => {
    expect(meetsSkillReleaseCondition(선수({ skillIds: [3], badBodyTrainings: 5 }), 값(3))).toBe(false)
    expect(meetsSkillReleaseCondition(선수({ skillIds: [3], badBodyTrainings: 6 }), 값(3))).toBe(true)
  })

  it('18 헛스윙은 히트를 연속 8회 훈련해야 풀린다 (+0x70 > 7)', () => {
    const 일곱 = 선수({ skillIds: [18], consecutiveTrainingCounts: { 히트: 7 } })
    const 여덟 = 선수({ skillIds: [18], consecutiveTrainingCounts: { 히트: 8 } })

    expect(meetsSkillReleaseCondition(일곱, 값(18))).toBe(false)
    expect(meetsSkillReleaseCondition(여덟, 값(18))).toBe(true)
  })

  it('아직 카운터를 못 옮긴 해제 조건은 통과시키지 않는다 (5 무력감)', () => {
    expect(meetsSkillReleaseCondition(선수({ skillIds: [5] }), 값(5))).toBe(false)
  })
})
