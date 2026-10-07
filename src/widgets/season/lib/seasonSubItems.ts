import { ORIGINAL_ITEMS } from '@/shared/config/original/items'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'

/**
 * **시즌 서브아이템 10칸** — 아이템 창 0x81dc0 이 시즌(0x7b998)일 때 읽는 표 (직접 떴다).
 *
 * 격자는 2줄 × 5칸, 칸 k = 줄 × 5 + 열 (0xca7b5 · 0xca911(목록, 5)).
 * ```
 * 보유     SR[0x58 + k]                         (0x82534~0x8253e · 0x825c0~0x825ca)
 * 아이콘   item_icon 0xd464e[k] (시즌) / 0xd463a[k] = k (나리)   (0x82564~0x8257e)
 * 이름     StrITEM[0x6d + k] (시즌) / [0x58 + k] (나리)          (0x826d8 · 0x826de)
 * 값       0xd45f4[k] × 1000 만원 (시즌) / 0xd4608[k] × 1000 (나리) — 0x63331 소지금 글꼴 (0x8284e~0x8288c)
 * 설명     "!cFFFFFF" + StrITEM[0xe1 + k] + "!N효과 : !cFFFF00" + 효과                 (0x82a48~0x82b6e)
 * 효과     k ≤ 3 : StrITEM[0xda] "%s 훈련 시 +2" 에 StrMODE[0x2c + k](투구·타격·집중·근성)
 *          k > 3 : StrITEM[0xd7 + k]
 * ```
 * 칸 0~3 = 팀 트레이닝(SR+0x58~0x5b) · 4 = 자동안마기(SR+0x5c) · 5~9 = 외출(SR+0x5d~0x61) — `SeasonRecord` 의 세 칸.
 */
export const SEASON_SUB_ITEM_COUNT = 10
/** 0xd464e — 시즌 서브아이템 아이콘 (item_icon 프레임) */
export const SEASON_SUB_ITEM_ICONS: readonly number[] = [0, 26, 25, 3, 4, 24, 6, 7, 8, 23]
/** 0xd45f4 — 시즌 서브아이템 값 (× 1000 만원) */
export const SEASON_SUB_ITEM_PRICES: readonly number[] = [25, 25, 20, 20, 15, 25, 25, 15, 25, 30]
const PRICE_UNIT = 1000
const NAME_BASE = 0x6d
const DESCRIPTION_BASE = 0xe1
const TRAINING_EFFECT_FORMAT = 0xda
const TRAINING_NAME_BASE = 0x2c
const OTHER_EFFECT_BASE = 0xd7
const TRAINING_SLOTS = 4
const MASSAGER_SLOT = 4
const EFFECT_HEAD = '!N효과 : !cFFFF00'

export interface SeasonSubItem {
  readonly slot: number
  readonly name: string
  /** 설명 박스 원문 마크업 */
  readonly description: string
  /** 값 — 만원 */
  readonly price: number
  readonly iconFrame: number
  readonly isOwned: boolean
}

/** SR+0x58 + k — 웹 레코드의 세 칸으로 */
export function ownsSeasonSubItem(record: Pick<SeasonRecord, 'trainingSubItems' | 'massager' | 'outingSubItems'>, slot: number): boolean {
  if (slot < TRAINING_SLOTS) return record.trainingSubItems[slot] ?? false
  if (slot === MASSAGER_SLOT) return record.massager
  return record.outingSubItems[slot - MASSAGER_SLOT - 1] ?? false
}

function effectTextOf(slot: number): string {
  if (slot < TRAINING_SLOTS) {
    return (ORIGINAL_ITEMS[TRAINING_EFFECT_FORMAT] ?? '').replace('%s', ORIGINAL_MODE_TEXT[TRAINING_NAME_BASE + slot] ?? '')
  }
  return ORIGINAL_ITEMS[OTHER_EFFECT_BASE + slot] ?? ''
}

export function seasonSubItemsOf(record: Pick<SeasonRecord, 'trainingSubItems' | 'massager' | 'outingSubItems'>): readonly SeasonSubItem[] {
  return Array.from({ length: SEASON_SUB_ITEM_COUNT }, (_unused, slot) => ({
    slot,
    name: ORIGINAL_ITEMS[NAME_BASE + slot] ?? '',
    description: `!cFFFFFF${ORIGINAL_ITEMS[DESCRIPTION_BASE + slot] ?? ''}${EFFECT_HEAD}${effectTextOf(slot)}`,
    price: (SEASON_SUB_ITEM_PRICES[slot] ?? 0) * PRICE_UNIT,
    iconFrame: SEASON_SUB_ITEM_ICONS[slot] ?? 0,
    isOwned: ownsSeasonSubItem(record, slot),
  }))
}
