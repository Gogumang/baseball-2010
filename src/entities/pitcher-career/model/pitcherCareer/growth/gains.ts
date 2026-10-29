import { PITCHER_ABILITY_ORDER } from '@/entities/pitcher-career/model/pitcherAbility'
import type { PitcherAbility } from '@/entities/pitcher-career/model/pitcherAbility'
import { clamp } from '@/entities/pitcher-career/model/pitcherCareer/bounds'
import { MAXIMUM_ABILITY, MAXIMUM_MORALE, MAXIMUM_POPULARITY, MAXIMUM_REPUTATION } from '@/entities/pitcher-career/model/pitcherCareer/constants'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer/types/pitcherCareer'

/* ── 값 올리기 — 모두 0..상한으로 자른다 ─────────────────────────────────────── */

export function gainPitcherPopularity(career: PitcherCareer, amount: number): PitcherCareer {
  return { ...career, popularity: clamp(career.popularity + amount, 0, MAXIMUM_POPULARITY) }
}

export function gainPitcherReputation(career: PitcherCareer, amount: number): PitcherCareer {
  return { ...career, reputation: clamp(career.reputation + amount, 0, MAXIMUM_REPUTATION) }
}

export function gainPitcherMorale(career: PitcherCareer, amount: number): PitcherCareer {
  return { ...career, morale: clamp(career.morale + amount, 0, MAXIMUM_MORALE) }
}

export function gainPitcherAbility(career: PitcherCareer, gains: Partial<PitcherAbility>): PitcherCareer {
  const ability = { ...career.ability }
  for (const key of PITCHER_ABILITY_ORDER) {
    ability[key] = clamp(ability[key] + (gains[key] ?? 0), 0, MAXIMUM_ABILITY)
  }
  return { ...career, ability }
}

export function spendPitcherCycleAction(career: PitcherCareer): PitcherCareer {
  return { ...career, hasActedThisCycle: true }
}
