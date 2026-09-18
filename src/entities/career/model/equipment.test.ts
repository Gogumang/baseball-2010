import { describe, expect, it } from 'vitest'
import { createCareer } from '@/entities/career/model/playerCareer'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import {
  EQUIPMENT_PARTS,
  equipmentBlockReasonOf,
  equipmentBonusOf,
  equipmentItemOf,
  equipOwned,
  hiddenOpenIdOf,
  hiddenOpenTextOf,
  isHiddenOpen,
  openHidden,
  purchaseEquipment,
} from '@/entities/career/model/equipment'

const 선수 = (overrides: Partial<PlayerCareer> = {}): PlayerCareer => ({ ...createCareer('테스트'), ...overrides })

describe('장착 아이템 — 0x13460 · 0x14a74', () => {
  it('부위 네 개는 헬멧→히트, 배트→파워, 밴드→수비, 슈즈→주루 다', () => {
    expect(EQUIPMENT_PARTS.map((part) => [part.name, part.ability])).toEqual([
      ['헬멧', 'hit'], ['배트', 'power'], ['밴드', 'defense'], ['슈즈', 'run'],
    ])
  })

  it('이름은 StrITEM[부위×11+레벨], 가격은 표 0xcc444 행 4~7(타자는 +44칸) × 1000만, 필요 인기도는 표 0xcc50a', () => {
    expect(equipmentItemOf(0, 0)).toMatchObject({ name: '나이스 헬멧', price: 5000, requiredPopularity: 0 })
    expect(equipmentItemOf(2, 1)).toMatchObject({ name: '라이트 밴드', price: 6000 })
    expect(equipmentItemOf(1, 6)).toMatchObject({ name: '하이퍼 배트', price: 45000, requiredPopularity: 800 })
    expect(equipmentItemOf(3, 10)).toMatchObject({ name: '이카로스슈즈', price: 190000, isHidden: true })
  })

  it('사면 소지금이 줄고 그 레벨이 곧바로 장착된다 (니블 = 레벨+1)', () => {
    const bought = purchaseEquipment(선수({ money: 10000, popularity: 100 }), 0, 1)

    expect(bought.money).toBe(1000)
    expect(bought.equipmentLevels.hit).toBe(2)
    expect(bought.ownedEquipment).toContain('0-1')
  })

  it('인기도 부족 · 소지금 부족 · 이미 보유 · 미오픈을 가린다 (StrMODE[62]·[77]·[78]·[76])', () => {
    expect(equipmentBlockReasonOf(선수({ money: 99999, popularity: 49 }), 0, 1)).toBe('인기도부족')
    expect(equipmentBlockReasonOf(선수({ money: 8999, popularity: 50 }), 0, 1)).toBe('소지금부족')
    expect(equipmentBlockReasonOf(선수({ money: 99999, ownedEquipment: ['0-1'] }), 0, 1)).toBe('이미보유')
    expect(equipmentBlockReasonOf(선수({ money: 999999 }), 0, 7)).toBe('미오픈')
  })

  it('레벨 0~6 을 모두 가진 부위는 레벨 8 이 열린다 — 힌트 둘째 줄 "○○ 컬렉터" (0xa5020, 누락 탐색 7차)', () => {
    const 컬렉터 = 선수({ ownedEquipment: ['0-0', '0-1', '0-2', '0-3', '0-4', '0-5', '0-6'] })

    expect(isHiddenOpen(컬렉터, 0, 8)).toBe(true)
    expect(isHiddenOpen(컬렉터, 0, 7)).toBe(false)
    expect(isHiddenOpen(컬렉터, 1, 8)).toBe(false)
  })

  it('타자 히든 오픈 id 는 35 + 부위×4 + (레벨−7) 이고, 열린 id 는 전역 기록에서 온다 (0x61f5c)', () => {
    expect([hiddenOpenIdOf(0, 7), hiddenOpenIdOf(1, 9), hiddenOpenIdOf(3, 10)]).toEqual([35, 41, 50])
    expect(isHiddenOpen(선수({ openedHiddenIds: [43] }), 2, 7)).toBe(true)
  })

  it('컬렉터가 되면 오픈 id 를 기록에 남긴다 — 구매 직후 0xa5020', () => {
    const 여섯개 = ['0-0', '0-1', '0-2', '0-3', '0-4', '0-5']
    const bought = purchaseEquipment(선수({ money: 999999, popularity: 999, ownedEquipment: 여섯개 }), 0, 6)

    expect(bought.openedHiddenIds).toContain(36)
    expect(openHidden(선수(), 36).openedHiddenIds).toEqual([36])
    expect(openHidden(선수({ openedHiddenIds: [36] }), 36).openedHiddenIds).toEqual([36])
  })

  it('오픈 알림은 StrCOMMON[139] + [143] — 타자 장비 id 만 이름을 안다', () => {
    expect(hiddenOpenTextOf(36)).toBe('히든 아이템 오픈!! [검투사 투구] 나만의리그 타자편에서 사용가능합니다')
    expect(hiddenOpenTextOf(3)).toBeNull()
  })

  it('히든 힌트는 부위당 레벨 7·8·9·10 순서다', () => {
    expect(equipmentItemOf(0, 8).hiddenHint).toBe('나는야!N헬멧 컬렉터')
  })

  it('가진 장비는 다시 장착할 수 있다 (StrMODE[80]·[81])', () => {
    const career = equipOwned(선수({ ownedEquipment: ['2-3'] }), 2, 3)

    expect(career.equipmentLevels.defense).toBe(4)
    expect(() => equipOwned(선수(), 2, 3)).toThrow()
  })

  it('장착 레벨 보너스는 +30/50/70/90/110/125/140/190/210/230/250 (표 0xd8890)', () => {
    expect([0, 1, 2, 7, 8, 11].map((level) => equipmentBonusOf(level))).toEqual([0, 30, 50, 140, 190, 250])
  })
})
