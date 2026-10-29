import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'

export const SEASON_SHOP_SLOT_COUNT = 10
/** 0xcbc94 s16[10] — 서브아이템 값 (× 10 = 100만 원 단위). 그림 0xd45f4 와 같은 값 */
const SUB_ITEM_PRICES: readonly number[] = [25, 25, 20, 20, 15, 25, 25, 15, 25, 30]
export const SUB_PRICE_SCALE = 10
/** 0xcbbe3 s8[7] — GP 아이템 값 (× 100 G). 그림 0xd4630 과 같은 값 */
const GP_ITEM_PRICES: readonly number[] = [3, 3, 5, 5, 10, 20, 20]
const GP_PRICE_SCALE = 100
export const SEASON_GP_ITEM_COUNT = GP_ITEM_PRICES.length
/** G 상한 0x1869f */
const GAME_POINT_LIMIT = 99_999
/** 칸 3 십전대보탕 — 0x7d90 이 G 를 안 빼고 투수 고르기 0xe8 로 보낸다 */
export const SEASON_STAMINA_ITEM = 3

/** StrMODE 번호 */
export const SEASON_SHOP_TEXT = {
  이미보유: 78,
  소지금부족: 77,
  소지금확인: 79,
  구매완료: 92,
  G부족: 65,
  트레이드: 176,
  사기최고: 91,
  이글아이최대: 210,
  건강: 208,
  매점사용중: 217,
  G확인: 82,
  이글아이안내: 224,
  스태미나선택: 177,
  스태미나최대: 211,
  스태미나회복: 178,
} as const

export function seasonSubItemPriceOf(slot: number): number {
  return SUB_ITEM_PRICES[slot] ?? 0
}

export function seasonGpItemPriceOf(slot: number): number {
  return (GP_ITEM_PRICES[slot] ?? 0) * GP_PRICE_SCALE
}

export type SeasonShopCheck =
  | { readonly ok: true; readonly question: string }
  /**
   * `asks` — 예/아니오 팝업 (2, 2). G부족 [65] 만 그렇다: 0x98fe~0x9902 가 0xbbef9(this, **2, 2**, 1) 로 띄우고
   * 결과 2 의 "예"(0x7d90 점프표 0xcbdf4[0] → 0x8214)는 G 충전 0xfa 로 간다 — 웹은 서버 기능을 빼 두어(10-24 결정) 예도 닫기만 한다.
   * 다른 가드는 모두 (1, 1) 한 단추 팝업(0x96b8 → 0x96be~0x96c2)이다.
   */
  | { readonly ok: false; readonly notice: string; readonly asks?: boolean }

/** StrMODE 원문 */
export const seasonShopTextOf = (id: number) => ORIGINAL_MODE_TEXT[id] ?? ''

/** 0x55cf5 — 만원 서식 (1억 이상 "%d억" · "%d억%03d") */
export function moneyTextOf(tenThousands: number): string {
  if (tenThousands < 10_000) return String(tenThousands)
  const rest = tenThousands % 10_000
  const head = `${Math.trunc(tenThousands / 10_000)}억`
  return rest === 0 ? head : `${head}${String(rest).padStart(3, '0')}`
}

/** 0x7ff2 — G = clamp(G − g, 0, 99999) */
export function seasonGamePointAfter(gamePoint: number, slot: number): number {
  return Math.min(GAME_POINT_LIMIT, Math.max(0, gamePoint - seasonGpItemPriceOf(slot)))
}

/** 상태 0xe8 키 0x7c00 — 스태미나 +0x2c == 10000 이면 [211] */
export const FULL_PITCHER_STAMINA = 10_000
