import { useEffect } from 'react'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { DefenseScreen } from '@/pages/defense/ui/DefenseScreen'
import type { DefenseViewState } from '@/pages/defense/lib/defenseView'

interface DefensePlaybackProps {
  /** 한 플레이의 매 틱 스냅샷 — `features/defense-play` 의 진행기가 만든 것 */
  readonly ticks: readonly DefenseViewState[]
  /** 마지막 틱까지 다 보여 준 뒤 */
  readonly onDone: () => void
  /** 다 본 뒤 잠깐 멈춰 두는 갱신 횟수 — 마지막 장면이 스치듯 지나가지 않게 */
  readonly holdUpdates?: number
  readonly children?: React.ReactNode
}

/** 원작 경기 루프는 한 갱신에 한 틱이다 (0xc2198) */
const UPDATES_PER_TICK = 1
const DEFAULT_HOLD_UPDATES = 8

/**
 * 수비 한 플레이를 틱 순서대로 보여 준다.
 *
 * 원본은 타구가 뜬 순간 경기 장면 상태가 0x11 → 0x13 → 0x17(수비 인플레이)로 넘어가
 * 공이 멈출 때까지 같은 루프를 돈다 (R10 · I 문서). 웹은 타석 결과가 먼저 정해지고
 * 진행기가 그 플레이를 통째로 계산해 두므로, 여기서는 **계산해 둔 틱을 재생만** 한다.
 */
export function DefensePlayback({ ticks, onDone, holdUpdates = DEFAULT_HOLD_UPDATES, children }: DefensePlaybackProps) {
  const update = useUpdateCounter(ticks.length > 0)
  const lastIndex = Math.max(0, ticks.length - 1)
  const index = Math.min(Math.floor(update / UPDATES_PER_TICK), lastIndex)
  const isFinished = ticks.length === 0 || update >= lastIndex * UPDATES_PER_TICK + holdUpdates

  useEffect(() => {
    if (isFinished) onDone()
  }, [isFinished, onDone])

  const state = ticks[index]
  if (state === undefined) return null
  return <DefenseScreen state={state}>{children}</DefenseScreen>
}
