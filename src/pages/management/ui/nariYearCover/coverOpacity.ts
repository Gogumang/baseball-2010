import { screenEffectFrameAt } from '@/entities/story/model/screenEffect'
import type { YearCoverStep } from '@/pages/management/lib/nariYearCover'

/** 효과기 덮개 — 종류 1 은 '검정에서밝아짐'(실제로는 어두워짐) · 종류 2 는 '검게어두워짐'(실제로는 밝아짐), 이름은 `screenEffect` 그대로 */
export function coverOpacityOf(step: YearCoverStep): number {
  if (step.kind === '관리') return 0
  const fadeOut = step.fadeOutFrame === null ? null : screenEffectFrameAt('검정에서밝아짐', '검정', step.fadeOutFrame)
  const fadeIn = step.fadeInFrame === null ? null : screenEffectFrameAt('검게어두워짐', '검정', step.fadeInFrame)
  return (fadeIn ?? fadeOut)?.overlay?.opacity ?? 0
}
