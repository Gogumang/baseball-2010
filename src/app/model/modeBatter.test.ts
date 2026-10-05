import { describe, expect, it } from 'vitest'
import { modeBatterOf } from '@/app/model/modeBatter'
import { createCareer } from '@/entities/career/model/playerCareer'
import { effectiveAbilityOf, equippedAbilityOf } from '@/entities/career/model/condition'
import { ROOKIE_BATTER_ABILITY } from '@/entities/batting/model/batter'

describe('미션·홈런더비 타자 — 0xb570c 모드 5·6·7 = 0xb6414', () => {
  const 선수 = createCareer('테스트')

  it('질병·부상·낮은 사기는 능력치를 깎지 않는다 (감소는 모드 3·4 갈래 0xb574a 뿐)', () => {
    const 아픈선수 = { ...선수, isSick: true, isInjured: true, injuryRemaining: 3, morale: 5 }

    expect(modeBatterOf(아픈선수).ability).toEqual(equippedAbilityOf(아픈선수))
    expect(modeBatterOf(아픈선수).ability).toEqual(선수.ability)
    // 나만의리그 경기(모드 4)라면 질병 −30% → 부상 −60% → 사기 −50% 가 차례로 먹는다
    expect(effectiveAbilityOf(아픈선수).hit).toBeLessThan(modeBatterOf(아픈선수).ability.hit)
  })

  it('장비·스킬 보정은 그대로 먹는다 (0xb6414)', () => {
    const 장비선수 = { ...선수, equipmentLevels: { hit: 3, power: 0, run: 0, defense: 0 } }
    expect(modeBatterOf(장비선수).ability.hit).toBeGreaterThan(선수.ability.hit)
  })

  it('스킬은 장착한 것만 (0xb62b4 장착 비트)', () => {
    const 스킬선수 = { ...선수, skillIds: [22, 7], equippedSkillIds: [22] }
    expect(modeBatterOf(스킬선수).skillIds).toEqual([22])
  })

  it('고른 필살타법 번호(+0x18)를 그대로 싣는다 — 미션 타석의 "0" 키가 쓴다', () => {
    expect(modeBatterOf({ ...선수, specialSwingNumber: 3 }).specialSwingNumber).toBe(3)
  })

  it('선수가 없으면 신인 능력치·스킬 없음', () => {
    expect(modeBatterOf(null)).toEqual({ ability: ROOKIE_BATTER_ABILITY, skillIds: [], specialSwingNumber: 0 })
  })
})
