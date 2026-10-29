import { ORIGINAL_ITEMS } from '@/shared/config/original/items'
import { MONEY_LIMIT, clampTo, type SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import {
  seasonShopTextOf,
  moneyTextOf,
  SEASON_SHOP_TEXT,
  seasonSubItemPriceOf,
  SUB_PRICE_SCALE,
  type SeasonShopCheck,
} from '@/entities/season-mode/model/seasonItemShop/prices'

const TRAINING_SLOTS = 4
const MASSAGER_SLOT = 4

type SubRecord = Pick<SeasonRecord, 'money' | 'trainingSubItems' | 'massager' | 'outingSubItems'>

/** SR[0x58 + k] */
export function ownsSeasonShopSubItem(record: SubRecord, slot: number): boolean {
  if (slot < TRAINING_SLOTS) return record.trainingSubItems[slot] ?? false
  if (slot === MASSAGER_SLOT) return record.massager
  return record.outingSubItems[slot - MASSAGER_SLOT - 1] ?? false
}

/** 키 0x957c 종류 1 — 가드 차례 그대로 */
export function checkSeasonSubItem(record: SubRecord, slot: number): SeasonShopCheck {
  if (ownsSeasonShopSubItem(record, slot)) return { ok: false, notice: seasonShopTextOf(SEASON_SHOP_TEXT.이미보유) }
  const price = seasonSubItemPriceOf(slot)
  if (price * SUB_PRICE_SCALE > record.money) return { ok: false, notice: seasonShopTextOf(SEASON_SHOP_TEXT.소지금부족) }
  return { ok: true, question: seasonShopTextOf(SEASON_SHOP_TEXT.소지금확인).replace('%s', moneyTextOf(price * 1000)) }
}

/** SR[0x58 + k] = 1 — 트레이닝 칸 0~3 · 자동안마기 4 · 외출 칸 5~9 */
function withSubItemOwned<R extends SubRecord>(record: R, slot: number, money: number): R {
  const own = (flags: readonly boolean[], at: number) => flags.map((flag, index) => (index === at ? true : flag))
  if (slot < TRAINING_SLOTS) return { ...record, money, trainingSubItems: own(record.trainingSubItems, slot) }
  if (slot === MASSAGER_SLOT) return { ...record, money, massager: true }
  return { ...record, money, outingSubItems: own(record.outingSubItems, slot - MASSAGER_SLOT - 1) }
}

/** 시즌 서브아이템 이름 StrITEM[0x6d + k] */
const SEASON_SUB_ITEM_NAME_BASE = 0x6d

/** 0x7d90 결과 0xc — 새 레코드와 팝업 글 */
export function applySeasonSubItem<R extends SubRecord>(record: R, slot: number): { readonly record: R; readonly notice: string } {
  const money = clampTo(record.money - seasonSubItemPriceOf(slot) * SUB_PRICE_SCALE, MONEY_LIMIT)
  const next = withSubItemOwned(record, slot, money)
  // 0x845f1(창, k) — 창이 그리는 이름(시즌 StrITEM[0x6d + k])
  const name = ORIGINAL_ITEMS[SEASON_SUB_ITEM_NAME_BASE + slot] ?? ''
  return { record: next, notice: seasonShopTextOf(SEASON_SHOP_TEXT.구매완료).replace('%s', name) }
}
