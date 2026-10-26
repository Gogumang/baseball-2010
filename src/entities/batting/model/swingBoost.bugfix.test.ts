import { afterEach, describe, expect, it } from 'vitest'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
import { NO_SWING_BOOST, swingBoostOf, type SwingBoostSide } from '@/entities/batting/model/swingBoost'

afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

const 보통타자: SwingBoostSide = { number: 0, isAce: false, isOwnPlayer: false }
const 육성투수마구1: SwingBoostSide = { number: 1, isAce: false, isOwnPlayer: true }
const 필살타자1: SwingBoostSide = { number: 1, isAce: false, isOwnPlayer: true }

describe('B-02 마구 % 부호', () => {
  it('원본: 마구 % 가 타자 B·C 를 올린다 (+10 · +7)', () => {
    expect(swingBoostOf(보통타자, 육성투수마구1)).toMatchObject({ solidPercent: 10, homeRunPercent: 7 })
  })

  it('고침: 마구 % 는 B·C 를 깎는다 (−10 · −7) — 구속·제구 보정은 그대로', () => {
    const original = swingBoostOf(보통타자, 육성투수마구1)
    setBugfixConfigForTests(bugfixConfigWith(['B-02']))
    const fixed = swingBoostOf(보통타자, 육성투수마구1)
    expect(fixed).toMatchObject({ solidPercent: -10, homeRunPercent: -7 })
    expect(fixed.pitcherVelocity).toBe(original.pitcherVelocity)
    expect(fixed.pitcherControl).toBe(original.pitcherControl)
  })

  it('고침: 필살타법 % 는 그대로 타자를 돕고, 마구가 없으면 보정도 없다', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-02']))
    const burst = swingBoostOf(필살타자1, { number: 0, isAce: false, isOwnPlayer: true })
    expect(burst.solidPercent).toBeGreaterThan(0)
    expect(swingBoostOf(보통타자, { number: 0, isAce: false, isOwnPlayer: false })).toEqual(NO_SWING_BOOST)
  })
})
