import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { setAppTickInterval } from '@/shared/lib/frameClock/frameClock'
import { useMirrorRef } from '@/shared/lib/mirrorRef/useMirrorRef'
import { BURST_WINDOW_START, burstObjectTicks, tickBurstWindow } from '@/widgets/burst-mission/lib/burstMissionWindowLayout'
import type { BurstWindowState } from '@/widgets/burst-mission/lib/burstMissionWindowLayout'

/**
 * 창 갱신 0x8e5b8 을 앱 틱마다 — 넘김 표시 차례 [+0x224] 는 경기 내내 이어 세므로 `burstObjectTicks` 에서 받고 돌려 적는다.
 * `draws` 는 그린 수(초상 애니는 그린 뒤 한 칸 나아간다 — 0x93d91). `stateRef` 는 키 · 누름이 읽는 마지막 창 상태다
 */
export function useBurstWindowClock(): {
  readonly state: BurstWindowState
  readonly draws: number
  readonly stateRef: RefObject<BurstWindowState>
} {
  const [state, setState] = useState<BurstWindowState>(() => tickBurstWindow({ ...BURST_WINDOW_START, ticks: burstObjectTicks.value }))
  const [draws, setDraws] = useState(0)
  const stateRef = useRef(state)
  useMirrorRef(stateRef, state)

  useEffect(() => {
    burstObjectTicks.value = stateRef.current.ticks
    const timer = setAppTickInterval(() => {
      const next = tickBurstWindow(stateRef.current)
      burstObjectTicks.value = next.ticks
      stateRef.current = next
      setState(next)
      setDraws((count) => count + 1)
    })
    return () => timer()
  }, [])
  return { state, draws, stateRef }
}
