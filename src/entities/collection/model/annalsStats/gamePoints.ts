import { BATTER_LEAGUE_MODE, EARNED_MODE_SLOTS, GAME_POINT_USAGE_LIMIT } from '@/entities/collection/model/annalsStats/layout'
import type { AnnalsStats } from '@/entities/collection/model/annalsStats/types'

/** `0x22c29` 의 사용처 번호 — StrMAINMENU[175 + k] 순서 */
export const GAME_POINT_USAGE = {
  ace: 0,
  batterLeague: 1,
  pitcherLeague: 2,
  season: 3,
  versus: 4,
  paidCharge: 5,
  giftSent: 6,
  giftReceived: 7,
} as const

/** 나리 편 사용처 — 호출지가 모두 `모드 == 4 ? 1 : 2` 로 고른다 (0x148c6 · 0x1500c · 0x62e16 …) */
export const leagueUsageOf = (mode: number): number => (mode === BATTER_LEAGUE_MODE ? GAME_POINT_USAGE.batterLeague : GAME_POINT_USAGE.pitcherLeague)

/** 0x4ecca `cmp r4, 0x1869e; ble` — 획득 GP 일곱 칸 합이 99998 을 넘으면 */
const EARNED_GAME_POINT_HIDDEN_THRESHOLD = 99_998
const EARNED_GAME_POINT_HIDDEN_ID = 33

/**
 * **정산 0x4ea0c 의 4eca0~4ecda** (직접 떴다) — 모드 5 · 6(미션)이 아니면 기록 달성 G 를 더하고 `0x22c7d` · `0x22e10` ·
 * 저장 0x1f1e1 을 한 바로 뒤, 통계 `+0x8c` u32 일곱 칸(모드별 획득 GP)을 **모두 더해** 99998 을 넘으면
 * `0x62368(ui, 0x21 = 33, 0)`. 보유 G(+0x64)가 아니라 **지금까지 얻은 GP 합**이다. 열 id 를, 아니면 null
 */
export function earnedGamePointHiddenIdOf(stats: AnnalsStats): number | null {
  const total = stats.gamePointEarned.reduce((sum, amount) => sum + amount, 0)
  return total > EARNED_GAME_POINT_HIDDEN_THRESHOLD ? EARNED_GAME_POINT_HIDDEN_ID : null
}

/** 더한 값을 0~99999999 로 자른다 (0x22c52~0x22c62 · 0x22d84~0x22d94) */
const clampedSum = (total: number, amount: number) => Math.min(GAME_POINT_USAGE_LIMIT, Math.max(0, total + Math.trunc(amount)))

/** `0x22c29(mgr, k, 액수)` — `k > 7` 은 무시, 더한 값을 0~99999999 로 자른다 (0x22c52~0x22c62) */
export function addGamePointUsage(stats: AnnalsStats, kind: number, amount: number): AnnalsStats {
  if (kind > 7 || kind < 0) return stats
  const gamePointUsage = stats.gamePointUsage.map((total, at) => (at === kind ? clampedSum(total, amount) : total))
  return { ...stats, gamePointUsage }
}

/** `0x2322d(mgr, k)` — `k > 7` 이면 원본은 −1 을 돌려준다 (0x23232) */
export function gamePointUsageOf(stats: AnnalsStats, kind: number): number {
  if (kind > 7) return -1
  return stats.gamePointUsage[kind] ?? 0
}

/**
 * `0x22c7d(mgr, 액수, 모드)` — 모드별 획득 GP. 모드가 1~9 가 아니면 아무것도 안 한다(0x22c82 `cmp #8; bls`).
 * 더한 값을 0~99999999 로 자른다 (0x22d84~0x22d94) — 음수 액수(이벤트 G 감소)면 줄어든다.
 */
export function addGamePointEarned(stats: AnnalsStats, amount: number, mode: number): AnnalsStats {
  const slot = EARNED_MODE_SLOTS[mode]
  if (slot === undefined) return stats
  const gamePointEarned = stats.gamePointEarned.map((total, at) => (at === slot ? clampedSum(total, amount) : total))
  return { ...stats, gamePointEarned }
}

/** `0x2325d(mgr, j)` — 칸 j 의 획득 GP. 없는 칸은 0 */
export function gamePointEarnedOf(stats: AnnalsStats, slot: number): number {
  return stats.gamePointEarned[slot] ?? 0
}
