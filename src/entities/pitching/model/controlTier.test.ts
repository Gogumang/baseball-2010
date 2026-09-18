import { describe, expect, it } from 'vitest'
import { controlTierOf } from '@/entities/pitching/model/controlTier'
import type { RandomPort } from '@/shared/api/random/randomPort'

const 고정 = (value: number): RandomPort => ({ next: () => value, nextInRange: () => 0, pick: (items) => items[0] })

describe('controlTierOf — 0xb74bc', () => {
  it('제구 300 은 [4,12,60,95,100] 행이다', () => {
    expect([0.03, 0.05, 0.2, 0.7, 0.96].map((value) => controlTierOf(300, true, 고정(value)))).toEqual([1, 2, 3, 4, 5])
  })

  it('지친 투수는 한 칸 아래(최소 0)', () => {
    expect(controlTierOf(300, false, 고정(0.03))).toBe(0)
    expect(controlTierOf(300, false, 고정(0.7))).toBe(2)
  })

  it('제구 999 는 마지막 행', () => {
    expect(controlTierOf(999, true, 고정(0.04))).toBe(2)
  })
})
