import type { RandomPort } from '@/shared/api/random/randomPort'
import { randomIntegerBelow } from '@/shared/lib/random/originalRandom'

/** 제구 250 단위 행 × 누적 % (표 0xd896c) */
const TIER_ROWS: readonly (readonly number[])[] = [
  [5, 15, 70, 97, 100],
  [4, 12, 60, 95, 100],
  [3, 9, 50, 93, 100],
  [2, 5, 45, 91, 100],
]
const CONTROL_ROW_WIDTH = 250
const LAST_TIER = 3

/**
 * 투구 제구 등급 (binary.mod 0xb74bc). 등급이 판정 배율 MUL 과 제구 오차 행을 정한다.
 * control 은 컨디션을 반영한 제구(0~999). 지친 투수(0xaebb0 == 0)는 한 칸 내려간다.
 */
export function controlTierOf(control: number, isNotExhausted: boolean, random: RandomPort): number {
  const row = TIER_ROWS[Math.min(Math.trunc(control / CONTROL_ROW_WIDTH), TIER_ROWS.length - 1)]
  const roll = randomIntegerBelow(random, 0, 10_000)
  const index = row.findIndex((percent) => roll < percent * 100)
  if (index < 0) return LAST_TIER
  return isNotExhausted ? index + 1 : Math.max(0, index - 1)
}
