import { describe, expect, it } from 'vitest'
import {
  applySkillReward, createCareer, equippedPlusSkillCountOf, isSkillEquipped, plusSkillSlotLimitOf,
  rebuildEquippedSkillIds, setSkillEquipped,
} from '@/entities/career/model/playerCareer'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import {
  equipSkill, expandSkillSlots, skillConfirmKindOf, skillSlotExpansionCostOf, unequipSkill,
} from '@/entities/career/model/skillEquip'
import { equippedAbilityOf, trainingInjuryChanceOf } from '@/entities/career/model/condition'
import { illnessChanceOf } from '@/entities/story/model/storyScene'

/**
 * 스킬 장착 칸 = 선수기록 +0x14 (H-modes 6절 "장착 칸", 확정).
 *   켜기 0xb663c 는 장착 동작 0xa4b04 안에서만 · 끄기 0xb66dc 는 해제(0xa4b04)·제거(0xa4430)에서만.
 *   획득 0xa4bd8 = 보유 켜기 + 0xa4b04(P, s, 1) — 자리가 있으면 자동 장착, 마이너스는 늘 장착.
 *   상한 [6, 8, 10] (0xd7e8e / 0xcc4f4), 확장 비용 0xcc4f7[L] × 1000.
 */

const 선수 = (overrides: Partial<PlayerCareer> = {}): PlayerCareer => ({
  ...createCareer('테스트'),
  skillIds: [],
  equippedSkillIds: [],
  ...overrides,
})
const 얻기 = (career: PlayerCareer, ...ids: number[]) => ids.reduce((next, id) => applySkillReward(next, id + 1), career)

describe('획득 0xa4bd8 — 얻는 순간 자동 장착', () => {
  it('신인 스킬 0·8 은 얻은 그 자리에서 장착된다 (0x11230 에서 0xa4bd9 두 번)', () => {
    expect(createCareer('신인').equippedSkillIds).toEqual([0, 8])
    expect(createCareer('신인').skillSlotLevel).toBe(0)
  })

  it('플러스 스킬은 상한 6 까지만 자동 장착된다 — 일곱째는 보유만 한다', () => {
    const career = 얻기(선수(), 0, 1, 6, 7, 8, 9, 10)

    expect(career.skillIds).toEqual([0, 1, 6, 7, 8, 9, 10])
    expect(career.equippedSkillIds).toEqual([0, 1, 6, 7, 8, 9])
    expect(isSkillEquipped(career, 10)).toBe(false)
  })

  it('마이너스 스킬은 상한을 안 보고 늘 장착된다', () => {
    const career = 얻기(선수(), 0, 1, 6, 7, 8, 9, 3, 17)

    expect(career.equippedSkillIds).toEqual([0, 1, 6, 7, 8, 9, 3, 17])
    expect(equippedPlusSkillCountOf(career)).toBe(6)
  })

  it('장착 수는 0~23 의 플러스만 센다 (0xa4aa4) — 24 이상은 세지 않아 상한에 안 걸린다', () => {
    expect(equippedPlusSkillCountOf(선수({ equippedSkillIds: [0, 3, 23, 24, 30] }))).toBe(2)
  })

  it('이미 가진 스킬을 또 얻으면 장착을 다시 시도한다 — 0xa4bd8 에 보유 검사가 없다', () => {
    const 뺀 = unequipSkill(얻기(선수(), 6), 6)
    expect(isSkillEquipped(뺀, 6)).toBe(false)

    const 다시 = 얻기(뺀, 6)
    expect(다시.skillIds).toEqual([6])
    expect(isSkillEquipped(다시, 6)).toBe(true)
  })

  it('제거(보상 4 음수 → 0xa4430)는 보유와 장착을 같이 끈다', () => {
    const career = applySkillReward(얻기(선수(), 6, 3), -(3 + 1))

    expect(career.skillIds).toEqual([6])
    expect(career.equippedSkillIds).toEqual([6])
    expect(career.removedMinusSkillIds).toEqual([3])
  })
})

describe('장착 동작 0xa4b04', () => {
  it('해제는 장착만 끄고 보유는 그대로 둔다 (0xb66dc)', () => {
    const career = setSkillEquipped(얻기(선수(), 6), 6, false)

    expect(career.skillIds).toEqual([6])
    expect(career.equippedSkillIds).toEqual([])
  })

  it('가득 차면 플러스 스킬은 못 낀다 — 아무 일도 없다', () => {
    const full = 선수({ skillIds: [0, 1, 6, 7, 8, 9, 10], equippedSkillIds: [0, 1, 6, 7, 8, 9] })

    expect(equipSkill(full, 10)).toBe(full)
  })

  it('슬롯 단계가 오르면 상한이 8 · 10 이 된다', () => {
    expect([0, 1, 2].map((skillSlotLevel) => plusSkillSlotLimitOf({ skillSlotLevel }))).toEqual([6, 8, 10])
  })
})

describe('확인 키 0x13140 의 갈래', () => {
  const 가득 = (skillSlotLevel: number) => 선수({
    skillIds: [0, 1, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    equippedSkillIds: [0, 1, 6, 7, 8, 9, 10, 11, 12, 13].slice(0, [6, 8, 10][skillSlotLevel]),
    skillSlotLevel,
  })

  it('마이너스 → 해제불가([129]) · 장착 중 → 해제확인([131]) · 자리 있음 → 장착확인([130])', () => {
    const career = 선수({ skillIds: [3, 6, 7], equippedSkillIds: [3, 6] })

    expect(skillConfirmKindOf(career, 3)).toBe('해제불가')
    expect(skillConfirmKindOf(career, 6)).toBe('해제확인')
    expect(skillConfirmKindOf(career, 7)).toBe('장착확인')
  })

  it('가득 찼을 때 L ≤ 1 이면 확장을 묻고, L = 2 면 [132] 최대 알림이다', () => {
    expect(skillConfirmKindOf(가득(0), 14)).toBe('확장확인')
    expect(skillConfirmKindOf(가득(1), 14)).toBe('확장확인')
    expect(skillConfirmKindOf(가득(2), 14)).toBe('최대')
  })
})

describe('슬롯 확장 — 대화 번호 6 (0x1484c)', () => {
  it('비용은 0xcc4f7[L] × 1000 = 5000 · 10000 G', () => {
    expect(skillSlotExpansionCostOf({ skillSlotLevel: 0 })).toBe(5000)
    expect(skillSlotExpansionCostOf({ skillSlotLevel: 1 })).toBe(10000)
  })

  it('G 가 모자라면 StrMODE[65] — 아무것도 안 바뀐다 (같으면 산다)', () => {
    expect(expandSkillSlots(선수({ gamePoint: 4999 }))).toEqual({ kind: 'G포인트부족' })
    expect(expandSkillSlots(선수({ gamePoint: 5000 })).kind).toBe('확장')
  })

  it('G 를 깎고 단계를 하나 올린다 — 알림 [136] 의 %d 는 새 상한', () => {
    const result = expandSkillSlots(선수({ gamePoint: 12000, skillSlotLevel: 1 }))

    expect(result).toMatchObject({ kind: '확장', slots: 10 })
    if (result.kind !== '확장') return
    expect(result.career.gamePoint).toBe(2000)
    expect(result.career.skillSlotLevel).toBe(2)
  })
})

describe('옛 저장 재구성', () => {
  it('보유 목록을 얻은 차례대로 단계 0 에서 다시 자동 장착한다', () => {
    expect(rebuildEquippedSkillIds([0, 8, 3, 1, 6, 7, 9, 21, 17])).toEqual([0, 8, 3, 1, 6, 7, 9, 17])
  })
})

describe('효과는 장착분만 낸다 — 0xb62b4 · 0xa4bf8', () => {
  it('전설(7)을 가졌어도 장착이 아니면 실효 능력치 +50 이 없다 (0xb6414)', () => {
    const ability = { hit: 100, power: 100, run: 100, defense: 100 }

    expect(equippedAbilityOf(선수({ ability, skillIds: [7], equippedSkillIds: [] })).hit).toBe(100)
    expect(equippedAbilityOf(선수({ ability, skillIds: [7], equippedSkillIds: [7] })).hit).toBe(150)
  })

  it('행운(6)의 부상 −20 은 장착일 때만이고, 유리몸(4)은 보유로 본다 (0x1b550·0x1b562)', () => {
    expect(trainingInjuryChanceOf(선수({ morale: 10, skillIds: [6], equippedSkillIds: [] }), false)).toBe(10)
    expect(trainingInjuryChanceOf(선수({ morale: 10, skillIds: [4], equippedSkillIds: [] }), false)).toBe(15)
  })

  it('질병(조건 22)도 유리몸은 보유, 행운은 장착으로 본다 (0xadba8·0xadbba)', () => {
    expect(illnessChanceOf(10, [6], [])).toBe(14)
    expect(illnessChanceOf(10, [6], [6])).toBe(0)
    expect(illnessChanceOf(10, [4], [])).toBe(24)
  })
})
