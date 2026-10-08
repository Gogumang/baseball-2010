import { describe, expect, it } from 'vitest'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { createFractionRandom } from '@/shared/api/random/fractionRandom'
import { rollBenchClearingEntry, rollBenchClearingTargets } from '@/features/play-game/model/benchClearingScene'

const 세는난수 = () => {
  const calls: number[] = []
  const random: RandomPort = createFractionRandom(() => {
    calls.push(1)
    return 0.5
  })
  return { calls, random }
}

describe('벤치 클리어링 연출의 전역 rand', () => {
  it('진입 0x3a5f0 — 공격 9명 × 다섯 = 45 번', () => {
    const { calls, random } = 세는난수()
    rollBenchClearingEntry(random)
    expect(calls.length).toBe(45)
  })

  it('틱 10 (0x401d4) — 수비 8명 목표 8 번', () => {
    const { calls, random } = 세는난수()
    rollBenchClearingTargets(random)
    expect(calls.length).toBe(8)
  })
})
