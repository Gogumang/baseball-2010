import type { BurstMissionRow, BurstReward } from '@/entities/burst-mission/model/burstMissionRow'
import type { BurstJudgement } from '@/entities/burst-mission/model/burstMissionJudge'
import { BALANCE } from '@/shared/config/original/balance'

/**
 * 돌발미션 보상·페널티 (0x8e34c — K 4절 1-3, 확정).
 *
 * 결과 상태(obj+0x21c)를 보고:
 *   - **2 성공** → (b10,b11) 과 (b12,b13) 두 개를 **더한다**
 *   - **1 실패** → (b14,b15) 하나를 **뺀다**. b14 == 0 이면 아무것도 안 한다
 *   - **3 무효** → 아무것도 안 한다
 *
 * 붙는 곳(r6)은 모드에 따라 다르다: 나만의리그(3·4)는 내 선수 레코드(0x1fa2d → 0x1400054),
 * 시즌(2)은 내 팀 레코드(0x1f55d)다. 웹에는 아직 팀 레코드 쪽이 없어(시즌 사기 필드 0x1f9a9 의
 * 뜻도 미확인) 여기서는 **어느 쪽에 붙일지 고르지 않고 변화량만** 만들어 준다.
 */

/** 보상 종류 (0x8e3ae 스위치) */
export const BURST_REWARD_KIND = {
  사기: 1,
  인기도: 2,
  평판: 3,
  소지금: 4,
} as const

export type BurstRewardName = keyof typeof BURST_REWARD_KIND

const REWARD_NAME_BY_KIND: Readonly<Record<number, BurstRewardName>> = {
  [BURST_REWARD_KIND.사기]: '사기',
  [BURST_REWARD_KIND.인기도]: '인기도',
  [BURST_REWARD_KIND.평판]: '평판',
  [BURST_REWARD_KIND.소지금]: '소지금',
}

export interface BurstRewardDelta {
  readonly name: BurstRewardName
  /** 성공은 +, 실패는 −. 양은 **원본 단위** 그대로다 (소지금은 100만 단위) */
  readonly amount: number
}

function deltaOf(reward: BurstReward, sign: 1 | -1): BurstRewardDelta | null {
  const name = REWARD_NAME_BY_KIND[reward.kind]
  // kind 0 = 없음. 점프표에 없는 종류도 원본은 그냥 건너뛴다
  if (name === undefined) return null
  return { name, amount: sign * reward.amount }
}

/** 판정 결과에 따른 변화량 목록. 무효면 비어 있다 */
export function burstRewardDeltasOf(
  row: BurstMissionRow,
  judgement: BurstJudgement,
): BurstRewardDelta[] {
  if (judgement === '성공') {
    return row.successRewards
      .map((reward) => deltaOf(reward, 1))
      .filter((delta): delta is BurstRewardDelta => delta !== null)
  }
  if (judgement === '실패') {
    const penalty = deltaOf(row.failurePenalty, -1)
    return penalty === null ? [] : [penalty]
  }
  return []
}

/**
 * 변화량이 붙는 값들. 이름은 웹 `PlayerCareer` 와 같게 두어 결선에서 그대로 옮겨 담을 수 있게 했다.
 * `money` 만 **웹 단위(만원)** 다 — 원본 보상 1칸 = 100만원이라 `BALANCE.money.unit`(100)을 곱한다
 * (`eventReward.ts` 의 소지금 보상과 같은 처리).
 */
export interface BurstRewardTarget {
  readonly morale: number
  readonly popularity: number
  readonly reputation: number
  readonly money: number
}

/** 상한 — 보상 점프표가 정한다 (사기 0~100 · 인기도 0~9999 · 평판 0~999 · 소지금 0~9999칸) */
const MAXIMUM = {
  morale: BALANCE.limits.morale,
  popularity: BALANCE.limits.popularity,
  reputation: BALANCE.limits.reputation,
  money: BALANCE.limits.moneyUnits * BALANCE.money.unit,
}

const clamp = (value: number, maximum: number) => Math.min(maximum, Math.max(0, value))

/** 변화량 하나를 더한다. 모든 종류가 0 아래로 내려가지 않고 상한에서 멈춘다 */
export function applyBurstRewards(
  target: BurstRewardTarget,
  deltas: readonly BurstRewardDelta[],
): BurstRewardTarget {
  return deltas.reduce<BurstRewardTarget>((current, delta) => {
    switch (delta.name) {
      case '사기':
        return { ...current, morale: clamp(current.morale + delta.amount, MAXIMUM.morale) }
      case '인기도':
        return { ...current, popularity: clamp(current.popularity + delta.amount, MAXIMUM.popularity) }
      case '평판':
        return { ...current, reputation: clamp(current.reputation + delta.amount, MAXIMUM.reputation) }
      case '소지금':
        return {
          ...current,
          money: clamp(current.money + delta.amount * BALANCE.money.unit, MAXIMUM.money),
        }
    }
  }, target)
}
