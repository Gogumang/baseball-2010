import { useEffect, useRef, useState } from 'react'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { DefenseScreen } from '@/pages/defense/ui/DefenseScreen'
import type { DefenseViewState } from '@/pages/defense/lib/defenseView'
import { originalKeyOf, type ControlSide } from '@/entities/defense-controls/model/defenseKeys'
import {
  defensePlayResultOf,
  isDefensePlayFinished,
  startDefensePlay,
  stepDefensePlay,
} from '@/features/defense-play/model/runDefensePlay'
import type {
  DefenseKeyPress,
  DefensePlayInput,
  DefensePlayResult,
  DefensePlayState,
} from '@/features/defense-play/model/runDefensePlay'

interface DefensePlaybackProps {
  /**
   * **미리 계산해 둔** 한 플레이의 매 틱 스냅샷. 홈런 비행 재생(`homeRunPlayback`)처럼
   * 사람이 끼어들 것이 없는 장면은 이 쪽을 쓴다.
   */
  readonly ticks?: readonly DefenseViewState[]
  /**
   * **실시간으로 돌릴** 타구. 주면 이 화면이 진행기를 **매 갱신 한 틱씩 직접 돌리고**
   * `keydown` 을 그 틱의 키로 넘긴다 — 사람이 주루·송구를 할 수 있는 갈래다.
   * `ticks` 와 같이 주면 이 쪽이 이긴다.
   */
  readonly input?: DefensePlayInput
  /**
   * 사람이 어느 쪽을 잡는가 — 조작 객체 `[+0xc]` (0 공격/주루 · 1 수비/송구).
   * **안 주면 자동이다**: 키를 눌러도 아무 일도 없고 CPU 규칙대로만 굴러간다.
   */
  readonly side?: ControlSide
  /** 마지막 틱까지 다 보여 준 뒤. 실시간 갈래는 그 플레이의 결과를 함께 넘긴다 */
  readonly onDone: (result?: DefensePlayResult) => void
  /** 다 본 뒤 잠깐 멈춰 두는 갱신 횟수 — 마지막 장면이 스치듯 지나가지 않게 */
  readonly holdUpdates?: number
  readonly children?: React.ReactNode
}

/** 원작 경기 루프는 한 갱신에 한 틱이다 (0xc2198) */
const UPDATES_PER_TICK = 1
const DEFAULT_HOLD_UPDATES = 8

/**
 * 수비 한 플레이를 보여 준다 — 갈래가 둘이다.
 *
 * 원본은 타구가 뜬 순간 경기 장면 상태가 0x11 → 0x13 → 0x17(수비 인플레이)로 넘어가
 * 공이 멈출 때까지 같은 루프를 돌면서 **매 갱신 눌린 키를 읽는다** (R10 · I 문서).
 *
 * - `ticks` 를 주면 **미리 계산해 둔 틱을 재생만** 한다 (홈런 비행 등).
 * - `input` 을 주면 **여기서 진행기를 한 틱씩 돌리며** 실시간 키를 먹인다 — 원본과 같은 모양이다.
 */
export function DefensePlayback({
  ticks,
  input,
  side,
  onDone,
  holdUpdates = DEFAULT_HOLD_UPDATES,
  children,
}: DefensePlaybackProps) {
  if (input !== undefined) {
    return (
      <LivePlayback input={input} side={side} onDone={onDone} holdUpdates={holdUpdates}>
        {children}
      </LivePlayback>
    )
  }
  return (
    <RecordedPlayback ticks={ticks ?? []} onDone={onDone} holdUpdates={holdUpdates}>
      {children}
    </RecordedPlayback>
  )
}

interface RecordedPlaybackProps {
  readonly ticks: readonly DefenseViewState[]
  readonly onDone: (result?: DefensePlayResult) => void
  readonly holdUpdates: number
  readonly children?: React.ReactNode
}

/** 미리 계산해 둔 틱을 차례대로 보여 주기만 한다 — 지금까지의 그 갈래 그대로다 */
function RecordedPlayback({ ticks, onDone, holdUpdates, children }: RecordedPlaybackProps) {
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

interface LivePlaybackProps {
  readonly input: DefensePlayInput
  readonly side?: ControlSide
  readonly onDone: (result?: DefensePlayResult) => void
  readonly holdUpdates: number
  readonly children?: React.ReactNode
}

/**
 * 진행기를 **매 갱신 한 틱씩** 직접 돌린다 (0xc2198).
 *
 * 원본 경기 장면은 매 틱 눌린 키를 `this+0x38` 에 담고 조작 객체(0x536bc)가 상태 0x17 갈래로 가른다.
 * 여기서는 `keydown` 을 줄 세워 두고 **한 틱에 한 개씩** 진행기에 먹인다.
 * 키 → 뜻은 진행기 안에서 `inPlayCommandOf` 가 한다 — 표를 여기서 다시 만들지 않는다.
 */
function LivePlayback({ input, side, onDone, holdUpdates, children }: LivePlaybackProps) {
  const update = useUpdateCounter(true)
  const stateRef = useRef<DefensePlayState | null>(null)
  const builtFromRef = useRef<DefensePlayInput | null>(null)
  const builtSideRef = useRef<ControlSide | undefined>(undefined)
  /** 이 플레이가 시작된 갱신 번호 — 갱신 계수는 화면이 서고부터 계속 오르므로 빼 준다 */
  const startedAtRef = useRef(0)
  /** 아직 진행기에 안 먹인 키들 */
  const pressesRef = useRef<DefenseKeyPress[]>([])
  const [view, setView] = useState<DefenseViewState | null>(null)
  const [finishedAt, setFinishedAt] = useState<number | null>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // 원본이 아는 키만 담는다 (숫자·방향·OK·CLR)
      if (originalKeyOf(event.key) === null) return
      // 누르고 있는 중인가 — 레이저 확정은 새로 누른 키만 받는다 (0x4e858 키 반복 계수 0)
      pressesRef.current.push({ key: event.key, isRepeat: event.repeat })
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (builtFromRef.current !== input || builtSideRef.current !== side) {
      builtFromRef.current = input
      builtSideRef.current = side
      stateRef.current = startDefensePlay(withSide(input, side))
      startedAtRef.current = update
      pressesRef.current = []
      setView(null)
      setFinishedAt(null)
    }
    const state = stateRef.current
    if (state === null) return

    // 한 갱신 = 한 틱. 프레임을 건너뛴 만큼은 따라잡는다
    const wanted = Math.floor((update - startedAtRef.current) / UPDATES_PER_TICK) + 1
    let running = state
    let moved = false
    while (running.tick < wanted && !isDefensePlayFinished(running)) {
      running = stepDefensePlay(running, pressesRef.current.shift() ?? null)
      moved = true
    }
    stateRef.current = running
    if (moved) setView(running.ticks[running.ticks.length - 1] ?? null)
    if (isDefensePlayFinished(running) && finishedAt === null) setFinishedAt(update)
  }, [update, input, side, finishedAt])

  const isFinished = finishedAt !== null && update >= finishedAt + holdUpdates

  useEffect(() => {
    if (!isFinished) return
    const state = stateRef.current
    onDone(state === null ? undefined : defensePlayResultOf(state))
  }, [isFinished, onDone])

  if (view === null) return null
  return <DefenseScreen state={view}>{children}</DefenseScreen>
}

/**
 * 사람이 잡은 쪽을 진행기에 알려 준다 — 조작 객체 `[+0xc]`.
 *
 * `keyAt` 은 **부르지 않는다**: 실시간 갈래는 눌린 키를 `stepDefensePlay` 의 인자로 바로 넘긴다.
 * 그래도 `controls` 자체는 있어야 진행기가 "사람이 조작한다" 로 보고 키 갈래를 연다.
 */
function withSide(input: DefensePlayInput, side?: ControlSide): DefensePlayInput {
  if (side === undefined) return input
  return {
    ...input,
    controls: { side, keyAt: () => null, canReturn: input.controls?.canReturn },
  }
}
