import type { RandomPort } from '@/shared/api/random/randomPort'
import { BALANCE } from '@/shared/config/original/balance'
import { gainAbility, gainMorale, isSkillEquipped, spendCycleAction } from '@/entities/career/model/playerCareer'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { subItemTrainingBonus } from '@/entities/career/model/subItems'
import { trainingMoraleAdjustmentOf } from '@/entities/career/model/trainingText'
import { ROOKIE_SKILL, trainingModifiersOf, WEAK_BODY_SKILL } from '@/entities/career/model/training/modifiers'
import type { BatterAbility } from '@/entities/career/model/training/otherSlices'
import { rollInRange, type IntegerRange, type TrainingMenu, type TrainingOutcome } from '@/entities/career/model/training/types'

const GAIN_RANGE: IntegerRange = BALANCE.training.gainRange
const LEG_GAIN_RANGE: IntegerRange = BALANCE.training.legGainRange
const LEG_ABILITIES: ReadonlySet<keyof BatterAbility> = new Set(['defense', 'run'])
const MORALE_LOSS_RANGE: IntegerRange = BALANCE.training.moraleLossRange
/** 배팅 타입 첫 선택 → 보너스 능력치 (0 → 히트, 1 → 파워) */
const TYPE_BONUS_ABILITY: readonly (keyof BatterAbility)[] = ['hit', 'power']
const TYPE_BONUS = BALANCE.training.typeBonus

export function rollAbilityTraining(career: PlayerCareer, menu: TrainingMenu, random: RandomPort): TrainingOutcome {
  const [ability] = menu.abilities
  // 굴리는 차례: 사기 bfa55(5,8) → [sp+0x38] (0x186c4) 이 **먼저**, 상승 bfa55 → [sp+0x34] (0x18704) 가 다음
  const rolledMoraleLoss = rollInRange(random, MORALE_LOSS_RANGE)
  const rolled = rollInRange(random, LEG_ABILITIES.has(ability) ? LEG_GAIN_RANGE : GAIN_RANGE)
  const typeBonus = TYPE_BONUS_ABILITY[career.battingTypeIndex] === ability ? TYPE_BONUS : 0
  const skillGain = (isSkillEquipped(career, ROOKIE_SKILL) ? 1 : 0) - (isSkillEquipped(career, WEAK_BODY_SKILL) ? 2 : 0)
  const subItemGain = subItemTrainingBonus(career, ability)
  const gains = { [ability]: rolled + typeBonus + skillGain + subItemGain }
  const modifiers = trainingModifiersOf(career)
  const moraleLoss = rolledMoraleLoss + trainingMoraleAdjustmentOf(modifiers)
  const spent = spendCycleAction(gainMorale(career, -moraleLoss))
  return {
    menuId: menu.id,
    gains,
    typeBonus,
    moraleLoss,
    rolledGain: rolled,
    rolledMoraleLoss,
    modifiers,
    hasSubItemBonus: subItemGain > 0,
    specialSwing: null,
    career: gainAbility(spent, gains),
  }
}
