import { useEffect, useState } from 'react'
import type { MutableRefObject } from 'react'
import { gameSceneTickNow, gameSceneTickOf, gameSceneTimeOf } from '@/shared/lib/commonWindow/commonWindow'

/**
 * **경기 장면의 갱신 횟수** — 켜진 장면 틱부터 지금 장면 틱까지 센 수(`gameSceneTickOf`). 장면 부품이 모두 같은 장면 틱 격자로
 * 세므로 부품마다 다른 때 켜져도 경계가 틱 안쪽에서 갈리지 않는다(원본은 경기 장면 0x52c50 이 한 틀에 한 번 갱신한다).
 * 공용 창 [0x140005c]+9 가 서 있는 동안 경기 장면 0x52c50 은 52cc6 에서 갱신을 통째로 건너뛰므로(장면 틱 0xbc9c9 · 키 0x498d4 ·
 * 갱신 표 0xd0530) 셈이 서고, 창이 닫히면 그 자리에서 이어 오른다 — 건너뛴 갱신을 따라잡지 않는다.
 *
 * `startTickRef` 를 넘기면 셈 0 이 든 장면 틱을 적어 준다 — 갱신 u 의 장면 틱은 (그 값 + u) 다(받은 키를 받은 틱 다음 갱신부터
 * 먹이는 쪽 — `sceneKeyLatch`).
 */
export function useGameSceneUpdateCounter(isRunning = true, startTickRef?: MutableRefObject<number | null>): number {
  const [update, setUpdate] = useState(0)

  useEffect(() => {
    if (!isRunning) return
    const startTick = gameSceneTickNow()
    if (startTickRef !== undefined) startTickRef.current = startTick
    let handle = 0
    /** 마지막으로 올린 값 — 같은 값이면 상태를 안 건드린다(틀마다 같은 값을 넣어 React 를 깨우지 않게) */
    let lastUpdate: number | null = null
    const tick = (now: number) => {
      const next = Math.max(0, gameSceneTickOf(gameSceneTimeOf(now)) - startTick)
      if (next !== lastUpdate) {
        lastUpdate = next
        setUpdate(next)
      }
      handle = requestAnimationFrame(tick)
    }
    handle = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(handle)
  }, [isRunning, startTickRef])

  return update
}
