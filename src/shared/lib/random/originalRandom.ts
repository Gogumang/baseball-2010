import type { RandomPort } from '@/shared/api/random/randomPort'

/** 원본 rand_range(a, b) — [a, b) 정수. 원본 판정식을 옮긴 곳은 모두 이것으로 뽑는다. */
export function randomIntegerBelow(random: RandomPort, minimum: number, maximumExclusive: number): number {
  return minimum + Math.floor(random.next() * (maximumExclusive - minimum))
}
