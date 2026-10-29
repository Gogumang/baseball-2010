import type { RandomPort } from '@/shared/api/random/randomPort'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { BATTER_GP_ITEMS } from '@/entities/career/model/gpItems/catalog'
import { applyEffect, BATTER_GP_RULES } from '@/entities/career/model/gpItems/use/effects'
import { drawLottery } from '@/entities/career/model/gpItems/use/lottery'
import { ITEM, type GpItemCareer, type GpItemResultOf, type GpItemRules } from '@/entities/career/model/gpItems/types'

const MAXIMUM_GAME_POINT = 99_999

export type GpItemResult = GpItemResultOf<PlayerCareer>

/** 0xa4488 — 모드 규칙을 받아 아이템 하나를 쓴다 (투수편 `pitcherItems.ts` 도 이것을 부른다) */
export function applyGpItemWith<T extends GpItemCareer>(rules: GpItemRules<T>, career: T, id: number, random: RandomPort): GpItemResultOf<T> {
  if (id === ITEM.또또상품권) return drawLottery(rules, career, random)
  return { career: applyEffect(rules, career, id), lotteryPrize: null }
}

export function applyGpItem(career: PlayerCareer, id: number, random: RandomPort): GpItemResult {
  return applyGpItemWith(BATTER_GP_RULES, career, id, random)
}

export type GpPurchaseOf<T> =
  | { readonly kind: '구입'; readonly result: GpItemResultOf<T> }
  | { readonly kind: '거절'; readonly reason: 'G포인트부족' }
export type GpPurchase = GpPurchaseOf<PlayerCareer>

/** 사면 곧바로 쓴다 (0x14a74 탭 2 — 전역 G 차감 0~99999 뒤 0xa4488). 가격 표는 두 모드 같은 값이다 */
export function purchaseGpItemWith<T extends GpItemCareer>(rules: GpItemRules<T>, career: T, id: number, random: RandomPort): GpPurchaseOf<T> {
  const price = BATTER_GP_ITEMS[id].price
  if (career.gamePoint < price) return { kind: '거절', reason: 'G포인트부족' }
  const paid = { ...career, gamePoint: Math.min(MAXIMUM_GAME_POINT, career.gamePoint - price) }
  return { kind: '구입', result: applyGpItemWith(rules, paid, id, random) }
}

export function purchaseGpItem(career: PlayerCareer, id: number, random: RandomPort): GpPurchase {
  return purchaseGpItemWith(BATTER_GP_RULES, career, id, random)
}
