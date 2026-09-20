import type { BurstRewardDelta } from '@/entities/burst-mission/model/burstMissionReward'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import {
  ORIGINAL_MONEY_UNIT,
  gainMorale,
  gainPopularity,
  gainReputation,
} from '@/entities/career/model/playerCareer'
import { BALANCE } from '@/shared/config/original/balance'

/**
 * 돌발미션 보상·페널티를 내 선수 레코드에 붙인다 (0x8e34c 의 r6 = 0x1fa2d, 나만의리그 3·4).
 *
 * `burstRewardDeltasOf` 는 "무엇을 얼마나" 만 돌려주고 **어디에 붙일지는 고르지 않는다** —
 * 시즌 모드(2)는 팀 레코드(0x1f55d)에 붙기 때문이다. 나만의리그는 붙을 곳이 내 선수라
 * 여기서 커리어에 얹는다.
 *
 * 소지금만 단위를 맞춰 준다: 원본 보상 양은 **100만원 한 칸** 단위고,
 * 웹 커리어의 `money` 는 만원 단위라 `ORIGINAL_MONEY_UNIT`(100)을 곱한다.
 */
const MAXIMUM_MONEY = BALANCE.limits.moneyUnits * ORIGINAL_MONEY_UNIT

function applyOne(career: PlayerCareer, delta: BurstRewardDelta): PlayerCareer {
  switch (delta.name) {
    case '사기':
      return gainMorale(career, delta.amount)
    case '인기도':
      return gainPopularity(career, delta.amount)
    case '평판':
      return gainReputation(career, delta.amount)
    case '소지금':
      return {
        ...career,
        money: Math.min(MAXIMUM_MONEY, Math.max(0, career.money + delta.amount * ORIGINAL_MONEY_UNIT)),
      }
    default:
      return career
  }
}

/** 변화량 목록을 차례로 얹는다. 빈 목록이면 그대로 돌려준다 */
export function applyBurstRewards(
  career: PlayerCareer,
  deltas: readonly BurstRewardDelta[],
): PlayerCareer {
  return deltas.reduce(applyOne, career)
}
