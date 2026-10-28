import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { SUB_ITEMS, SUB_ITEM_BLOCK_TEXT, hasSubItem, subItemBlockReasonOf } from '@/entities/career/model/subItems'
import { BATTER_GP_ITEMS, gpItemBlockReasonOf } from '@/entities/career/model/gpItems'
import { shopItemId } from '@/features/shop/model/shopSelection'
import { NOT_ENOUGH_GAME_POINT_TEXT } from '@/features/shop/model/pitcherShopSelection'
import type { ShopTab } from '@/features/shop/model/shopSelection'
import { itemIconFrameOf } from '@/pages/shop/lib/shopLayout'
import type { ShopWindowKindName } from '@/pages/shop/lib/shopLayout'

/**
 * 서브·GP 아이템 창(0x81dc0)의 격자 한 칸.
 * 이름은 딱지 박스 3, 설명은 박스 4, 값은 박스 5 에 들어간다.
 */
export interface ShopEntry {
  /** `shopItemId` 가 만든 구매 식별자 */
  readonly id: string
  readonly name: string
  /** 설명 박스 4 에 그릴 원문 마크업 (0x82400 조립) */
  readonly description: string
  /** 값 박스 5 — 서브는 만원, GP 는 G포인트 */
  readonly price: number
  /** item_icon 그림 번호 */
  readonly iconFrame: number | null
  readonly isOwned: boolean
  /**
   * 가드에 걸린 칸이면 그 안내 문구. 원본은 0x13460 이 여기서 **1버튼 팝업만 띄우고 사지 않는다**.
   */
  readonly blockNotice: string | null
  /**
   * 막힘 팝업이 예/아니오(2, 2)인가 — GP 칸의 G 부족 [65] 만 그렇다(0x1378c~0x137a4 → 0x1371c → 0x13b0c 0xbbef9(글, 2, 2, 1)).
   * 다른 가드는 (1, 1) 한 단추(0x139a0~0x139a8). 예는 원본에서 G 충전이지만 웹은 서버 기능을 빼 두어 두 답 모두 닫는다.
   */
  readonly blockAsks?: boolean
}

/**
 * 아이템 설명 조립 — 창 0x81dc0 이 칸마다 0x82400 을 돌며 지은 글 (나만의리그 갈래 0x82890~0x82b6e, 직접 떴다):
 * `"!cFFFFFF"(0xcc260) + 설명(StrITEM) + "!N효과 : !cFFFF00"(0xcc9f0) + 효과(StrITEM)` — 설명 · 효과 모두 원문 `!N` 그대로.
 * 시즌 갈래(`widgets/season/lib/seasonSubItems`)와 같은 꼴이다.
 */
export function itemDescriptionOf(descriptionText: string, effectText: string): string {
  return `!cFFFFFF${descriptionText}!N효과 : !cFFFF00${effectText}`
}

/** 서브아이템 상점 — 창 종류 1 (R12 1b-나: 보유 → 소지금) */
function subEntriesOf(career: PlayerCareer): readonly ShopEntry[] {
  return SUB_ITEMS.map((item, index) => {
    const blockReason = subItemBlockReasonOf(career, index)
    return {
      id: shopItemId('서브', index),
      name: item.name,
      description: itemDescriptionOf(item.descriptionText, item.effectText),
      price: item.price,
      iconFrame: itemIconFrameOf('서브', index),
      isOwned: hasSubItem(career, item.id),
      blockNotice: blockReason === null ? null : SUB_ITEM_BLOCK_TEXT[blockReason],
    }
  })
}

/** GP아이템 상점 — 창 종류 2 (R12 1b-다: G부족이 가장 먼저, 그 다음 아이템별 가드 여섯) */
function gpEntriesOf(career: PlayerCareer): readonly ShopEntry[] {
  return BATTER_GP_ITEMS.map((item, index) => ({
    id: shopItemId('GP', index),
    name: item.name,
    description: itemDescriptionOf(item.descriptionText, item.effectText),
    price: item.price,
    iconFrame: itemIconFrameOf('GP', index),
    isOwned: false,
    blockNotice: career.gamePoint < item.price ? NOT_ENOUGH_GAME_POINT_TEXT : gpItemBlockReasonOf(career, index),
    blockAsks: career.gamePoint < item.price,
  }))
}

export interface ShopEntryRequest {
  readonly tab: '서브' | 'GP'
  readonly career: PlayerCareer
}

/**
 * 서브·GP 상점(창 종류 1·2)의 열 칸. 장비(종류 3)는 격자가 아니라 장비 창 0x83378 이라
 * `equipmentRows.batterEquipmentRowsOf` 가 줄을 만든다.
 */
export function shopEntriesOf({ tab, career }: ShopEntryRequest): readonly ShopEntry[] {
  return tab === '서브' ? subEntriesOf(career) : gpEntriesOf(career)
}

/** 창 종류 이름 — 배치·머리 그림을 고르는 데 쓴다 */
export function windowKindNameOf(tab: ShopTab): ShopWindowKindName {
  return tab === '서브' || tab === 'GP' ? tab : tab === '착용' ? '착용' : '장착'
}
