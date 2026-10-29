import { isSkillEquipped } from '@/entities/career/model/playerCareer'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { subItemMoraleRelief } from '@/entities/career/model/subItems'
import type { TrainingModifiers } from '@/entities/career/model/trainingText'
import { BALANCE } from '@/shared/config/original/balance'

export const ROOKIE_SKILL = BALANCE.training.rookieSkillId
export const WEAK_BODY_SKILL = BALANCE.training.weakBodySkillId
/*
 * 훈련 상승·사기 보정(0x17f5c)은 병아리(0)·몹쓸몸(3)을 **장착** 비트(0xa4bf8 — 0x17ffc·0x1827a·0x182e2·
 * 0x18384·0x185ae·0x18612·0x18922)로 본다. 몹쓸몸은 마이너스라 보유 = 장착이다(0x18994 는 보유로 본다).
 */

/** 병아리(장착 0) · 몹쓸몸(장착 3) · 자동안마기(서브 4) — 0x17f5c 의 사기 보정 셋 */
export function trainingModifiersOf(career: PlayerCareer): TrainingModifiers {
  return {
    rookie: isSkillEquipped(career, ROOKIE_SKILL),
    weakBody: isSkillEquipped(career, WEAK_BODY_SKILL),
    massage: subItemMoraleRelief(career) > 0,
  }
}
