import type { RandomPort } from '@/shared/api/random/randomPort'
import { ORIGINAL_ITEMS } from '@/shared/config/original/items'
import { MONEY_LIMIT, MORALE_LIMIT, clampTo } from '@/entities/season-mode/model/seasonRecord'
import { EAGLE_EYE_SLOT, type GpRecord } from '@/entities/season-mode/model/seasonItemShop/gpItemShop'
import { seasonShopTextOf, moneyTextOf } from '@/entities/season-mode/model/seasonItemShop/prices'

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

/** 누적 % 를 넘지 않은 첫 등수 (0~6, 6 이면 꽝) */
function lotteryRankOf(roll: number): number {
  let rank = 0
  while (rank <= 6 && (LOTTERY_CUMULATIVE[rank] ?? 0) * 100 <= roll) rank += 1
  return rank
}

/** 효과 하나 — 글은 "!C" 뒤에 덧붙인다 */
type GpEffect = <R extends GpRecord>(record: R, teamMorale: number, random: RandomPort) => SeasonGpEffect<R>

const raisedMorale = (teamMorale: number) => clampTo(teamMorale + MORALE_GAIN, MORALE_LIMIT)

/** 칸 0 복권 — rand(0, 10000) 한 번 */
const rollLotteryEffect: GpEffect = (record, teamMorale, random) => {
  const roll = random.rand(0, LOTTERY_RANGE)
  const rank = lotteryRankOf(roll)
  if (rank <= LOTTERY_LAST_PRIZE) {
    const prize = LOTTERY_PRIZES[rank] ?? 0
    const text = `!C${rank + 1}등 ${seasonShopTextOf(116)}${moneyTextOf(prize * 100)}${rank !== 0 ? '만' : ''}${seasonShopTextOf(117)}` // "%d등 " + " 당첨…"([116] 앞 빈칸 원문)
    return { record: { ...record, money: clampTo(record.money + prize, MONEY_LIMIT) }, teamMorale, notice: text }
  }
  // 꽝(10%) — "우정상 당첨!! [영지버섯] 획득!" 뒤 영지버섯 효과를 그대로 (0xa3212~0xa3288)
  const text = `!C${seasonShopTextOf(CONSOLATION_TITLE)}${seasonShopTextOf(116)}${ORIGINAL_ITEMS[CONSOLATION_ITEM] ?? ''}${seasonShopTextOf(117)}!N${seasonShopTextOf(122)}`
  return { record, teamMorale: raisedMorale(teamMorale), notice: text }
}

/** 점프표 0xd7d60 — 칸 → 효과. 칸 3 은 여기 오지 않는다 (0xe8 길) — 원본도 글만 "!C" */
const GP_ITEM_EFFECTS: Readonly<Record<number, GpEffect>> = {
  0: rollLotteryEffect,
  1: (record, teamMorale) => ({ record, teamMorale: raisedMorale(teamMorale), notice: `!C${seasonShopTextOf(122)}` }),
  2: (record, teamMorale) => ({
    record: { ...record, illness: 0, illnessSlack: CURED_SLACK, illnessCooldown: CURED_COOLDOWN },
    teamMorale,
    notice: `!C${seasonShopTextOf(123)}`,
  }),
  [EAGLE_EYE_SLOT]: (record, teamMorale) => {
    const games = Math.min(EAGLE_EYE_LIMIT, record.aimVisionGames + EAGLE_EYE_GAMES)
    // %d 는 **늘어난 뒤의 값** (0xa3300 이 SR+0x54 를 다시 읽는다)
    return { record: { ...record, aimVisionGames: games }, teamMorale, notice: `!C${seasonShopTextOf(126).replace('%d', String(games))}` }
  },
  5: (record, teamMorale) => ({ record: { ...record, tradeUsed: 0 }, teamMorale, notice: `!C${seasonShopTextOf(127)}` }),
  6: (record, teamMorale) => ({ record: { ...record, storeGames: STORE_GAMES }, teamMorale, notice: `!C${seasonShopTextOf(128)}` }),
}

/**
 * 효과 0xa310c(SR, k, StrMODE, StrITEM) — 글은 "!C" 로 시작해 칸마다 덧붙인다.
 * 복권(k 0)만 `rand(0, 10000)` 을 한 번 굴린다.
 */
export function applySeasonGpItem<R extends GpRecord>(record: R, teamMorale: number, slot: number, random: RandomPort): SeasonGpEffect<R> {
  const effect = GP_ITEM_EFFECTS[slot]
  if (effect === undefined) return { record, teamMorale, notice: '!C' }
  return effect(record, teamMorale, random)
}
