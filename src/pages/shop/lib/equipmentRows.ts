import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import {
  EQUIPMENT_LEVEL_COUNT, EQUIPMENT_PARTS, FIRST_HIDDEN_LEVEL, equipmentBonusOf, equipmentItemOf, isHiddenOpen, ownsEquipment,
} from '@/entities/career/model/equipment'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import {
  isPitcherEquipmentEquipped, isPitcherHiddenOpen, ownsPitcherEquipment, pitcherEquipmentItemOf,
} from '@/entities/pitcher-career/model/pitcherEquipment'
import { ORIGINAL_ITEMS } from '@/shared/config/original/items'
import { shopItemId } from '@/features/shop/model/shopSelection'
import { LOCKED_NAME } from '@/pages/shop/lib/equipmentWindowLayout'

/**
 * 장비 창 0x83378 의 목록 한 줄. 줄 차례는 0x8146c 가 `[창+0x1b1..]` 에 레벨을 적어 둔 그대로다(0x8146c, 직접 떴다):
 *   상점(상태 111)   레벨 0~10 열한 줄 전부 (0x814ba~0x814ca)
 *   장비착용(121)    가진 레벨만 차례로 (`rec[0x188 + 부위·11 + 레벨] ≠ 0`, 0x814e2~0x8151e)
 * 목록 객체는 1열 × 줄 수, 꼴 0x30(세로 감기), 한 화면 5줄([목록+0x38] = 5) 이다.
 */
export interface EquipmentRow {
  /** `shopItemId` 구매·장착 식별자 */
  readonly id: string
  readonly level: number
  /** 이름 칸 — 잠긴 히든(레벨 > 6 · 해금표 0)이면 "????" (0xd4c18) */
  readonly name: string
  readonly isOwned: boolean
  readonly isEquipped: boolean
  /** 가격 (만원) — 0x63331(… 표 0xd4510 × 1000) */
  readonly price: number
  /** 효과 줄 숫자 — 표 0xd41ae[레벨] (시즌이 아닌 갈래 0x83dda) */
  readonly bonus: number
  /**
   * 설명 칸(박스 4) 글 — 원문 마크업. 0x84256~0x84334:
   *   레벨 ≤ 6       표 0xd44ae[레벨] 이 0 이면 StrITEM[184] "인기도 제한 없음", 아니면 StrITEM[185] "인기도 %d 이상"
   *   레벨 > 6 잠김   오픈 힌트 StrITEM[(타자 202 · 투수 186) + 부위·4 + 레벨 − 7]
   *   레벨 > 6 열림   **아무것도 안 그린다** (0x841a8 `bne 0x84334` — 원본 그대로)
   */
  readonly description: string
}

/** StrITEM[184] · [185] */
const NO_POPULARITY_TEXT = ORIGINAL_ITEMS[184]
const POPULARITY_TEXT = ORIGINAL_ITEMS[185]

function descriptionOf(level: number, requiredPopularity: number, isOpen: boolean, hint: string | null): string {
  if (level < FIRST_HIDDEN_LEVEL) {
    return requiredPopularity === 0 ? NO_POPULARITY_TEXT : POPULARITY_TEXT.replace('%d', String(requiredPopularity))
  }
  return isOpen ? '' : hint ?? ''
}

/** 0x8146c — 상점이면 열한 레벨 전부, 장비착용이면 가진 레벨만 */
const levelsOf = (isWearing: boolean, owns: (level: number) => boolean): readonly number[] =>
  Array.from({ length: EQUIPMENT_LEVEL_COUNT }, (_unused, level) => level).filter((level) => !isWearing || owns(level))

/** 타자편 장비 줄 — 창 종류 3 (상점 '장착' · 장비착용 '착용') */
export function batterEquipmentRowsOf(career: PlayerCareer, part: number, isWearing: boolean): readonly EquipmentRow[] {
  const { ability } = EQUIPMENT_PARTS[part]
  return levelsOf(isWearing, (level) => ownsEquipment(career, part, level)).map((level) => {
    const item = equipmentItemOf(part, level)
    const isOpen = isHiddenOpen(career, part, level)
    return {
      id: shopItemId(isWearing ? '착용' : '장착', part, level),
      level,
      name: isOpen ? item.name : LOCKED_NAME,
      isOwned: ownsEquipment(career, part, level),
      isEquipped: career.equipmentLevels[ability] === level + 1,
      price: item.price,
      bonus: equipmentBonusOf(level + 1),
      description: descriptionOf(level, item.requiredPopularity, isOpen, item.hiddenHint),
    }
  })
}

/** 투수편 장비 줄 — 이름·가격·힌트 표만 투수 것 (0x832e8 · 0xd4510 앞 44칸 · StrITEM[186~]) */
export function pitcherEquipmentRowsOf(career: PitcherCareer, part: number, isWearing: boolean): readonly EquipmentRow[] {
  return levelsOf(isWearing, (level) => ownsPitcherEquipment(career, part, level)).map((level) => {
    const item = pitcherEquipmentItemOf(part, level)
    const isOpen = isPitcherHiddenOpen(career, part, level)
    return {
      id: shopItemId(isWearing ? '착용' : '장착', part, level),
      level,
      name: isOpen ? item.name : LOCKED_NAME,
      isOwned: ownsPitcherEquipment(career, part, level),
      isEquipped: isPitcherEquipmentEquipped(career, part, level),
      price: item.price,
      bonus: equipmentBonusOf(level + 1),
      description: descriptionOf(level, item.requiredPopularity, isOpen, item.hiddenHint),
    }
  })
}
