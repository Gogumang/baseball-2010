import { useLayoutEffect, useRef, useState } from 'react'
import { screenEffectFrameAt } from '@/entities/story/model/screenEffect'
import type { ScreenEffectFrame } from '@/entities/story/model/screenEffect'
import type { EventStep } from '@/entities/story/model/eventScript'
import { vibrate } from '@/entities/defense-controls/model/vibration'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { effectTimelineOf, effectorEndingFrameOf, effectorPhaseAt } from '@/pages/story/lib/eventBackdrop'
import type { EffectorPhase, EffectTimelineEntry } from '@/pages/story/lib/eventBackdrop'

export interface ScreenEffectView {
  /** 효과기가 이 프레임에 칠하는 덮개 · 흔들기 오프셋. 없으면 null */
  readonly frame: ScreenEffectFrame | null
  /** 대화창 0x8b5ac 가 이 그리기에서 본 효과기 단계 (`effectorPhaseAt`) */
  readonly phase: EffectorPhase
  /** 효과기를 건 차례 — 건 때마다 1 씩 는다(같은 '끝' 을 두 번 세지 않게) */
  readonly serial: number
  /** [mgr+0x2c4] — 이 걸음에서 지금까지 돈 마지막 명령 5 의 id (아직 없으면 null — 부르는 쪽이 앞 값을 둔다) */
  readonly lastEffectId: number | null
}

/** 걸음의 열쇠 — 커서 자리 */
export function stepKeyOf(step: EventStep): string {
  return `${step.cursor.eventId}:${step.cursor.commandIndex}`
}

/** 이 걸음이 효과(id 4~7)를 기다리느라 멈출 명령을 아직 돌리지 않는가 — 열쇠가 풀린 걸음과 다르면 기다린다 */
export function isStepHeld(step: EventStep, releasedKey: string | null): boolean {
  return effectTimelineOf(step.passed).releaseFrame > 0 && releasedKey !== stepKeyOf(step)
}

/** `frame` 틀에 효과기를 쥔 마지막 명령(종류가 있는 것) */
function activeEntryAt(entries: readonly EffectTimelineEntry[], frame: number): number {
  let active = -1
  entries.forEach((entry, index) => {
    if (entry.kind !== null && entry.start <= frame) active = index
  })
  return active
}

/**
 * 이벤트 명령 5 화면효과를 재생한다 (`entities/story/model/screenEffect` 머리말).
 *
 * 걸음(step)이 바뀌면 그 사이 지나온 명령 5 들을 원본 차례대로 돌린다(`effectTimelineOf`) — id 4~7 은 효과가 끝날 때까지
 * 다음 명령을 막고(0x8b564), 나머지는 곧바로 넘긴다(뒤 효과가 효과기를 덮는다 — 0xbdae8). 진동은 그 명령이 도는 틀에
 * 울린다(0x3a44, 환경설정 진동이 켜졌을 때만). 막는 효과가 다 끝난 다음 틀에 `onRelease` — 그때 멈출 명령이 돈다.
 * 효과기는 전역 하나라 다음 걸음으로 넘어가도 끝날 때까지 돌고, 새 효과가 걸리면 덮인다.
 * 덮개가 걷힌 뒤에도 대화창 0x8b5ac 가 '끝'(+0x10 = 2)을 한 번 더 보므로 그 그리기까지 돈다.
 */
export function useScreenEffect(
  step: EventStep,
  isVibrationOn: boolean,
  /** 대화창이 '끝'(+0x10 = 2)을 보는 그리기 — 건 효과 하나에 한 번, 그 효과의 id 와 (`drawEventBackdrop`) */
  onEnd?: (effectId: number) => void,
  /** 막는 효과를 다 기다린 틀 — 이 걸음의 멈출 명령이 돈다 (`isStepHeld`) */
  onRelease?: (stepKey: string) => void,
): ScreenEffectView {
  const [view, setView] = useState<ScreenEffectView>(
    { frame: null, phase: '없음', serial: 0, lastEffectId: null },
  )
  const handledRef = useRef<string | null>(null)
  const handleRef = useRef(0)
  const serialRef = useRef(0)
  const isVibrationOnRef = useRef(isVibrationOn)
  isVibrationOnRef.current = isVibrationOn
  const onEndRef = useRef(onEnd)
  onEndRef.current = onEnd
  const onReleaseRef = useRef(onRelease)
  onReleaseRef.current = onRelease

  // 효과기는 전역 하나라 다음 명령으로 넘어가도 끝날 때까지 돈다 — 화면을 떠날 때만 멈춘다
  useLayoutEffect(() => () => cancelAnimationFrame(handleRef.current), [])

  // 레이아웃 이펙트 — 막지 않는 걸음은 그리기 전에 곧바로 풀어 멈출 명령이 한 번도 가려지지 않게 한다
  useLayoutEffect(() => {
    const key = stepKeyOf(step)
    const { entries, releaseFrame } = effectTimelineOf(step.passed)
    // 진동은 걸음마다 한 번만 — 개발 모드가 이펙트를 다시 돌려도(효과 그림은 다시 시작해도 무해) 두 번 울리지 않게
    const isFirstRun = handledRef.current !== key
    handledRef.current = key
    let vibrated = isFirstRun ? 0 : entries.length
    const vibrateUpTo = (frame: number) => {
      while (vibrated < entries.length && entries[vibrated].start <= frame) {
        const { vibrationMilliseconds } = entries[vibrated]
        if (vibrationMilliseconds > 0) vibrate(vibrationMilliseconds, isVibrationOnRef.current)
        vibrated += 1
      }
    }
    vibrateUpTo(0)
    if (entries.every((entry) => entry.kind === null)) {
      // 효과기를 안 건드리는 걸음 — 앞 효과는 그대로 돈다
      if (entries.length > 0) setView((previous) => ({ ...previous, lastEffectId: entries[entries.length - 1].id }))
      onReleaseRef.current?.(key)
      return
    }

    // 새로 걸면 앞 효과를 덮는다 (0xbdae8)
    cancelAnimationFrame(handleRef.current)
    serialRef.current += 1
    const serial = serialRef.current
    const startedAt = performance.now()
    /** 효과마다 '끝' 그리기를 봤는가 — 프레임이 건너뛰어도 꼭 한 번 거친다([mgr+0x2c8] 을 바꾸는 그리기다) */
    const ended = entries.map(() => false)
    let isReleased = false
    const lastIdAt = (frame: number) => {
      let id: number | null = null
      for (const entry of entries) if (entry.start <= frame) id = entry.id
      return id
    }
    const draw = (frameIndex: number): boolean => {
      vibrateUpTo(frameIndex)
      // 지나간 효과의 '끝' — 뒤 효과에 덮이기 전에 끝 그리기에 닿은 것만 (막는 효과는 늘 닿는다)
      entries.forEach((entry, index) => {
        if (entry.kind === null || ended[index]) return
        const endFrame = entry.start + effectorEndingFrameOf(entry.kind) + 1
        const overriddenAt = entries.slice(index + 1).find((later) => later.kind !== null)?.start ?? Infinity
        if (overriddenAt <= endFrame) {
          if (overriddenAt <= frameIndex) ended[index] = true
          return
        }
        if (frameIndex < endFrame) return
        ended[index] = true
        onEndRef.current?.(entry.id)
      })
      const active = activeEntryAt(entries, frameIndex)
      const entry = entries[active]
      const local = frameIndex - entry.start
      const phase = entry.kind === null ? '없음' : effectorPhaseAt(entry.kind, local)
      setView({
        frame: entry.kind === null ? null : screenEffectFrameAt(entry.kind, entry.color, local),
        phase, serial, lastEffectId: lastIdAt(frameIndex),
      })
      if (!isReleased && frameIndex >= releaseFrame) {
        isReleased = true
        onReleaseRef.current?.(key)
      }
      return phase !== '없음' || !isReleased || activeEntryAt(entries, Infinity) !== active
    }
    const tick = (now: number) => {
      const frameIndex = Math.floor((now - startedAt) / millisecondsPerFrame())
      if (draw(frameIndex)) handleRef.current = requestAnimationFrame(tick)
    }
    if (draw(0)) handleRef.current = requestAnimationFrame(tick)
  }, [step])

  return view
}
