import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import {
  gainMorale,
  MAXIMUM_MORALE,
  MAXIMUM_POPULARITY,
  MAXIMUM_REPUTATION,
  spendCycleAction,
} from '@/entities/career/model/playerCareer'
import type { OutingEffect, OutingFunction, OutingRange, RolledOutingEffect } from '@/shared/config/outingPlaces'
import { HOSPITAL_RECOVERY, REST_RECOVERY, rollRecovery } from '@/entities/career/model/recovery'
import type { RecoverableCareer } from '@/entities/career/model/recovery'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { randomIntegerBelow } from '@/shared/lib/random/originalRandom'
import { applyOutingSubItems } from '@/entities/career/model/subItems'

/**
 * 외출 커맨드 — 2010판에서 신규 추가된 기능이다.
 * 원작 설명서: "전체 맵으로 이동할 수 있으며 ... 각 건물마다 특수 기능을 사용할 수 있으며"
 */


export type OutingBlockReason = '소지금부족' | '이미행동함' | '건강함' | '인기도부족' | '사기최고'

/**
 * 외출이 읽고 쓰는 칸만 추린 것 — **타자편·투수편이 함께 쓴다.**
 *
 * 원본 모드 3(투수편)·4(타자편)는 한 장면 0x106 의 같은 상태 112·113·126 을 돈다 (디스어셈 확정):
 *   - 105 커맨드 칸 3(점프표 0xcc540 → 0x126be)은 모드를 보지 않고 곧장 상태 0x70(112) 로 간다.
 *   - 112 진입 0x118e4(지도 적재 0x7f49c · [!] 배정 0x8cdc0) · 113 키·가드 0x16c64 · 효과 0x15234 ·
 *     입원 회복 0x1575c 어디에도 모드 갈림이 없다 — 표(0xcc402 · 0xcc344 · 0xcc358 · 0xcc34e · 0xcc33a)와
 *     서브 아이템 칸(`기록[0x5d + 장소]`, 점프표 0xcc6c4)·인기도 +0x48 · 평판 +0x62 · 소지금 +2 · 사기 0xa3a45 를
 *     장면의 기록(`[장면+0xb0]`)에 그대로 쓴다.
 * 그래서 커리어 타입을 묶지 않고 이 칸들을 가진 것이면 무엇이든 받는다 (`PlayerCareer`·`PitcherCareer`).
 */
export type OutingCareer = RecoverableCareer &
  Pick<
    PlayerCareer,
    'hasActedThisCycle' | 'popularity' | 'reputation' | 'morale' | 'money' | 'subItemIds' | 'outingsThisSeason'
  >

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
  career: OutingCareer,
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

/** 막힘 알림 원문 — StrMODE[62] · [77] · [196] · [91] (색 표식 `!C`·`!N`·`!c…` 은 뺐다), 이미 행동함은 r_event_txt[176] */
export function outingBlockTextOf(reason: OutingBlockReason, outingFunction: OutingFunction): string {
  switch (reason) {
    case '인기도부족':
      return `인기도가 부족합니다. 필요한 인기도 : ${outingFunction.requiredPopularity}`
    case '소지금부족':
      return '소지금이 부족합니다'
    case '건강함':
      return '건강한 상태입니다 입원할 필요가 없습니다'
    case '사기최고':
      return '사기 최고 상태입니다'
    case '이미행동함':
      return '트레이닝·휴식·외출은 한 번에 한 가지만 할 수 있습니다'
  }
}

const clamp = (value: number, maximum: number) => Math.min(maximum, Math.max(0, value))

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

export function runOuting<T extends OutingCareer>(career: T, outingFunction: OutingFunction, random: RandomPort): T {
  const blockReason = outingBlockReasonOf(career, outingFunction)
  if (blockReason !== null) {
    throw new Error(`외출할 수 없습니다 (${blockReason}): ${outingFunction.name}`)
  }

  const effect = applyOutingSubItems(career, outingFunction.id, rollOutingEffect(outingFunction.effect, random))
  // 반영 범위는 원본 그대로 (0x152f4~0x15374): 인기도 0..9999 · 평판 0..999 · 사기 0..100 (두 모드 같은 한계)
  const gained: T = {
    ...career,
    hasActedThisCycle: true,
    outingsThisSeason: career.outingsThisSeason + 1,
    money: Math.max(0, career.money - effect.moneyCost),
    morale: clamp(career.morale + effect.moraleGain, MAXIMUM_MORALE),
    popularity: clamp(career.popularity + effect.popularityGain, MAXIMUM_POPULARITY),
    reputation: clamp(career.reputation + effect.reputationGain, MAXIMUM_REPUTATION),
  }
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
