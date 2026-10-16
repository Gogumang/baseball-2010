import { useEffect, useState } from 'react'
import { millisecondsPerFrame } from '@/shared/config/frameRate'

/** 원작 게임 루프의 갱신 횟수를 센다. 켜져 있는 동안 계속 오른다 (반복 애니메이션용). */
export function useUpdateCounter(isRunning = true): number {
  const [update, setUpdate] = useState(0)

  useEffect(() => {
    if (!isRunning) return
    const startedAt = performance.now()
    let handle = 0
    /** 마지막으로 올린 값 — 같은 값이면 상태를 안 건드린다(틀마다 같은 값을 넣어 React 를 깨우지 않게) */
    let lastUpdate: number | null = null
    const tick = (now: number) => {
      const next = Math.floor((now - startedAt) / millisecondsPerFrame())
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
