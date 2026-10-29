import type { BatterAbility } from '@/entities/batting/model/batter'
import { clamp } from '@/entities/career/model/playerCareer/bounds'
import {
  MAXIMUM_ABILITY,
  MAXIMUM_GAME_POINT,
  MAXIMUM_MORALE,
  MAXIMUM_POPULARITY,
  MAXIMUM_REPUTATION,
} from '@/entities/career/model/playerCareer/constants'
import type { PlayerCareer } from '@/entities/career/model/playerCareer/types/playerCareer'

export function gainPopularity(career: PlayerCareer, amount: number): PlayerCareer {
  return { ...career, popularity: clamp(career.popularity + amount, 0, MAXIMUM_POPULARITY) }
}

export function gainReputation(career: PlayerCareer, amount: number): PlayerCareer {
  return { ...career, reputation: clamp(career.reputation + amount, 0, MAXIMUM_REPUTATION) }
}

/** G포인트를 더한다 (상한 99999). 원본은 전역 저장 +0x64 에 쌓는다 */
export function gainGamePoint(career: PlayerCareer, amount: number): PlayerCareer {
  return { ...career, gamePoint: clamp(career.gamePoint + amount, 0, MAXIMUM_GAME_POINT) }
}

export function gainMorale(career: PlayerCareer, amount: number): PlayerCareer {
  return { ...career, morale: clamp(career.morale + amount, 0, MAXIMUM_MORALE) }
}

/**
 * 필살타법 창(상태 0x7b)에서 고른 번호를 선수 +0x18 에 쓴다 (틀 0x17bf4 의 0x17c64 `strb 커서 + 1`).
 * 관리 주기 행동·G포인트는 건드리지 않는다 — 0x17c50~0x17c66 갈래의 쓰기는 이 `strb` 하나뿐이다.
 */
export function selectSpecialSwingNumber(career: PlayerCareer, number: number): PlayerCareer {
  return { ...career, specialSwingNumber: number }
}

/** 관리 주기의 행동 한 번을 쓴다. 경기를 치르면 다시 생긴다. */
export function spendCycleAction(career: PlayerCareer): PlayerCareer {
  return { ...career, hasActedThisCycle: true }
}

export function gainAbility(career: PlayerCareer, gains: Partial<BatterAbility>): PlayerCareer {
  return {
    ...career,
    ability: {
      hit: clamp(career.ability.hit + (gains.hit ?? 0), 0, MAXIMUM_ABILITY),
      power: clamp(career.ability.power + (gains.power ?? 0), 0, MAXIMUM_ABILITY),
      run: clamp(career.ability.run + (gains.run ?? 0), 0, MAXIMUM_ABILITY),
      defense: clamp(career.ability.defense + (gains.defense ?? 0), 0, MAXIMUM_ABILITY),
    },
  }
}
