import { useState } from 'react'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { initialSeasonCardFigure, stepSeasonCardFigure } from '@/pages/season/lib/seasonPlayerCard'
import type { SeasonCardFigureState } from '@/pages/season/lib/seasonPlayerCard'

interface FigureMemory {
  readonly tick: number
  readonly state: SeasonCardFigureState
  readonly key: string
}

/** 들고 있던 자세를 틱까지 0x45e8 로 걷는다 — 열쇠가 바뀌거나 틱이 되돌아가면(다시 들어옴) 처음부터. 바뀐 게 없으면 같은 것을 돌려준다 */
function figureMemoryAt(memory: FigureMemory, tick: number, isBatter: boolean, form: number, isAnimating: boolean): FigureMemory {
  const key = `${isBatter}:${form}`
  const isRestart = memory.key !== key || tick < memory.tick
  const current = isRestart ? { tick: -1, state: initialSeasonCardFigure(isBatter, form), key } : memory
  if (!isAnimating || current.tick === tick) return current
  let { state } = current
  for (let step = current.tick + 1; step <= tick; step += 1) state = stepSeasonCardFigure(state, step, isBatter)
  return { tick, state, key }
}

/**
 * 0x45e8 를 갱신마다 한 번 — 상태 틱이 되돌아가면(다시 들어옴) 처음부터. 걸은 자세는 렌더가 읽고 고치는 칸에 든다(예전 ref 그대로 —
 * 틱마다 한 번 그리고, 굴림 없는 순수 계산이라 다시 그려도 같다)
 */
export function useSeasonCardFigurePose(isBatter: boolean, form: number, isAnimating: boolean): number {
  const tick = useUpdateCounter(isAnimating)
  const [figure] = useState(() => {
    let memory: FigureMemory = { tick: -1, state: initialSeasonCardFigure(isBatter, form), key: `${isBatter}:${form}` }
    return {
      poseAt(nextTick: number, batter: boolean, nextForm: number, animating: boolean): number {
        memory = figureMemoryAt(memory, nextTick, batter, nextForm, animating)
        return memory.state.pose
      },
    }
  })
  return figure.poseAt(tick, isBatter, form, isAnimating)
}
