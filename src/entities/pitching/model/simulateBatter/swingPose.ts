import type { CpuPitchOutcome, CpuSwingPose } from '@/entities/pitching/model/simulateBatter/types'

/** 휘두른 공이면 장면 스윙 재료, 아니면 null */
export function cpuSwingPoseOf(outcome: CpuPitchOutcome): CpuSwingPose | null {
  return outcome.swingFrame === undefined ? null : { frame: outcome.swingFrame, buntKind: outcome.buntKind ?? 0 }
}
