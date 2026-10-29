import { useEffect, useRef, useState } from 'react'
import { appTickNow, appTickOf } from '@/shared/lib/frameClock/frameClock'

/**
 * 원작 게임 루프의 갱신 횟수를 센다 — 켜진 앱 틱부터 지금 앱 틱까지(`appTickOf`). 켜져 있는 동안 계속 오른다 (반복 애니메이션용).
 * 화면 부품이 모두 같은 앱 틱 격자로 세므로 따로 켜진 부품끼리도 같은 틀에 오른다(원본 장면 프레임은 한 틀에 한 번 돈다).
 */
export function useUpdateCounter(isRunning = true): number {
  const [update, setUpdate] = useState(0)
  const startTickRef = useRef(0)

  useEffect(() => {
    if (!isRunning) return
    startTickRef.current = appTickNow()
    let handle = 0
    /** 마지막으로 올린 값 — 같은 값이면 상태를 안 건드린다(틀마다 같은 값을 넣어 React 를 깨우지 않게) */
    let lastUpdate: number | null = null
    const tick = (now: number) => {
      const next = Math.max(0, appTickOf(now) - startTickRef.current)
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
