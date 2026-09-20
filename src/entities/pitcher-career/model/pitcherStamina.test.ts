import { describe, expect, it } from 'vitest'
import {
  FULL_STAMINA,
  abilityAfterFatigue,
  applyStaminaTonic,
  basePitchStaminaCostOf,
  canBuyStaminaTonic,
  consumeStamina,
  pitchStaminaCostOf,
  recoverStaminaAfterGameDay,
  staminaCapacityOf,
  staminaGaugeStepOf,
  staminaPercentOf,
  staminaRecoveryPercentOf,
} from '@/entities/pitcher-career/model/pitcherStamina'

const plainPitch = {
  batterIntimidates: false,
  pitcherIsCoward: false,
  pitcherEndures: false,
} as const

describe('구질별 기본 소모 (표 0xd2624)', () => {
  it('직구 9 · 기본 변화구 11 · 상위 변화구 12 · 히든 13 · 마구 9', () => {
    expect(basePitchStaminaCostOf(1)).toBe(9)
    expect([2, 5, 9].map(basePitchStaminaCostOf)).toEqual([11, 11, 11])
    expect([10, 14, 17].map(basePitchStaminaCostOf)).toEqual([12, 12, 12])
    expect([18, 20, 21].map(basePitchStaminaCostOf)).toEqual([13, 13, 13])
    expect(basePitchStaminaCostOf(22)).toBe(9)
    expect(basePitchStaminaCostOf(0)).toBe(9)
  })
})

describe('스킬 보정은 ×2 다음 −1 순서다 (0xa5f0e~0xa5f60)', () => {
  it('비겁자와 끈기를 함께 가지면 2c−1 이다', () => {
    expect(pitchStaminaCostOf({ ...plainPitch, pitchTypeNumber: 1, pitcherIsCoward: true, pitcherEndures: true })).toBe(
      17,
    )
  })

  it('타자 스킬 22 도 두 배로 만든다', () => {
    expect(pitchStaminaCostOf({ ...plainPitch, pitchTypeNumber: 2, batterIntimidates: true })).toBe(22)
  })

  it('끈기만 있으면 1 줄어든다', () => {
    expect(pitchStaminaCostOf({ ...plainPitch, pitchTypeNumber: 1, pitcherEndures: true })).toBe(8)
  })
})

describe('용량 X (0x66e44)', () => {
  it('P1 3-2 의 예 — 체력 400 · 사기 80 · 선발 첫 투수 → 850', () => {
    expect(staminaCapacityOf(400, 80, true)).toBe(850)
  })

  it('구원은 +200 이 없다', () => {
    expect(staminaCapacityOf(400, 80, false)).toBe(650)
  })

  it('사기 구간마다 실효 체력이 달라진다', () => {
    expect(staminaCapacityOf(400, 95, true)).toBe(400 + 20 + 450)
    expect(staminaCapacityOf(400, 60, true)).toBe(400 - 40 + 450)
    expect(staminaCapacityOf(400, 40, true)).toBe(400 - 80 + 450)
    expect(staminaCapacityOf(400, 20, true)).toBe(400 - 120 + 450)
    expect(staminaCapacityOf(400, 5, true)).toBe(400 - 200 + 450)
  })
})

describe('소모 적용 (0xaeb08)', () => {
  it('직구 한 개는 용량 850 에서 약 1.06% 를 깎는다', () => {
    expect(consumeStamina(FULL_STAMINA, 9, 850)).toBe(9894)
  })

  it('변화구 11 은 더 많이 깎는다', () => {
    expect(consumeStamina(FULL_STAMINA, 11, 850)).toBeLessThan(consumeStamina(FULL_STAMINA, 9, 850))
  })

  it('100% 에서 직구만 던지면 80~95구 사이에 바닥난다', () => {
    let stamina = FULL_STAMINA
    let pitches = 0
    while (stamina > 0 && pitches < 500) {
      stamina = consumeStamina(stamina, 9, 850)
      pitches += 1
    }
    expect(pitches).toBeGreaterThanOrEqual(80)
    expect(pitches).toBeLessThanOrEqual(95)
  })

  it('⚠️ 원본 버그 그대로 — 0 인 투수가 하나 더 던지면 1% 로 되살아난다', () => {
    expect(consumeStamina(0, 9, 850)).toBe(100)
  })

  it('용량이 0 이하면(투수가 없을 때) 값을 그대로 둔다', () => {
    expect(consumeStamina(5000, 9, 0)).toBe(5000)
  })
})

describe('경기 사이 회복 (0xb60e0 · 0x66ed0)', () => {
  it('투수편의 내 선발 40% · 내 구원 80% · 나머지 20%', () => {
    expect(staminaRecoveryPercentOf({ mode: 3, isMine: true, isStarterRole: true })).toBe(40)
    expect(staminaRecoveryPercentOf({ mode: 3, isMine: true, isStarterRole: false })).toBe(80)
    expect(staminaRecoveryPercentOf({ mode: 3, isMine: false, isStarterRole: true })).toBe(20)
    expect(staminaRecoveryPercentOf({ mode: 2, isMine: true, isStarterRole: false })).toBe(20)
  })

  it('회복은 100 을 곱해 더하고 10000 에서 자른다', () => {
    expect(recoverStaminaAfterGameDay(3000, { mode: 3, isMine: true, isStarterRole: true })).toBe(7000)
    expect(recoverStaminaAfterGameDay(9000, { mode: 3, isMine: true, isStarterRole: false })).toBe(FULL_STAMINA)
  })
})

describe('체력%가 능력치를 깎는다 (0xb58e6)', () => {
  it('55% 이상은 그대로, 아래로는 −10 / −30 / −50 / −90%', () => {
    expect(abilityAfterFatigue(500, 100)).toBe(500)
    expect(abilityAfterFatigue(500, 55)).toBe(500)
    expect(abilityAfterFatigue(500, 40)).toBe(450)
    expect(abilityAfterFatigue(500, 25)).toBe(350)
    expect(abilityAfterFatigue(500, 10)).toBe(250)
    expect(abilityAfterFatigue(500, 0)).toBe(50)
  })
})

describe('체력 % 와 표시 단계', () => {
  it('체력%는 100 으로 나눈 몫이다', () => {
    expect(staminaPercentOf(FULL_STAMINA)).toBe(100)
    expect(staminaPercentOf(1999)).toBe(19)
  })

  it('표시 단계는 0~3 에서 멈춘다', () => {
    expect([0, 25, 50, 75, 100].map(staminaGaugeStepOf)).toEqual([0, 1, 2, 3, 3])
  })
})

describe('십전대보탕', () => {
  it('최대면 살 수 없다', () => {
    expect(canBuyStaminaTonic(FULL_STAMINA)).toBe(false)
    expect(canBuyStaminaTonic(9999)).toBe(true)
  })

  it('쓰면 무조건 최대가 된다', () => {
    expect(applyStaminaTonic()).toBe(FULL_STAMINA)
  })
})
