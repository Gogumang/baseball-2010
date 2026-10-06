import { useEffect, useRef, useState } from 'react'
import { screenEffectFrameAt, screenEffectsIn } from '@/entities/story/model/screenEffect'
import type { ScreenEffectFrame } from '@/entities/story/model/screenEffect'
import type { EventStep } from '@/entities/story/model/eventScript'
import { vibrate } from '@/entities/defense-controls/model/vibration'
import { millisecondsPerFrame } from '@/shared/config/frameRate'

/**
 * 이벤트 명령 5 화면효과를 재생한다 (`entities/story/model/screenEffect` 머리말).
 *
 * 걸음(step)이 바뀌면 그 사이 지나온 명령 5 들을 원본 차례대로 푼다 — 진동은 하나씩 울리고(0x3a44,
 * 환경설정 진동이 켜졌을 때만), 효과기는 마지막으로 건 것이 프레임마다 돈다(그리기 0xbd844 를 게임 프레임마다 한 번).
 * 효과기는 전역 하나라 다음 명령으로 넘어가도 끝날 때까지 돌고, 새 효과가 걸리면 덮인다.
 */
export function useScreenEffect(step: EventStep, isVibrationOn: boolean): ScreenEffectFrame | null {
  const [frame, setFrame] = useState<ScreenEffectFrame | null>(null)
  const handledRef = useRef<string | null>(null)
  const handleRef = useRef(0)
  const isVibrationOnRef = useRef(isVibrationOn)
  isVibrationOnRef.current = isVibrationOn

  // 효과기는 전역 하나라 다음 명령으로 넘어가도 끝날 때까지 돈다 — 화면을 떠날 때만 멈춘다
  useEffect(() => () => cancelAnimationFrame(handleRef.current), [])

  useEffect(() => {
    const { vibrations, last } = screenEffectsIn(step.passed)
    // 진동은 걸음마다 한 번만 — 개발 모드가 이펙트를 다시 돌려도(효과 그림은 다시 시작해도 무해) 두 번 울리지 않게
    const key = `${step.cursor.eventId}:${step.cursor.commandIndex}`
    if (handledRef.current !== key) {
      handledRef.current = key
      for (const milliseconds of vibrations) vibrate(milliseconds, isVibrationOnRef.current)
    }
    if (last === null) return

    // 새로 걸면 앞 효과를 덮는다 (0xbdae8)
    cancelAnimationFrame(handleRef.current)
    const startedAt = performance.now()
    const tick = (now: number) => {
      const current = screenEffectFrameAt(last.kind, last.color, Math.floor((now - startedAt) / millisecondsPerFrame()))
      setFrame(current)
      if (current !== null) handleRef.current = requestAnimationFrame(tick)
    }
    setFrame(screenEffectFrameAt(last.kind, last.color, 0))
    handleRef.current = requestAnimationFrame(tick)
  }, [step])

  return frame
}
