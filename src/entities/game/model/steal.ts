import type { BatterAbility } from '@/entities/batting/model/batter'
import type { BaseState } from '@/entities/game/model/baseState'
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

/* ── CPU 간이 엔진의 도루 (0xc1818, E-defense-rules E-5) ─────────────────────── */

/**
 * 간이 엔진이 도루를 걸 루 — **가장 앞선 주자**가 선 루다 (E-5 의 `lead`).
 * 주자가 없거나 가장 앞선 주자가 3루면 걸지 않는다 (`lead.루 != 3`).
 *
 * ⚠️ 그래서 1·3루면 앞 주자가 3루라 **1루 주자도 못 뛴다** — 원본이 그렇게 본다.
 */
export function quickStealBaseOf(bases: BaseState): 1 | 2 | null {
  if (bases.third) return null
  if (bases.second) return 2
  if (bases.first) return 1
  return null
}

export interface QuickStealResult {
  readonly bases: BaseState
  /** 한 루씩 간 주자 수 (원본은 주자마다 도루 기록 +1 을 준다) */
  readonly stolen: number
}

/**
 * 간이 엔진 도루 한 번 (0xc1818 의 투구 판정 뒤, E-5).
 *
 * ```
 * if 주자 > 0:
 *     lead = 가장 앞선 주자; 주력 = min(실효 주루, 999)
 *     if lead.루 != 3 and rand(0,10000) < 표0xd9064[주력/100] × 100:
 *         모든 주자 +1루, 각 주자 도루 +1
 * ```
 *
 * ⚠️ **원본 그대로 — 실패가 없다.** 굴림에 지면 아무 일도 일어나지 않고 주자도 죽지 않는다.
 * 투수 구속·포수 능력도 이 판정에 들어오지 않는다. 사람 경기의 `attemptSteal`(실패 있음)과
 * 다른 길이라 따로 둔다.
 *
 * 성공하면 **모든 주자가 한 루씩** 간다. 가장 앞선 주자가 3루가 아닌 것이 조건이라 득점은 나오지 않는다.
 */
export function quickEngineSteal(
  bases: BaseState,
  leadRunner: BatterAbility,
  random: RandomPort,
): QuickStealResult {
  const base = quickStealBaseOf(bases)
  if (base === null) return { bases, stolen: 0 }
  if (randomIntegerBelow(random, 0, RANDOM_LIMIT) >= stealChanceOf(leadRunner)) {
    return { bases, stolen: 0 }
  }
  return {
    bases: { first: false, second: bases.first, third: bases.second },
    stolen: Number(bases.first) + Number(bases.second),
  }
}
