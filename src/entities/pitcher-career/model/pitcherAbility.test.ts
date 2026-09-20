import { describe, expect, it } from 'vitest'
import { PITCHER_ROLE, pitcherPositionCodeOf, pitcherRoleOf, isStarterTypePosition } from '@/entities/pitcher-career/model/pitcherRole'
import {
  ALL_ABILITY_ITEM_ID,
  HIDDEN_PITCH_EVENTS,
  PITCHER_ABILITY_NAMES,
  PITCHER_ABILITY_ORDER,
  applyPitcherAbilityItem,
  pitcherAbilityLimitOf,
} from '@/entities/pitcher-career/model/pitcherAbility'
import type { PitcherAbility } from '@/entities/pitcher-career/model/pitcherAbility'

const ability: PitcherAbility = { control: 500, velocity: 500, breaking: 500, stamina: 500 }

describe('능력치 칸 순서 (StrMODE[40~43])', () => {
  it('0 제구 · 1 구속 · 2 변화 · 3 체력', () => {
    expect(PITCHER_ABILITY_ORDER).toEqual(['control', 'velocity', 'breaking', 'stamina'])
    expect(PITCHER_ABILITY_NAMES).toEqual(['제구', '구속', '변화', '체력'])
  })
})

describe('보직 · 포지션 코드', () => {
  it('보직은 +0xb 의 아래 두 비트다', () => {
    expect(pitcherRoleOf(0b1000)).toBe(PITCHER_ROLE.starter)
    expect(pitcherRoleOf(0b1010)).toBe(PITCHER_ROLE.relief)
  })

  it('포지션 코드는 +0xa 의 아래 다섯 비트이고 ≤3 이 선발형이다', () => {
    expect(pitcherPositionCodeOf(0xa3)).toBe(3)
    expect(isStarterTypePosition(3)).toBe(true)
    expect(isStarterTypePosition(4)).toBe(false)
  })
})

describe('보직별 능력 한계 (표 0xd80be — 타입이 아니라 보직으로 고른다)', () => {
  it('선발은 네 칸 모두 800 이다', () => {
    expect(pitcherAbilityLimitOf(PITCHER_ROLE.starter)).toEqual({
      control: 800,
      velocity: 800,
      breaking: 800,
      stamina: 800,
    })
  })

  it('구원은 850·850·850 에 체력만 600 이다', () => {
    expect(pitcherAbilityLimitOf(PITCHER_ROLE.relief)).toEqual({
      control: 850,
      velocity: 850,
      breaking: 850,
      stamina: 600,
    })
  })

  it('보직 1 도 구원 쪽 한계를 쓴다 (0xa44f4 는 0 인지만 본다)', () => {
    expect(pitcherAbilityLimitOf(PITCHER_ROLE.unknown)).toEqual(pitcherAbilityLimitOf(PITCHER_ROLE.relief))
  })
})

describe('GP 능력 아이템 (0xa4528)', () => {
  it('아이템 0~3 은 제구·구속·변화·체력을 10 씩 올린다', () => {
    expect(applyPitcherAbilityItem(ability, 0, PITCHER_ROLE.starter).control).toBe(510)
    expect(applyPitcherAbilityItem(ability, 1, PITCHER_ROLE.starter).velocity).toBe(510)
    expect(applyPitcherAbilityItem(ability, 2, PITCHER_ROLE.starter).breaking).toBe(510)
    expect(applyPitcherAbilityItem(ability, 3, PITCHER_ROLE.starter).stamina).toBe(510)
  })

  it('한 칸만 올리고 나머지는 그대로다', () => {
    expect(applyPitcherAbilityItem(ability, 0, PITCHER_ROLE.starter)).toEqual({
      control: 510,
      velocity: 500,
      breaking: 500,
      stamina: 500,
    })
  })

  it('엄마의도시락은 네 칸을 모두 올린다', () => {
    expect(applyPitcherAbilityItem(ability, ALL_ABILITY_ITEM_ID, PITCHER_ROLE.starter)).toEqual({
      control: 510,
      velocity: 510,
      breaking: 510,
      stamina: 510,
    })
  })

  it('한계를 넘으면 한계로 내린다 — 선발 800', () => {
    const nearLimit: PitcherAbility = { control: 795, velocity: 795, breaking: 795, stamina: 795 }
    expect(applyPitcherAbilityItem(nearLimit, 0, PITCHER_ROLE.starter).control).toBe(800)
  })

  it('구원 체력은 600 에서 멈춘다', () => {
    const nearLimit: PitcherAbility = { control: 500, velocity: 500, breaking: 500, stamina: 595 }
    expect(applyPitcherAbilityItem(nearLimit, 3, PITCHER_ROLE.relief).stamina).toBe(600)
  })

  it('능력 칸이 아닌 아이템 번호는 아무것도 바꾸지 않는다', () => {
    expect(applyPitcherAbilityItem(ability, 9, PITCHER_ROLE.starter)).toEqual(ability)
  })
})

describe('히든 변화구 오픈 조건 (이벤트 30~33)', () => {
  it('네 이벤트가 네 행을 하나씩 연다', () => {
    expect(HIDDEN_PITCH_EVENTS).toHaveLength(4)
    expect([...HIDDEN_PITCH_EVENTS].map((event) => event.row).sort()).toEqual([0, 1, 2, 3])
  })

  it('조건은 제구·구속·변화 세 칸뿐이다 (체력 조건은 없다)', () => {
    for (const event of HIDDEN_PITCH_EVENTS) {
      expect(Object.keys(event)).not.toContain('stamina')
    }
  })
})
