import { balanceGrid, balanceNumber } from '@/shared/config/balance'
import { pitcherAbilityLimitOf } from '@/entities/pitcher-career/model/pitcherAbility'
import type { PitcherAbility } from '@/entities/pitcher-career/model/pitcherAbility'
import { pitcherFormOf } from '@/entities/pitcher-career/model/pitcherRegistration'
import { equippedPitcherAbilityOf } from '@/entities/pitcher-career/model/pitcherCareer/ability/equippedAbility'
import { mapPitcherAbility } from '@/entities/pitcher-career/model/pitcherCareer/ability/mapPitcherAbility'
import { clamp, reduceByPercent } from '@/entities/pitcher-career/model/pitcherCareer/bounds'
import { MAXIMUM_ABILITY } from '@/entities/pitcher-career/model/pitcherCareer/constants'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer/types/pitcherCareer'

/** 능력 한계 — 타자와 달리 **보직**으로 행을 고른다 (0xa44f4, R7 3절) */
export function pitcherAbilityLimitsOf(career: PitcherCareer): PitcherAbility {
  return pitcherAbilityLimitOf(career.role)
}

/**
 * 경기용 실효 능력치 `0xb570c` — 0xb6414 뒤에 **질병 → 부상 → 사기 감소** 차례다 (G-1).
 * 모드 3·4 이고 내 선수(0xb6389)일 때의 갈래로, 타자편 `condition.ts` 와 같은 코드다:
 *   질병 `v += (−30·v)/100` (0xb5784) · 부상 `v += (−60·v)/100` (0xb57b4 `lsls #4; subs; lsls #2` = −60)
 */
// 감소율(질병 30 · 부상 60 · 사기 [10,50] · [30,20] · [50,10])은 타자편과 같은 숨은 판정값 표 `ability.*` 에서 읽는다

/**
 * 0xb570c 를 체력% 피로(0xb58e6) **앞까지** 돌린 값 — 0..999 로 **아직 자르지 않았다**.
 * 원본은 피로·팀 능력치·코치까지 더한 뒤 맨 끝(0xb5b06)에서 한 번만 자르므로,
 * 피로를 따로 먹이는 투구 흐름(`fatiguedStatsOf`)은 이 값을 받아 피로 뒤에 자른다.
 * 냉정 22 로 999 를 넘은 제구가 피로로 깎일 때만 차이가 난다.
 */
export function unclampedGamePitcherAbilityOf(career: PitcherCareer, appliesCondition = true): PitcherAbility {
  // 넷째 인자 0 — 질병 · 부상 · 사기 감소(0xb5734 → 0xb58e6)를 건너뛴다. 카드 0x7ba44 는 상태 102 · 103 에서 0 을 넘긴다(R9 12-3)
  if (!appliesCondition) return equippedPitcherAbilityOf(career)
  return withMoraleAbilityCut(gamePitcherAbilityBeforeMoraleOf(career), career.morale)
}

/** 0xb570c 를 사기 감소 **앞까지**(질병 −30% → 부상 −60%) 돌린 값 — 사기는 그 뒤 `withMoraleAbilityCut` 가 먹인다 */
export function gamePitcherAbilityBeforeMoraleOf(career: PitcherCareer): PitcherAbility {
  const equipped = equippedPitcherAbilityOf(career)
  return mapPitcherAbility((key) => {
    let value = equipped[key]
    if (career.isSick) value = reduceByPercent(value, balanceNumber('ability.illnessCutPercent'))
    if (career.isInjured) value = reduceByPercent(value, balanceNumber('ability.injuryCutPercent'))
    return value
  })
}

/**
 * 0xb570c 의 사기 감소(b57c4~b5802) — 사기 ≤ 50 −10% · ≤ 30 −20% · ≤ 10 −50%. 사기는 b5768 이 넘겨 받은 팀 레코드 +2 에 쓴
 * 0xa3a24 값이라 경기 중 돌발 보상으로 바뀌면 다음 계산부터 새 값이 먹는다(`pitcherGameFlow` 의 `withPitcherGameMorale`)
 */
export function withMoraleAbilityCut(ability: PitcherAbility, morale: number): PitcherAbility {
  const moraleCut = balanceGrid('ability.moraleCuts').find(([limit]) => morale <= limit)?.[1] ?? 0
  if (moraleCut <= 0) return ability
  return mapPitcherAbility((key) => reduceByPercent(ability[key], moraleCut))
}

/**
 * 피로 없는(체력 인자 > 54) 0xb570c — 맨 끝 0..999 자르기(0xb5b06)까지 한 값. 화면 표시용 실효값.
 * `appliesCondition` = 0xb570d 의 넷째 인자 — 거짓이면 질병 · 부상 · 사기 감소를 건너뛴다.
 */
export function effectivePitcherAbilityOf(career: PitcherCareer, appliesCondition = true): PitcherAbility {
  const unclamped = unclampedGamePitcherAbilityOf(career, appliesCondition)
  return mapPitcherAbility((key) => clamp(unclamped[key], 0, MAXIMUM_ABILITY))
}

/** 투수 폼 `0xb6e24` = 레코드 +0xb 윗니블 = **2×타입 + 손** (0x16f9a, C 표) */
export function pitcherFormOfCareer(career: PitcherCareer): number {
  return pitcherFormOf(career.typeIndex, career.handIndex)
}
