import { describe, expect, it } from 'vitest'
import { modePitchMenuOf, modePitcherOf } from '@/app/model/modePitcher'
import { createPitcherCareer, equippedPitcherAbilityOf } from '@/entities/pitcher-career/model/pitcherCareer'
import { rookiePitcherAbilityOf } from '@/entities/pitcher-career/model/pitcherRegistration'
import { PITCH_TYPES } from '@/shared/config/original/pitchTypes'

describe('투수 미션 투수 — 0x213c0 모드 5→3 나리 투수편 저장 · 0xb570c 모드 5 = 0xb6414', () => {
  const 투수 = createPitcherCareer('테스트', {
    role: 0,
    typeIndex: 1,
    handIndex: 1,
    skinIndex: 0,
    breakingPitchSlots: [1, 4],
  })

  it('질병·부상·낮은 사기는 능력치를 깎지 않는다 (감소는 모드 3·4 갈래뿐)', () => {
    const 아픈투수 = { ...투수, isSick: true, isInjured: true, morale: 5 }
    expect(modePitcherOf(아픈투수).stats).toEqual(equippedPitcherAbilityOf(투수))
  })

  it('장비·장착 스킬은 그대로 먹는다 (0xb6414) — 냉정 22 로 999 를 넘은 제구는 0xb5b06 에서 잘린다', () => {
    const 장비 = { ...투수, equipmentLevels: { control: 0, velocity: 3, breaking: 0, stamina: 0 } }
    expect(modePitcherOf(장비).stats.velocity).toBeGreaterThan(투수.ability.velocity)

    const 냉정 = { ...투수, ability: { ...투수.ability, control: 990 }, equippedSkillIds: [22] }
    expect(equippedPitcherAbilityOf(냉정).control).toBeGreaterThan(999)
    expect(modePitcherOf(냉정).stats.control).toBe(999)
  })

  it('폼·구질 마스크·고른 마구 번호를 레코드에서 가져온다', () => {
    const 마구투수 = { ...투수, selectedMagicNumber: 2 }
    const pitcher = modePitcherOf(마구투수)
    // 폼 = 2×타입 + 손 (0xb6e24)
    expect(pitcher.repertoire).toEqual({ pitchMask: 투수.pitchMask, form: 3, magicNumber: 2, isAce: false })
  })

  it('실투 판정 스킬은 장착 비트만 본다 — 32 안정감 · 33 새가슴 · 38 냉정 = 투수 비트 16·17·22', () => {
    const 보유만 = { ...투수, skillIds: [16, 17, 22], equippedSkillIds: [] }
    expect(modePitcherOf(보유만)).toMatchObject({ isSteady: false, isTimid: false, isCool: false })
    const 장착 = { ...투수, skillIds: [16, 17, 22], equippedSkillIds: [16, 17] }
    expect(modePitcherOf(장착)).toMatchObject({ isSteady: true, isTimid: true, isCool: false })
  })

  it('구질 메뉴는 그 투수의 구질 칸(0xb6d2c)이다 — 마구 칸은 빠진다', () => {
    // 신인 등록은 FASTBALL + 고른 기본 변화구 둘 (칸 1 → 3 H.FAST, 칸 4 → 7 CURVE)
    const names = modePitchMenuOf(modePitcherOf({ ...투수, selectedMagicNumber: 1 })).map((type) => type.name)
    expect(names).toContain(PITCH_TYPES[0].name)
    expect(names).toContain(PITCH_TYPES[2].name)
    expect(names).toContain(PITCH_TYPES[6].name)
    expect(names).toHaveLength(3)
  })

  it('투수가 없으면 신인 투수(등록 기본 프로필)·스킬 없음 — 원본에 없는 대체', () => {
    const pitcher = modePitcherOf(null)
    expect(pitcher.stats).toEqual(rookiePitcherAbilityOf(0, 0))
    expect(pitcher).toMatchObject({ isSteady: false, isTimid: false, isCool: false })
    expect(pitcher.repertoire.magicNumber).toBe(0)
  })
})
