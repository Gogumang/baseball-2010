import { useEffect, useMemo, useRef, useState } from 'react'
import { advanceCursor, jumpToEvent, stepFrom } from '@/entities/story/model/eventScript'
import type { EventStep } from '@/entities/story/model/eventScript'
import { rewardsIn } from '@/entities/story/model/eventReward'
import type { EventReward } from '@/entities/story/model/eventReward'
import type { EventCommand, EventPortrait, OriginalEvent } from '@/shared/config/original/eventTypes'
import { EMPTY_STORY_CARRY, mergeStoryCarry } from '@/entities/story/model/aceMatch'
import type { StoryCarry } from '@/entities/story/model/aceMatch'

export type MatchCommand = Extract<EventCommand, { op: 'match' }>
export type SystemCommand = Extract<EventCommand, { op: 'system' }>

/**
 * 창을 띄우는 system 명령(3 타이틀 · 4 MVP 발표, 0x8cf64 → 0xd4ee4)에서 멈춘다 — `windowTextOf` 가 글을 주는 것만.
 * 이벤트 스크립트(`stepFrom`)는 system 0 만 멈추는 명령으로 보므로, 지나온 명령 가운데 첫 창 명령에서 끊고
 * 그 글을 실어 알림처럼 보여 준다. 다음 칸으로 넘기면 창 뒤 명령부터 이어 간다.
 */
function stopAtWindow(step: EventStep, windowTextOf: ((command: SystemCommand) => string | null) | undefined): EventStep {
  if (windowTextOf === undefined) return step
  for (let index = 0; index < step.passed.length; index += 1) {
    const command = step.passed[index]
    if (command.op !== 'system') continue
    const text = windowTextOf(command)
    if (text === null) continue
    const firstIndex = step.cursor.commandIndex - step.passed.length
    return {
      cursor: { eventId: step.cursor.eventId, commandIndex: firstIndex + index },
      command: { ...command, text },
      passed: step.passed.slice(0, index),
    }
  }
  return step
}

/**
 * 이벤트 한 편을 원본 명령 순서대로 재생한다.
 * 대사·선택지는 초상화 묶음을 통째로 바꾸고(0x7f54c), 알림·예아니오는 앞 초상화를 그대로 둔다.
 * 선택지가 다른 이벤트를 가리키면 화면을 닫지 않고 그 이벤트로 이어 간다.
 * 지나온 보상 명령은 모아 두었다가 끝날 때 한꺼번에 넘긴다.
 * 경기(match)에 닿으면 모은 것을 들고 대결로 나간다 — 결과 이벤트로 돌아올 때 carried 로 다시 받는다.
 */
export function useEventPlayback(
  events: readonly OriginalEvent[],
  startEvent: OriginalEvent,
  onComplete: (rewards: readonly EventReward[], viewedEventIds: readonly number[]) => void,
  onMatch: (command: MatchCommand, carry: StoryCarry) => void,
  carried: StoryCarry = EMPTY_STORY_CARRY,
  /** system 3·4 발표 창의 글 — 안 주면 예전처럼 지나간다 */
  windowTextOf?: (command: SystemCommand) => string | null,
): {
  step: EventStep
  portraits: readonly EventPortrait[]
  next: () => void
  jump: (eventId: number) => void
} {
  const [cursor, setCursor] = useState(() => jumpToEvent(startEvent.id))
  // 창 글은 커리어에서 나온다 — 부르는 쪽이 렌더마다 새 함수를 넘겨도 걸음이 다시 계산되지 않게 ref 로 든다
  const windowTextOfRef = useRef(windowTextOf)
  windowTextOfRef.current = windowTextOf
  const step = useMemo(() => stopAtWindow(stepFrom(events, cursor), windowTextOfRef.current), [events, cursor])

  const [portraits, setPortraits] = useState<readonly EventPortrait[]>([])
  useEffect(() => {
    const command = step.command
    if (command !== null && (command.op === 'say' || command.op === 'choice')) setPortraits(command.portraits)
  }, [step])

  // 같은 칸을 두 번 세지 않도록 커서별로 담는다 (개발 모드의 이펙트 재실행 포함).
  const rewardsByCursorRef = useRef(new Map<string, readonly EventReward[]>())
  useEffect(() => {
    rewardsByCursorRef.current.set(`${step.cursor.eventId}:${step.cursor.commandIndex}`, rewardsIn(step.passed))
  }, [step])

  const carriedRef = useRef(carried)
  const collect = (): StoryCarry => mergeStoryCarry(carriedRef.current, rewardsByCursorRef.current)

  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete
  const onMatchRef = useRef(onMatch)
  onMatchRef.current = onMatch
  const isCompletedRef = useRef(false)
  useEffect(() => {
    if (isCompletedRef.current) return
    if (step.command?.op === 'match') {
      isCompletedRef.current = true
      // 경기 명령까지 지나온 보상도 담기도록 이 칸을 먼저 기록한다
      rewardsByCursorRef.current.set(`${step.cursor.eventId}:${step.cursor.commandIndex}`, rewardsIn(step.passed))
      onMatchRef.current(step.command, collect())
      return
    }
    if (step.command !== null) return
    isCompletedRef.current = true
    const collected = collect()
    onCompleteRef.current(collected.rewards, collected.viewedEventIds)
  }, [step])

  const stepRef = useRef(step)
  stepRef.current = step
  const next = () => setCursor(advanceCursor(stepRef.current.cursor))
  const jump = (eventId: number) => setCursor(jumpToEvent(eventId))

  // 알림은 Enter/Space 로 넘긴다. 대사(say)는 대사 상자(`EventDialogueBox` — 키 0x8b804)가, 선택지는 메뉴가 키를 가져간다.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const op = stepRef.current.command?.op
      if (op !== 'system') return
      if (event.key !== 'Enter' && event.key !== ' ') return
      if (event.target instanceof HTMLButtonElement) return
      event.preventDefault()
      setCursor(advanceCursor(stepRef.current.cursor))
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return { step, portraits, next, jump }
}
