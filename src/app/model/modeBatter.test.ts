import { describe, expect, it } from 'vitest'
import { hallOfFameModeBatterOf, modeBatterOf, modeBatterOfHallOfFame } from '@/app/model/modeBatter'
import { EMPTY_COLLECTION, registerHallOfFame } from '@/entities/collection/model/collection'
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

describe('명예 타자 — 0x1fc20 의 +0xa6 ≥ 0 갈래 = 0x1f640 명전 기록', () => {
  const 나리 = {
    ...createCareer('전설'), endingIndex: 4,
    equipmentLevels: { hit: 3, power: 2, run: 0, defense: 0 }, skillIds: [22, 7], equippedSkillIds: [22, 7], specialSwingNumber: 2,
  }
  const 등록 = registerHallOfFame(EMPTY_COLLECTION, 나리, 99_999, 1)
  if (등록.kind !== '등록') throw new Error('등록 실패')
  const collection = 등록.collection

  it('같은 기록이라 나리 타자와 같은 값 — 0xb6414 · 장착 비트 · 필살 번호 +0x18', () => {
    expect(modeBatterOfHallOfFame(collection.hallOfFame[0])).toEqual(modeBatterOf(나리))
  })

  it('고른 선수가 명예 타자일 때만 — 나리 선수(−1)·투수·빈 칸은 null', () => {
    expect(hallOfFameModeBatterOf({ side: '타자', hallOfFameIndex: 1 }, collection)).toEqual(modeBatterOf(나리))
    expect(hallOfFameModeBatterOf({ side: '타자', hallOfFameIndex: null }, collection)).toBeNull()
    expect(hallOfFameModeBatterOf({ side: '투수', hallOfFameIndex: 1 }, collection)).toBeNull()
    expect(hallOfFameModeBatterOf({ side: '타자', hallOfFameIndex: 0 }, collection)).toBeNull()
    expect(hallOfFameModeBatterOf(null, collection)).toBeNull()
  })

  it('옛 저장은 남긴 장비 얹은 능력치(없으면 기본)로 — 스킬 없음, 필살 0', () => {
    const { equipmentLevels: _e, equippedSkillIds: _s, specialSwingNumber: _n, ...옛기록 } = collection.hallOfFame[0]
    expect(modeBatterOfHallOfFame(옛기록)).toEqual({ ability: 옛기록.equippedAbility, skillIds: [], specialSwingNumber: 0 })
    const { equippedAbility: _a, ...더옛기록 } = 옛기록
    expect(modeBatterOfHallOfFame(더옛기록).ability).toEqual(나리.ability)
  })
})
