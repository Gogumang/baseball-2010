import { describe, expect, it } from 'vitest'
import { createFielders } from '@/entities/fielding/model/fieldingState'
import {
  chooseRelaySlot,
  effectiveThrowSpeedOf,
  INFIELD_READY_TICKS,
  OUTFIELD_READY_TICKS,
  planThrow,
  readyTicksOf,
  RELAY_DISTANCE,
  THROW_COEFFICIENT_INFIELD,
  THROW_COEFFICIENT_OUTFIELD,
  throwTicksTo,
} from '@/entities/fielding/model/throwPlan'

/** 수비 500(등급 3) 아홉 명 — 송구 공 속도 940 + 8×4 = 972 */
const 야수들 = createFielders(Array.from({ length: 9 }, () => 500))

describe('설정값 — d_level.dat (S7 5-2)', () => {
  it('준비 틱 내야 3 · 외야 6, 중계 문턱 17000, 속도 계수 70 / 80', () => {
    expect([INFIELD_READY_TICKS, OUTFIELD_READY_TICKS]).toEqual([3, 6])
    expect(RELAY_DISTANCE).toBe(17_000)
    expect([THROW_COEFFICIENT_INFIELD, THROW_COEFFICIENT_OUTFIELD]).toEqual([70, 80])
    expect([0, 5, 6, 8].map(readyTicksOf)).toEqual([3, 3, 6, 6])
  })

  it('송구 유효 속도 = 공 속도 × 계수 ÷ 100 (내야 680 · 외야 777)', () => {
    expect(야수들[3].throwSpeed).toBe(972)
    expect(effectiveThrowSpeedOf(야수들[3])).toBe(680)
    expect(effectiveThrowSpeedOf(야수들[8])).toBe(777)
  })
})

describe('송구 계획 0xb3444', () => {
  it('내야 송구는 중계 없이 한 구간이다', () => {
    const 계획 = planThrow({ fielders: 야수들, fromSlot: 3, finalSlot: 2, base: 1 })
    expect(계획.relayed).toBe(false)
    expect(계획.firstLegTicks).toBe(계획.totalTicks)
    expect(계획.totalTicks).toBe(6)
  })

  it('외야에서 17000 이상 떨어진 송구는 내야 중계를 끼고 +3틱 이 붙는다', () => {
    const 계획 = planThrow({ fielders: 야수들, fromSlot: 8, finalSlot: 1, base: 0 })
    expect(계획.relayed).toBe(true)
    expect(계획.toSlot).toBe(3) // 중계맨은 내야 2~5 중 두 구간 합이 최소인 칸
    expect(계획.finalSlot).toBe(1)
    expect(계획.totalTicks).toBe(계획.firstLegTicks + 15 + INFIELD_READY_TICKS)
    expect(계획.totalTicks).toBe(33)
  })

  it('특수(레이저) 송구면 거리가 멀어도 중계를 안 끼고, 27틱 > 17 이라 특수 표시가 선다', () => {
    const 계획 = planThrow({ fielders: 야수들, fromSlot: 8, finalSlot: 1, base: 0, special: true })
    expect(계획.relayed).toBe(false)
    expect(계획.special).toBe(true)
    expect(계획.totalTicks).toBe(27)
  })

  it('중계맨은 "외야수→후보 목표점 + 후보→최종 목표점" 이 최소인 내야 칸 2~5 다', () => {
    expect(chooseRelaySlot(야수들, 야수들[8], 야수들[1])).toBe(3)
    expect([2, 3, 4, 5]).toContain(chooseRelaySlot(야수들, 야수들[6], 야수들[1]))
  })

  it('거리 ÷ 유효 속도 근사 — 중견수에서 홈까지 21705 ÷ 777 = 27틱', () => {
    expect(throwTicksTo(야수들[8], { x: 20_000, y: 0, z: 29_705 })).toBe(27)
  })
})
