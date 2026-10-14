import { useEffect, useState } from 'react'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { radarGrowthAt, radarGrowthStart, radarObject } from '@/pages/management/lib/radarGrowth'
import type { RadarGrowthState } from '@/pages/management/lib/radarGrowth'

interface Segment {
  readonly key: string
  /** 다시 만든 그림 (그림 수) */
  readonly startDraw: number
  readonly start: RadarGrowthState
}

/**
 * 레이더 [skin+0xd4] 의 자라는 애니 (`lib/radarGrowth`) — 이 그림의 축별 지금값을 돌려준다.
 * 화면에 붙을 때 0 에서 자라고(들어옴 · +0xad = 0 · +0x1e3 = 0), 목표값이 바뀌면(장비 끼워 보기 0x81938 → +0x1e3 = 0)
 * 바뀐 그림에서 지난 목표값부터 새 값으로 다시 오르내린다.
 */
export function useRadarGrowth(targets: readonly number[]): readonly number[] {
  const draws = useUpdateCounter()
  const key = targets.join(',')
  const [segment, setSegment] = useState<Segment>(() => ({
    key, startDraw: 0, start: radarGrowthStart(radarObject.previous, radarObject.hasPrevious, targets.length, true),
  }))
  let active = segment
  if (segment.key !== key) {
    // 0x81938 은 +0x1e3 만 지운다 — 다음 그림의 0x75ebc 가 지금값을 지난 목표값(+0xad 면)으로 다시 둔다
    const reached = radarGrowthAt(segment.start, segment.key.split(',').map(Number), Math.max(0, draws - segment.startDraw - 1))
    active = { key, startDraw: draws, start: radarGrowthStart(reached.previous, reached.hasPrevious, targets.length, false) }
    setSegment(active)
  }
  const state = radarGrowthAt(active.start, targets, Math.max(0, draws - active.startDraw))
  useEffect(() => {
    radarObject.previous = state.previous
    radarObject.hasPrevious = state.hasPrevious
  })
  return state.current
}
