import { subItemSlotTrainingBonus, trainingMoraleAdjustmentOf } from '@/entities/pitcher-career/model/pitcherManagement/otherSlices'
import { countReleaseTrainingStreak } from '@/entities/pitcher-career/model/pitcherManagement/counts/releaseStreak'
import { countPitcherTraining } from '@/entities/pitcher-career/model/pitcherManagement/counts/trainingCounts'
import type { PitcherTrainingMenu } from '@/entities/pitcher-career/model/pitcherManagement/menus'
import { ROOKIE_SKILL, WEAK_BODY_SKILL, rollIn, trainingModifiersOf } from '@/entities/pitcher-career/model/pitcherManagement/training/modifiers'
import type { IntegerRange } from '@/entities/pitcher-career/model/pitcherManagement/training/modifiers'
import type { PitcherTrainingOutcome } from '@/entities/pitcher-career/model/pitcherManagement/training/types'
import { gainPitcherAbility, gainPitcherMorale, isPitcherSkillEquipped, spendPitcherCycleAction } from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { PITCHER_ABILITY_ORDER } from '@/entities/pitcher-career/model/pitcherAbility'
import type { PitcherAbility } from '@/entities/pitcher-career/model/pitcherAbility'
import { PITCHER_TYPE_BONUS_ABILITY } from '@/entities/pitcher-career/model/pitcherRegistration'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { BALANCE } from '@/shared/config/original/balance'

const GAIN_RANGE: IntegerRange = BALANCE.training.gainRange
/** 투수는 칸 3(체력)만 bfa55(5,8) — 0x186f4 `cmp k,#3` */
const SLOW_GAIN_RANGE: IntegerRange = BALANCE.training.legGainRange
const STAMINA_SLOT = 3
/** 타입 보너스 +1 (0x18750 · 0x187a8 의 [sp+0xe8+k] += 1) */
const TYPE_BONUS = 1
const MORALE_LOSS_RANGE: IntegerRange = BALANCE.training.moraleLossRange
/** 장착 스킬 보정 — 병아리 +1 · 몹쓸몸 −2 */
const ROOKIE_GAIN = 1
const WEAK_BODY_GAIN = -2

/** 장착 스킬로 붙는 상승 보정 (병아리 · 몹쓸몸 장착 비트) */
function skillGainOf(career: PitcherCareer): number {
  return (isPitcherSkillEquipped(career, ROOKIE_SKILL) ? ROOKIE_GAIN : 0) + (isPitcherSkillEquipped(career, WEAK_BODY_SKILL) ? WEAK_BODY_GAIN : 0)
}

/**
 * 능력치 훈련 한 번 (칸 0~3, 0x186c4~). 굴리는 차례: 사기 bfa55(5,8) → [sp+0x38] (0x186c4) 이 **먼저**,
 * 상승 bfa55 → [sp+0x34] (0x18704) 가 다음. 타입 보너스는 칸 0(제구)·타입 1 · 칸 1(구속)·타입 0 · 칸 2(변화)·타입 2 (0x18786~0x187a6)
 */
export function runAbilityTraining(
  career: PitcherCareer,
  menu: PitcherTrainingMenu,
  ability: keyof PitcherAbility,
  random: RandomPort,
): PitcherTrainingOutcome {
  const slot = PITCHER_ABILITY_ORDER.indexOf(ability)
  const rolledMoraleLoss = rollIn(random, MORALE_LOSS_RANGE)
  const rolled = rollIn(random, slot === STAMINA_SLOT ? SLOW_GAIN_RANGE : GAIN_RANGE)
  const typeBonus = PITCHER_TYPE_BONUS_ABILITY[career.typeIndex] === ability ? TYPE_BONUS : 0
  // 서브 아이템 0~3 은 훈련 칸 k 로 `기록[0x58+k]` 를 본다 (0x187f6, 모드 공용) — 표적판 = 제구 … 하드타이어 = 체력
  const subItemGain = subItemSlotTrainingBonus(career, slot)
  const gains: Partial<PitcherAbility> = { [ability]: rolled + typeBonus + skillGainOf(career) + subItemGain }
  const modifiers = trainingModifiersOf(career)
  const moraleLoss = rolledMoraleLoss + trainingMoraleAdjustmentOf(modifiers)
  const spent = spendPitcherCycleAction(gainPitcherMorale(career, -moraleLoss))
  return {
    menuId: menu.id,
    gains,
    typeBonus,
    moraleLoss,
    rolledGain: rolled,
    rolledMoraleLoss,
    modifiers,
    hasSubItemBonus: subItemGain > 0,
    magic: null,
    career: countReleaseTrainingStreak(countPitcherTraining(gainPitcherAbility(spent, gains), menu.id), slot),
  }
}
