import { describe, expect, it } from 'vitest'
import { createPitcherCareer, equippedPitcherAbilityOf } from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import {
  PITCHER_EQUIPMENT_PARTS, equipOwnedPitcherEquipment, isPitcherHiddenOpen, pitcherEquipmentBlockReasonOf,
  pitcherEquipmentItemOf, pitcherHiddenOpenIdOf, pitcherHiddenOpenTextOf, purchasePitcherEquipment,
} from '@/entities/pitcher-career/model/pitcherEquipment'

/** 투수편(모드 3) 장비 — 0x13460 kind 3 · 0x14a74 · 0x832e8 · 0xb6414 (pitcherEquipment.ts 머리글) */

const 부자 = (overrides: Partial<PitcherCareer> = {}): PitcherCareer => ({
  ...createPitcherCareer('투수'),
  money: 999_000,
  popularity: 999,
  ...overrides,
})

describe('투수 장비 표', () => {
  it('부위 k = 능력치 칸 k — 모자 제구 · 글러브 구속 · 아대 변화 · 신발 체력 (0xb646c 니블 k)', () => {
    expect(PITCHER_EQUIPMENT_PARTS.map((part) => part.ability)).toEqual(['control', 'velocity', 'breaking', 'stamina'])
  })

  it('가격은 0xcc444 **앞 44칸** — 타자(뒤 44칸)와 모자 줄이 다르다 (0x13584 cmp r3,#3)', () => {
    expect(Array.from({ length: 11 }, (_unused, level) => pitcherEquipmentItemOf(0, level).price / 1000))
      .toEqual([4, 8, 12, 18, 24, 32, 40, 80, 110, 150, 200])
    expect(pitcherEquipmentItemOf(1, 10).price).toBe(210_000)
    expect(pitcherEquipmentItemOf(2, 0).price).toBe(4_000)
    expect(pitcherEquipmentItemOf(3, 6).price).toBe(36_000)
  })

  it('이름은 StrITEM[44 + 부위·11 + 레벨] (0x832e8), 히든 힌트는 [186 + 부위·4 + 레벨 − 7] (0x841b4)', () => {
    expect(pitcherEquipmentItemOf(0, 0).name).toBe('나이스 모자')
    expect(pitcherEquipmentItemOf(1, 10).name).toBe('황금의글러브')
    expect(pitcherEquipmentItemOf(2, 7).name).toBe('선글라스')
    expect(pitcherEquipmentItemOf(3, 10).name).toBe('황제의 신발')
    expect(pitcherEquipmentItemOf(0, 8).hiddenHint).toBe('나는야!N모자 컬렉터')
    expect(pitcherEquipmentItemOf(3, 8).hiddenHint).toBe('나는야!N신발 컬렉터')
    expect(pitcherEquipmentItemOf(0, 6).hiddenHint).toBeNull()
  })

  it('히든 id 는 19~34 — 컬렉터(레벨 8)가 20·24·28·32 (0x14bda…)', () => {
    expect([0, 1, 2, 3].map((part) => pitcherHiddenOpenIdOf(part, 8))).toEqual([20, 24, 28, 32])
    expect(pitcherHiddenOpenTextOf(20)).toBe('히든 아이템 오픈!! [해적 선장모] 나만의리그 투수편에서 사용가능합니다')
    expect(pitcherHiddenOpenTextOf(36)).toBeNull()
  })
})

describe('가드 차례 (0x13460 kind 3) — 미오픈 → 보유 → 인기도 → 소지금', () => {
  it('히든 칸은 열리기 전엔 무엇보다 먼저 막힌다', () => {
    expect(pitcherEquipmentBlockReasonOf(부자({ money: 0, popularity: 0 }), 0, 7)).toBe('미오픈')
  })

  it('보유가 인기도보다 앞이고, 인기도가 소지금보다 앞이다', () => {
    const 가진 = 부자({ ownedEquipment: ['0-3'], popularity: 0, money: 0 })
    expect(pitcherEquipmentBlockReasonOf(가진, 0, 3)).toBe('이미보유')
    expect(pitcherEquipmentBlockReasonOf(부자({ popularity: 299, money: 0 }), 0, 3)).toBe('인기도부족')
    expect(pitcherEquipmentBlockReasonOf(부자({ popularity: 300, money: 17_999 }), 0, 3)).toBe('소지금부족')
    expect(pitcherEquipmentBlockReasonOf(부자({ popularity: 300, money: 18_000 }), 0, 3)).toBeNull()
  })
})

describe('구매 확정 (0x14a74 kind 3)', () => {
  it('소지금을 깎고 보유를 켜고 **곧바로 장착**한다 — 니블 = 레벨 + 1', () => {
    const bought = purchasePitcherEquipment(부자({ money: 10_000 }), 1, 1)

    expect(bought.money).toBe(1_000)
    expect(bought.ownedEquipment).toEqual(['1-1'])
    expect(bought.equipmentLevels).toEqual({ control: 0, velocity: 2, breaking: 0, stamina: 0 })
  })

  it('장착 니블이 실효 능력치에 0xd8890[n−1] 로 들어간다 (0xb6414)', () => {
    const before = 부자()
    const bought = purchasePitcherEquipment(before, 1, 1)

    expect(equippedPitcherAbilityOf(bought).velocity - equippedPitcherAbilityOf(before).velocity).toBe(50)
  })

  it('레벨 0~6 을 다 모으면 컬렉터 칸(레벨 8)이 열리고 id 20 이 남는다 (0xa5020 → 0x62368)', () => {
    let career = 부자()
    for (let level = 0; level < 7; level += 1) {
      expect(isPitcherHiddenOpen(career, 0, 8)).toBe(false)
      career = purchasePitcherEquipment(career, 0, level)
    }
    expect(career.openedHiddenIds).toEqual([20])
    expect(isPitcherHiddenOpen(career, 0, 8)).toBe(true)
    expect(isPitcherHiddenOpen(career, 0, 9)).toBe(false)
  })

  it('전역에서 열린 id 가 커리어에 있으면 그 히든 칸을 살 수 있다', () => {
    expect(pitcherEquipmentBlockReasonOf(부자({ openedHiddenIds: [21] }), 0, 9)).toBeNull()
  })
})

describe('장비착용 (0x17ad0)', () => {
  it('가진 것으로 바꿔 끼운다 — 없는 것은 낄 수 없다', () => {
    const 두개 = purchasePitcherEquipment(purchasePitcherEquipment(부자(), 3, 0), 3, 2)
    expect(두개.equipmentLevels.stamina).toBe(3)

    expect(equipOwnedPitcherEquipment(두개, 3, 0).equipmentLevels.stamina).toBe(1)
    expect(() => equipOwnedPitcherEquipment(두개, 3, 1)).toThrow()
  })
})
