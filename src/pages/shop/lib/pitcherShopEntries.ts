import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { shopItemId } from '@/features/shop/model/shopSelection'
import { pitcherItemBlockNoticeOf } from '@/features/shop/model/pitcherShopSelection'
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
    description: itemDescriptionOf(item.descriptionText, item.effectText),
    price: item.price,
    iconFrame: tab === '서브' ? itemIconFrameOf('서브', index) : PITCHER_GP_ICON_FRAMES[index],
    isOwned: tab === '서브' && hasSubItem(career, index),
    blockNotice: pitcherItemBlockNoticeOf(career, tab, index),
  }))
}

/** 투수편 서브·GP 상점 칸. 장비(창 종류 3)는 장비 창 0x83378 이라 `equipmentRows.pitcherEquipmentRowsOf` 가 줄을 만든다 */
export function pitcherShopEntriesOf(career: PitcherCareer, tab: '서브' | 'GP'): readonly ShopEntry[] {
  return pitcherItemEntriesOf(career, tab)
}
