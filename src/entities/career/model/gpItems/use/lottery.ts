import type { RandomPort } from '@/shared/api/random/randomPort'
import { applyEffect } from '@/entities/career/model/gpItems/use/effects'
import type { GpItemCareer, GpItemResultOf, GpItemRules, LotteryPrize } from '@/entities/career/model/gpItems/types'

/** 누적 기준 (% × 100) — 누적 확률 표 0xd80b1 */
const LOTTERY_THRESHOLDS = [2, 5, 10, 20, 40, 70, 71, 75, 85, 100].map((percent) => percent * 100)
const LOTTERY_PRIZES: readonly LotteryPrize[] = [1, 2, 3, 4, 5, 6, '엄마상', '메디카상', '우정상', '아차상']
/** 1~6등 상금 (100만원, 표 0xd80a7) — 웹판 소지금은 만원 */
export const LOTTERY_MONEY = [100, 50, 20, 10, 5, 2]
export const MONEY_UNIT = 100
const MAXIMUM_MONEY = 9999 * MONEY_UNIT
const MAXIMUM_LOTTERY_PURCHASES = 200
const LOTTERY_ROLL_RANGE = 10_000
/** 아차상 — bfa55(0,4) = 능력치 아이템 0~3 (0xa46ec) */
const RANDOM_ABILITY_ITEM_COUNT = 4
/** 엄마상 = 도시락 4 · 메디카상 = 종합건강진단 7 · 우정상 = 영지버섯 6 */
export const LOTTERY_EFFECT_OF: Readonly<Record<string, number>> = { 엄마상: 4, 메디카상: 7, 우정상: 6 }

export function lotteryPrizeOf(roll: number): LotteryPrize {
  const index = LOTTERY_THRESHOLDS.findIndex((threshold) => roll < threshold)
  return LOTTERY_PRIZES[index < 0 ? LOTTERY_PRIZES.length - 1 : index]
}

/** 아이템 상의 효과 번호 — 아차상만 능력치 아이템 0~3 을 굴린다 */
function rollPrizeItemId(prize: Exclude<LotteryPrize, number>, random: RandomPort): number {
  if (prize !== '아차상') return LOTTERY_EFFECT_OF[prize]
  return random.rand(0, RANDOM_ABILITY_ITEM_COUNT)
}

/** 또또상품권(5) — 기록 +0x185(1등)·+0x186(구매, 상한 200) */
export function drawLottery<T extends GpItemCareer>(rules: GpItemRules<T>, career: T, random: RandomPort): GpItemResultOf<T> {
  const roll = random.rand(0, LOTTERY_ROLL_RANGE)
  const prize = lotteryPrizeOf(roll)
  const counted: T = {
    ...career,
    lotteryPurchases: Math.min(MAXIMUM_LOTTERY_PURCHASES, career.lotteryPurchases + 1),
    lotteryFirstPrizes: career.lotteryFirstPrizes + (prize === 1 ? 1 : 0),
  }
  if (typeof prize === 'number') {
    const money = Math.min(MAXIMUM_MONEY, counted.money + LOTTERY_MONEY[prize - 1] * MONEY_UNIT)
    return { career: { ...counted, money }, lotteryPrize: prize }
  }
  const effectId = rollPrizeItemId(prize, random)
  return { career: applyEffect(rules, counted, effectId), lotteryPrize: prize, prizeItemId: effectId }
}
