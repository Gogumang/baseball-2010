import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import { ORIGINAL_ITEMS } from '@/shared/config/original/items'

export interface GpItem {
  readonly id: number
  readonly name: string
  /** 설명 첫 줄 — StrITEM[0xad + k] (타자 칸 9 는 [0xb7]) — 원문 `!N` 그대로 */
  readonly descriptionText: string
  /** 효과 글 — `gpItemEffectTextOf` (원문 `!N` · 들여쓰기 그대로) */
  readonly effectText: string
  /** G포인트 (표 0xcc41b × 100) */
  readonly price: number
}

/** GP 가격 — 상점 0x14e54 가 `0xcc41b`[k (모드 4 면 +10)] × 100 G 로 읽는다. 두 블록 모두 같은 값 */
const PRICE_TABLE = [3, 3, 3, 3, 10, 3, 3, 5, 20, 5]
const PRICE_UNIT = 100

/** 이름 StrITEM[0x62 + k] — 칸 9 는 타자(모드 4)면 [0x6c] 이글아이, 투수면 [0x62 + 9] 십전대보탕 (0x826b0) */
export const NAME_BASE = 0x62
const BATTER_NINTH_NAME = 0x6c
const DESCRIPTION_BASE = 0xad
const BATTER_NINTH_DESCRIPTION = 0xb7
const ABILITY_EFFECT_FORMAT = 0xa5
const OTHER_EFFECT_BASE = 0xa2
const BATTER_NINTH_EFFECT = 0xac
const ABILITY_ITEM_COUNT = 4
const NINTH_ITEM = 9
/** 능력치 이름 StrMODE[0x23 + k] (타자) — 투수는 [0x28 + k] */
const BATTER_ABILITY_NAME_BASE = 0x23
const PITCHER_ABILITY_NAME_BASE = BATTER_ABILITY_NAME_BASE + 5

export const itemText = (index: number): string => ORIGINAL_ITEMS[index] ?? ''

/**
 * GP 아이템 설명 조립 — 아이템 창 0x81dc0 창 종류 2 의 나만의리그 갈래 (직접 떴다, 0x828a6~0x829ea):
 * ```
 * 82890  "!cFFFFFF"
 * 828c8  + StrITEM[0xad + k]  (k == 9 이고 모드 4(0x7b970) 면 [0xb7])
 * 82906  + "!N효과 : !cFFFF00"(0xcc9f0)
 * 82932  k ≤ 3: + sprintf(StrITEM[0xa5], StrMODE[0x23 + k])  ; 투수(0x7b984)면 [0x28 + k]
 * 829a2  k == 9 이고 모드 4: + StrITEM[0xac]
 * 829d0  그 밖: + StrITEM[0xa2 + k]
 * ```
 */
export function gpItemEffectTextOf(id: number, isBatter = true): string {
  if (id < ABILITY_ITEM_COUNT) {
    const nameBase = isBatter ? BATTER_ABILITY_NAME_BASE : PITCHER_ABILITY_NAME_BASE
    return itemText(ABILITY_EFFECT_FORMAT).replace('%s', ORIGINAL_MODE_TEXT[nameBase + id] ?? '')
  }
  if (id === NINTH_ITEM && isBatter) return itemText(BATTER_NINTH_EFFECT)
  return itemText(OTHER_EFFECT_BASE + id)
}

/** 이름 · 설명 · 효과를 원문 표에서 (모드 4 = 타자) */
export function gpItemOf(id: number, isBatter = true): GpItem {
  const isBatterNinth = id === NINTH_ITEM && isBatter
  return {
    id,
    name: itemText(isBatterNinth ? BATTER_NINTH_NAME : NAME_BASE + id),
    descriptionText: itemText(isBatterNinth ? BATTER_NINTH_DESCRIPTION : DESCRIPTION_BASE + id),
    effectText: gpItemEffectTextOf(id, isBatter),
    price: PRICE_TABLE[id] * PRICE_UNIT,
  }
}

export const BATTER_GP_ITEMS: readonly GpItem[] = PRICE_TABLE.map((_price, id) => gpItemOf(id))
