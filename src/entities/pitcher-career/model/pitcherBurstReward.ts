import type { BurstRewardDelta } from '@/entities/burst-mission/model/burstMissionReward'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import {
  ORIGINAL_MONEY_UNIT,
  gainPitcherPopularity,
  gainPitcherReputation,
} from '@/entities/pitcher-career/model/pitcherCareer'
import { nariMoraleOf, withNariMorale } from '@/entities/career/model/nariMorale'
import { BALANCE } from '@/shared/config/original/balance'

/**
 * **투수편 돌발미션 보상 · 페널티** — 0x8e34c 의 모드 3 · 4 갈래(r6 = 0x1fa2d → 0x1400054 = 나리 선수 레코드 R, 직접 떴다).
 * 타자편 `entities/career/model/burstReward` 와 같은 코드다:
 * ```
 * 종류 1 사기   8e408~8e422  0xa3a24(R) + 양 → 0xa3a44(R, …)  (0..100 — 대회 중이면 상대국 칸 +2, `nariMorale`)
 * 종류 2 인기도 8e428~8e44a  0xb6e79(R) + 양 → R+0x48        (0..9999)
 * 종류 3 평판   8e44e~8e46c  R+0x62 + 양                       (0..999)
 * 종류 4 소지금 8e470~8e48a  R+2 + 양                          (0..9999 칸, 한 칸 100만원)
 * ```
 * 0x8e34c 는 저장하지 않는다 — 경기 끝 정산 0x4ea0c 의 저장(4f3c0)이 함께 쓴다. 웹 투수편은 경기 요약(`burstRewardDeltas`)으로 받아
 * 정산 맨 앞에 얹는다(경기 중 나가면 둘 다 사라진다). 경기 중의 사기 변화는 진행기가 판정 그 자리에서 먹였다(`withPitcherGameMorale`).
 */
const MAXIMUM_MONEY = BALANCE.limits.moneyUnits * ORIGINAL_MONEY_UNIT

function applyOne(career: PitcherCareer, delta: BurstRewardDelta): PitcherCareer {
  switch (delta.name) {
    case '사기':
      return withNariMorale(career, nariMoraleOf(career) + delta.amount)
    case '인기도':
      return gainPitcherPopularity(career, delta.amount)
    case '평판':
      return gainPitcherReputation(career, delta.amount)
    case '소지금':
      return {
        ...career,
        money: Math.min(MAXIMUM_MONEY, Math.max(0, career.money + delta.amount * ORIGINAL_MONEY_UNIT)),
      }
    default:
      return career
  }
}

/** 변화량 목록을 판정 차례대로 얹는다. 빈 목록이면 그대로 돌려준다 */
export function applyPitcherBurstRewards(
  career: PitcherCareer,
  deltas: readonly BurstRewardDelta[],
): PitcherCareer {
  return deltas.reduce(applyOne, career)
}
