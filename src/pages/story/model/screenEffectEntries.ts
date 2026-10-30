import { effectorEndingFrameOf, effectorPhaseAt } from '@/pages/story/lib/eventBackdrop'
import type { EffectTimelineEntry } from '@/pages/story/lib/eventBackdrop'
import type { ScreenEffectView } from '@/pages/story/model/useScreenEffect'

/** 지나온 명령 5 효과들(`effectTimelineOf`)을 틀마다 읽는 판정 — `useScreenEffect` 의 그리기가 쓴다 */
type Entries = readonly EffectTimelineEntry[]

/** `frame` 틀에 효과기를 쥔 마지막 명령(종류가 있는 것) */
export function activeEntryAt(entries: Entries, frame: number): number {
  let active = -1
  entries.forEach((entry, index) => {
    if (entry.kind !== null && entry.start <= frame) active = index
  })
  return active
}

/** [mgr+0x2c4] 만 바꾼 그림 값 */
export const withLastEffectId =
  (lastEffectId: number) =>
  (previous: ScreenEffectView): ScreenEffectView => ({ ...previous, lastEffectId })

/**
 * 효과 `index`(종류가 있는 것)의 '끝' 그리기 — 뒤 효과에 덮이기 전에 끝 그리기에 닿았으면 '끝', 덮였으면 그 틀부터 '덮임'
 * (끝 그리기 없이 지나간 것으로 센다), 아직이면 null
 */
export function effectEndAt(entries: Entries, index: number, frameIndex: number): '끝' | '덮임' | null {
  const entry = entries[index]
  if (entry.kind === null) return null
  const endFrame = entry.start + effectorEndingFrameOf(entry.kind) + 1
  const overriddenAt = entries.slice(index + 1).find((later) => later.kind !== null)?.start ?? Infinity
  if (overriddenAt <= endFrame) return overriddenAt <= frameIndex ? '덮임' : null
  return frameIndex < endFrame ? null : '끝'
}

/** 걸음을 푼 뒤에도 그리기를 이어 가는가 — 쥔 효과가 아직 돌거나, 뒤에 효과기를 쥘 명령이 남았다 */
export function effectStillRuns(entries: Entries, active: number, frameIndex: number): boolean {
  if (active === -1) return false
  const entry = entries[active]
  const phase = entry.kind === null ? '없음' : effectorPhaseAt(entry.kind, frameIndex - entry.start)
  return phase !== '없음' || activeEntryAt(entries, Infinity) !== active
}
