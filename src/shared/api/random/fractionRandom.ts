import type { RandomPort } from '@/shared/api/random/randomPort'

/**
 * **시험용** — [0, 1) 비율을 하나씩 내는 함수로 원본 난수 포트를 흉내 낸다. 굴림 하나에 비율 하나다.
 * - `rand(lo, hi)`: 늘 비율 하나를 쓰고(원본도 lo == hi 여도 굴린다) `min(lo, hi) + floor(v · |hi − lo|)`.
 * - `rand9d(n)`: n ≤ 0 이면 비율을 쓰지 않고 0(원본도 굴리지 않는다), 아니면 `floor(v · n)`.
 *
 * 시험이 "높은 값 · 낮은 값"을 골라 사건을 세우는 데 쓴다 — 원본 수열을 내지는 않는다(그건 `createSeededRandom`).
 */
export function createFractionRandom(next: () => number): RandomPort {
  return {
    rand(lo: number, hi: number): number {
      const value = next()
      const low = lo | 0
      const high = hi | 0
      if (low === high) return low
      const minimum = Math.min(low, high)
      return minimum + Math.floor(value * Math.abs(high - low))
    },
    rand9d(n: number): number {
      const limit = n | 0
      if (limit <= 0) return 0
      return Math.floor(next() * limit)
    },
  }
}

/** 같은 비율만 내는 시험용 포트 */
export function createConstantRandom(value: number): RandomPort {
  return createFractionRandom(() => value)
}
