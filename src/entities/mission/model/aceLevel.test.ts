import { describe, expect, it } from 'vitest'
import {
  ACE_LEVEL_ABILITY_PERCENT,
  ACE_LEVEL_UP_COST_THOUSANDS,
  INITIAL_ACE_LEVEL,
  INITIAL_ACE_LEVEL_SAVE,
  aceLevelRecordOf,
  aceLevelUpCostOf,
  aceLevelUpOutcomeOf,
  aceLevelUpRowsOf,
  isAceMaxLevel,
  levelUpAceSave,
  normalizeAceLevelSave,
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

describe('마선수 레벨 저장 mgr[0x13a..0x143]', () => {
  it('새 저장·옛 저장은 열 칸 모두 0 이다 (0x9f26c)', () => {
    expect(INITIAL_ACE_LEVEL_SAVE.levels).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
    expect(normalizeAceLevelSave(undefined).levels).toHaveLength(10)
    expect(normalizeAceLevelSave({}).levels.every((level) => level === 0)).toBe(true)
  })

  it('0~4 정수만 받고 나머지 칸은 0 으로 채운다', () => {
    expect(normalizeAceLevelSave({ levels: [1, 4, 5, -1, 2.5, '3', 3] }).levels).toEqual([1, 4, 0, 0, 0, 0, 3, 0, 0, 0])
  })

  it('칸 번호 → 레벨 꼴로 바꾼다', () => {
    expect(aceLevelRecordOf(normalizeAceLevelSave({ levels: [0, 0, 0, 0, 0, 0, 0, 2] }))[7]).toBe(2)
  })
})

describe('마선수 레벨업 0x5fb24', () => {
  it('비용은 1000 · 0xd1724[지금 레벨] = 3000·6000·9000·12000 G', () => {
    expect(ACE_LEVEL_UP_COST_THOUSANDS).toEqual([3, 6, 9, 12])
    expect([0, 1, 2, 3].map(aceLevelUpCostOf)).toEqual([3000, 6000, 9000, 12000])
    expect(() => aceLevelUpCostOf(4)).toThrow(RangeError)
  })

  it('레벨 > 3 이면 최고 레벨이라 창을 안 연다 (0x2b0e0 cmp #3; ble)', () => {
    expect(isAceMaxLevel(3)).toBe(false)
    expect(isAceMaxLevel(4)).toBe(true)
  })

  it('G < 비용이면 G부족, 같으면 오른다 (0x5fbd0 bge)', () => {
    expect(aceLevelUpOutcomeOf(1, 5999)).toEqual({ kind: 'G부족', cost: 6000 })
    expect(aceLevelUpOutcomeOf(1, 6000)).toEqual({ kind: '레벨업', cost: 6000 })
  })

  it('한 칸만 한 단계 올린다 (0x5fbee)', () => {
    const save = normalizeAceLevelSave({ levels: [0, 3] })
    expect(levelUpAceSave(save, 1).levels).toEqual([0, 4, 0, 0, 0, 0, 0, 0, 0, 0])
    expect(() => levelUpAceSave(levelUpAceSave(save, 1), 1)).toThrow(RangeError)
  })
})

describe('레벨업 창 다섯 줄 (0x5f394)', () => {
  const 크라이져 = { hit: 777, power: 555, defense: 666, run: 444 }

  it('마타자는 히트·파워·수비·주루 지금→다음 배율 값과 필살타법 횟수 0xd1739', () => {
    expect(aceLevelUpRowsOf('타자', 크라이져, 0)).toEqual([
      { label: '히트', current: 466, next: 543 },
      { label: '파워', current: 333, next: 388 },
      { label: '수비', current: 399, next: 466 },
      { label: '주루', current: 266, next: 310 },
      { label: '필살타법', current: 2, next: 2 },
    ])
  })

  it('마투수는 제구·구속·변화·체력과 마구 횟수 0xd173e', () => {
    const rows = aceLevelUpRowsOf('투수', 크라이져, 3)
    expect(rows.map((row) => row.label)).toEqual(['제구', '구속', '변화', '체력', '마구'])
    expect(rows[0]).toEqual({ label: '제구', current: 699, next: 777 })
    expect(rows[4]).toEqual({ label: '마구', current: 6, next: 7 })
  })
})
