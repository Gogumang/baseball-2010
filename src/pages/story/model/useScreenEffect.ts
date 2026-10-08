import { useEffect, useRef, useState } from 'react'
import { screenEffectFrameAt, screenEffectsIn } from '@/entities/story/model/screenEffect'
import type { ScreenEffectFrame } from '@/entities/story/model/screenEffect'
import type { EventStep } from '@/entities/story/model/eventScript'
import { vibrate } from '@/entities/defense-controls/model/vibration'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { effectorPhaseAt, lastEffectIdIn } from '@/pages/story/lib/eventBackdrop'
import type { EffectorPhase } from '@/pages/story/lib/eventBackdrop'

export interface ScreenEffectView {
  /** 효과기가 이 프레임에 칠하는 덮개 · 흔들기 오프셋. 없으면 null */
  readonly frame: ScreenEffectFrame | null
  /** 대화창 0x8b5ac 가 이 그리기에서 본 효과기 단계 (`effectorPhaseAt`) */
  readonly phase: EffectorPhase
  /** 효과기를 건 차례 — 건 때마다 1 씩 는다(같은 '끝' 을 두 번 세지 않게) */
  readonly serial: number
  /** [mgr+0x2c4] — 지나온 마지막 명령 5 의 id (없었으면 null — 부르는 쪽이 앞 값을 둔다) */
  readonly lastEffectId: number | null
}

/**
 * 이벤트 명령 5 화면효과를 재생한다 (`entities/story/model/screenEffect` 머리말).
 *
 * 걸음(step)이 바뀌면 그 사이 지나온 명령 5 들을 원본 차례대로 푼다 — 진동은 하나씩 울리고(0x3a44,
 * 환경설정 진동이 켜졌을 때만), 효과기는 마지막으로 건 것이 프레임마다 돈다(그리기 0xbd844 를 게임 프레임마다 한 번).
 * 효과기는 전역 하나라 다음 명령으로 넘어가도 끝날 때까지 돌고, 새 효과가 걸리면 덮인다.
 * 덮개가 걷힌 뒤에도 대화창 0x8b5ac 가 '끝'(+0x10 = 2)을 한 번 더 보므로 그 그리기까지 돈다.
 */
export function useScreenEffect(
  step: EventStep,
  isVibrationOn: boolean,
  /** 대화창이 '끝'(+0x10 = 2)을 처음 보는 그리기 — 효과기 한 번에 한 번 (`drawEventBackdrop`) */
  onEnd?: () => void,
): ScreenEffectView {
  const [view, setView] = useState<{ frame: ScreenEffectFrame | null; phase: EffectorPhase; serial: number }>(
    { frame: null, phase: '없음', serial: 0 },
  )
  const handledRef = useRef<string | null>(null)
  const handleRef = useRef(0)
  const serialRef = useRef(0)
  const isVibrationOnRef = useRef(isVibrationOn)
  isVibrationOnRef.current = isVibrationOn
  const onEndRef = useRef(onEnd)
  onEndRef.current = onEnd

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
    serialRef.current += 1
    const serial = serialRef.current
    const startedAt = performance.now()
    // 프레임이 건너뛰어도 '끝' 그리기는 꼭 한 번 거친다 — [mgr+0x2c8] 을 바꾸는 그리기다
    let isEndSeen = false
    const tick = (now: number) => {
      const frameIndex = Math.floor((now - startedAt) / millisecondsPerFrame())
      const reached = effectorPhaseAt(last.kind, frameIndex)
      const phase = reached === '없음' && !isEndSeen ? '끝' : reached
      if (phase === '끝' && !isEndSeen) {
        isEndSeen = true
        onEndRef.current?.()
      }
      setView({ frame: screenEffectFrameAt(last.kind, last.color, frameIndex), phase, serial })
      if (phase !== '없음') handleRef.current = requestAnimationFrame(tick)
    }
    setView({ frame: screenEffectFrameAt(last.kind, last.color, 0), phase: effectorPhaseAt(last.kind, 0), serial })
    handleRef.current = requestAnimationFrame(tick)
  }, [step])

  return { ...view, lastEffectId: lastEffectIdIn(step.passed) }
}
