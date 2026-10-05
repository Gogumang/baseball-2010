import { describe, expect, it } from 'vitest'
import {
  ACE_LEVEL_ABILITY_PERCENT,
  INITIAL_ACE_LEVEL,
  aceAbilityAtLevel,
  aceLevelOf,
  aceLevelSlotOf,
  applyAceLevelRate,
} from '@/entities/mission/model/aceLevel'

describe('마선수 레벨 배율 0xd88aa (0xb6414 첫 단계)', () => {
  it('표는 60·70·80·90·100 % 이고 새 저장 레벨은 0 (Lv1) 이다', () => {
    expect(ACE_LEVEL_ABILITY_PERCENT).toEqual([60, 70, 80, 90, 100])
    expect(INITIAL_ACE_LEVEL).toBe(0)
  })

  it('레벨 칸은 마투수 순번 n → n−1, 마타자 순번 n → n−1+5 다 (mgr[0x13a+idx])', () => {
    expect(aceLevelSlotOf('투수', 1)).toBe(0)
    expect(aceLevelSlotOf('투수', 5)).toBe(4)
    expect(aceLevelSlotOf('타자', 1)).toBe(5)
    expect(aceLevelSlotOf('타자', 3)).toBe(7)
  })

  it('저장이 없거나 칸이 비면 새 저장 값 0 이다', () => {
    expect(aceLevelOf(undefined, 7)).toBe(0)
    expect(aceLevelOf({ 2: 3 }, 7)).toBe(0)
    expect(aceLevelOf({ 7: 3 }, 7)).toBe(3)
  })

  it('v · 퍼센트 / 100 을 0 쪽으로 버린다 (0xca7b5)', () => {
    expect(applyAceLevelRate(777, 0)).toBe(466) // 466.2
    expect(applyAceLevelRate(555, 1)).toBe(388) // 388.5
    expect(applyAceLevelRate(999, 4)).toBe(999)
  })

  it('네 칸 모두에 곱한다', () => {
    expect(aceAbilityAtLevel({ hit: 580, power: 850, run: 320, defense: 600 }, 0)).toEqual({
      hit: 348,
      power: 510,
      run: 192,
      defense: 360,
    })
  })

  it('저장 값은 0~4 뿐이라 표 밖은 받지 않는다', () => {
    expect(() => applyAceLevelRate(500, 5)).toThrow(RangeError)
  })
})
