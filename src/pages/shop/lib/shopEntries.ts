import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { SUB_ITEMS, SUB_ITEM_BLOCK_TEXT, hasSubItem, subItemBlockReasonOf } from '@/entities/career/model/subItems'
import { BATTER_GP_ITEMS, gpItemBlockReasonOf } from '@/entities/career/model/gpItems'
import {
  EQUIPMENT_LEVEL_COUNT, EQUIPMENT_PARTS, equipmentBonusOf, equipmentItemOf, isHiddenOpen, ownsEquipment,
} from '@/entities/career/model/equipment'
import { shopItemId } from '@/features/shop/model/shopSelection'
import type { ShopTab } from '@/features/shop/model/shopSelection'
import { itemIconFrameOf } from '@/pages/shop/lib/shopLayout'
import type { ShopWindowKindName } from '@/pages/shop/lib/shopLayout'

/**
 * 아이템 창(0x81dc0)의 격자 한 칸.
 * 이름은 딱지 박스 3, 설명은 박스 4, 값은 박스 5 에 들어간다.
 */
export interface ShopEntry {
  /** `shopItemId` 가 만든 구매 식별자 */
  readonly id: string
  readonly name: string
  /** 설명 박스 4 에 그릴 원문 마크업 (0x82400 조립) */
  readonly description: string
  /** 값 박스 5 — 서브·장비는 만원, GP 는 G포인트 */
  readonly price: number
  readonly iconFrame: number | null
  readonly isOwned: boolean
  /**
   * 가드에 걸린 칸이면 그 안내 문구. 원본은 0x13460 이 여기서 **1버튼 팝업만 띄우고 사지 않는다**.
   * 장비(종류 3)는 막힘 문구가 features/shop 안에만 있어서 지금처럼 부모(`onPurchase`)가 만들게 두고
   * 여기서는 null 로 둔다 — 규칙을 두 군데 적지 않으려는 것이다.
   */
  readonly blockNotice: string | null
}

/** 아이템 설명 줄 조립 0x82400 (Q3 N-2) — 조건 줄 뒤에 `!N효과 : !cFFFF00` + 효과 문구 */
export function itemDescriptionOf(effectText: string, conditionText = ''): string {
  const effectLine = `효과 : !cFFFF00${effectText}`
  return conditionText === '' ? effectLine : `${conditionText}!N${effectLine}`
}

/** 서브아이템 상점 — 창 종류 1 (R12 1b-나: 보유 → 소지금) */
function subEntriesOf(career: PlayerCareer): readonly ShopEntry[] {
  return SUB_ITEMS.map((item, index) => {
    const blockReason = subItemBlockReasonOf(career, index)
    return {
      id: shopItemId('서브', index),
      name: item.name,
      description: itemDescriptionOf(item.effectText),
      price: item.price,
      iconFrame: itemIconFrameOf('서브', index),
      isOwned: hasSubItem(career, item.id),
      blockNotice: blockReason === null ? null : SUB_ITEM_BLOCK_TEXT[blockReason],
    }
  })
}

/** G 부족 StrMODE[65] — `selectShopItem` 이 내는 문구와 같은 글이어야 두 길의 팝업이 안 갈린다 */
const NOT_ENOUGH_GAME_POINT = 'G포인트가 부족합니다'

/** GP아이템 상점 — 창 종류 2 (R12 1b-다: G부족이 가장 먼저, 그 다음 아이템별 가드 여섯) */
function gpEntriesOf(career: PlayerCareer): readonly ShopEntry[] {
  return BATTER_GP_ITEMS.map((item, index) => ({
    id: shopItemId('GP', index),
    name: item.name,
    description: itemDescriptionOf(item.effectText),
    price: item.price,
    iconFrame: itemIconFrameOf('GP', index),
    isOwned: false,
    blockNotice: career.gamePoint < item.price ? NOT_ENOUGH_GAME_POINT : gpItemBlockReasonOf(career, index),
  }))
}

const ABILITY_NAMES = { hit: '히트', power: '파워', defense: '수비', run: '주루' } as const

/**
 * 장비 상점·장비착용 — 창 종류 3.
 * 한 부위에 레벨이 11 칸인데 프레임 34 격자는 10 칸이라 **격자를 한 행씩 굴려서** 3행을 담는다 (근사).
 * 원본 장비 창은 `[win+0x198]` 목록의 행이 부위, `sel` 이 0~10 칸이라(R12 1b-가) 격자 모양이 아직 안 잡혔다.
 */
function equipmentEntriesOf(career: PlayerCareer, part: number, isWearing: boolean): readonly ShopEntry[] {
  const { ability } = EQUIPMENT_PARTS[part]
  return Array.from({ length: EQUIPMENT_LEVEL_COUNT }, (_unused, level) => {
    const item = equipmentItemOf(part, level)
    const isOpen = isHiddenOpen(career, part, level)
    const isEquipped = career.equipmentLevels[ability] === level + 1
    // 조건 줄 = StrITEM[184] "인기도 제한 없음" / [185] "인기도 %d 이상" (R12 4-3 과 같은 두 줄)
    const condition = item.requiredPopularity === 0 ? '인기도 제한 없음' : `인기도 ${item.requiredPopularity} 이상`
    const effect = `${ABILITY_NAMES[ability]} +${equipmentBonusOf(level + 1)}${isEquipped ? ' (장착 중)' : ''}`
    return {
      id: shopItemId(isWearing ? '착용' : '장착', part, level),
      name: isOpen ? item.name : '???',
      // 안 열린 히든 칸은 StrITEM[202~217] 오픈 힌트를 원문 마크업 그대로 보여 준다
      description: isOpen ? itemDescriptionOf(effect, condition) : item.hiddenHint ?? '',
      price: item.price,
      iconFrame: null,
      isOwned: ownsEquipment(career, part, level),
      blockNotice: null,
    }
  })
}

export interface ShopEntryRequest {
  readonly tab: ShopTab
  readonly career: PlayerCareer
  /** 장비 상점에서 고른 부위 (0~3). 서브·GP 는 안 쓴다 */
  readonly part: number
}

export function shopEntriesOf({ tab, career, part }: ShopEntryRequest): readonly ShopEntry[] {
  if (tab === '서브') return subEntriesOf(career)
  if (tab === 'GP') return gpEntriesOf(career)
  return equipmentEntriesOf(career, part, tab === '착용')
}

/** 창 종류 이름 — 배치·머리 그림을 고르는 데 쓴다 */
export function windowKindNameOf(tab: ShopTab): ShopWindowKindName {
  return tab === '서브' || tab === 'GP' ? tab : tab === '착용' ? '착용' : '장착'
}
