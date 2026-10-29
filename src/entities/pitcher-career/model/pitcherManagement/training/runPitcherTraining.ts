import { pitcherTrainingBlockReasonOf } from '@/entities/pitcher-career/model/pitcherManagement/block'
import type { PitcherTrainingMenu } from '@/entities/pitcher-career/model/pitcherManagement/menus'
import { runAbilityTraining } from '@/entities/pitcher-career/model/pitcherManagement/training/abilityTraining'
import { runMagicTraining } from '@/entities/pitcher-career/model/pitcherManagement/training/magicTraining'
import type { PitcherTrainingOutcome } from '@/entities/pitcher-career/model/pitcherManagement/training/types'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import type { RandomPort } from '@/shared/api/random/randomPort'

/** 훈련 한 번 (0x17f5c → 0xa3bad). 범위·타입 보너스 갈림은 모음 머리말 (디스어셈 확정). 막힌 칸이면 던진다 */
export function runPitcherTraining(career: PitcherCareer, menu: PitcherTrainingMenu, random: RandomPort): PitcherTrainingOutcome {
  const blockReason = pitcherTrainingBlockReasonOf(career, menu)
  if (blockReason !== null) throw new Error(`훈련을 실행할 수 없습니다 (${blockReason}): ${menu.name}`)
  return menu.ability === null ? runMagicTraining(career, menu, random) : runAbilityTraining(career, menu, menu.ability, random)
}
