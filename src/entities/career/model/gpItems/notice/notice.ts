import { isBugFixed } from '@/shared/config/bugfixes'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import { itemText, NAME_BASE } from '@/entities/career/model/gpItems/catalog'
import { EAGLE_EYE_GAMES } from '@/entities/career/model/gpItems/use/effects'
import { LOTTERY_EFFECT_OF, LOTTERY_MONEY, MONEY_UNIT } from '@/entities/career/model/gpItems/use/lottery'
import { ITEM, type LotteryPrize } from '@/entities/career/model/gpItems/types'

const ABILITY_NAMES = ['히트', '파워', '수비', '주루', '모든능력치']
/**
 * ⚠️ **원본 버그를 그대로 옮긴다** (G 2절 확정 · DECISIONS 2026-09-20):
 * 능력치는 실제로 **+10** 오르는데, 알림 글에는 **칸별 아이템 6 · 엄마의도시락 8** 이라고 찍힌다.
 * 글 = StrMODE[35+k] + " " + 숫자 + " " + StrMODE[83] 이고, 그 숫자 인자가 6·8 로 박혀 있다.
 *
 * **고침(`bugfixes.json` B-45, 기본 켬)**: 글의 숫자를 실제 상승 **10** 으로 — 복권 상 갈래(0xa4868 `movs r1,#0xa`)와 상점 설명
 * StrITEM[165] "능력치 + 10" 이 이미 10 이라 그쪽에 맞췄다. 능력치 · 굴림은 그대로.
 */
const ABILITY_NOTICE_NUMBERS = [6, 6, 6, 6, 8]
const modeText = (index: number): string => ORIGINAL_MODE_TEXT[index] ?? ''
/** StrMODE[83] " 상승하였습니다"(색 마크업) · [116] " 당첨!!!N[" · [117] "] 획득!" · [126] "%d게임 동안 상대 투구…" */
const RISE_TEXT = 83
const LOTTERY_HEAD_TEXT = 116
const LOTTERY_TAIL_TEXT = 117
const EAGLE_EYE_USED_TEXT = 126
/** 아이템 6~8 의 알림 — StrMODE[122] 사기 +40 · [123] 부상 및 질병 치료 · [124] 마이너스 스킬 삭제 (0xa48e2 · 0xa4956 · 0xa49a2) */
const STATIC_NOTICES: Readonly<Record<number, string>> = {
  6: modeText(122),
  7: modeText(123),
  8: modeText(124),
}
/** 상으로 받은 능력치 아이템 알림의 숫자 — 복권 갈래는 0xbc73d 에 **10** 을 넘긴다 (0xa4868 `movs r1,#0xa`, 일반 갈래 6·8 과 다르다) */
const LOTTERY_ABILITY_NOTICE_NUMBER = 10
const LOTTERY_LINE_BREAK = '!N'

/**
 * 이글아이 알림 — 0xa49a6~0xa49e2: 남은 경기 `min(SR+0x54 + 20, 99)` 를 저장하고 그 **새 값**을
 * sprintf(StrMODE[126], 값) 에 끼운다 (`ldrsb r2,[r5]` → 0x1400468). 처음 사면 20, 쌓이면 40 · 60 … 99.
 */
export function eagleEyeNoticeOf(gamesRemaining: number): string {
  return modeText(EAGLE_EYE_USED_TEXT).replace('%d', String(gamesRemaining))
}

function prizeLabelOf(prize: LotteryPrize, prizeItemId: number | undefined): string {
  // 아이템 상의 이름 StrITEM[0x62 + n] — 모드 갈림이 없다 (0xa4720~0xa4730, n 은 0~7 이라 칸 9 이름 갈래를 안 탄다)
  if (typeof prize !== 'number') return itemText(NAME_BASE + (prizeItemId ?? LOTTERY_EFFECT_OF[prize]))
  const amount = LOTTERY_MONEY[prize - 1]
  return amount >= MONEY_UNIT ? `${amount / MONEY_UNIT}억` : `${amount * MONEY_UNIT}만`
}

/**
 * 아이템 상의 뒷줄 — 0xa474e~0xa48ee (직접 떴다). 효과를 그 자리에서 다시 적용하고(일반 갈래와 같은 계산) 글을 잇는다:
 * ```
 * a474e  n ≤ 3 (아차상): StrMODE[0x23 + n](모드 4) / [0x28 + n] + " " + "10" + " " + StrMODE[83]
 * a480c  n == 4 (엄마상): StrMODE[0x27] "모든능력치" + " " + "10" + " " + StrMODE[83]
 * a4888  n == 7 (메디카상): StrMODE[0x7b]
 * a48cc  n == 6 (우정상): StrMODE[0x7a]
 * ```
 */
function lotteryPrizeEffectNoticeOf(texts: GpNoticeTexts, prizeItemId: number): string {
  if (prizeItemId <= ITEM.도시락) {
    return `${texts.abilityNames[prizeItemId] ?? ''} ${LOTTERY_ABILITY_NOTICE_NUMBER} ${modeText(RISE_TEXT)}`
  }
  return STATIC_NOTICES[prizeItemId] ?? ''
}

/**
 * 또또상품권 알림
 * - 돈 상: sprintf("%d등 "(0xd7e08), 등수) + StrMODE[116] + 금액 + StrMODE[117] (0xa4658~0xa46c0)
 * - 아이템 상: StrMODE[0x70 + 칸](118 엄마상 …) + [116] + StrITEM[0x62 + n] + [117] + "!N"(0xd80a4) (0xa46f8~0xa474a)
 *   뒤에 그 아이템의 효과 알림을 잇는다 (0xa474e~0xa48ee — `lotteryPrizeEffectNoticeOf`)
 */
function lotteryNoticeOf(texts: GpNoticeTexts, prize: LotteryPrize, prizeItemId: number | undefined): string {
  const title = typeof prize === 'number' ? `${prize}등 ` : prize
  const head = `${title}${modeText(LOTTERY_HEAD_TEXT)}${prizeLabelOf(prize, prizeItemId)}${modeText(LOTTERY_TAIL_TEXT)}`
  if (typeof prize === 'number') return head
  return `${head}${LOTTERY_LINE_BREAK}${lotteryPrizeEffectNoticeOf(texts, prizeItemId ?? LOTTERY_EFFECT_OF[prize])}`
}

/** 모드로 갈리는 알림 조각 — 능력치 이름 5칸(0~3 + 모든능력치 StrMODE[39]) 과 아이템 9 글 */
export interface GpNoticeTexts {
  readonly abilityNames: readonly string[]
  readonly ninthItemNotice: string
}

/** 사용 알림 — 원문 조각을 이어 붙인다 (StrMODE[35+k]/[40+k]+[83] · [116]/[117] · [122~126]). 상의 아이템 이름은 StrITEM[98+k] */
export function gpItemNoticeWith(texts: GpNoticeTexts, id: number, prize: LotteryPrize | null, prizeItemId?: number): string {
  // 실제 상승은 +10 이지만 글에는 6·8 이 찍힌다 (원본 그대로).
  // 0xa455c~0xa45fe: StrMODE[35+k](투수 40+k · 모든능력치 39) + " "(0xd80bc) + 0xbc73d(6 · 8) + " "(0xd80bc) + StrMODE[83]
  if (id < texts.abilityNames.length) {
    // 고침(B-45): 실제 상승 10 을 쓴다
    const number = isBugFixed('B-45') ? LOTTERY_ABILITY_NOTICE_NUMBER : ABILITY_NOTICE_NUMBERS[id]
    return `${texts.abilityNames[id]} ${number} ${modeText(RISE_TEXT)}`
  }
  if (id === ITEM.또또상품권 && prize !== null) return lotteryNoticeOf(texts, prize, prizeItemId)
  if (id === ITEM.이글아이) return texts.ninthItemNotice
  return STATIC_NOTICES[id] ?? ''
}

/** `eagleEyeGamesRemaining` — 이글아이를 쓴 **뒤** 남은 경기 (알림 [126] 의 %d) */
export function gpItemNoticeOf(
  id: number,
  prize: LotteryPrize | null,
  prizeItemId?: number,
  eagleEyeGamesRemaining: number = EAGLE_EYE_GAMES,
): string {
  return gpItemNoticeWith({ abilityNames: ABILITY_NAMES, ninthItemNotice: eagleEyeNoticeOf(eagleEyeGamesRemaining) }, id, prize, prizeItemId)
}
