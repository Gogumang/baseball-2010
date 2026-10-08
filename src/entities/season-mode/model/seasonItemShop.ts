import type { RandomPort } from '@/shared/api/random/randomPort'
import { ORIGINAL_ITEMS } from '@/shared/config/original/items'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import { MONEY_LIMIT, MORALE_LIMIT, clampTo } from '@/entities/season-mode/model/seasonRecord'
import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'

/**
 * **시즌 서브아이템 상점(0xdc 창 종류 1) · GP 상점(종류 2)** — 아이템 메뉴 0xd0 칸 2 · 칸 3 (들어옴 0x5f3c).
 * 직접 떴다: 키 0x957c(종류 1 0x97de~0x98a0 · 종류 2 0x98a8~0x9a82) · 적용 0x7d90(결과 0xc → 0x7f2a · 0xd → 0x7ff2) ·
 * 효과 0xa310c(점프표 0xd7d60).
 *
 * ```
 * 종류 1  k = 줄 × 5 + 열 (0xca7b5 · 0xca911)
 *         SR[0x58 + k] ≠ 0                       → StrMODE[78]
 *         p = 0xcbc94[k] ; p × 10 > SR+2 소지금     → StrMODE[77]
 *         StrMODE[79] (%s = 0x55cf5(p × 1000)) 예/아니오 — 결과 0xc
 *   0x7f2a 소지금 = clamp(소지금 − p × 10, 0, 9999) · SR[0x58 + k] = 1 · StrMODE[92](%s = 이름) · 저장
 * 종류 2  k > 6 이면 아무것도 안 한다. g = 0xcbbe3[k] × 100
 *         g > G(app+0x64)                         → StrMODE[65]
 *         k 5: SR+0x56 ≠ 1 → [176] · k 1: 사기 == 100 → [91] · k 4: SR+0x54 > 98 → [210]
 *         k 2: SR+5 == 0 → [208] · k 6: SR+0x55 > 0 → [217]
 *         StrMODE[82] (%d = g) — k 4 만 앞에 [224] + "!N" + "!N" — 예/아니오, 결과 0xd
 *   0x7ff2 k 3 → 상태 0xe8 (G 는 거기서 뺀다, `SEASON_STAMINA_ITEM`)
 *          그 밖: G = clamp(G − g, 0, 99999) · 0x22c29(3, g) · 효과 0xa310c · 0x22e35(2, k) · 저장 · 팝업
 * ```
 */

export const SEASON_SHOP_SLOT_COUNT = 10
/** 0xcbc94 s16[10] — 서브아이템 값 (× 10 = 100만 원 단위). 그림 0xd45f4 와 같은 값 */
const SUB_ITEM_PRICES: readonly number[] = [25, 25, 20, 20, 15, 25, 25, 15, 25, 30]
const SUB_PRICE_SCALE = 10
/** 0xcbbe3 s8[7] — GP 아이템 값 (× 100 G). 그림 0xd4630 과 같은 값 */
const GP_ITEM_PRICES: readonly number[] = [3, 3, 5, 5, 10, 20, 20]
const GP_PRICE_SCALE = 100
export const SEASON_GP_ITEM_COUNT = GP_ITEM_PRICES.length
/** G 상한 0x1869f */
const GAME_POINT_LIMIT = 99_999
/** 칸 3 십전대보탕 — 0x7d90 이 G 를 안 빼고 투수 고르기 0xe8 로 보낸다 */
export const SEASON_STAMINA_ITEM = 3

const TRAINING_SLOTS = 4
const MASSAGER_SLOT = 4

/** StrMODE 번호 */
export const SEASON_SHOP_TEXT = {
  이미보유: 78, 소지금부족: 77, 소지금확인: 79, 구매완료: 92,
  G부족: 65, 트레이드: 176, 사기최고: 91, 이글아이최대: 210, 건강: 208, 매점사용중: 217, G확인: 82, 이글아이안내: 224,
  스태미나선택: 177, 스태미나최대: 211, 스태미나회복: 178,
} as const

type SubRecord = Pick<SeasonRecord, 'money' | 'trainingSubItems' | 'massager' | 'outingSubItems'>

/** SR[0x58 + k] */
export function ownsSeasonShopSubItem(record: SubRecord, slot: number): boolean {
  if (slot < TRAINING_SLOTS) return record.trainingSubItems[slot] ?? false
  if (slot === MASSAGER_SLOT) return record.massager
  return record.outingSubItems[slot - MASSAGER_SLOT - 1] ?? false
}

export function seasonSubItemPriceOf(slot: number): number {
  return SUB_ITEM_PRICES[slot] ?? 0
}

export function seasonGpItemPriceOf(slot: number): number {
  return (GP_ITEM_PRICES[slot] ?? 0) * GP_PRICE_SCALE
}

export type SeasonShopCheck =
  | { readonly ok: true; readonly question: string }
  | { readonly ok: false; readonly notice: string }

const modeText = (id: number) => ORIGINAL_MODE_TEXT[id] ?? ''
/** StrMODE 원문 */
export const seasonShopTextOf = modeText

/** 0x55cf5 — 만원 서식 (1억 이상 "%d억" · "%d억%03d") */
function moneyTextOf(tenThousands: number): string {
  if (tenThousands < 10_000) return String(tenThousands)
  const rest = tenThousands % 10_000
  const head = `${Math.trunc(tenThousands / 10_000)}억`
  return rest === 0 ? head : `${head}${String(rest).padStart(3, '0')}`
}

/** 키 0x957c 종류 1 — 가드 차례 그대로 */
export function checkSeasonSubItem(record: SubRecord, slot: number): SeasonShopCheck {
  if (ownsSeasonShopSubItem(record, slot)) return { ok: false, notice: modeText(SEASON_SHOP_TEXT.이미보유) }
  const price = seasonSubItemPriceOf(slot)
  if (price * SUB_PRICE_SCALE > record.money) return { ok: false, notice: modeText(SEASON_SHOP_TEXT.소지금부족) }
  return { ok: true, question: modeText(SEASON_SHOP_TEXT.소지금확인).replace('%s', moneyTextOf(price * 1000)) }
}

/** 0x7d90 결과 0xc — 새 레코드와 팝업 글 */
export function applySeasonSubItem<R extends SubRecord>(record: R, slot: number): { readonly record: R; readonly notice: string } {
  const money = clampTo(record.money - seasonSubItemPriceOf(slot) * SUB_PRICE_SCALE, MONEY_LIMIT)
  const own = (flags: readonly boolean[], at: number) => flags.map((flag, index) => (index === at ? true : flag))
  const next = slot < TRAINING_SLOTS
    ? { ...record, money, trainingSubItems: own(record.trainingSubItems, slot) }
    : slot === MASSAGER_SLOT
      ? { ...record, money, massager: true }
      : { ...record, money, outingSubItems: own(record.outingSubItems, slot - MASSAGER_SLOT - 1) }
  // 0x845f1(창, k) — 창이 그리는 이름(시즌 StrITEM[0x6d + k])
  const name = ORIGINAL_ITEMS[0x6d + slot] ?? ''
  return { record: next, notice: modeText(SEASON_SHOP_TEXT.구매완료).replace('%s', name) }
}

type GpRecord = Pick<SeasonRecord, 'money' | 'illness' | 'illnessSlack' | 'illnessCooldown' | 'aimVisionGames' | 'storeGames' | 'tradeUsed'>

export interface SeasonGpShopInput {
  readonly record: GpRecord
  /** 팀 레코드 +2 사기 */
  readonly teamMorale: number
  readonly gamePoint: number
}

const EAGLE_EYE_SLOT = 4
const EAGLE_EYE_GUARD = 98

/** 키 0x957c 종류 2 — k > 6 이면 null (아무것도 안 한다) */
export function checkSeasonGpItem(input: SeasonGpShopInput, slot: number): SeasonShopCheck | null {
  if (slot < 0 || slot >= SEASON_GP_ITEM_COUNT) return null
  const price = seasonGpItemPriceOf(slot)
  const refuse = (id: number): SeasonShopCheck => ({ ok: false, notice: modeText(id) })
  if (price > input.gamePoint) return refuse(SEASON_SHOP_TEXT.G부족)
  const { record } = input
  if (slot === 5 && record.tradeUsed !== 1) return refuse(SEASON_SHOP_TEXT.트레이드)
  if (slot === 1 && input.teamMorale === MORALE_LIMIT) return refuse(SEASON_SHOP_TEXT.사기최고)
  if (slot === EAGLE_EYE_SLOT && record.aimVisionGames > EAGLE_EYE_GUARD) return refuse(SEASON_SHOP_TEXT.이글아이최대)
  if (slot === 2 && record.illness === 0) return refuse(SEASON_SHOP_TEXT.건강)
  if (slot === 6 && record.storeGames > 0) return refuse(SEASON_SHOP_TEXT.매점사용중)
  const question = modeText(SEASON_SHOP_TEXT.G확인).replace('%d', String(price))
  // 0x9a2e~0x9a72 — 이글아이만 [224] 뒤에 "!N" 둘을 잇고 확인 글을 붙인다
  return {
    ok: true,
    question: slot === EAGLE_EYE_SLOT ? `${modeText(SEASON_SHOP_TEXT.이글아이안내)}!N!N${question}` : question,
  }
}

/** 0x7ff2 — G = clamp(G − g, 0, 99999) */
export function seasonGamePointAfter(gamePoint: number, slot: number): number {
  return Math.min(GAME_POINT_LIMIT, Math.max(0, gamePoint - seasonGpItemPriceOf(slot)))
}

/** 0xd7cea — 복권 누적 % (× 100) */
const LOTTERY_CUMULATIVE: readonly number[] = [2, 7, 15, 30, 55, 90, 100]
/** 0xd7ce3 — 등수별 상금 (100만 원 단위) */
const LOTTERY_PRIZES: readonly number[] = [100, 50, 20, 10, 5, 2, 0]
const LOTTERY_RANGE = 10_000
/** 꽝 칸 — i > 5 */
const LOTTERY_LAST_PRIZE = 5
/** 0xd7cf1[0] — 치료 뒤 SR+6 */
const CURED_SLACK = 0
const CURED_COOLDOWN = 20
const EAGLE_EYE_GAMES = 20
const EAGLE_EYE_LIMIT = 99
const STORE_GAMES = 45
const MORALE_GAIN = 40
/** 꽝 상품 이름 StrITEM[120] (창+0x1ac 글표) */
const CONSOLATION_ITEM = 120
const CONSOLATION_TITLE = 120

export interface SeasonGpEffect<R> {
  readonly record: R
  readonly teamMorale: number
  /** 0x1400408 팝업 글 */
  readonly notice: string
}

/**
 * 효과 0xa310c(SR, k, StrMODE, StrITEM) — 글은 "!C" 로 시작해 칸마다 덧붙인다.
 * 복권(k 0)만 `rand(0, 10000)` 을 한 번 굴린다.
 */
export function applySeasonGpItem<R extends GpRecord>(
  record: R,
  teamMorale: number,
  slot: number,
  random: RandomPort,
): SeasonGpEffect<R> {
  let text = '!C'
  const raiseMorale = () => clampTo(teamMorale + MORALE_GAIN, MORALE_LIMIT)
  switch (slot) {
    case 0: {
      const roll = random.rand(0, LOTTERY_RANGE)
      let rank = 0
      while (rank <= 6 && (LOTTERY_CUMULATIVE[rank] ?? 0) * 100 <= roll) rank += 1
      if (rank <= LOTTERY_LAST_PRIZE) {
        const prize = LOTTERY_PRIZES[rank] ?? 0
        text += `${rank + 1}등 ${modeText(116)}${moneyTextOf(prize * 100)}${rank !== 0 ? '만' : ''}${modeText(117)}`
        return { record: { ...record, money: clampTo(record.money + prize, MONEY_LIMIT) }, teamMorale, notice: text }
      }
      // 꽝(10%) — "우정상 당첨!! [영지버섯] 획득!" 뒤 영지버섯 효과를 그대로 (0xa3212~0xa3288)
      text += `${modeText(CONSOLATION_TITLE)}${modeText(116)}${ORIGINAL_ITEMS[CONSOLATION_ITEM] ?? ''}${modeText(117)}!N${modeText(122)}`
      return { record, teamMorale: raiseMorale(), notice: text }
    }
    case 1:
      return { record, teamMorale: raiseMorale(), notice: text + modeText(122) }
    case 2:
      return {
        record: { ...record, illness: 0, illnessSlack: CURED_SLACK, illnessCooldown: CURED_COOLDOWN },
        teamMorale,
        notice: text + modeText(123),
      }
    case EAGLE_EYE_SLOT: {
      const games = Math.min(EAGLE_EYE_LIMIT, record.aimVisionGames + EAGLE_EYE_GAMES)
      // %d 는 **늘어난 뒤의 값** (0xa3300 이 SR+0x54 를 다시 읽는다)
      return { record: { ...record, aimVisionGames: games }, teamMorale, notice: text + modeText(126).replace('%d', String(games)) }
    }
    case 5:
      return { record: { ...record, tradeUsed: 0 }, teamMorale, notice: text + modeText(127) }
    case 6:
      return { record: { ...record, storeGames: STORE_GAMES }, teamMorale, notice: text + modeText(128) }
    default:
      // 칸 3 은 여기 오지 않는다 (0xe8 길) — 원본도 글만 "!C"
      return { record, teamMorale, notice: text }
  }
}

/** 상태 0xe8 키 0x7c00 — 스태미나 +0x2c == 10000 이면 [211] */
export const FULL_PITCHER_STAMINA = 10_000
