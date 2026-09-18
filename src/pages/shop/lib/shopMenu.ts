import type { MenuItem } from '@/shared/ui'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import {
  EQUIPMENT_LEVEL_COUNT, EQUIPMENT_PARTS, equipmentBonusOf, equipmentItemOf, isHiddenOpen, ownsEquipment,
} from '@/entities/career/model/equipment'
import { formatMoney, shopItemId } from '@/features/shop/model/shopSelection'

export { formatMoney }
import { stripGameMarkup } from '@/shared/lib/gameMarkup/gameMarkup'

const ABILITY_NAMES = { hit: '히트', power: '파워', defense: '수비', run: '주루' } as const

/** 부위 하나의 레벨 0~10 목록. 히든 칸은 열리기 전까지 이름 대신 오픈 힌트(StrITEM[202~217])를 보여 준다 */
/** isWearing 이면 장비착용 화면 — 가진 장비만 고를 수 있다 */
export function equipmentMenuOf(career: PlayerCareer, part: number, isWearing = false): MenuItem[] {
  const { ability } = EQUIPMENT_PARTS[part]
  return Array.from({ length: EQUIPMENT_LEVEL_COUNT }, (_unused, level) => {
    const item = equipmentItemOf(part, level)
    const isOpen = isHiddenOpen(career, part, level)
    const isEquipped = career.equipmentLevels[ability] === level + 1
    const bonus = `${ABILITY_NAMES[ability]} +${equipmentBonusOf(level + 1)}`
    const popularity = item.requiredPopularity === 0 ? '인기도 제한 없음' : `인기도 ${item.requiredPopularity} 이상` // StrITEM[184]·[185]
    const state = isEquipped ? '장착 중' : ownsEquipment(career, part, level) ? '보유' : popularity
    return {
      id: shopItemId(isWearing ? '착용' : '장착', part, level),
      label: isOpen ? item.name : '???',
      detail: isOpen ? `${bonus} · ${state}` : stripGameMarkup(item.hiddenHint ?? '').replace(/\n/g, ' '),
      cost: formatMoney(item.price),
      isDisabled: !isOpen || (isWearing && !ownsEquipment(career, part, level)),
    }
  })
}
