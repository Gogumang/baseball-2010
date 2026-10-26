import type { RandomPort } from '@/shared/api/random/randomPort'
import { balanceGrid, balanceNumber } from '@/shared/config/balance'

// 제구 250 단위 행 × 누적 % (표 0xd896c) — 숨은 판정값 표 `pitching.controlTierRows` · `pitching.controlRowWidth`
const LAST_TIER = 3

/**
 * 투구 제구 등급 (binary.mod 0xb74bc). 등급이 판정 배율 MUL 과 제구 오차 행을 정한다.
 * control 은 컨디션을 반영한 제구(0~999). 지친 투수(0xaebb0 == 0)는 한 칸 내려간다.
 */
export function controlTierOf(control: number, isNotExhausted: boolean, random: RandomPort): number {
  const rows = balanceGrid('pitching.controlTierRows')
  const row = rows[Math.min(Math.trunc(control / balanceNumber('pitching.controlRowWidth')), rows.length - 1)]
  const roll = random.rand(0, 10_000)
  const index = row.findIndex((percent) => roll < percent * 100)
  if (index < 0) return LAST_TIER
  return isNotExhausted ? index + 1 : Math.max(0, index - 1)
}
