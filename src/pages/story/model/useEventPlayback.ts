import { useEffect, useMemo, useRef, useState } from 'react'
import { advanceCursor, jumpToEvent, stepFrom } from '@/entities/story/model/eventScript'
import type { EventStep } from '@/entities/story/model/eventScript'
import { rewardsIn } from '@/entities/story/model/eventReward'
import type { EventReward } from '@/entities/story/model/eventReward'
import type { EventCommand, EventPortrait, OriginalEvent } from '@/shared/config/original/eventTypes'
import { EMPTY_STORY_CARRY, mergeStoryCarry } from '@/entities/story/model/aceMatch'
import type { StoryCarry } from '@/entities/story/model/aceMatch'

export type MatchCommand = Extract<EventCommand, { op: 'match' }>

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
): {
  step: EventStep
  portraits: readonly EventPortrait[]
  next: () => void
  jump: (eventId: number) => void
} {
  const [cursor, setCursor] = useState(() => jumpToEvent(startEvent.id))
  const step = useMemo(() => stepFrom(events, cursor), [events, cursor])

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

  // 대사·알림은 Enter/Space 로 넘긴다. 선택지는 메뉴가 키를 가져간다.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const op = stepRef.current.command?.op
      if (op !== 'say' && op !== 'system') return
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
