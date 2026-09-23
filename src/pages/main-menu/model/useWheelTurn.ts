import { useEffect, useRef, useState } from 'react'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { MENU_WHEEL_TURN_TICKS } from '@/pages/main-menu/lib/mainMenuLayout'

export interface WheelTurn {
  /** 돌기 시작할 때 고른 칸이던 번호 */
  readonly fromIndex: number
  /** 0..5 — 5 면 다 돌아 멈춘 상태다 */
  readonly counter: number
}

/**
 * 바퀴가 한 칸 도는 동안의 카운터.
 *
 * 원본은 카운터 [0x1552d64] 를 0→4 로 세고 5틱에 한 칸을 옮긴다 (0x24c42~0x24c4c 확정).
 * 그 동안 각 칸의 각은 `표값 ± 카운터×9` (90° 벌어진 칸은 ×18) 로 움직인다 (0x24de6 확정).
 * 여기서는 카운터만 세고, 각 계산은 `mainMenuLayout.menuWheelTurnAngleOf` 가 한다.
 */
export function useWheelTurn(selectedIndex: number): WheelTurn {
  const [turn, setTurn] = useState<WheelTurn>({
    fromIndex: selectedIndex,
    counter: MENU_WHEEL_TURN_TICKS,
  })
  const previousRef = useRef(selectedIndex)

  useEffect(() => {
    const fromIndex = previousRef.current
    previousRef.current = selectedIndex
    if (fromIndex === selectedIndex) return undefined

    setTurn({ fromIndex, counter: 0 })
    const startedAt = performance.now()
    let handle = 0
    const tick = (now: number) => {
      const counter = Math.floor((now - startedAt) / millisecondsPerFrame())
      setTurn({ fromIndex, counter: Math.min(counter, MENU_WHEEL_TURN_TICKS) })
      if (counter >= MENU_WHEEL_TURN_TICKS) return
      handle = requestAnimationFrame(tick)
    }
    handle = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(handle)
  }, [selectedIndex])

  return turn
}
