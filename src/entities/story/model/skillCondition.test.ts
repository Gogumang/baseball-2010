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
    expect([2, 3, 4, 7, 10].map((id) => meetsSkillAcquireCondition(career, 값(id), undefined))).toEqual([
      false, false, false, false, false,
    ])
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

  it('카운터가 필요한 해제 조건은 아직 통과시키지 않는다 (3 몹쓸몸·18 헛스윙)', () => {
    expect(meetsSkillReleaseCondition(선수({ skillIds: [3] }), 값(3))).toBe(false)
    expect(meetsSkillReleaseCondition(선수({ skillIds: [18] }), 값(18))).toBe(false)
  })
})
