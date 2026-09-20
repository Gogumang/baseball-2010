import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import {
  gainMorale,
  gainPopularity,
  gainReputation,
  MAXIMUM_MORALE,
  spendCycleAction,
} from '@/entities/career/model/playerCareer'
import type { OutingEffect, OutingFunction, OutingRange, RolledOutingEffect } from '@/shared/config/outingPlaces'
import { HOSPITAL_RECOVERY, REST_RECOVERY, rollRecovery } from '@/entities/career/model/recovery'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { randomIntegerBelow } from '@/shared/lib/random/originalRandom'
import { applyOutingSubItems } from '@/entities/career/model/subItems'

/**
 * 외출 커맨드 — 2010판에서 신규 추가된 기능이다.
 * 원작 설명서: "전체 맵으로 이동할 수 있으며 ... 각 건물마다 특수 기능을 사용할 수 있으며"
 */


export type OutingBlockReason = '소지금부족' | '이미행동함' | '건강함' | '인기도부족' | '사기최고'

/**
 * 외출 막힘 판정 — **원본 0x16cf0 의 순서 그대로**다 (G-3 확정):
 *   1. 필요 인기도 `0xcc402[장소]` > 인기도 → StrMODE[62]
 *   2. 비용 > 소지금 → StrMODE[77]
 *   3. 입원인데 질병·부상 없음 → StrMODE[196]
 *   4. 외식인데 사기 100 → StrMODE[91]
 *
 * ⚠️ **원본 버그를 그대로 옮긴다** (DECISIONS 2026-09-20): 2번 소지금 검사는 **보험증서를 보지 않는다**
 * (0x16d42) → 보험증서가 있어 실제로는 공짜인 입원도 소지금이 모자라면 막힌다.
 */
export function outingBlockReasonOf(
  career: PlayerCareer,
  outingFunction: OutingFunction,
): OutingBlockReason | null {
  if (career.hasActedThisCycle) return '이미행동함'
  // StrMODE[62] "인기도가 부족합니다. 필요한 인기도 : %d"
  if (career.popularity < outingFunction.requiredPopularity) return '인기도부족'
  // StrMODE[77] — 보험증서(서브아이템 7)를 보지 않는다 (원본 그대로)
  if (outingFunction.effect.moneyCost > 0 && career.money < outingFunction.effect.moneyCost) return '소지금부족'
  // StrMODE[196] "건강한 상태입니다 입원할 필요가 없습니다"
  if (outingFunction.effect.healsInjury && !career.isInjured && !career.isSick) return '건강함'
  // 외식은 사기가 최고면 막힌다 (StrMODE[91])
  if (outingFunction.id === '외식' && career.morale >= MAXIMUM_MORALE) return '사기최고'
  return null
}

function rollRange(random: RandomPort, [first, second]: OutingRange): number {
  const sign = first < 0 ? -1 : 1
  return sign * randomIntegerBelow(random, Math.abs(first), Math.abs(second))
}

/** 효과 표의 난수를 뽑는다 — 순서(인기도 → 평판 → 사기)는 추정 */
export function rollOutingEffect(effect: OutingEffect, random: RandomPort): RolledOutingEffect {
  return {
    moneyCost: effect.moneyCost,
    popularityGain: rollRange(random, effect.popularity),
    reputationGain: rollRange(random, effect.reputation),
    moraleGain: rollRange(random, effect.morale),
    healsInjury: effect.healsInjury,
  }
}

export function runOuting(career: PlayerCareer, outingFunction: OutingFunction, random: RandomPort): PlayerCareer {
  const blockReason = outingBlockReasonOf(career, outingFunction)
  if (blockReason !== null) {
    throw new Error(`외출할 수 없습니다 (${blockReason}): ${outingFunction.name}`)
  }

  const effect = applyOutingSubItems(career, outingFunction.id, rollOutingEffect(outingFunction.effect, random))
  const paid: PlayerCareer = {
    ...spendCycleAction(career),
    outingsThisSeason: career.outingsThisSeason + 1,
    money: Math.max(0, career.money - effect.moneyCost),
  }
  const gained = gainReputation(
    gainPopularity(gainMorale(paid, effect.moraleGain), effect.popularityGain),
    effect.reputationGain,
  )
  return effect.healsInjury ? rollRecovery(gained, HOSPITAL_RECOVERY, random).career : gained
}

/**
 * 원작 [휴식] 커맨드 (0x18e3c) — 사기 bfa55(10,16) = 10~15 회복, 이어서 질병 60% · 부상 30% 회복 판정 (0x1b308, 누락 탐색 7차).
 */
const REST_MORALE_RANGE = { minimum: 10, maximumExclusive: 16 }

export function restBlockReasonOf(career: PlayerCareer): '이미행동함' | '사기최고' | null {
  if (career.hasActedThisCycle) return '이미행동함'
  // 0x1261c — 사기가 100 이면 아파도 StrMODE[91] 로 거절한다 (행동으로 치지 않음)
  return career.morale >= MAXIMUM_MORALE ? '사기최고' : null
}

/** 휴식 결과 (0x18e3c) — 사기만 오른다. 회복 판정은 결과 창을 닫을 때 recoverAfterRest 로 한다 (0x1b308) */
export function runRest(career: PlayerCareer, random: RandomPort): { career: PlayerCareer; moraleGain: number } {
  if (restBlockReasonOf(career) !== null) {
    throw new Error(`휴식할 수 없습니다 (${restBlockReasonOf(career)})`)
  }
  const moraleGain = randomIntegerBelow(random, REST_MORALE_RANGE.minimum, REST_MORALE_RANGE.maximumExclusive)
  return { career: gainMorale(spendCycleAction(career), moraleGain), moraleGain }
}

export function recoverAfterRest(career: PlayerCareer, random: RandomPort) {
  return rollRecovery(career, REST_RECOVERY, random)
}
