import { useEffect, useLayoutEffect, useRef } from 'react'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import { advanceCursor, jumpToEvent, skipSayCursor } from '@/entities/story/model/eventScript'
import type { EventCursor, EventStep } from '@/entities/story/model/eventScript'
import type { EventReward } from '@/entities/story/model/eventReward'
import type { OriginalEvent } from '@/shared/config/original/eventTypes'
import { SYSTEM_YEAR_GOAL_WINDOW } from '@/pages/story/lib/yearGoalWindow'

/**
 * 돌려주는 함수(다음 · 건너뛰기 · 이동 · 떠나온 줄)와 올해의 목표 창 키 — 함수와 키가 볼 값은 커밋 때 적는다.
 *
 * 돌려주는 차례: [다음, 건너뛰기, 이동, 떠나온 줄 꺼내기]
 */
export function usePlaybackControls(
  events: readonly OriginalEvent[],
  step: EventStep,
  isReleased: boolean,
  onYearGoalWindowConfirm: (() => void) | undefined,
  setCursor: Dispatch<SetStateAction<EventCursor>>,
  rewardsByCursorRef: RefObject<Map<string, readonly EventReward[]>>,
) {
  const stepRef = useRef(step)
  const yearGoalConfirmRef = useRef(onYearGoalWindowConfirm)
  const isReleasedRef = useRef(isReleased)
  useLayoutEffect(() => {
    stepRef.current = step
    yearGoalConfirmRef.current = onYearGoalWindowConfirm
    isReleasedRef.current = isReleased
  })
  const next = () => setCursor(advanceCursor(stepRef.current.cursor))
  const skip = () => setCursor(skipSayCursor(events, stepRef.current.cursor))
  const jump = (eventId: number) => setCursor(jumpToEvent(eventId))
  /**
   * 떠나온 이벤트 줄 [mgr+0x38a](수 [mgr+0x39e]) — 원본 줄을 비우는 곳은 관리자 생성(0x8a414 · 0x8a480 — 장면 0x106 셋업 0xf684 ·
   * 0x105 셋업 0x3b14)과 0x8b0e4 의 끝(8b174~8b188, 본 표시 · 저장 뒤) 둘이고, 넣는 곳은 이벤트 끝 0x8cfc8([mgr+0x2bc] > 0 —
   * 다른 이벤트로 넘어갈 때 지금 이벤트) 하나다. 재생은 늘 114 끝 0x1c014 의 0x8b0e4(1c02e)로 끝나 줄이 빈 채로 다음 재생이 선다 —
   * 마선수 대결의 결과 이벤트(140)도 대결 앞 114 끝에서 비었고 장면 0x106 이 새로 서 관리자도 새것이다. 곧 대결 앞 이벤트(carried)는
   * 줄에 없다. 한 재생 안에서도 선택지 OK 마다 0x8b0e4 가 줄을 비우므로 이미 알린 이벤트는 다음 알림에서 빠진다.
   */
  const reportedLeftRef = useRef(new Set<number>())
  const leftEventIds = () => {
    const current = stepRef.current.cursor.eventId
    const left = [...new Set([...rewardsByCursorRef.current.keys()].map((key) => Number(key.split(':')[0])))].filter(
      (id) => id !== current && !reportedLeftRef.current.has(id),
    )
    // 8b174~8b188 — 알린 줄을 비운다
    left.forEach((id) => reportedLeftRef.current.add(id))
    return left
  }

  // 올해의 목표 창(system 1, 0x8d304 가 키 표에 OK −5 · '5' → 0 을 넣는다)은 Enter/Space 로 닫는다.
  // 대사(say)는 대사 상자(`EventDialogueBox` — 키 0x8b804)가, 선택지는 메뉴가, 알림 · 예아니오(0x74ef4)는 공용 창(`MessageBox`)이 키를 가져간다.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isReleasedRef.current || !isYearGoalWindowStep(stepRef.current)) return
      if (!isYearGoalConfirmKey(event)) return
      event.preventDefault()
      yearGoalConfirmRef.current?.()
      setCursor(advanceCursor(stepRef.current.cursor))
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [setCursor])

  return [next, skip, jump, leftEventIds] as const
}

const isYearGoalWindowStep = (step: EventStep) => step.command?.op === 'system' && step.command.sub === SYSTEM_YEAR_GOAL_WINDOW

/** Enter · Space — 단추(공용 창 · 메뉴)에 잡힌 키는 그쪽 것이다 */
const isYearGoalConfirmKey = (event: KeyboardEvent) => (event.key === 'Enter' || event.key === ' ') && !(event.target instanceof HTMLButtonElement)
