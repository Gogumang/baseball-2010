import type { RandomPort } from '@/shared/api/random/randomPort'
import { randomIntegerBelow } from '@/shared/lib/random/originalRandom'

/**
 * 필살타법 성공 판정 (경기 `0x34c74` → 타구 처리 `0x517e6` — H2 2-2 확정).
 *
 * ```
 * p% = 마타자(S+0x24 순번 ≥ 0) 면 30, 아니면 표 0xcfdbe[번호−1] = 15·20·25·25·30
 * 성공 = p·10 > rand(0, 1000)
 * ```
 * 성공하면 그 타구에 **"송구공" 비트**가 붙어 야수가 쥐지 않고 지나친다
 * (`0x51800` → `features/defense-play` 의 `isUncatchable`, S13 6절).
 *
 * ⚠️ 필살은 **그 공 한 번의 스윙에만** 걸린다 — 새 투구 준비 `0x34334` 가 `S+0x10` 을 0 으로
 * 되돌린다(0x34444). 부르는 쪽이 투구마다 다시 눌러야 한다.
 */

/** 표 `0xcfdbe` — 필살타법 번호(레벨) 1~5 의 성공 확률 % */
export const SPECIAL_SWING_PERCENTS: readonly number[] = [15, 20, 25, 25, 30]
/** 마타자는 번호와 무관하게 30% 다 (0x34c74) */
export const ACE_BATTER_SPECIAL_SWING_PERCENT = 30
/** `p·10 > rand(0, 1000)` — 원본이 천분율로 굴린다 */
const RANDOM_LIMIT = 1000

/** 그 타자의 성공 확률 % — 레벨 0(안 배움)이면 0 이라 굴려도 늘 실패다 */
export function specialSwingPercentOf(level: number, isAceBatter = false): number {
  if (isAceBatter) return ACE_BATTER_SPECIAL_SWING_PERCENT
  if (level <= 0) return 0
  return SPECIAL_SWING_PERCENTS[Math.min(level, SPECIAL_SWING_PERCENTS.length) - 1] ?? 0
}

/** 필살 스윙이 성공했는가 — 성공하면 그 타구를 아무도 못 잡는다 */
export function rollSpecialSwing(level: number, random: RandomPort, isAceBatter = false): boolean {
  const percent = specialSwingPercentOf(level, isAceBatter)
  if (percent <= 0) return false
  return percent * 10 > randomIntegerBelow(random, 0, RANDOM_LIMIT)
}
