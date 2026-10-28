import { afterEach, describe, expect, it } from 'vitest'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { createFractionRandom } from '@/shared/api/random/fractionRandom'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
import { EMPTY_BASES } from '@/entities/game/model/baseState'
import { rollCpuSteal } from '@/entities/fielding/model/cpuSteal'

afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

/** 정해진 rand(0,1000) 값을 내고 굴림 수를 센다 */
function 고정난수(value: number): RandomPort & { readonly count: () => number } {
  let rolls = 0
  return {
    ...createFractionRandom(() => {
      rolls += 1
      return value / 1000
    }),
    count: () => rolls,
  }
}

const 일루 = { ...EMPTY_BASES, first: true }
const 뛰나 = (run: number, roll: number) => rollCpuSteal({ bases: 일루, offenseIsCpu: true, runAbilityOf: () => run }, 고정난수(roll))

describe('B-15 CPU 도루 확률', () => {
  it('원본: 주루와 상관없이 칸 1 (1루 주자 표값 10)', () => {
    for (const run of [0, 300, 999]) {
      expect(뛰나(run, 10), String(run)).toBe(1)
      expect(뛰나(run, 11), String(run)).toBeNull()
    }
  })

  it('고침: 칸 = 주루 ÷ 250 — 느리면 5, 빠르면 100', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-15']))
    expect(뛰나(100, 5)).toBe(1)
    expect(뛰나(100, 6)).toBeNull()
    expect(뛰나(300, 10)).toBe(1)
    expect(뛰나(600, 40)).toBe(1)
    expect(뛰나(600, 41)).toBeNull()
    expect(뛰나(999, 100)).toBe(1)
  })

  it('고쳐도 굴림 수는 같다 — 후보가 있을 때 한 번', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-15']))
    const random = 고정난수(500)
    rollCpuSteal({ bases: 일루, offenseIsCpu: true, runAbilityOf: () => 800 }, random)
    expect(random.count()).toBe(1)
  })
})
