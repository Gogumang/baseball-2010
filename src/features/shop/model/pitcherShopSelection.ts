import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import {
  equipOwnedPitcherEquipment, isPitcherEquipmentEquipped, ownsPitcherEquipment, pitcherEquipmentBlockReasonOf,
  pitcherEquipmentItemOf, purchasePitcherEquipment,
} from '@/entities/pitcher-career/model/pitcherEquipment'
import type { PitcherEquipmentBlockReason } from '@/entities/pitcher-career/model/pitcherEquipment'
// StrMODE[92] — 서브아이템(kind 1)만 띄운다 (0x14d28). 장비(kind 3)는 구매 완료 창이 없다 (창 차례는 `shopSelection` 의 `selectEquipment` 머리말)
import { formatOriginalMoney, opensGpDetailWindow, purchasedText } from '@/features/shop/model/shopSelection'
import type { GpDetailOf } from '@/features/shop/model/shopSelection'
import { SUB_ITEM_BLOCK_TEXT, purchaseSubItem, subItemBlockReasonOf } from '@/entities/career/model/subItems'
import {
  PITCHER_GP_ITEMS,
  PITCHER_SUB_ITEMS,
  pitcherGpItemBlockReasonOf,
  pitcherGpItemNoticeOf,
  purchasePitcherGpItem,
} from '@/entities/pitcher-career/model/pitcherItems'
import type { RandomPort } from '@/shared/api/random/randomPort'

/**
 * 투수편(모드 3) 상점 고르기 — 타자편 `shopSelection` 과 **같은 키 처리**(0x13460 kind 1·2·3)·
 * **같은 구매 확정**(0x14a74 kind 1·2·3)·**같은 장착 가드**(0x17ad0)를 탄다. 글도 같은 StrMODE 번호다.
 * 다른 것은 표와 이름뿐이라(`pitcherEquipment.ts` · `pitcherItems.ts` 머리글) 규칙은 그대로 두고 투수 커리어로만 옮겼다.
 *
 * 탭: '장착' 장비 상점(111, kind 3) · '서브' 서브아이템(kind 1) · 'GP' GP아이템(kind 2) · '착용' 장비착용(121).
 */
export type PitcherShopTab = '장착' | '서브' | 'GP' | '착용'

export interface PitcherShopSelection {
  readonly career: PitcherCareer
  readonly notice: string
  /** GP 칸 0~4·6 — 타자편과 같은 상세 결과 창 (0x14a74 모드 공용, `opensGpDetailWindow`) */
  readonly detail?: GpDetailOf<PitcherCareer> | null
  /** 장비 구매가 새로 연 히든 k (컬렉터 20·24·28·32) — 공용 알림 창에 띄운다 (창 차례는 `shopSelection` 의 `selectEquipment` 머리말) */
  readonly openedHiddenIds?: readonly number[]
}

const BLOCK_TEXT: Readonly<Record<Exclude<PitcherEquipmentBlockReason, '인기도부족'>, string>> = {
  // 원문 표 그대로 (r216 — 예전엔 !N 을 띄어 쓰고 마크업을 뺀 글이었다)
  미오픈: ORIGINAL_MODE_TEXT[76] ?? '',
  이미보유: ORIGINAL_MODE_TEXT[78] ?? '',
  소지금부족: ORIGINAL_MODE_TEXT[77] ?? '',
}

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
    return (ORIGINAL_MODE_TEXT[62] ?? '').replace('%d', String(pitcherEquipmentItemOf(part, level).requiredPopularity)) // StrMODE[62] 원문
  }
  return BLOCK_TEXT[reason]
}

/** StrMODE[79] — %s = 0x55cf4(가격 × 1000 만원) */
const moneyQuestion = (amount: number) =>
  `!C!cFFFF00소지금 ${formatOriginalMoney(amount)}!cFFFFFF이 소모됩니다!N구매하겠습니까?`

/** G 부족 StrMODE[65] — 타자편 상점과 같은 글 (`shopEntries` 의 칸 막힘 글과 같아야 두 길의 팝업이 안 갈린다) */
export const NOT_ENOUGH_GAME_POINT_TEXT = 'G포인트가 부족합니다'

/** 서브·GP 칸의 막힘 글 (0x13460 kind 1·2 차례 그대로) — 없으면 null */
export function pitcherItemBlockNoticeOf(career: PitcherCareer, tab: '서브' | 'GP', index: number): string | null {
  if (tab === '서브') {
    const reason = subItemBlockReasonOf(career, index)
    return reason === null ? null : SUB_ITEM_BLOCK_TEXT[reason]
  }
  // G 부족(StrMODE[65])이 가장 먼저, 그 다음 아이템별 가드 (R12 1b-다)
  if (career.gamePoint < PITCHER_GP_ITEMS[index].price) return NOT_ENOUGH_GAME_POINT_TEXT
  return pitcherGpItemBlockReasonOf(career, index)
}

/** 살 수 있는(끼울 수 있는) 칸이면 확인 문구(원문 마크업), 아니면 null */
export function pitcherPurchaseQuestionOf(career: PitcherCareer, itemId: string): string | null {
  const { tab, part, level } = parse(itemId)
  if (tab === '서브' || tab === 'GP') {
    if (pitcherItemBlockNoticeOf(career, tab, part) !== null) return null
    if (tab === '서브') return moneyQuestion(PITCHER_SUB_ITEMS[part].price)
    // StrMODE[82] — 투수 칸 9(십전대보탕)에는 이글아이 안내줄 224 가 안 붙는다 (0x13ab4 는 모드 4 일 때만)
    return `!C!cFFFF00${PITCHER_GP_ITEMS[part].price} G포인트!cFFFFFF가 소모됩니다!N구매하시겠습니까?`
  }
  if (tab === '착용') {
    if (!ownsPitcherEquipment(career, part, level) || isPitcherEquipmentEquipped(career, part, level)) return null
    return `!C[!cFFFF00${pitcherEquipmentItemOf(part, level).name}!cFFFFFF] 아이템을!N장착하시겠습니까?` // StrMODE[81]
  }
  if (pitcherEquipmentBlockReasonOf(career, part, level) !== null) return null
  return moneyQuestion(pitcherEquipmentItemOf(part, level).price)
}

/**
 * 상점·장비착용에서 한 칸을 고르고 (확인을 마친 뒤) 결과를 낸다.
 * `random` 은 GP 아이템 5 또또상품권(0xa4604 bfa55(0,10000) · 아차상 bfa55(0,4))만 쓴다.
 */
export function selectPitcherShopItem(career: PitcherCareer, itemId: string, random: RandomPort): PitcherShopSelection {
  const { tab, part, level } = parse(itemId)
  if (tab === '서브') {
    const blockNotice = pitcherItemBlockNoticeOf(career, '서브', part)
    if (blockNotice !== null) return { career, notice: blockNotice }
    // 0x14c8c — 소지금 −가격×10(0~9999) · 기록[0x58+k] = 1 · StrMODE[92]
    return { career: purchaseSubItem(career, part), notice: purchasedText(PITCHER_SUB_ITEMS[part].name) }
  }
  if (tab === 'GP') {
    const blockNotice = pitcherItemBlockNoticeOf(career, 'GP', part)
    if (blockNotice !== null) return { career, notice: blockNotice }
    const purchase = purchasePitcherGpItem(career, part, random)
    if (purchase.kind === '거절') return { career, notice: NOT_ENOUGH_GAME_POINT_TEXT }
    const { result } = purchase
    if (opensGpDetailWindow(part)) {
      return { career: result.career, notice: '', detail: { itemIndex: part, before: career, after: result.career } }
    }
    return { career: result.career, notice: pitcherGpItemNoticeOf(part, result.lotteryPrize, result.prizeItemId) }
  }
  if (tab === '착용') {
    if (!ownsPitcherEquipment(career, part, level)) return { career, notice: '' }
    // 0x17ad0 의 가드는 "지금 장착 중"(StrMODE[80]) 하나뿐이다. 장착 뒤 따로 알림은 없다
    if (isPitcherEquipmentEquipped(career, part, level)) return { career, notice: ORIGINAL_MODE_TEXT[80] ?? '' } // StrMODE[80] 원문
    return { career: equipOwnedPitcherEquipment(career, part, level), notice: '' }
  }
  const blockNotice = pitcherEquipmentBlockNoticeOf(career, part, level)
  if (blockNotice !== null) return { career, notice: blockNotice }
  const bought = purchasePitcherEquipment(career, part, level)
  // 0x14a74 kind 3 — 구매 완료 창 없이 새로 연 컬렉터 k 만 (0x62368 셋째 인자 0 이라 이미 열린 k 는 창이 없다)
  const opened = bought.openedHiddenIds.filter((id) => !career.openedHiddenIds.includes(id))
  return { career: bought, notice: '', openedHiddenIds: opened }
}
