import { describe, expect, it } from 'vitest'
import {
  applySeasonEquipment, checkSeasonEquipment, seasonEquipmentHiddenIdOf, seasonEquipmentNameOf, seasonEquipmentPriceOf,
} from '@/entities/season-mode/model/seasonEquipment'

const 열림없음 = () => false

describe('시즌 장비 창 0xdc 종류 3 — 가드 0x957c · 적용 0x7d90', () => {
  it('가격 0xcbca8 — 투수 앞 44칸 · 타자 뒤 44칸, 이름은 타자 StrITEM[i + 11t] · 투수 +44', () => {
    expect(seasonEquipmentPriceOf(false, 0, 0)).toBe(4)
    expect(seasonEquipmentPriceOf(true, 0, 0)).toBe(5)
    expect(seasonEquipmentPriceOf(true, 3, 10)).toBe(190)
    expect(seasonEquipmentNameOf(true, 0, 0)).toBe('나이스 헬멧')
  })

  it('가드 차례 — 미오픈 → 이미 낀 것 → 인기도 → 소지금 (가격 × 10 > 소지금)', () => {
    const 레코드 = { popularity: 1000, money: 9999 }
    expect(checkSeasonEquipment(레코드, { isBatter: true, equipment: [8, 0, 0, 0] }, 0, 7, 열림없음))
      .toEqual({ ok: false, reason: '미오픈' })
    expect(checkSeasonEquipment(레코드, { isBatter: true, equipment: [8, 0, 0, 0] }, 0, 7, (id) => id === seasonEquipmentHiddenIdOf(true, 0, 7)))
      .toEqual({ ok: false, reason: '이미보유' })
    expect(checkSeasonEquipment({ popularity: 100, money: 9999 }, { isBatter: true, equipment: [0, 0, 0, 0] }, 0, 2, 열림없음))
      .toEqual({ ok: false, reason: '인기도부족', required: 150 })
    expect(checkSeasonEquipment({ popularity: 0, money: 49 }, { isBatter: true, equipment: [0, 0, 0, 0] }, 0, 0, 열림없음))
      .toEqual({ ok: false, reason: '소지금부족' })
    expect(checkSeasonEquipment({ popularity: 0, money: 50 }, { isBatter: true, equipment: [0, 0, 0, 0] }, 0, 0, 열림없음))
      .toEqual({ ok: true, price: 5 })
  })

  it('예전에 끼었던 것도 지금 낀 것이 아니면 다시 산다 — 산 기록이 없다', () => {
    expect(checkSeasonEquipment({ popularity: 0, money: 9999 }, { isBatter: false, equipment: [3, 0, 0, 0] }, 0, 0, 열림없음).ok).toBe(true)
  })

  it('적용 — 소지금 − 가격 × 10 (0..9999) · 니블 = 칸 + 1, 나머지 부위는 그대로', () => {
    expect(applySeasonEquipment(100, { isBatter: false, equipment: [0, 2, 0, 5] }, 2, 4))
      .toEqual({ money: 0, equipment: [0, 2, 5, 5] }) // 100 − 240 → 0 에서 자른다
    expect(applySeasonEquipment(500, { isBatter: false, equipment: [0, 0, 0, 0] }, 0, 0)).toEqual({ money: 460, equipment: [1, 0, 0, 0] })
  })

  it('해금 id — 투수 19 + 4t + (i − 7) · 타자 35 + 4t + (i − 7)', () => {
    expect(seasonEquipmentHiddenIdOf(false, 0, 7)).toBe(19)
    expect(seasonEquipmentHiddenIdOf(true, 3, 10)).toBe(50)
  })
})
