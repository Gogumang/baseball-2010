import { describe, expect, it } from 'vitest'
import {
  battingAverageValueOf,
  batterHandOf,
  earnedRunAverageValueOf,
  staminaGaugeOf,
} from '@/widgets/matchup-cards/lib/matchupRecord'
import { staminaCapacityOf } from '@/entities/pitcher-career/model/pitcherStamina'

describe('소개 판 값의 셈', () => {
  it('방어율 0xb6ce8 — 실점 × 2700 / 아웃 (9999 상한), 아웃 0 이면 실점 있으면 9999', () => {
    expect(earnedRunAverageValueOf({ outs: 81, runsAllowed: 10 })).toBe(333)
    expect(earnedRunAverageValueOf({ outs: 1, runsAllowed: 9 })).toBe(9999)
    expect(earnedRunAverageValueOf({ outs: 0, runsAllowed: 1 })).toBe(9999)
    expect(earnedRunAverageValueOf({ outs: 0, runsAllowed: 0 })).toBe(0)
  })

  it('타율 0xb8e3c — 안타 × 1000 / 타수 (1000 상한), 타수 0 이면 0', () => {
    expect(battingAverageValueOf({ atBats: 1000, hits: 373 })).toBe(373)
    expect(battingAverageValueOf({ atBats: 0, hits: 0 })).toBe(0)
  })

  it('타자 손 0xb63c0 — 폼 니블(+0xb >> 4)의 낮은 비트, 마타자는 표 0xd88b0 [1,0,0,0,1]', () => {
    expect(batterHandOf(0x10)).toBe(1)
    expect(batterHandOf(0x20)).toBe(0)
    expect([0, 1, 2, 3, 4].map((ace) => batterHandOf(0x10, ace))).toEqual([1, 0, 0, 0, 1])
  })

  it('체력 막대 — 길이 0x66e44 · 최대 첫 투수 1449 / 아니면 1249 · % 0xaebb0', () => {
    expect(staminaGaugeOf({ staminaAbility: 500, teamMorale: 80, isFirstPitcher: false, stamina: 4321 })).toEqual({
      lengthValue: staminaCapacityOf(500, 80, false),
      maxValue: 1249,
      percent: 43,
    })
  })
})
