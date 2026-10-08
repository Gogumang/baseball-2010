import { describe, expect, it } from 'vitest'
import { createSeededRandom } from '@/shared/api/random/seededRandom'

/*
 * 기대값은 원본 산술을 파이썬으로 따로 계산했다:
 *   step(s) = (s * 0x343fd + 0x269ec3) & 0xffffffff
 *   bfa54: s = step(s) >> 1 ; lo == hi → lo ; lo > hi → hi + s % (lo − hi) ; 아니면 lo + s % (hi − lo)
 *   9d468: n ≤ 0 → 0 (s 그대로) ; 아니면 s = step(s) ; ((s << 1) & 0xffffffff) >> 17 % n
 */
describe('createSeededRandom — 원본 0xbfa54 · 0x9d468', () => {
  it('rand(lo, hi) 첫 값들이 원본 산술과 같다 — lo == hi 도 한 번 굴리고, lo > hi 는 hi 에서 센다', () => {
    const random = createSeededRandom(20100901)

    expect([
      random.rand(0, 100),
      random.rand(0, 10000),
      random.rand(5, 5),
      random.rand(10, 3),
      random.rand(-20, 20),
      random.rand(0, 2),
    ]).toEqual([14, 6370, 5, 7, 11, 1])
  })

  it('rand9d(n) 첫 값들이 원본 산술과 같다 — n ≤ 0 은 굴리지 않고 0', () => {
    const random = createSeededRandom(20100901)

    expect([random.rand9d(100), random.rand9d(16), random.rand9d(0), random.rand9d(-3), random.rand9d(7)]).toEqual([
      19, 3, 0, 0, 3,
    ])
  })

  it('두 함수는 씨앗 칸 하나를 함께 굴린다', () => {
    const random = createSeededRandom(1)

    expect([random.rand(0, 100), random.rand9d(10), random.rand(0, 6)]).toEqual([12, 7, 3])
  })

  it('씨앗은 32비트로 넘친다 — 0xffffffff 다음 값', () => {
    const random = createSeededRandom(0xffffffff)

    expect(random.rand(-5, 5)).toBe(4)
  })

  it('같은 시드는 같은 수열을 낸다 — 밸런싱 테스트가 재현 가능해야 한다', () => {
    const first = createSeededRandom(20100901)
    const second = createSeededRandom(20100901)

    expect(Array.from({ length: 20 }, () => first.rand(0, 1000))).toEqual(
      Array.from({ length: 20 }, () => second.rand(0, 1000)),
    )
  })

  it('rand(lo, hi) 는 위끝을 빼고 [lo, hi) 안에 든다', () => {
    const random = createSeededRandom(7)

    for (let index = 0; index < 500; index += 1) {
      const value = random.rand(-3, 4)
      expect(value).toBeGreaterThanOrEqual(-3)
      expect(value).toBeLessThan(4)
    }
  })
})
