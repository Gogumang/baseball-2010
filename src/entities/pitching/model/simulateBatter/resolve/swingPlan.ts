import { remainingAfterSpecialSwing } from '@/entities/pitching/model/simulateBatter/otherSlices'
import type { BatterAbility } from '@/entities/pitching/model/simulateBatter/otherSlices'
import { cpuBuntKindOf, cpuSpecialSwingNumberOf } from '@/entities/pitching/model/simulateBatter/decision/buntAndSpecial'
import { cpuSwingTimingOffsetOf } from '@/entities/pitching/model/simulateBatter/decision/swingTiming'
import type { CpuBatterTraits, CpuPitchOutcome, CpuSwingChoice } from '@/entities/pitching/model/simulateBatter/types'
import type { PitchResolution } from '@/entities/pitching/model/simulateBatter/otherSlices'
import type { Pitch } from '@/entities/pitching/model/pitch'
import type { RandomPort } from '@/shared/api/random/randomPort'

/** 스윙 프레임 F = N − 2 + d — d = 0 이 타이밍 100 이다 (0x34be0) */
const SWEET_FRAME_OFFSET = 2

/** 휘두르기로 정한 공의 장면 칸 — 스윙 프레임 +0xfd8 · 번트 종류 +0xfdc · 필살 번호 S+0x10 · 스윙 틱 뒤 남은 필살 횟수 */
export interface CpuSwingPlan {
  readonly frame: number
  readonly buntKind: number
  readonly specialNumber: number
  readonly isSpecialSwing: boolean
  readonly remainingAfter: number | null
}

/** 0x34468~0x34488 — 마타자는 남은 횟수가 있으면 무조건 필살 (난수 없음). 필살 재료를 안 넘겼으면 0 */
function specialNumberOfTraits(traits: CpuBatterTraits): number {
  const special = traits.specialSwing
  if (special === undefined) return 0
  return cpuSpecialSwingNumberOf({ isMagicBatter: traits.isMagicBatter === true, swingNumber: special.swingNumber, remaining: special.remaining })
}

/** 0x4e136 — 스윙 틱에 소모 (결과와 무관). 필살 재료를 안 넘겼으면 null */
function remainingAfterSwing(remainingBefore: number | null, isSpecialSwing: boolean): number | null {
  if (remainingBefore === null || !isSpecialSwing) return remainingBefore
  return remainingAfterSpecialSwing(remainingBefore)
}

/** 0x34334 → 0x340f8 타이밍 굴림 → 0x3445a 번트 종류 굴림(타이밍 **뒤**) → S+0x10 (난수 없음) */
export function rollCpuSwingPlan(
  pitch: Pitch,
  batter: BatterAbility,
  choice: CpuSwingChoice,
  traits: CpuBatterTraits,
  remainingBefore: number | null,
  random: RandomPort,
): CpuSwingPlan {
  const frame = pitch.frameCount - SWEET_FRAME_OFFSET + cpuSwingTimingOffsetOf(batter.hit, random, traits.isMistakePitch === true)
  const buntKind = cpuBuntKindOf(choice, traits.isMagicBatter === true, random)
  const specialNumber = specialNumberOfTraits(traits)
  const isSpecialSwing = specialNumber !== 0
  return { frame, buntKind, specialNumber, isSpecialSwing, remainingAfter: remainingAfterSwing(remainingBefore, isSpecialSwing) }
}

/** 휘두른 공은 0x34436~0x34464 가 +0xfdc 에 이 공의 번트 종류(0 · 1~3)를 썼다 — 헛스윙 · 파울 · 타구 모두 싣는다 */
export function swungOutcomeOf(plan: CpuSwingPlan, resolution: PitchResolution, isUncatchable: boolean): CpuPitchOutcome {
  return {
    resolution,
    isSpecialSwing: plan.isSpecialSwing,
    specialSwingRemaining: plan.remainingAfter,
    isUncatchable,
    buntKind: plan.buntKind,
    swingFrame: plan.frame,
  }
}
