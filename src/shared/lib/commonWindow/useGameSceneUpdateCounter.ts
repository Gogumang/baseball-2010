import { useEffect, useState } from 'react'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { gameSceneNow, gameSceneTimeOf } from '@/shared/lib/commonWindow/commonWindow'

/**
 * **경기 장면의 갱신 횟수** — `useUpdateCounter` 와 같되 경기 장면 시계(`gameSceneTimeOf`)로 센다.
 * 공용 창 [0x140005c]+9 가 서 있는 동안 경기 장면 0x52c50 은 52cc6 에서 갱신을 통째로 건너뛰므로(장면 틱 0xbc9c9 · 키 0x498d4 ·
 * 갱신 표 0xd0530) 셈이 서고, 창이 닫히면 그 자리에서 이어 오른다 — 건너뛴 갱신을 따라잡지 않는다.
 */
export function useGameSceneUpdateCounter(isRunning = true): number {
  const [update, setUpdate] = useState(0)

  useEffect(() => {
    if (!isRunning) return
    const startedAt = gameSceneNow()
    let handle = 0
    /** 마지막으로 올린 값 — 같은 값이면 상태를 안 건드린다(틀마다 같은 값을 넣어 React 를 깨우지 않게) */
    let lastUpdate: number | null = null
    const tick = (now: number) => {
      const next = Math.floor((gameSceneTimeOf(now) - startedAt) / millisecondsPerFrame())
      if (next !== lastUpdate) {
        lastUpdate = next
        setUpdate(next)
      }
      handle = requestAnimationFrame(tick)
    }
    handle = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(handle)
  }, [isRunning])

  return update
}
