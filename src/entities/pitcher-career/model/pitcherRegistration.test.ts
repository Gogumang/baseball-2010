import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PITCHER_ROOKIE_PROFILE,
  PITCHER_TYPE_COUNT,
  ROOKIE_BREAKING_PITCH_TYPES,
  canRegisterPitcher,
  pitcherFormOf,
  pitcherRecordByte0x0bOf,
  pitcherRoleChoiceOf,
  pitcherRoleOfChoice,
  rookiePitchMaskOf,
  rookiePitcherAbilityOf,
  toggleBreakingPitchSlot,
} from '@/entities/pitcher-career/model/pitcherRegistration'
import { PITCHER_ROLE, pitcherRoleOf } from '@/entities/pitcher-career/model/pitcherRole'

describe('투수 등록 — 고르는 줄 (C-4)', () => {
  it('타입은 세 가지다 — 타자 둘과 다르다', () => {
    expect(PITCHER_TYPE_COUNT).toBe(3)
  })

  it('보직은 목록 값 1 을 고르면 레코드에 2 가 저장된다 (0x1707c)', () => {
    expect(pitcherRoleOfChoice(0)).toBe(PITCHER_ROLE.starter)
    expect(pitcherRoleOfChoice(1)).toBe(PITCHER_ROLE.relief)
    expect(pitcherRoleChoiceOf(PITCHER_ROLE.relief)).toBe(1)
  })

  it('레코드 +0xb 를 비트로 조립한다 — bit0~1 보직 · bit2~3 피부 · bit4 손 · bit5~7 타입', () => {
    const byte = pitcherRecordByte0x0bOf({
      ...DEFAULT_PITCHER_ROOKIE_PROFILE,
      role: PITCHER_ROLE.relief,
      skinIndex: 2,
      handIndex: 1,
      typeIndex: 1,
    })

    expect(pitcherRoleOf(byte)).toBe(PITCHER_ROLE.relief)
    expect((byte >> 2) & 3).toBe(2)
    expect((byte >> 4) & 1).toBe(1)
    expect((byte >> 5) & 7).toBe(1)
  })

  it('폼은 윗니블 = 2 × 타입 + 손 이다 (0x16f9a) — 육성 투수 폼 0~5 와 맞는다', () => {
    expect(pitcherFormOf(0, 0)).toBe(0)
    expect(pitcherFormOf(1, 1)).toBe(3)
    expect(pitcherFormOf(2, 1)).toBe(5)
  })
})

describe('투수 시작 능력치 — 표 0xcc3f2 × 10 (0x16e2c, C-4)', () => {
  it('선발은 [10,10,10,20] × 10 이고 타입 0 은 구속에 +30 이다', () => {
    expect(rookiePitcherAbilityOf(PITCHER_ROLE.starter, 0)).toEqual({
      control: 100,
      velocity: 130,
      breaking: 100,
      stamina: 200,
    })
  })

  it('구원은 [12,12,12,10] × 10 이다 — 체력이 선발의 절반이다', () => {
    expect(rookiePitcherAbilityOf(PITCHER_ROLE.relief, 0)).toEqual({
      control: 120,
      velocity: 150,
      breaking: 120,
      stamina: 100,
    })
  })

  it('타입 1 은 제구에, 그 밖은 변화에 +30 을 얹는다', () => {
    expect(rookiePitcherAbilityOf(PITCHER_ROLE.starter, 1).control).toBe(130)
    expect(rookiePitcherAbilityOf(PITCHER_ROLE.starter, 2).breaking).toBe(130)
  })
})

describe('기본 변화구 고르기 — 표 0xcc520 (J 3-1)', () => {
  it('고를 수 있는 8종은 [2,3,5,4,7,6,8,9] 순서다', () => {
    expect(ROOKIE_BREAKING_PITCH_TYPES).toEqual([2, 3, 5, 4, 7, 6, 8, 9])
  })

  it('FASTBALL(1) 은 무조건 들어가고 고른 칸이 비트마스크에 더해진다', () => {
    // 칸 0 = 구질 2 · 칸 4 = 구질 7
    const mask = rookiePitchMaskOf([0, 4])

    expect(mask & 1).toBe(1)
    expect((mask >>> 1) & 1).toBe(1)
    expect((mask >>> 6) & 1).toBe(1)
  })

  it('두 개를 고르기 전에는 등록할 수 없다 (StrMODE[13])', () => {
    expect(canRegisterPitcher({ ...DEFAULT_PITCHER_ROOKIE_PROFILE, breakingPitchSlots: [0] })).toBe(false)
    expect(canRegisterPitcher({ ...DEFAULT_PITCHER_ROOKIE_PROFILE, breakingPitchSlots: [0, 3] })).toBe(true)
  })

  it('세 번째를 고르면 가장 먼저 고른 칸이 빠진다', () => {
    expect(toggleBreakingPitchSlot([0, 1], 5)).toEqual([1, 5])
    expect(toggleBreakingPitchSlot([0, 1], 1)).toEqual([0])
  })
})
