import { describe, expect, it } from 'vitest'
import { computerPitchTypeOf, pitchListOf, targetKindOf } from '@/entities/pitching/model/pitchIntelligence'
import type { RandomPort } from '@/shared/api/random/randomPort'

const 고정난수 = (value: number): RandomPort => ({
  next: () => value,
  nextInRange: (minimum, maximum) => minimum + value * (maximum - minimum),
  pick: (candidates) => candidates[0],
})

describe('보유 구질 목록 — 0xb6d2c', () => {
  it('비트 t−1 이 켜진 구질 t 를 SLOT[t] 칸에 넣고, 뒤 비트가 덮는다', () => {
    // 구질 1·2·4·9·15 (싸이커 0x410b)
    expect(pitchListOf(0x410b, false)).toEqual([1, 2, 4, 15, 9, 0])
  })

  it('0 번 칸이 비면 직구(1)를 넣고, 마구가 있으면 5 번 칸이 22 다', () => {
    expect(pitchListOf(0b10, true)).toEqual([1, 2, 0, 0, 0, 22])
  })
})

describe('CPU 구질 고르기 — 0x344dc', () => {
  const 목록 = [1, 2, 4, 0, 9, 0]

  it('rand(0,6) 칸을 고르고, 빈 칸이면 직구다', () => {
    expect(computerPitchTypeOf({ list: 목록, magicCount: 0, runnerCount: 0, strikes: 0, balls: 1 }, 고정난수(2 / 6))).toBe(4)
    expect(computerPitchTypeOf({ list: 목록, magicCount: 0, runnerCount: 0, strikes: 0, balls: 1 }, 고정난수(5 / 6))).toBe(1)
  })

  it('마구가 남아 있고 주자 2명 이상·2스트라이크·초구·3볼 0스트라이크면 마구다', () => {
    const 마구목록 = [1, 2, 0, 0, 0, 22]
    expect(computerPitchTypeOf({ list: 마구목록, magicCount: 1, runnerCount: 0, strikes: 0, balls: 0 }, 고정난수(0))).toBe(22)
    expect(computerPitchTypeOf({ list: 마구목록, magicCount: 0, runnerCount: 0, strikes: 0, balls: 1 }, 고정난수(5 / 6))).toBe(1)
  })
})

describe('목표 종류 — 0x9eeac', () => {
  it('(스트라이크, 볼, 아웃, 주자열) 행의 가중치 × 100 을 rand(0,10000) 와 누적 비교한다', () => {
    // normal 0-0-0 주자 없음(열 3): [57, 15, 8, 20, 0]
    const 상황 = { strikes: 0, balls: 0, outs: 0, runnerCount: 0 }
    expect(targetKindOf('normal', 상황, 고정난수(0))).toBe(0)
    expect(targetKindOf('normal', 상황, 고정난수(0.5701))).toBe(1)
    expect(targetKindOf('normal', 상황, 고정난수(0.9999))).toBe(3)
  })

  it('주자가 있으면 2사는 열 2, 아니면 열 1 이다', () => {
    // normal 0-0-0 주자 있음(열 1): [37, 15, 15, 30, 3]
    expect(targetKindOf('normal', { strikes: 0, balls: 0, outs: 0, runnerCount: 1 }, 고정난수(0.9999))).toBe(4)
  })
})
