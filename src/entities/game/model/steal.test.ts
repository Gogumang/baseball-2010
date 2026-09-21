import { describe, expect, it } from 'vitest'
import {
  attemptSteal,
  canStealFrom,
  quickEngineSteal,
  quickStealBaseOf,
  stealChanceOf,
} from '@/entities/game/model/steal'
import type { BatterAbility } from '@/entities/batting/model/batter'
import type { RandomPort } from '@/shared/api/random/randomPort'

const 주자 = (run: number): BatterAbility => ({ hit: 0, power: 0, defense: 0, run })
const 고정 = (value: number): RandomPort => ({
  next: () => value,
  nextInRange: (minimum, maximum) => minimum + value * (maximum - minimum),
  pick: (candidates) => candidates[0],
})

describe('도루 — 원본 표 0xd9064', () => {
  it('주력 100 마다 줄이 바뀌고 표값이 그대로 확률이다', () => {
    const 표 = [1, 5, 10, 15, 20, 30, 40, 50, 60, 80]

    표.forEach((percent, band) => {
      expect(stealChanceOf(주자(band * 100)).valueOf()).toBe(percent * 100)
    })
  })

  it('주력이 표를 넘어가도 마지막 줄(80%)로 자른다', () => {
    expect(stealChanceOf(주자(999))).toBe(80 * 100)
    expect(stealChanceOf(주자(5000))).toBe(80 * 100)
  })

  it('투수는 도루 판정에 들어오지 않는다 — 원본은 주력만 본다', () => {
    // 인자가 주자 하나뿐이라는 것 자체가 그 증거다
    expect(stealChanceOf.length).toBe(1)
  })

  it('rand(0,10000) 이 확률보다 작으면 성공이다', () => {
    // 주력 500 → 30% → 3000
    expect(attemptSteal(주자(500), 고정(0.2999))).toBe('성공')
    expect(attemptSteal(주자(500), 고정(0.3))).toBe('실패')
  })

  it('3루 주자는 도루를 걸지 않는다', () => {
    expect(canStealFrom(1)).toBe(true)
    expect(canStealFrom(2)).toBe(true)
    expect(canStealFrom(3)).toBe(false)
  })
})

/**
 * CPU 간이 엔진의 도루 (0xc1818, E-defense-rules E-5).
 * ⚠️ **원본 그대로 — 실패가 없다.** 사람 경기의 `attemptSteal` 과 다른 길이다.
 */
describe('간이 엔진 도루 — 성공만 있고 실패가 없다 (0xc1818)', () => {
  const 빈루 = { first: false, second: false, third: false }

  it('가장 앞선 주자가 선 루를 본다 — 주자가 없거나 3루면 안 건다', () => {
    expect(quickStealBaseOf(빈루)).toBe(null)
    expect(quickStealBaseOf({ ...빈루, first: true })).toBe(1)
    expect(quickStealBaseOf({ ...빈루, second: true })).toBe(2)
    expect(quickStealBaseOf({ ...빈루, first: true, second: true })).toBe(2)
    expect(quickStealBaseOf({ ...빈루, third: true })).toBe(null)
    // ⚠️ 1·3루도 앞 주자가 3루라 1루 주자마저 못 뛴다 — 원본이 그렇게 본다
    expect(quickStealBaseOf({ first: true, second: false, third: true })).toBe(null)
  })

  it('굴림에 지면 아무 일도 없다 — 주자가 죽지 않는다', () => {
    const 루 = { ...빈루, first: true }
    // 주력 500 → 30% → 3000
    const 진결과 = quickEngineSteal(루, 주자(500), 고정(0.3))

    expect(진결과.bases).toEqual(루)
    expect(진결과.stolen).toBe(0)
  })

  it('이기면 모든 주자가 한 루씩 간다 — 주자마다 도루 하나다', () => {
    const 결과 = quickEngineSteal({ first: true, second: true, third: false }, 주자(500), 고정(0.2999))

    expect(결과.bases).toEqual({ first: false, second: true, third: true })
    expect(결과.stolen).toBe(2)
  })

  it('3루 주자가 있으면 난수를 뽑지도 않는다', () => {
    let 뽑은횟수 = 0
    const 세는난수: RandomPort = {
      next: () => {
        뽑은횟수 += 1
        return 0
      },
      nextInRange: (minimum) => {
        뽑은횟수 += 1
        return minimum
      },
      pick: (candidates) => candidates[0],
    }
    quickEngineSteal({ first: true, second: false, third: true }, 주자(900), 세는난수)

    expect(뽑은횟수).toBe(0)
  })
})
