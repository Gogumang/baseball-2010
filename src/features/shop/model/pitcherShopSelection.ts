import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import {
  equipOwnedPitcherEquipment, isPitcherEquipmentEquipped, ownsPitcherEquipment, pitcherEquipmentBlockReasonOf,
  pitcherEquipmentItemOf, pitcherHiddenOpenTextOf, purchasePitcherEquipment,
} from '@/entities/pitcher-career/model/pitcherEquipment'
import type { PitcherEquipmentBlockReason } from '@/entities/pitcher-career/model/pitcherEquipment'
import { formatOriginalMoney } from '@/features/shop/model/shopSelection'

/**
 * 투수편(모드 3) 상점 고르기 — 타자편 `shopSelection` 과 **같은 키 처리**(0x13460 kind 3)·
 * **같은 구매 확정**(0x14a74 kind 3)·**같은 장착 가드**(0x17ad0)를 탄다. 글도 같은 StrMODE 번호다.
 * 다른 것은 표와 이름뿐이라(`pitcherEquipment.ts` 머리글) 규칙은 그대로 두고 투수 커리어로만 옮겼다.
 *
 * 탭은 장비 둘('장착' 상점 · '착용' 장비착용 121)뿐이다 —
 * ⚠️ 투수편 **서브아이템(kind 1)·GP아이템(kind 2)** 은 아직 옮기지 않았다(가격 갈림 `mode==4 ? 10 : 0`,
 * 투수 한계표 0xcc4fa, 십전대보탕 가드 211 등은 R12 1b-다에 있다). 관리 화면이 그 두 칸을 막아 둔다.
 */
export type PitcherShopTab = '장착' | '착용'

export interface PitcherShopSelection {
  readonly career: PitcherCareer
  readonly notice: string
}

const BLOCK_TEXT: Readonly<Record<Exclude<PitcherEquipmentBlockReason, '인기도부족'>, string>> = {
  미오픈: '아직 구매할 수 없는 아이템입니다. 특별한 조건을 통해 오픈됩니다', // StrMODE[76]
  이미보유: '이미 가지고 있는 아이템입니다', // StrMODE[78]
  소지금부족: '소지금이 부족합니다', // StrMODE[77]
}
const purchasedText = (name: string) => `[${name}] 구매 완료` // StrMODE[92]

const parse = (itemId: string) => {
  const [tab, first, second] = itemId.split(':')
  return { tab, part: Number(first), level: Number(second) }
}

/** 막힌 칸이면 그 1버튼 팝업 글, 아니면 null (0x13460 kind 3 의 가드 문구) */
export function pitcherEquipmentBlockNoticeOf(career: PitcherCareer, part: number, level: number): string | null {
  const reason = pitcherEquipmentBlockReasonOf(career, part, level)
  if (reason === null) return null
  if (reason === '인기도부족') {
    // StrMODE[62]
    return `인기도가 부족합니다. 필요한 인기도 : ${pitcherEquipmentItemOf(part, level).requiredPopularity}`
  }
  return BLOCK_TEXT[reason]
}

/** 살 수 있는(끼울 수 있는) 칸이면 확인 문구(원문 마크업), 아니면 null */
export function pitcherPurchaseQuestionOf(career: PitcherCareer, itemId: string): string | null {
  const { tab, part, level } = parse(itemId)
  if (tab === '착용') {
    if (!ownsPitcherEquipment(career, part, level) || isPitcherEquipmentEquipped(career, part, level)) return null
    return `!C[!cFFFF00${pitcherEquipmentItemOf(part, level).name}!cFFFFFF] 아이템을!N장착하시겠습니까?` // StrMODE[81]
  }
  if (pitcherEquipmentBlockReasonOf(career, part, level) !== null) return null
  // StrMODE[79] — %s = 0x55cf4(가격 × 1000 만원)
  const amount = formatOriginalMoney(pitcherEquipmentItemOf(part, level).price)
  return `!C!cFFFF00소지금 ${amount}!cFFFFFF이 소모됩니다!N구매하겠습니까?`
}

/** 상점·장비착용에서 한 칸을 고르고 (확인을 마친 뒤) 결과를 낸다 */
export function selectPitcherShopItem(career: PitcherCareer, itemId: string): PitcherShopSelection {
  const { tab, part, level } = parse(itemId)
  if (tab === '착용') {
    if (!ownsPitcherEquipment(career, part, level)) return { career, notice: '' }
    // 0x17ad0 의 가드는 "지금 장착 중"(StrMODE[80]) 하나뿐이다. 장착 뒤 따로 알림은 없다
    if (isPitcherEquipmentEquipped(career, part, level)) return { career, notice: '현재 장착 중인 장비입니다' }
    return { career: equipOwnedPitcherEquipment(career, part, level), notice: '' }
  }
  const blockNotice = pitcherEquipmentBlockNoticeOf(career, part, level)
  if (blockNotice !== null) return { career, notice: blockNotice }
  const bought = purchasePitcherEquipment(career, part, level)
  const openTexts = bought.openedHiddenIds
    .filter((id) => !career.openedHiddenIds.includes(id))
    .map(pitcherHiddenOpenTextOf)
    .filter((text): text is string => text !== null)
  return { career: bought, notice: [purchasedText(pitcherEquipmentItemOf(part, level).name), ...openTexts].join(' · ') }
}
