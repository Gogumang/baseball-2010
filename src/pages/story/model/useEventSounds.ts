import { useLayoutEffect, useRef } from 'react'
import type { EventStep } from '@/entities/story/model/eventScript'
import { playEventSound } from '@/entities/story/model/eventSound'
import { activeSound } from '@/shared/api/audio/soundPort'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { soundTimelineOf } from '@/pages/story/lib/eventBackdrop'
import { stepKeyOf } from '@/pages/story/model/useScreenEffect'

/**
 * 걸음 사이에 지나온 **소리 명령(6)** 을 그 명령이 도는 틀에 낸다 (`entities/story/model/eventSound` — 0x8d470).
 * 틀 셈은 화면효과와 같다(`soundTimelineOf`). 칸마다 한 번 — 개발 모드가 이펙트를 다시 돌려도 두 번 안 낸다.
 * 걸음이 바뀌면(건너뛰기 등) 아직 안 난 소리는 버린다.
 */
export function useEventSounds(step: EventStep): void {
  /** 이 걸음에서 이미 낸 소리 칸 — 개발 모드의 이펙트 재실행이 다시 내지 않게 */
  const playedRef = useRef<{ key: string; played: Set<number> }>({ key: '', played: new Set() })
  useLayoutEffect(() => {
    const key = stepKeyOf(step)
    if (playedRef.current.key !== key) playedRef.current = { key, played: new Set() }
    const { played } = playedRef.current
    const timers = soundTimelineOf(step.passed).flatMap(({ id, start }, index) => played.has(index)
      ? []
      : [window.setTimeout(() => {
        played.add(index)
        playEventSound(activeSound(), id)
      }, start * millisecondsPerFrame())])
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [step])
}
