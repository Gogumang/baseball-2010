import type { AnimationEntry } from '@/shared/lib/sprite/useFrameOrigins'

export interface AnimationStep {
  /** 애니메이션의 몇 번째 칸인지 (원작 currentFrame) */
  readonly entryIndex: number
  /** 그릴 PZX 프레임 번호 */
  readonly frame: number
  /** 그 칸에서 더하는 이동 (PZX 애니메이션 dx/dy) */
  readonly dx: number
  readonly dy: number
}

/** binary.mod 0x93d90: 지연 0 은 1 로 올린다. 칸마다 지연만큼 갱신이 지나야 다음 칸이다. */
function updatesOf(entry: AnimationEntry): number {
  return Math.max(1, entry.delay)
}

/** 갱신 횟수에 맞는 칸. 반복 재생이라 끝에 닿으면 처음으로 돈다. */
export function animationStepAt(entries: readonly AnimationEntry[], update: number): AnimationStep | null {
  if (entries.length === 0) return null

  const cycle = entries.reduce((total, entry) => total + updatesOf(entry), 0)
  let remaining = Math.max(0, update) % cycle
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]
    const length = updatesOf(entry)
    if (remaining < length) return { entryIndex: index, frame: entry.frame, dx: entry.dx ?? 0, dy: entry.dy ?? 0 }
    remaining -= length
  }
  const last = entries[entries.length - 1]
  return { entryIndex: entries.length - 1, frame: last.frame, dx: last.dx ?? 0, dy: last.dy ?? 0 }
}
