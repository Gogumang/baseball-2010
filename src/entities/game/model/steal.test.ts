import { describe, expect, it } from 'vitest'
import { attemptSteal, stealChanceOf } from '@/entities/game/model/steal'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import type { BatterAbility } from '@/entities/batting/model/batter'

function 주자(run: number): BatterAbility {
  return { hit: 50, power: 50, run, defense: 50 }
}
const 보통투수 = { control: 60, velocity: 60 }

describe('stealChanceOf', () => {
  it('주루가 높을수록 성공률이 높다', () => {
    expect(stealChanceOf(주자(95), 보통투수)).toBeGreaterThan(stealChanceOf(주자(20), 보통투수))
  })

  it('투수 구속이 빠를수록 성공률이 낮다', () => {
    const 빠른투수 = { control: 60, velocity: 100 }
    const 느린투수 = { control: 60, velocity: 10 }

    expect(stealChanceOf(주자(60), 빠른투수)).toBeLessThan(stealChanceOf(주자(60), 느린투수))
  })

  it('확률은 0과 1 사이에 머문다', () => {
    expect(stealChanceOf(주자(0), { control: 0, velocity: 100 })).toBeGreaterThan(0)
    expect(stealChanceOf(주자(100), { control: 0, velocity: 0 })).toBeLessThan(1)
  })
})

describe('attemptSteal', () => {
  it('발 빠른 주자가 느린 주자보다 많이 성공한다', () => {
    function 성공수(run: number): number {
      const random = createSeededRandom(20100901)
      let count = 0
      for (let i = 0; i < 500; i += 1) {
        if (attemptSteal(주자(run), 보통투수, random) === '성공') count += 1
      }
      return count
    }

    expect(성공수(95)).toBeGreaterThan(성공수(15))
  })

  it('같은 시드는 같은 결과를 낸다', () => {
    expect(attemptSteal(주자(60), 보통투수, createSeededRandom(7))).toBe(
      attemptSteal(주자(60), 보통투수, createSeededRandom(7)),
    )
  })

  it('성공과 실패가 모두 나온다', () => {
    const random = createSeededRandom(20100901)
    const results = Array.from({ length: 300 }, () => attemptSteal(주자(60), 보통투수, random))

    expect(results).toContain('성공')
    expect(results).toContain('실패')
  })
})
