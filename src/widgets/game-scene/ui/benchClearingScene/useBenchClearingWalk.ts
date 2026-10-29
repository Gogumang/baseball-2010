import { useRenderMachine } from '@/shared/lib/renderMachine/useRenderMachine'
import {
  type BenchClearingWalkInput,
  type BenchClearingWalkState,
  startBenchClearingWalk,
  stepBenchClearingWalk,
} from '@/widgets/game-scene/ui/benchClearingScene/otherSlices'

interface BenchWalkMemory {
  readonly field: BenchClearingWalkInput
  readonly tick: number
  readonly state: BenchClearingWalkState
}

interface BenchWalkInput {
  readonly field: BenchClearingWalkInput | undefined
  readonly tick: number
  readonly targetRolls: readonly number[] | null
}

/** 같은 판 재료인가 — 진입 굴림 · 공격 쪽 · 좌타가 같으면 앞 걸음을 이어 간다 */
function isSameField(previous: BenchWalkMemory | null, field: BenchClearingWalkInput): previous is BenchWalkMemory {
  return (
    previous !== null &&
    previous.field.entryRolls === field.entryRolls &&
    previous.field.offenseSide === field.offenseSide &&
    previous.field.isLeftBatter === field.isLeftBatter
  )
}

/** 판 재료가 없으면 앞 걸음을 그대로 들고 있는다(다시 오면 이어 굴린다) */
function advanceBenchWalkMemory(previous: BenchWalkMemory | null, { field, tick, targetRolls }: BenchWalkInput): BenchWalkMemory | null {
  if (field === undefined) return previous
  const canContinue = isSameField(previous, field) && previous.tick <= tick
  const start = canContinue ? previous : { field, tick: -1, state: startBenchClearingWalk(field) }
  let { state } = start
  for (let t = start.tick + 1; t <= tick; t += 1) state = stepBenchClearingWalk(state, t, field, targetRolls)
  return { field, tick: Math.max(tick, start.tick), state }
}

/** 틱마다 한 걸음씩 — 진입부터 다시 굴리지 않게 지난 상태를 들고 있는다 */
export function useBenchClearingWalk(
  field: BenchClearingWalkInput | undefined,
  tick: number,
  targetRolls: readonly number[] | null,
): BenchClearingWalkState | null {
  const memory = useRenderMachine<BenchWalkMemory | null, BenchWalkInput>(advanceBenchWalkMemory, { field, tick, targetRolls })
  return field === undefined ? null : (memory?.state ?? null)
}
