import type { RandomPort } from '@/shared/api/random/randomPort'
import { countTraining } from '@/entities/career/model/playerCareer'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { abilityLimitOf } from '@/entities/career/model/abilityLimit'
import { rollAbilityTraining } from '@/entities/career/model/training/abilityTraining'
import { SPECIAL_SWING_MAXIMUM_LEVEL } from '@/entities/career/model/training/specialSwingSlots'
import { rollSpecialSwingTraining } from '@/entities/career/model/training/specialSwingTraining'
import { isSpecialSwingMenu, type TrainingBlockReason, type TrainingMenu, type TrainingOutcome } from '@/entities/career/model/training/types'

export function blockReasonOf(career: PlayerCareer, menu: TrainingMenu): TrainingBlockReason | null {
  // 행동함(S+4)은 보지 않는다 — 107 키 0x12d48 확인(12d8a~)은 사기 0xa3a25 만 본다(StrMODE[193]). 105 의 흑백 칸도 확인으로 들어온다
  if (career.morale <= 0) return '사기부족'
  // 훈련 **함수**(0xa3c78)는 G포인트가 모자라도 막지 않는다 — 0xa3c84 가 0 에서 바닥을 친다.
  // 막는 것은 그 앞의 **창**(0x17828)이고, 거기에 인기도 100/500/1000/1500 과 G 부족([65]) 가드가 있다
  // (R7 4절 확정 → `specialSwingSlotBlockOf`). 여기 `blockReasonOf` 는 창을 거치지 않는 흐름이라
  // 원본 훈련 함수 쪽 규칙만 본다.
  // 최고 레벨 가드는 **원본에도 있다** (R7 4절 확정): 필살타법 창 0x17828 이 "칸 i == 배운 수" 일 때만
  // 훈련시키므로, 최고 레벨이면 모든 칸이 StrMODE[63] 으로 막힌다. 우리가 넣은 안전장치가 아니다.
  if (isSpecialSwingMenu(menu)) {
    return career.specialSwingLevel >= SPECIAL_SWING_MAXIMUM_LEVEL ? '훈련완료' : null
  }
  const limits = abilityLimitOf(career.battingTypeIndex)
  if (menu.abilities.every((ability) => career.ability[ability] >= limits[ability])) return '능력치최대'
  return null
}

/** 막힌 상태로 부르면 예외 — 조용히 넘기면 무엇이 잘못됐는지 알 수 없다 */
export function runTraining(career: PlayerCareer, menu: TrainingMenu, random: RandomPort): TrainingOutcome {
  const blockReason = blockReasonOf(career, menu)
  if (blockReason !== null) throw new Error(`훈련을 실행할 수 없습니다 (${blockReason}): ${menu.name}`)
  const outcome = isSpecialSwingMenu(menu) ? rollSpecialSwingTraining(career, menu, random) : rollAbilityTraining(career, menu, random)
  // 훈련 횟수는 칭호 23·24 의 조건이라 능력 훈련·필살타법 양쪽 모두 센다
  return { ...outcome, career: countTraining(outcome.career, menu.id) }
}
