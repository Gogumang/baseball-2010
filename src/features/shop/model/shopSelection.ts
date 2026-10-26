import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import {
  equipmentBlockReasonOf, equipmentItemOf, EQUIPMENT_PARTS, equipOwned, ownsEquipment, purchaseEquipment,
} from '@/entities/career/model/equipment'
import type { EquipmentBlockReason } from '@/entities/career/model/equipment'
import { purchaseSubItem, SUB_ITEM_BLOCK_TEXT, SUB_ITEMS, subItemBlockReasonOf } from '@/entities/career/model/subItems'
import { BATTER_GP_ITEMS, EAGLE_EYE_ITEM_ID, EAGLE_EYE_NOTICE, gpItemBlockReasonOf, gpItemNoticeOf, purchaseGpItem } from '@/entities/career/model/gpItems'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'

/** 상점 탭 (0x14a74 의 화면+0x1a4 — 3 장착 · 1 서브 · 2 GP) · 선수정보 장비착용(0x17b66) */
export type ShopTab = '장착' | '서브' | 'GP' | '착용'

export function shopItemId(tab: ShopTab, first: number, second = 0): string {
  return `${tab}:${first}:${second}`
}

/**
 * GP 아이템 구매 뒤 상세 결과 창(0x872a1)을 띄우는 칸 — **0~4 · 6** 만 (0x14f28 · 0x15030, 두 모드 공용).
 * 이 칸들은 효과 0xa4488 이 팝업 버퍼 0x1552af4 에 써 둔 알림을 0x15044 가 지우고(0x1400428, 0x200 바이트)
 * 창 글 "[이름] 구매!N효과 : 효과"(0x15096~0x15180)로 바꿔 쓴다 — **알림 팝업은 따로 안 뜬다.**
 * 나머지 5·7·8·9 는 0x15214 `0xbbef9(버퍼, 1, −1, 1)` 로 알림만 띄운다.
 */
export function opensGpDetailWindow(index: number): boolean {
  return index <= 4 || index === 6
}

/** 상세 결과 창 재료 — 줄은 화면(pages/shop)이 세운다. `before` 는 효과 전, `after` 는 효과 뒤 기록 */
export interface GpDetailOf<T> {
  readonly itemIndex: number
  readonly before: T
  readonly after: T
}

export interface ShopSelection {
  readonly career: PlayerCareer
  readonly notice: string
  /** GP 칸 0~4·6 을 샀을 때만 — 창을 닫으면 상점 그대로(콜백 0x1d649 는 닫기만, 굴림 없음) */
  readonly detail?: GpDetailOf<PlayerCareer> | null
  /**
   * 장비 구매가 **새로 연** 히든 k (컬렉터 — 타자 36·40·44·48 / 투수 20·24·28·32). 부르는 쪽이 공용 알림 창에 띄운다
   * (창 차례는 `selectEquipment` 머리말). 없으면 비었거나 빠진다
   */
  readonly openedHiddenIds?: readonly number[]
}

const EQUIPMENT_BLOCK_TEXT: Readonly<Record<Exclude<EquipmentBlockReason, '인기도부족'>, string>> = {
  // 원문 표 그대로 (r216 — 예전엔 !N 을 띄어 쓰고 마크업을 뺀 글이었다)
  미오픈: ORIGINAL_MODE_TEXT[76] ?? '',
  이미보유: ORIGINAL_MODE_TEXT[78] ?? '',
  소지금부족: ORIGINAL_MODE_TEXT[77] ?? '',
}
/**
 * StrMODE[92] 원문 마크업 `!C[!cFFFF00%s!cFFFFFF] 구매 완료` — 서브아이템(kind 1)만 띄운다. 0x14d28 이 `0x702b5(글표, 0x5c)` 로 꺼내
 * 0x14d38 `0x845d5` 이름을 0x1400468(sprintf)로 넣고 0xbbef9(글, 1, 1, 1) → 0x74ef5(창, 글, 1, 0, 0) 로 **그대로** 띄운다(0xbbef8 은
 * 앞에 아무것도 안 붙인다). 시즌 0x7fa6 도 같은 글이다(`seasonItemShop.applySeasonSubItem`). 메인 메뉴 0x30972(상태 36 0x308d8 —
 * 🌐 서버 갈래, 웹에 없음)는 sprintf 없이 %s 째로 띄운다.
 */
export const purchasedText = (name: string) => (ORIGINAL_MODE_TEXT[PURCHASED_TEXT_ID] ?? '').replace('%s', name)
/** StrMODE[92] */
const PURCHASED_TEXT_ID = 92

/** 장비착용 화면 (0x17b66) — 가진 장비만 낄 수 있다 */
function wearEquipment(career: PlayerCareer, part: number, level: number): ShopSelection {
  if (!ownsEquipment(career, part, level)) return { career, notice: '' }
  const isEquipped = career.equipmentLevels[EQUIPMENT_PARTS[part].ability] === level + 1
  if (isEquipped) return { career, notice: ORIGINAL_MODE_TEXT[80] ?? '' } // StrMODE[80]
  // 장착 성공 알림은 없다 — StrMODE 에 그런 문구가 없고, 원본은 확인 팝업(81) 뒤 알림이 따로 없다 (R12-shop-guards.md 5절)
  return { career: equipOwned(career, part, level), notice: '' }
}

/**
 * 상점 장착 탭 (0x13506) — 미오픈 → 보유 → 인기도 → 소지금 순으로 막는다.
 *
 * **장비 구매 확정의 창 차례 — 0x14a74 kind 3 (0x14aaa~0x14c8a, 직접 떴다)**
 * ```
 * 앞가드  [창+9] ≠ 0 · [창+0x248] == 2(구매 확인) · (s8)[창+0x21c] == 0(예)     ; 창은 아직 서 있다(닫힘 애니 중)
 * 14b2c   소지금 −가격×10 (0~9999) · 보유 · 곧바로 장착 니블 · 0x1fded · 0x22755 저장
 * 14ba4   [창+0x21c] = −1                                                    ; 답만 비운다 — 창은 안 닫는다
 * 14bac~  네 부위 0xa5021 참 → 0x62369(ui, 컬렉터 k, 0) → 0x74ef5(창, 글, 종류 1)
 * 14c8a   끝 — StrMODE[92] "구매 완료" 창이 없다
 * ```
 * StrMODE[92] 를 0x702b5 로 꺼내는 곳은 이 함수의 **kind 1 서브아이템 갈래 하나**(0x14d28 → 0xbbef9(글, 1, 1, 1))와 시즌 0x7fa6 ·
 * 메인 메뉴 0x30972 뿐이다(전수, `movs r1,#0x5c` + 0x702b5). 그래서 장비는 구매 완료 창이 **없다**.
 * 0x62368 의 0x74ef4 는 구매 확인 창이 아직 떠 있어([창+9] ≠ 0 — 닫힘 애니 동안도) 글을 **대기 칸**(+0x2a4 = 1 · +0x2a8 글)에
 * 넣고, 확인 창 닫힘이 끝나면 0x754f8 → 0x742a8(닫기) → 0x75440 이 그 글로 창을 다시 세운다. 곧 차례는
 * **구매 확인 창 닫힘 → 히든 오픈 알림 창**(새로 연 컬렉터가 있을 때만)이다.
 */
function selectEquipment(career: PlayerCareer, part: number, level: number): ShopSelection {
  const item = equipmentItemOf(part, level)
  const blockReason = equipmentBlockReasonOf(career, part, level)
  if (blockReason === '인기도부족') {
    return { career, notice: (ORIGINAL_MODE_TEXT[62] ?? '').replace('%d', String(item.requiredPopularity)) } // StrMODE[62] 원문
  }
  if (blockReason !== null) return { career, notice: EQUIPMENT_BLOCK_TEXT[blockReason] }
  const bought = purchaseEquipment(career, part, level)
  // 0x62368 셋째 인자 0 — 이미 열린 k(0x61f5c)는 창을 안 띄운다
  const opened = bought.openedHiddenIds.filter((id) => !career.openedHiddenIds.includes(id))
  return { career: bought, notice: '', openedHiddenIds: opened }
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
  // G 부족(StrMODE[65])이 가장 먼저, 그 다음 아이템별 가드 여섯 (0x13460)
  if (career.gamePoint < price) return null
  if (gpItemBlockReasonOf(career, index) !== null) return null
  // 이글아이는 확인창 앞에 StrMODE[224] 안내줄이 붙는다 (0x13ab4) — 가드가 아니다
  const notice = index === EAGLE_EYE_ITEM_ID ? `!C${EAGLE_EYE_NOTICE}!N` : '!C'
  // StrMODE[82] (0x13966)
  return `${notice}!cFFFF00${price} G포인트!cFFFFFF가 소모됩니다!N구매하시겠습니까?`
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
  // G 부족을 먼저 보고(StrMODE[65]), 그 다음 아이템별 가드 (R12 1b)
  const gpBlock = career.gamePoint < BATTER_GP_ITEMS[index].price ? null : gpItemBlockReasonOf(career, index)
  if (gpBlock !== null) return { career, notice: gpBlock }
  const purchase = purchaseGpItem(career, index, random)
  if (purchase.kind === '거절') return { career, notice: ORIGINAL_MODE_TEXT[65] ?? '' } // StrMODE[65] 원문
  const { result } = purchase
  if (opensGpDetailWindow(index)) {
    return { career: result.career, notice: '', detail: { itemIndex: index, before: career, after: result.career } }
  }
  return {
    career: result.career,
    notice: gpItemNoticeOf(index, result.lotteryPrize, result.prizeItemId, result.career.eagleEyeGamesRemaining),
  }
}
