import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { PITCHER_ABILITY_NAMES } from '@/entities/pitcher-career/model/pitcherAbility'
import {
  PITCHER_EQUIPMENT_PARTS, isPitcherEquipmentEquipped, isPitcherHiddenOpen, ownsPitcherEquipment,
  pitcherEquipmentItemOf,
} from '@/entities/pitcher-career/model/pitcherEquipment'
import { EQUIPMENT_LEVEL_COUNT, equipmentBonusOf } from '@/entities/career/model/equipment'
import { shopItemId } from '@/features/shop/model/shopSelection'
import { pitcherItemBlockNoticeOf } from '@/features/shop/model/pitcherShopSelection'
import type { PitcherShopTab } from '@/features/shop/model/pitcherShopSelection'
import { hasSubItem } from '@/entities/career/model/subItems'
import { PITCHER_GP_ICON_FRAMES, PITCHER_GP_ITEMS, PITCHER_SUB_ITEMS } from '@/entities/pitcher-career/model/pitcherItems'
import { itemDescriptionOf } from '@/pages/shop/lib/shopEntries'
import type { ShopEntry } from '@/pages/shop/lib/shopEntries'
import { itemIconFrameOf } from '@/pages/shop/lib/shopLayout'

/**
 * 투수편 서브아이템(창 종류 1)·GP아이템(창 종류 2) 칸 — 타자편 `shopEntries` 의 sub/gp 와 같은 꼴이고
 * 표만 `pitcherItems.ts` 것이다. 막힘 글은 0x13460 kind 1·2 차례 그대로 칸에 싣는다.
 * 아이콘: 서브는 두 모드 같은 표 0xd463a(= 순번), GP 는 투수 표 0xd4676 (0x82464).
 */
function pitcherItemEntriesOf(career: PitcherCareer, tab: '서브' | 'GP'): readonly ShopEntry[] {
  const items = tab === '서브' ? PITCHER_SUB_ITEMS : PITCHER_GP_ITEMS
  return items.map((item, index) => ({
    id: shopItemId(tab, index),
    name: item.name,
    description: itemDescriptionOf(item.effectText),
    price: item.price,
    iconFrame: tab === '서브' ? itemIconFrameOf('서브', index) : PITCHER_GP_ICON_FRAMES[index],
    isOwned: tab === '서브' && hasSubItem(career, index),
    blockNotice: pitcherItemBlockNoticeOf(career, tab, index),
  }))
}

/**
 * 투수편 장비 상점·장비착용 칸 — 창 종류 3 (서브·GP 탭이면 위 `pitcherItemEntriesOf`). 타자편 `shopEntries.equipmentEntriesOf` 와 같은 꼴이다.
 *
 * 설명 줄도 타자편과 같은 근사다: 원본 창(0x83378)은 효과를 숫자 그림(0xd41ae[sel] = 보너스)으로 찍는데
 * 웹은 아직 그 그림을 안 옮겨 "능력치 +n" 글로 적는다. 능력치 이름은 StrMODE[40+칸] (제구·구속·변화·체력).
 */
export function pitcherShopEntriesOf(career: PitcherCareer, tab: PitcherShopTab, part: number): readonly ShopEntry[] {
  if (tab === '서브' || tab === 'GP') return pitcherItemEntriesOf(career, tab)
  const abilityName = PITCHER_ABILITY_NAMES[part]
  return Array.from({ length: EQUIPMENT_LEVEL_COUNT }, (_unused, level) => {
    const item = pitcherEquipmentItemOf(part, level)
    const isOpen = isPitcherHiddenOpen(career, part, level)
    const isEquipped = isPitcherEquipmentEquipped(career, part, level)
    // 조건 줄 = StrITEM[184] "인기도 제한 없음" / [185] "인기도 %d 이상"
    const condition = item.requiredPopularity === 0 ? '인기도 제한 없음' : `인기도 ${item.requiredPopularity} 이상`
    const effect = `${abilityName} +${equipmentBonusOf(level + 1)}${isEquipped ? ' (장착 중)' : ''}`
    return {
      id: shopItemId(tab, part, level),
      name: isOpen ? item.name : '???',
      // 안 열린 히든 칸은 StrITEM[186~201] 오픈 힌트를 원문 마크업 그대로 (0x841b4)
      description: isOpen ? itemDescriptionOf(effect, condition) : item.hiddenHint ?? '',
      price: item.price,
      iconFrame: null,
      isOwned: ownsPitcherEquipment(career, part, level),
      blockNotice: null,
    }
  })
}

export const PITCHER_PART_NAMES: readonly string[] = PITCHER_EQUIPMENT_PARTS.map((part) => part.name)
