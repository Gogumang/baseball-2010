import { useEffect, useState } from 'react'
import { createGameSceneDrawGate, isGameSceneFrozen } from '@/shared/lib/commonWindow/commonWindow'

/**
 * **창이 선 첫 그림([창+0x250])의 수** — 켜진 뒤 공용 창이 서서 경기 장면이 멈출 때마다 하나씩 오른다.
 *
 * 경기 장면 0x52c50 은 창이 서 있으면 52cc6 에서 갱신을 건너뛰지만, 창이 선 첫 그림은 52efe 를 지나 그리기 표 0xd05a0 을 한 번 더
 * 돈다(갱신 없이 — `commonWindow.createGameSceneDrawGate`). 그 그림의 그리기 쪽 셈(애니 0x93d91 · 그림이 올리는 칸)을 부품이 한 번 더
 * 돌리도록 센다. 켜질 때 이미 멈춰 있었으면 그 멈춤은 안 센다(타석 `useStageAnimation` 의 문과 같다).
 */
export function useGameSceneRedrawCount(isRunning = true): number {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!isRunning) return undefined
    const gate = createGameSceneDrawGate()
    let handle = 0
    const tick = () => {
      if (isGameSceneFrozen() && gate.allowsDraw()) setCount((previous) => previous + 1)
      handle = requestAnimationFrame(tick)
    }
    handle = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(handle)
  }, [isRunning])

  return count
}
