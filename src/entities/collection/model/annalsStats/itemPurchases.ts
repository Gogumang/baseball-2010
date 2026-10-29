import { ITEM_MODE_SLOTS, ITEM_SLOTS_PER_MODE, U16 } from '@/entities/collection/model/annalsStats/layout'
import type { AnnalsStats, StatMode } from '@/entities/collection/model/annalsStats/types'

const isMode = (mode: number): mode is StatMode => mode === 2 || mode === 3 || mode === 4

/**
 * `0x22e35(mgr, 모드, i)` — GP 아이템 구매 수. `i > 9` 이거나 모드가 2·3·4 가 아니면 아무것도 안 한다.
 * 저장은 u16 두 바이트에 `(값 << 16) + 0x10000 >> 16` 이라 65535 다음은 0 이다 (0x22e62~0x22e78).
 */
export function countItemPurchase(stats: AnnalsStats, mode: number, index: number): AnnalsStats {
  if (index > 9 || !isMode(mode)) return stats
  const slot = ITEM_MODE_SLOTS[mode] * ITEM_SLOTS_PER_MODE + index
  if (slot < 0) return stats
  const itemPurchaseCounts = stats.itemPurchaseCounts.map((count, at) => (at === slot ? (count + 1) % U16 : count))
  return { ...stats, itemPurchaseCounts }
}

/** `0x22eb5(mgr, 모드, i)` — 없는 칸은 0 */
export function itemPurchaseCountOf(stats: AnnalsStats, mode: number, index: number): number {
  if (index > 9 || index < 0 || !isMode(mode)) return 0
  return stats.itemPurchaseCounts[ITEM_MODE_SLOTS[mode] * ITEM_SLOTS_PER_MODE + index] ?? 0
}
