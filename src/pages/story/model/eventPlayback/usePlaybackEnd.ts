import { useEffect, useEffectEvent, useRef } from 'react'
import type { RefObject } from 'react'
import type { EventStep } from '@/entities/story/model/eventScript'
import type { EventReward } from '@/entities/story/model/eventReward'
import { mergeStoryCarry } from '@/entities/story/model/aceMatch'
import type { StoryCarry } from '@/entities/story/model/aceMatch'
import type { EventCompleteHandler, EventRewardHandler, MatchCommand } from './playbackTypes'
import { rewardsOfStep } from './playbackSteps'

/** 끝 · 경기로 넘길 모은 칸 — 대결 앞 carried 와 커서별로 담은 보상 · 거친 이벤트 */
export const collectedCarryOf = (carriedRef: RefObject<StoryCarry>, rewardsByCursorRef: RefObject<Map<string, readonly EventReward[]>>): StoryCarry =>
  mergeStoryCarry(carriedRef.current, rewardsByCursorRef.current)

/** 이 걸음에서 모을 보상 — 그 자리에서 주면(`onReward`) 담지 않는다 */
const collectedRewardsOf = (onRewardRef: RefObject<EventRewardHandler | undefined>, step: EventStep) =>
  onRewardRef.current === undefined ? rewardsOfStep(step) : []

const cursorKeyOf = (step: EventStep) => `${step.cursor.eventId}:${step.cursor.commandIndex}`

/**
 * 칸 기록과 재생 끝 — 같은 칸을 두 번 세지 않도록 커서별로 담고(개발 모드의 이펙트 재실행 포함), 경기 명령이면 모은 것을 들고
 * 대결로(`onMatch`), 멈출 명령이 없으면 끝(`onComplete`)으로 나간다. 두 효과는 그 자리 보상 효과 뒤에 돈다(원본 차례)
 */
export function usePlaybackEnd(
  step: EventStep,
  isReleased: boolean,
  onRewardRef: RefObject<EventRewardHandler | undefined>,
  carriedRef: RefObject<StoryCarry>,
  rewardsByCursorRef: RefObject<Map<string, readonly EventReward[]>>,
  endingEventIdRef: RefObject<number | null>,
  onComplete: EventCompleteHandler,
  onMatch: (command: MatchCommand, carry: StoryCarry) => void,
) {
  useEffect(() => {
    rewardsByCursorRef.current.set(cursorKeyOf(step), collectedRewardsOf(onRewardRef, step))
  }, [step, onRewardRef, rewardsByCursorRef])

  const complete = useEffectEvent(onComplete)
  const match = useEffectEvent(onMatch)
  const isCompletedRef = useRef(false)
  useEffect(() => {
    if (isCompletedRef.current || !isReleased) return
    if (step.command?.op === 'match') {
      isCompletedRef.current = true
      // 경기 명령까지 지나온 보상도 담기도록 이 칸을 먼저 기록한다
      rewardsByCursorRef.current.set(cursorKeyOf(step), collectedRewardsOf(onRewardRef, step))
      match(step.command, collectedCarryOf(carriedRef, rewardsByCursorRef))
      return
    }
    if (step.command !== null) return
    isCompletedRef.current = true
    const collected = collectedCarryOf(carriedRef, rewardsByCursorRef)
    complete(collected.rewards, collected.viewedEventIds, endingEventIdRef.current)
  }, [step, isReleased, onRewardRef, carriedRef, rewardsByCursorRef, endingEventIdRef])
}
