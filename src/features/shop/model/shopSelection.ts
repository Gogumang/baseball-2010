import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import {
  equipmentBlockReasonOf, equipmentItemOf, EQUIPMENT_PARTS, equipOwned, hiddenOpenTextOf, ownsEquipment, purchaseEquipment,
} from '@/entities/career/model/equipment'
import type { EquipmentBlockReason } from '@/entities/career/model/equipment'
import { purchaseSubItem, SUB_ITEM_BLOCK_TEXT, SUB_ITEMS, subItemBlockReasonOf } from '@/entities/career/model/subItems'
import { BATTER_GP_ITEMS, gpItemNoticeOf, purchaseGpItem } from '@/entities/career/model/gpItems'
import type { RandomPort } from '@/shared/api/random/randomPort'

/** 상점 탭 (0x14a74 의 화면+0x1a4 — 3 장착 · 1 서브 · 2 GP) · 선수정보 장비착용(0x17b66) */
export type ShopTab = '장착' | '서브' | 'GP' | '착용'

export function shopItemId(tab: ShopTab, first: number, second = 0): string {
  return `${tab}:${first}:${second}`
}

export interface ShopSelection {
  readonly career: PlayerCareer
  readonly notice: string
}

const EQUIPMENT_BLOCK_TEXT: Readonly<Record<Exclude<EquipmentBlockReason, '인기도부족'>, string>> = {
  미오픈: '아직 구매할 수 없는 아이템입니다. 특별한 조건을 통해 오픈됩니다', // StrMODE[76]
  이미보유: '이미 가지고 있는 아이템입니다', // StrMODE[78]
  소지금부족: '소지금이 부족합니다', // StrMODE[77]
}
const purchasedText = (name: string) => `[${name}] 구매 완료` // StrMODE[92]

/** 장비착용 화면 (0x17b66) — 가진 장비만 낄 수 있다 */
function wearEquipment(career: PlayerCareer, part: number, level: number): ShopSelection {
  if (!ownsEquipment(career, part, level)) return { career, notice: '' }
  const isEquipped = career.equipmentLevels[EQUIPMENT_PARTS[part].ability] === level + 1
  if (isEquipped) return { career, notice: '현재 장착 중인 장비입니다' } // StrMODE[80]
  return { career: equipOwned(career, part, level), notice: '해당 장비를 장착 했습니다' } // StrMODE[142]
}

/** 상점 장착 탭 (0x13506) — 미오픈 → 보유 → 인기도 → 소지금 순으로 막는다 */
function selectEquipment(career: PlayerCareer, part: number, level: number): ShopSelection {
  const item = equipmentItemOf(part, level)
  const blockReason = equipmentBlockReasonOf(career, part, level)
  if (blockReason === '인기도부족') {
    return { career, notice: `인기도가 부족합니다. 필요한 인기도 : ${item.requiredPopularity}` } // StrMODE[62]
  }
  if (blockReason !== null) return { career, notice: EQUIPMENT_BLOCK_TEXT[blockReason] }
  const bought = purchaseEquipment(career, part, level)
  const opened = bought.openedHiddenIds.filter((id) => !career.openedHiddenIds.includes(id))
  const openTexts = opened.map(hiddenOpenTextOf).filter((text): text is string => text !== null)
  return { career: bought, notice: [purchasedText(item.name), ...openTexts].join(' · ') }
}

const TEN_THOUSAND = 10_000

/** 만원 값 → "1억5000만" */
export function formatMoney(amount: number): string {
  const hundredMillions = Math.trunc(amount / TEN_THOUSAND)
  const rest = amount % TEN_THOUSAND
  if (hundredMillions === 0) return `${rest}만`
  return rest === 0 ? `${hundredMillions}억` : `${hundredMillions}억${rest}만`
}

const HUNDRED_MILLION = 10_000

/** 원본 금액 서식 0x55cf4 — 9999 이하 "%d", 1억 이상 "%d억" 또는 "%d억%03d" (만원 단위, "만" 없음 — 점검 12차) */
export function formatOriginalMoney(amount: number): string {
  if (amount < HUNDRED_MILLION) return String(amount)
  const hundredMillions = Math.trunc(amount / HUNDRED_MILLION)
  const rest = amount % HUNDRED_MILLION
  return rest === 0 ? `${hundredMillions}억` : `${hundredMillions}억${String(rest).padStart(3, '0')}`
}

const moneyQuestion = (amount: number) =>
  `!C!cFFFF00소지금 ${formatOriginalMoney(amount)}!cFFFFFF이 소모됩니다!N구매하겠습니까?` // StrMODE[79]

/** 살 수 있는 칸이면 구매 확인 문구(원문 마크업), 아니면 null (막힘 알림·다시 끼기는 묻지 않는다) */
export function purchaseQuestionOf(career: PlayerCareer, itemId: string): string | null {
  const [tab, first, second] = itemId.split(':')
  const index = Number(first)
  if (tab === '착용') {
    const level = Number(second)
    const isEquipped = career.equipmentLevels[EQUIPMENT_PARTS[index].ability] === level + 1
    if (!ownsEquipment(career, index, level) || isEquipped) return null
    return `!C[!cFFFF00${equipmentItemOf(index, level).name}!cFFFFFF] 아이템을!N장착하시겠습니까?` // StrMODE[81]
  }
  if (tab === '장착') {
    const level = Number(second)
    if (equipmentBlockReasonOf(career, index, level) !== null) return null
    return moneyQuestion(equipmentItemOf(index, level).price)
  }
  if (tab === '서브') {
    if (subItemBlockReasonOf(career, index) !== null) return null
    return moneyQuestion(SUB_ITEMS[index].price)
  }
  const price = BATTER_GP_ITEMS[index].price
  // StrMODE[82] (0x13966)
  return career.gamePoint < price ? null : `!C!cFFFF00${price} G포인트!cFFFFFF가 소모됩니다!N구매하시겠습니까?`
}

/** 상점에서 한 칸을 고르고 (구매라면 확인을 마친 뒤) 결과를 낸다 */
export function selectShopItem(career: PlayerCareer, itemId: string, random: RandomPort): ShopSelection {
  const [tab, first, second] = itemId.split(':')
  const index = Number(first)
  if (tab === '장착') return selectEquipment(career, index, Number(second))
  if (tab === '착용') return wearEquipment(career, index, Number(second))
  if (tab === '서브') {
    const blockReason = subItemBlockReasonOf(career, index)
    if (blockReason !== null) return { career, notice: SUB_ITEM_BLOCK_TEXT[blockReason] }
    return { career: purchaseSubItem(career, index), notice: purchasedText(SUB_ITEMS[index].name) }
  }
  const purchase = purchaseGpItem(career, index, random)
  if (purchase.kind === '거절') return { career, notice: 'G포인트가 부족합니다' }
  const { result } = purchase
  return { career: result.career, notice: gpItemNoticeOf(index, result.lotteryPrize, result.prizeItemId) }
}
