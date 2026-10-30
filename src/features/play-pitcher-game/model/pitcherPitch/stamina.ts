import { withFightingSpirit } from '@/entities/pitching/model/pitcherGameStats'
import {
  pitchStaminaCostOf,
  staminaCapacityOf,
  staminaPercentOf,
  consumeStamina,
  abilityAfterFatigue,
} from '@/entities/pitcher-career/model/pitcherStamina'
import { MAXIMUM_PITCHER_ABILITY } from '@/entities/pitcher-career/model/pitcherAbility'
import type { PitcherStats } from '@/features/play-pitcher-game/model/pitcherPitch/types'

export interface StaminaDrainInput {
  /** 지금 스태미나 0~10000 (레코드 +0x2c) */
  readonly stamina: number
  readonly typeNumber: number
  /** 체력 실효 능력치 (장비·스킬 포함, 0xb6415(P, 3, 1)) */
  readonly staminaAbility: number
  /** 팀 사기 */
  readonly teamMorale: number
  /** 아직 교체가 없는 첫 투수인가 (`team+0x26 − team+0x33 == 1`) */
  readonly isFirstPitcher: boolean
  readonly batterIntimidates: boolean
  readonly pitcherIsCoward: boolean
  readonly pitcherEndures: boolean
}

/** 공 하나가 깎는 스태미나 (0xa5e14 → 0xaeb08). ⚠️ 0 에서 한 개 더 던지면 1% 로 되살아난다 */
export function drainStamina(input: StaminaDrainInput): number {
  const cost = pitchStaminaCostOf({
    pitchTypeNumber: input.typeNumber,
    batterIntimidates: input.batterIntimidates,
    pitcherIsCoward: input.pitcherIsCoward,
    pitcherEndures: input.pitcherEndures,
  })
  const capacity = staminaCapacityOf(input.staminaAbility, input.teamMorale, input.isFirstPitcher)
  return consumeStamina(input.stamina, cost, capacity)
}

const clampFatigued = (value: number) => Math.min(MAXIMUM_PITCHER_ABILITY, Math.max(0, value))

/**
 * 체력%가 깎아 놓은 실효 능력치 (0xb570c → 0xb58e6). 투구 화면 0x34968 이 이 값으로 등급·구속을 낸다.
 * 장비·스킬·컨디션은 부르는 쪽이 이미 반영해 넘긴다 (투수편 `unclampedGamePitcherAbilityOf`).
 * 0xb570c 는 피로 **뒤** 맨 끝(0xb5b06)에서 0..999 로 자르므로 여기서 자른다 —
 * 냉정 22 로 999 를 넘은 제구가 피로로 깎일 때 먼저 자른 값과 달라진다.
 */
export function fatiguedStatsOf(
  stats: PitcherStats,
  stamina: number,
  /**
   * 스킬 14(투지) 갈래가 지금 서는가 (0xb570c b5a16~b5a72 — 장착 비트 14 ∧ 경기 상태). 정액이 없는 모드(3 · 5)라 피로 **뒤** · 자르기 **앞**에
   * 세 칸(칸 ≠ 3) `v += v/10`. 안 넘기면 거짓
   */
  fightingSpirit = false,
): PitcherStats {
  const percent = staminaPercentOf(stamina)
  const at = (value: number) => {
    const fatigued = abilityAfterFatigue(value, percent)
    return clampFatigued(fightingSpirit ? withFightingSpirit(fatigued) : fatigued)
  }
  return {
    control: at(stats.control),
    velocity: at(stats.velocity),
    breaking: at(stats.breaking),
    stamina: stats.stamina,
  }
}
