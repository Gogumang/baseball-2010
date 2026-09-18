import { useEffect, useState } from 'react'
import { millisecondsPerFrame } from '@/shared/config/frameRate'

/** 원작 게임 루프의 갱신 횟수를 센다. 켜져 있는 동안 계속 오른다 (반복 애니메이션용). */
export function useUpdateCounter(isRunning = true): number {
  const [update, setUpdate] = useState(0)

  useEffect(() => {
    if (!isRunning) return
    const startedAt = performance.now()
    let handle = 0
    const tick = (now: number) => {
      setUpdate(Math.floor((now - startedAt) / millisecondsPerFrame()))
      handle = requestAnimationFrame(tick)
    }
    handle = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(handle)
  }, [isRunning])

  return update
}
