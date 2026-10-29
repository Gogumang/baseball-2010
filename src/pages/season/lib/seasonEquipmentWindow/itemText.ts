import { ORIGINAL_ITEMS } from '@/shared/config/original/items'
import {
  SEASON_FIRST_HIDDEN_LEVEL,
  seasonEquipmentHiddenIdOf,
  seasonEquipmentNameOf,
  seasonEquipmentPriceOf,
  seasonEquipmentRequiredPopularityOf,
} from '@/entities/season-mode/model/seasonEquipment'
import { isHiddenUnlocked } from '@/shared/config/unlocks'

/** 잠긴 히든 칸 이름 (0xd4c18) */
export const LOCKED_ITEM_NAME = '????'

/** 잠긴 히든 칸 — 해금 표(`unlocks.json`)가 풀면 열린 칸으로 그린다 */
const isLockedLevel = (isBatter: boolean, part: number, level: number, isHiddenOpen: (id: number) => boolean) => {
  if (level < SEASON_FIRST_HIDDEN_LEVEL) return false
  const hiddenId = seasonEquipmentHiddenIdOf(isBatter, part, level)
  return !isHiddenUnlocked(hiddenId, () => isHiddenOpen(hiddenId))
}

/** 칸 이름 — 잠긴 히든 칸은 "????" */
export function equipmentItemNameOf(isBatter: boolean, part: number, level: number, isHiddenOpen: (id: number) => boolean): string {
  return isLockedLevel(isBatter, part, level, isHiddenOpen) ? LOCKED_ITEM_NAME : seasonEquipmentNameOf(isBatter, part, level)
}

/** 가격 칸 — 0xd4510 × 1000 만원 (= 0xcbca8 × 10 백만 원과 같은 표) */
export function equipmentPriceTenThousandsOf(isBatter: boolean, part: number, level: number): number {
  return seasonEquipmentPriceOf(isBatter, part, level) * 1000
}

/** 보너스 표 0xd41ae — 칸마다 (부위와 무관) */
const EFFECT_BONUS: readonly number[] = [30, 50, 70, 90, 110, 125, 140, 190, 210, 230, 250]

export function equipmentEffectBonusOf(level: number): number {
  return EFFECT_BONUS[level] ?? 0
}

/** 0x6c805(v, 10) — 10 으로 나눠 0 이 될 때까지 센다(자릿수 − 1) */
export function divisionsOf(value: number): number {
  let count = 0
  let left = Math.trunc(value / 10)
  while (left !== 0) {
    count += 1
    left = Math.trunc(left / 10)
  }
  return count
}

/** 효과 줄 ox — 이름표 −(7d + 19) · "+" −(7d + 10) */
export function effectOffsetsOf(bonus: number): { readonly label: number; readonly plus: number } {
  const d = divisionsOf(bonus)
  return { label: -(7 * d + 19), plus: -(7 * d + 10) }
}

/** 히든 힌트 첫 칸 — StrITEM 186(투수) · 202(타자) */
const HIDDEN_HINT_BASE = { 타자: 202, 투수: 186 } as const
const HINTS_PER_PART = 4
/** StrITEM[184] "인기도 제한 없음" · [185] "인기도 %d 이상" */
const NO_POPULARITY_LIMIT = 184
const POPULARITY_LIMIT_FORMAT = 185

/** 설명 상자 글 — 없으면 null (열린 히든 칸) */
export function equipmentDescriptionOf(isBatter: boolean, part: number, level: number, isHiddenOpen: (id: number) => boolean): string | null {
  if (level >= SEASON_FIRST_HIDDEN_LEVEL) {
    if (!isLockedLevel(isBatter, part, level, isHiddenOpen)) return null
    const base = HIDDEN_HINT_BASE[isBatter ? '타자' : '투수']
    return ORIGINAL_ITEMS[base + HINTS_PER_PART * part + level - SEASON_FIRST_HIDDEN_LEVEL] ?? ''
  }
  // 0xd44ae — 0xcbd58 과 같은 값(필요 인기도)
  const required = seasonEquipmentRequiredPopularityOf(level)
  if (required === 0) return ORIGINAL_ITEMS[NO_POPULARITY_LIMIT] ?? ''
  return (ORIGINAL_ITEMS[POPULARITY_LIMIT_FORMAT] ?? '').replace('%d', String(required))
}
