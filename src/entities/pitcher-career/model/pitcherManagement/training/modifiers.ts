import { subItemMoraleRelief } from '@/entities/pitcher-career/model/pitcherManagement/otherSlices'
import type { TrainingModifiers } from '@/entities/pitcher-career/model/pitcherManagement/otherSlices'
import { isPitcherSkillEquipped } from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { BALANCE } from '@/shared/config/original/balance'

export interface IntegerRange {
  readonly minimum: number
  readonly maximumExclusive: number
}

/*
 * 병아리(0)·몹쓸몸(3)은 훈련 함수 0x17f5c 가 **장착** 비트(0xa4bf8 — 0x17ffc·0x1827a·0x182e2·0x18384·
 * 0x185ae·0x18612·0x18922)로 본다. 함수가 모드 3·4 공용이라 투수도 같다 (타자편 training.ts 와 같은 갈래).
 */
export const ROOKIE_SKILL = BALANCE.training.rookieSkillId
export const WEAK_BODY_SKILL = BALANCE.training.weakBodySkillId

/** bfa55(최소, 끝) 한 번 */
export function rollIn(random: RandomPort, range: IntegerRange): number {
  return random.rand(range.minimum, range.maximumExclusive)
}

/**
 * 굴린 사기 감소에 병아리 −1 · 몹쓸몸 +2 · 자동안마기(서브 4, `기록+0x5c`) −1 ([sp+0xf8]) 을 더한다.
 * 자동안마기는 능력치 갈래 0x188cc · 필살/마구 갈래 0x18036 모두 모드 갈림 없이 본다.
 */
export function trainingModifiersOf(career: PitcherCareer): TrainingModifiers {
  return {
    rookie: isPitcherSkillEquipped(career, ROOKIE_SKILL),
    weakBody: isPitcherSkillEquipped(career, WEAK_BODY_SKILL),
    massage: subItemMoraleRelief(career) > 0,
  }
}
