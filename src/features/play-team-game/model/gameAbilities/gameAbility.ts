import type { PitcherGameAbilityParts } from '@/entities/pitching/model/pitcherGameStats'
import { fightingSpiritValueOf, gameAbilityStepsOf, isFightingSpiritSlot } from '@/features/play-team-game/model/gameAbilities/abilitySteps'
import { ABILITY_LIMIT, PITCHER_SLOT } from '@/features/play-team-game/model/gameAbilities/slots'
import type { GameAbilityInput, GameAbilityParts } from '@/features/play-team-game/model/gameAbilities/types'

export function gameAbilityPartsOf(input: GameAbilityInput): GameAbilityParts {
  const steps = gameAbilityStepsOf(input)
  return {
    beforeFatigue: steps.beforeFatigue,
    bonusAfterFatigue: steps.teamBonus + steps.coachBonus,
    coachBonus: steps.coachBonus,
    fightingSpirit: isFightingSpiritSlot(input),
  }
}

/**
 * 경기용 능력치 한 칸을 계산한다 — 피로가 없는 값(체력 인자 90: 타자·야수·능력 합 0xb5b50).
 *
 * 나만의리그 쪽 보정(장비·스킬·부상)은 이 함수가 건드리지 않는다 — 부르는 쪽이 이미 먹인
 * 값을 `base` 로 넘긴다. 팀 경기에는 육성 선수가 (영입하지 않는 한) 없어서 지금은 밑값 그대로다.
 */
export function gameAbilityOf(input: GameAbilityInput): number {
  const steps = gameAbilityStepsOf(input)
  const value = fightingSpiritValueOf(steps.beforeFatigue + steps.teamBonus, input) + steps.coachBonus
  if (value < 0) return 0
  return value > ABILITY_LIMIT ? ABILITY_LIMIT : value
}

/**
 * 네 칸을 한꺼번에 — 로스터 레코드의 `ability` 순서(히트·파워·수비·주루 / 제구·구속·변화·체력) 그대로.
 */
export function gameAbilitiesOf(base: readonly number[], input: Omit<GameAbilityInput, 'base' | 'slot'>): [number, number, number, number] {
  const at = (slot: number) => gameAbilityOf({ ...input, base: base[slot] ?? 0, slot })
  return [at(0), at(1), at(2), at(3)]
}

/**
 * 투수 제구·구속·변화 세 칸을 피로 앞뒤로 쪼갠다 — 사람 타석 CPU 투수의 `PitcherAbility.gameAbility`
 * (0x34968 · 0x4dbac · 0xab214 의 ab548·ab582 가 0xb570c 를 투수 체력%로 부른다).
 */
export function pitcherGameAbilityPartsOf(
  base: readonly number[],
  input: Omit<GameAbilityInput, 'base' | 'slot' | 'isPitcher'>,
): PitcherGameAbilityParts {
  const at = (slot: number) => gameAbilityPartsOf({ ...input, isPitcher: true, base: base[slot] ?? 0, slot })
  const control = at(PITCHER_SLOT.제구)
  const velocity = at(PITCHER_SLOT.구속)
  const breaking = at(PITCHER_SLOT.변화)
  return {
    beforeFatigue: {
      control: control.beforeFatigue,
      velocity: velocity.beforeFatigue,
      breaking: breaking.beforeFatigue,
    },
    bonusAfterFatigue: {
      control: control.bonusAfterFatigue,
      velocity: velocity.bonusAfterFatigue,
      breaking: breaking.bonusAfterFatigue,
    },
    coachBonusAfterFatigue: {
      control: control.coachBonus,
      velocity: velocity.coachBonus,
      breaking: breaking.coachBonus,
    },
    // 세 칸 모두 칸 ≠ 3 이라 투수 레코드면 함께 선다 (b5a48)
    ...(control.fightingSpirit ? { fightingSpirit: true } : {}),
  }
}
