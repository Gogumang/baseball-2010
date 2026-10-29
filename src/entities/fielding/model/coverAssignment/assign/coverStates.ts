import { AI_STATE, NONE, type FielderState } from '@/entities/fielding/model/fieldingState'

/** b2564 — 이 AI 의 야수는 커버 상태를 안 받는다: 협살(8) · 쫓기(1) · 받기 대기(9) */
const KEEPS_OWN_STATE: readonly number[] = [AI_STATE.RUNDOWN, AI_STATE.CHASE, AI_STATE.RECEIVE]

/**
 * b2564 — 커버 야수는 AI 루 + 2 로 그 루에. b2592: 플레이 +0x110(파울)이 서 있으면 모두 건너뛴다.
 */
export function coverStatesOf(
  covers: readonly number[],
  fielders: readonly FielderState[],
  foulFlag: boolean | undefined,
): { slot: number; base: number }[] {
  if (foulFlag === true) return []
  return covers.flatMap((slot, base) => {
    if (slot === NONE) return []
    const fielder = fielders[slot]
    if (fielder === undefined || KEEPS_OWN_STATE.includes(fielder.aiState)) return []
    return [{ slot, base }]
  })
}
