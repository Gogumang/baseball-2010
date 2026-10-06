import { describe, expect, it } from 'vitest'
import { createCareer } from '@/entities/career/model/playerCareer'
import { createPitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import {
  abilityDetailScrollKeyOf, abilityDetailViewOf, batterAbilityDetailViewOf, scrollAbilityDetail,
} from '@/pages/management/lib/abilityDetail'
import type { AbilityDetailSource } from '@/pages/management/lib/abilityDetail'
import { BATTER_DETAIL_LABEL_FRAMES, PITCHER_DETAIL_LABEL_FRAMES } from '@/pages/management/lib/detailPopup'
import { pitcherAbilityDetailViewOf } from '@/pages/pitcher-league/lib/pitcherDetailPopup'

/** 능력치 상세 창(나리 120) — 글 만들기 0x88fe8 · 스크롤 0x8a044 (직접 떴다) */

const 바탕: AbilityDetailSource = {
  isBatter: true,
  base: [100, 200, 300, 400],
  limits: [500, 500, 500, 500],
  effective: [100, 200, 300, 400],
  morale: 80,
  equipmentNibbles: [0, 0, 0, 0],
  isPowerlessEquipped: false,
  isLegendEquipped: false,
  isSick: false,
  isInjured: false,
}

describe('표 (0x890a2~0x8911c → 0x872a0)', () => {
  it('현재 = 기본 능력치 · 최대 = 한계 · 변화 = 실효 − 기본 · 사기 줄은 변화 0 · 보너스 칸은 0', () => {
    const { rows } = abilityDetailViewOf({ ...바탕, effective: [130, 140, 300, 0], morale: 40 }, BATTER_DETAIL_LABEL_FRAMES)
    expect(rows.map((row) => [row.labelFrame, row.current, row.maximum, row.change, row.bonus])).toEqual([
      [336, 100, 500, 30, 0],
      [337, 200, 500, -60, 0],
      [338, 300, 500, 0, 0],
      [339, 400, 500, -400, 0],
      [84, 40, 100, 0, 0],
    ])
  })
})

describe('글 줄 (창 +0x354, 0x89134~0x897cc)', () => {
  it('조건이 없으면 글이 없다 — 사기 > 50', () => {
    expect(abilityDetailViewOf(바탕, BATTER_DETAIL_LABEL_FRAMES).messages).toEqual([])
  })

  it('타자 장비 니블 n → StrITEM[(n−1) + 11k] · StrMODE[35+k] · 표 0xd41ae[n−1]', () => {
    const { messages } = abilityDetailViewOf({ ...바탕, equipmentNibbles: [1, 0, 3, 11] }, BATTER_DETAIL_LABEL_FRAMES)
    expect(messages).toEqual([
      '[!cFFFF00나이스 헬멧!cFFFFFF] 히트 +30',
      '[!cFFFF00스킬풀 밴드!cFFFFFF] 수비 +70',
      '[!cFFFF00이카로스슈즈!cFFFFFF] 주루 +250',
    ])
  })

  it('투수 장비는 StrITEM 44 칸부터 · 능력치 이름은 StrMODE[40+k]', () => {
    const { messages } = abilityDetailViewOf(
      { ...바탕, isBatter: false, equipmentNibbles: [1, 2, 1, 1] },
      PITCHER_DETAIL_LABEL_FRAMES,
    )
    expect(messages).toEqual([
      '[!cFFFF00나이스 모자!cFFFFFF] 제구 +30',
      '[!cFFFF00라이트글러브!cFFFFFF] 구속 +50',
      '[!cFFFF00나이스 아대!cFFFFFF] 변화 +30',
      '[!cFFFF00나이스 신발!cFFFFFF] 체력 +30',
    ])
  })

  it('장비 → 무력감(5) → 전설(7) → 질병 → 부상 → 사기 차례다', () => {
    const { messages } = abilityDetailViewOf({
      ...바탕,
      equipmentNibbles: [0, 1, 0, 0],
      isPowerlessEquipped: true,
      isLegendEquipped: true,
      isSick: true,
      isInjured: true,
      morale: 50,
    }, BATTER_DETAIL_LABEL_FRAMES)
    expect(messages).toEqual([
      '[!cFFFF00나이스 배트!cFFFFFF] 파워 +30',
      '[!cFFFF00무력감!cFFFFFF] 모든능력치 -100',
      '[!cFFFF00전설!cFFFFFF] 모든능력치 +50',
      '[!cFFFF00질병!cFFFFFF] 모든능력치 30% 감소',
      '[!cFFFF00부상!cFFFFFF] 모든능력치 60% 감소',
      '[!cFFFF00사기!cFFFFFF] 모든능력치 10% 감소',
    ])
  })

  it('사기 % — 31~50 은 10 · 11~30 은 20 · 10 이하는 50 (0x8973c~0x897a2)', () => {
    const 사기줄 = (morale: number) => abilityDetailViewOf({ ...바탕, morale }, BATTER_DETAIL_LABEL_FRAMES).messages
    expect(사기줄(51)).toEqual([])
    expect(사기줄(31)).toEqual(['[!cFFFF00사기!cFFFFFF] 모든능력치 10% 감소'])
    expect(사기줄(30)).toEqual(['[!cFFFF00사기!cFFFFFF] 모든능력치 20% 감소'])
    expect(사기줄(11)).toEqual(['[!cFFFF00사기!cFFFFFF] 모든능력치 20% 감소'])
    expect(사기줄(10)).toEqual(['[!cFFFF00사기!cFFFFFF] 모든능력치 50% 감소'])
  })
})

describe('커리어에서 세우기', () => {
  it('타자편 — 장비를 끼면 변화 칸에 보너스만큼, 글에 장비 줄', () => {
    const career = { ...createCareer('테스터'), morale: 80, equipmentLevels: { hit: 2, power: 0, defense: 0, run: 0 } }
    const view = batterAbilityDetailViewOf(career)
    expect(view.rows[0]).toMatchObject({ labelFrame: 336, current: career.ability.hit, change: 50 })
    expect(view.messages).toEqual(['[!cFFFF00라이트 헬멧!cFFFFFF] 히트 +50'])
  })

  it('투수편 — 이름표 340~343, 질병이면 변화 칸이 줄어든다', () => {
    const career = { ...createPitcherCareer('테스터'), morale: 80, isSick: true }
    const view = pitcherAbilityDetailViewOf(career)
    expect(view.rows.map((row) => row.labelFrame)).toEqual([340, 341, 342, 343, 84])
    expect(view.rows[0].change).toBe(-Math.trunc((career.ability.control * 30) / 100))
    expect(view.messages).toEqual(['[!cFFFF00질병!cFFFFFF] 모든능력치 30% 감소'])
  })
})

describe('스크롤 0x8a044', () => {
  it('줄 수가 4 이하면 그대로', () => {
    expect(scrollAbilityDetail(0, 4, 'down')).toBe(0)
    expect(scrollAbilityDetail(0, 4, 'up')).toBe(0)
  })

  it('↓ 는 줄 수 − 4 를 넘으면 0 으로, ↑ 는 0 아래면 줄 수 − 4 로 감는다', () => {
    expect(scrollAbilityDetail(0, 6, 'down')).toBe(1)
    expect(scrollAbilityDetail(2, 6, 'down')).toBe(0)
    expect(scrollAbilityDetail(0, 6, 'up')).toBe(2)
    expect(scrollAbilityDetail(2, 6, 'up')).toBe(1)
  })

  it("키 — ↑·'2' 는 위, ↓·'8' 은 아래", () => {
    expect(abilityDetailScrollKeyOf('ArrowUp')).toBe('up')
    expect(abilityDetailScrollKeyOf('2')).toBe('up')
    expect(abilityDetailScrollKeyOf('ArrowDown')).toBe('down')
    expect(abilityDetailScrollKeyOf('8')).toBe('down')
    expect(abilityDetailScrollKeyOf('5')).toBeNull()
  })
})
