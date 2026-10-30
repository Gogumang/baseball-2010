import type { FrameOrigins, useAnimations } from '@/shared/lib/sprite/useFrameOrigins'
import { animationFolderOf, type TrainingPresentation } from '@/shared/config/original/trainingAnimation'
import { animationStepAt } from '@/widgets/training-scene/lib/animationPlayback'

export type TrainingStep = NonNullable<ReturnType<typeof animationStepAt>>

/** 연출 애니 폴더 — 판이 없으면 기본 훈련 애니 */
export const trainingFolderOf = (presentation: TrainingPresentation | null): string => animationFolderOf(presentation?.file ?? 'raise_traning_ani')

/** 이 그림의 애니 칸 — 판 · 애니가 없거나 첫 틱 전이면 null */
export function trainingStepOf(
  presentation: TrainingPresentation | null,
  animations: ReturnType<typeof useAnimations>,
  update: number,
): TrainingStep | null {
  if (presentation === null || update < 0) return null
  const entries = animations?.[presentation.animation]
  return entries === undefined ? null : animationStepAt(entries, update)
}

/** 애니 칸의 그림 — 원점을 받기 전이면 null */
export function trainingFrameOf(step: TrainingStep | null, origins: FrameOrigins | null) {
  if (step === null) return null
  const frameKey = String(step.frame).padStart(3, '0')
  const origin = origins?.[frameKey]
  return origin === undefined ? null : { step, frameKey, origin }
}
