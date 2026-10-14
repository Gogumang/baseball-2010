import { useEffect, useState } from 'react'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { radarGrowthAt, radarGrowthStart, radarObject } from '@/shared/lib/radarGrowth/radarGrowth'
import type { RadarGrowthState } from '@/shared/lib/radarGrowth/radarGrowth'

interface Segment {
  readonly restartKey: string
  readonly targets: readonly number[]
  /** 다시 만든 그림 (그림 수) */
  readonly startDraw: number
  readonly start: RadarGrowthState
}

export interface RadarGrowthOptions {
  /**
   * 이 값이 바뀐 그림에서 도형을 다시 만든다([anim+0x1e3] = 0 → 0x75ebc 가 지금값을 지난 목표값(+0xad 면)으로 다시 둔다).
   * 안 주면 목표값이 바뀔 때 — 장비 끼워 보기 0x81938 이 그렇다. 목록 0x63b14 는 **격자 커서가 움직인 그림**(커서 +0x25,
   * 0x63c36~0x63c56)이라 목록 화면은 커서 칸 번호를 넘긴다 — 같은 값의 칸으로 옮겨도 다시 만든다.
   */
  readonly restartKey?: string | number
  /**
   * 붙을 때 0 에서 자라나(들어옴이 +0xad = 0 · +0x1e3 = 0 을 쓴다). 거짓이면 레이더 객체가 들고 있던 지난 목표값에서 이어 간다 —
   * 같은 상태 안에서 하위 화면만 바뀌어 들어옴을 다시 안 거치는 곳(에디트 하위 1 · 2 → 0)이 그렇다. 기본 참.
   */
  readonly fromZero?: boolean
}

/**
 * 레이더 [skin+0xd4] 의 자라는 애니 (`radarGrowth`) — 이 그림의 축별 지금값을 돌려준다.
 * 화면에 붙을 때 0 에서 자라고(들어옴 · +0xad = 0 · +0x1e3 = 0), `restartKey` 가 바뀌면 바뀐 그림에서
 * 지난 목표값부터 새 값으로 다시 오르내린다.
 */
export function useRadarGrowth(targets: readonly number[], { restartKey, fromZero = true }: RadarGrowthOptions = {}): readonly number[] {
  const draws = useUpdateCounter()
  const key = restartKey === undefined ? targets.join(',') : String(restartKey)
  const [segment, setSegment] = useState<Segment>(() => ({
    restartKey: key, targets, startDraw: 0, start: radarGrowthStart(radarObject.previous, radarObject.hasPrevious, targets.length, fromZero),
  }))
  let active = segment
  if (segment.restartKey !== key) {
    // 다시 만들기 앞 그림까지 굴린 값에서 지난 목표값 · 깃발을 넘겨받는다
    const reached = radarGrowthAt(segment.start, segment.targets, Math.max(0, draws - segment.startDraw - 1))
    active = { restartKey: key, targets, startDraw: draws, start: radarGrowthStart(reached.previous, reached.hasPrevious, targets.length, false) }
    setSegment(active)
  }
  const state = radarGrowthAt(active.start, targets, Math.max(0, draws - active.startDraw))
  useEffect(() => {
    radarObject.previous = state.previous
    radarObject.hasPrevious = state.hasPrevious
  })
  return state.current
}
