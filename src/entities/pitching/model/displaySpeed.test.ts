import { describe, expect, it } from 'vitest'
import { displaySpeedKmhOf, rollDisplaySpeedKmh } from '@/entities/pitching/model/displaySpeed'
import { pitchSpeedRankOf } from '@/entities/pitching/model/pitchSpeedStage'
import { magicPitchDisplaySpeedOf } from '@/entities/pitcher-career/model/magicPitch'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import type { RandomPort } from '@/shared/api/random/randomPort'

/** rand(lo, hi) 로 받은 인자만 적고 lo 를 돌려준다 */
function 기록난수() {
  const calls: [number, number][] = []
  const random: RandomPort = {
    rand: (lo, hi) => {
      calls.push([lo, hi])
      return lo
    },
    rand9d: () => 0,
  }
  return { random, calls }
}

describe('표시 구속 0x66dc0(구질, rank) — 표 0xd2568 + 134~139', () => {
  it('FASTBALL rank 0 은 rand(134, 140), rank 7 은 홀짝으로 3 · 2 를 더해 rand(152, 158)', () => {
    const 처음 = 기록난수()
    displaySpeedKmhOf(1, 0, 처음.random)
    expect(처음.calls).toEqual([[134, 140]])
    const 끝 = 기록난수()
    displaySpeedKmhOf(1, 7, 끝.random)
    // lo = 134 + 3+2+3+2+3+2+3 = 152 ; 마지막 i = 7 홀수 → hi = lo + 5
    expect(끝.calls).toEqual([[152, 158]])
  })

  it('짝수 rank 는 상한이 lo + 4 다 — TWO-SEAM(보정 −5) rank 2 = rand(134, 139)', () => {
    const 기록 = 기록난수()
    displaySpeedKmhOf(2, 2, 기록.random)
    // lo = 129 + 3 + 2 = 134 ; i = 2 짝수 → hi = lo + 4 = 138
    expect(기록.calls).toEqual([[134, 139]])
  })

  it('KNUCKLE(21, 보정 −28)은 6 에서 rank 까지 거꾸로 센다 — rank 7 은 고리 없이 rand(106, 111), rank 0 은 rand(123, 129)', () => {
    const 높음 = 기록난수()
    displaySpeedKmhOf(21, 7, 높음.random)
    expect(높음.calls).toEqual([[106, 111]])
    const 낮음 = 기록난수()
    displaySpeedKmhOf(21, 0, 낮음.random)
    // i = 6..0: lo += 2,3,2,3,2,3,2 = 17 → 123 ; 마지막 i = 0 짝수 → hi = lo + 5 = 128
    expect(낮음.calls).toEqual([[123, 129]])
  })

  it('구질 번호가 1~21 밖이면 0 이고 굴리지 않는다 (66dc8)', () => {
    const 기록 = 기록난수()
    expect(displaySpeedKmhOf(0, 3, 기록.random)).toBe(0)
    expect(displaySpeedKmhOf(23, 3, 기록.random)).toBe(0)
    expect(기록.calls).toEqual([])
  })
})

describe('0x34968 의 표시 구속 굴림 — 공마다 rand 한 번', () => {
  const stats = { control: 600, velocity: 800, breaking: 400 }

  it('일반 구질은 피로 능력치 · 등급 배율로 낸 rank 를 0x66dc0 에 넘긴다', () => {
    const rank = pitchSpeedRankOf(0, stats, 4)
    const actual = createSeededRandom(77)
    const expected = createSeededRandom(77)
    const speed = rollDisplaySpeedKmh({ typeNumber: 1, stats, controlTier: 4, magicNumber: 0, form: 0 }, actual)
    expect(speed).toBe(displaySpeedKmhOf(1, rank, expected))
    expect(actual.rand(0, 0x7fffffff)).toBe(expected.rand(0, 0x7fffffff))
  })

  it('마구(22)는 표 0xcfda8 — 육성 마구 4 · 폼 2(폼/2 = 1)는 캐넌 칸 9 (157~162)', () => {
    const actual = createSeededRandom(5)
    const expected = createSeededRandom(5)
    const speed = rollDisplaySpeedKmh({ typeNumber: 22, stats, controlTier: 5, magicNumber: 4, form: 2 }, actual)
    expect(speed).toBe(magicPitchDisplaySpeedOf(4, 2, expected))
    expect(speed).toBeGreaterThanOrEqual(157)
    expect(speed).toBeLessThanOrEqual(162)
  })
})
