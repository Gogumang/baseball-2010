import type { BatterAbility } from '@/entities/batting/model/batter'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { randomIntegerBelow } from '@/shared/lib/random/originalRandom'

/**
 * 도루 (binary.mod 0xc1818 안에서 쓰는 표 0xd9064 — 바이트로 직접 읽어 확인).
 *
 * 원본은 주력만 본다. 투수 구속·포수 능력은 이 판정에 들어오지 않는다.
 *   줄 = 주력 ÷ 100 (0~9), 성공 조건 = `rand(0, 10000) < 표값 × 100`
 * 즉 주력 0~99 면 1%, 900 이상이면 80% 다.
 *
 * **3루 주자는 시도하지 않는다** — 원본이 홈 도루를 걸지 않는다.
 *
 * (예전 웹판은 "기본 25% + 주루 55% − 구속 25%" 라는 원본에 없는 공식을 쓰고 있었다.)
 */
const STEAL_SUCCESS_PERCENT: readonly number[] = [1, 5, 10, 15, 20, 30, 40, 50, 60, 80]
const RUN_BAND = 100
const RANDOM_LIMIT = 10_000

export type StealResult = '성공' | '실패'

/** 성공률(만분율). 퍼센트로 보여 줄 때는 100 으로 나눈다 */
export function stealChanceOf(runner: BatterAbility): number {
  const band = Math.min(STEAL_SUCCESS_PERCENT.length - 1, Math.max(0, Math.trunc(runner.run / RUN_BAND)))
  return STEAL_SUCCESS_PERCENT[band] * 100
}

export function attemptSteal(runner: BatterAbility, random: RandomPort): StealResult {
  return randomIntegerBelow(random, 0, RANDOM_LIMIT) < stealChanceOf(runner) ? '성공' : '실패'
}

/** 3루 주자는 도루를 걸지 않는다 (원본이 홈 도루를 시도하지 않는다) */
export function canStealFrom(base: 1 | 2 | 3): boolean {
  return base !== 3
}
