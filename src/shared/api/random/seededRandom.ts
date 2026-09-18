import type { RandomPort } from '@/shared/api/random/randomPort'

/**
 * mulberry32 기반 시드 난수 어댑터.
 * 같은 시드는 항상 같은 수열을 내므로 밸런싱 테스트와 리플레이에 쓸 수 있다.
 */
export function createSeededRandom(seed: number): RandomPort {
  let state = seed >>> 0

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = Math.imul(state ^ (state >>> 15), 1 | state)
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }

  return {
    next,
    nextInRange: (minimum, maximum) => minimum + next() * (maximum - minimum),
    pick: <T>(candidates: readonly T[]): T => {
      if (candidates.length === 0) {
        throw new Error('pick: 후보가 비어 있습니다')
      }
      return candidates[Math.floor(next() * candidates.length)]
    },
  }
}
