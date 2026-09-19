import { describe, expect, it } from 'vitest'
import { attemptSteal, canStealFrom, stealChanceOf } from '@/entities/game/model/steal'
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
