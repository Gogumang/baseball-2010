import { MORALE_LIMIT, type SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import {
  seasonShopTextOf,
  SEASON_GP_ITEM_COUNT,
  SEASON_SHOP_TEXT,
  seasonGpItemPriceOf,
  type SeasonShopCheck,
} from '@/entities/season-mode/model/seasonItemShop/prices'

export type GpRecord = Pick<SeasonRecord, 'money' | 'illness' | 'illnessSlack' | 'illnessCooldown' | 'aimVisionGames' | 'storeGames' | 'tradeUsed'>

export interface SeasonGpShopInput {
  readonly record: GpRecord
  /** 팀 레코드 +2 사기 */
  readonly teamMorale: number
  readonly gamePoint: number
}

export const EAGLE_EYE_SLOT = 4
const EAGLE_EYE_GUARD = 98

/** 칸마다 하나씩 있는 가드 — 걸리면 그 StrMODE 번호 (0x9908~0x9a2c, 차례 5 · 1 · 4 · 2 · 6 은 칸이 달라 서로 안 겹친다) */
const GP_ITEM_REFUSALS: Readonly<Record<number, (input: SeasonGpShopInput) => number | null>> = {
  5: ({ record }) => (record.tradeUsed !== 1 ? SEASON_SHOP_TEXT.트레이드 : null),
  1: ({ teamMorale }) => (teamMorale === MORALE_LIMIT ? SEASON_SHOP_TEXT.사기최고 : null),
  [EAGLE_EYE_SLOT]: ({ record }) => (record.aimVisionGames > EAGLE_EYE_GUARD ? SEASON_SHOP_TEXT.이글아이최대 : null),
  2: ({ record }) => (record.illness === 0 ? SEASON_SHOP_TEXT.건강 : null),
  6: ({ record }) => (record.storeGames > 0 ? SEASON_SHOP_TEXT.매점사용중 : null),
}

/** 키 0x957c 종류 2 — k > 6 이면 null (아무것도 안 한다) */
export function checkSeasonGpItem(input: SeasonGpShopInput, slot: number): SeasonShopCheck | null {
  if (slot < 0 || slot >= SEASON_GP_ITEM_COUNT) return null
  const price = seasonGpItemPriceOf(slot)
  if (price > input.gamePoint) return { ok: false, notice: seasonShopTextOf(SEASON_SHOP_TEXT.G부족), asks: true }
  const refusal = GP_ITEM_REFUSALS[slot]?.(input) ?? null
  if (refusal !== null) return { ok: false, notice: seasonShopTextOf(refusal) }
  const question = seasonShopTextOf(SEASON_SHOP_TEXT.G확인).replace('%d', String(price))
  // 0x9a2e~0x9a72 — 이글아이만 [224] 뒤에 "!N" 둘을 잇고 확인 글을 붙인다
  return {
    ok: true,
    question: slot === EAGLE_EYE_SLOT ? `${seasonShopTextOf(SEASON_SHOP_TEXT.이글아이안내)}!N!N${question}` : question,
  }
}
