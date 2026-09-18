export { animationStepAt } from '@/shared/lib/sprite/animationPlayback'
export type { AnimationStep } from '@/shared/lib/sprite/animationPlayback'

/** 동작표에서 지금 캐릭터 동작 번호. pose = table[min(칸, 길이−1)] (0x848d0). */
export function figurePoseAt(poses: readonly number[], entryIndex: number): number {
  if (poses.length === 0) return 0
  return poses[Math.min(Math.max(0, entryIndex), poses.length - 1)]
}
