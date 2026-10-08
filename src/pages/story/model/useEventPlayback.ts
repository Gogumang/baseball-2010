import { useEffect, useMemo, useRef, useState } from 'react'
import { advanceCursor, jumpToEvent, skipSayCursor, stepFrom } from '@/entities/story/model/eventScript'
import type { EventCursor, EventStep } from '@/entities/story/model/eventScript'
import { rewardsIn } from '@/entities/story/model/eventReward'
import type { EventReward } from '@/entities/story/model/eventReward'
import type { RewardNotice, RewardNoticeResult } from '@/entities/story/model/rewardNotice'
import type { EventCommand, EventPortrait, OriginalEvent } from '@/shared/config/original/eventTypes'
import { SYSTEM_YEAR_GOAL_WINDOW } from '@/pages/story/lib/yearGoalWindow'
import { EMPTY_STORY_CARRY, mergeStoryCarry } from '@/entities/story/model/aceMatch'
import type { StoryCarry } from '@/entities/story/model/aceMatch'

export type MatchCommand = Extract<EventCommand, { op: 'match' }>
export type SystemCommand = Extract<EventCommand, { op: 'system' }>

export type RewardCommand = Extract<EventCommand, { op: 'reward' }>

/** 보상 명령 하나의 알림 — 부르는 쪽이 맥락(모드 · 선수 · 난수)을 묶어 준다 (`rewardNoticeOf`) */
export type RewardNoticeOf = (items: readonly EventReward[], eventId: number) => RewardNoticeResult

/** 알림 창을 띄우는 보상 — 기다림 0x8daa0 이 확인까지 다음 명령을 막는다. 첫 종류 7 · 21 은 이 명령이 창을 안 띄운다 */
const opensRewardWindow = (notice: RewardNotice) => notice.kind === '알림' || notice.kind === '스킬'

/**
 * 창을 띄우는 명령에서 멈춘다 — 이벤트 스크립트(`stepFrom`)는 system 0 만 멈추는 명령으로 보므로, 지나온 명령 가운데 첫 창 명령에서 끊는다.
 * - system 3 타이틀 · 4 MVP 발표(0x8cf64 → 0xd4ee4): `windowTextOf` 가 글을 주는 것만 — 그 글을 실어 알림 창(0x74ef4 종류 1)으로.
 * - 보상(명령 7, 0x8d4c4): `noticeOf` 가 알림 · 스킬 창을 주는 것 — 명령 값은 0x8beb8 이 고친 값(질병 굴림)으로 바꿔 둔다.
 *   창을 안 띄우는 보상(첫 종류 7 · 21)도 고친 값으로 바꿔 지나간다.
 * 다음 칸으로 넘기면 창 뒤 명령부터 이어 간다.
 */
function stopAtWindow(
  step: EventStep,
  windowTextOf: ((command: SystemCommand) => string | null) | undefined,
  noticeOf: ((command: RewardCommand, commandIndex: number) => RewardNoticeResult) | undefined,
): EventStep {
  if (windowTextOf === undefined && noticeOf === undefined) return step
  const firstIndex = step.cursor.commandIndex - step.passed.length
  const passed: EventCommand[] = []
  for (let index = 0; index < step.passed.length; index += 1) {
    const command = step.passed[index]
    const at = { eventId: step.cursor.eventId, commandIndex: firstIndex + index }
    if (command.op === 'system' && windowTextOf !== undefined) {
      const text = windowTextOf(command)
      if (text !== null) return { cursor: at, command: { ...command, text }, passed }
    }
    if (command.op === 'reward' && noticeOf !== undefined) {
      const result = noticeOf(command, at.commandIndex)
      const resolved: RewardCommand = { ...command, items: result.items }
      if (opensRewardWindow(result.notice)) return { cursor: at, command: resolved, passed }
      passed.push(resolved)
      continue
    }
    passed.push(command)
  }
  return passed.length === step.passed.length && passed.every((command, index) => command === step.passed[index])
    ? step
    : { ...step, passed }
}

/** 이 걸음이 주는 보상 — 지나온 보상 명령과, 알림 창에 멈춘 보상 명령 자신 (원본은 창을 띄운 그 갱신에 0x8c460 으로 준다) */
const rewardsOfStep = (step: EventStep): readonly EventReward[] =>
  rewardsIn(step.command?.op === 'reward' ? [...step.passed, step.command] : step.passed)

/**
 * 이벤트 한 편을 원본 명령 순서대로 재생한다.
 * 대사·선택지는 초상화 묶음을 통째로 바꾸고(0x7f54c), 알림·예아니오는 앞 초상화를 그대로 둔다.
 * 선택지가 다른 이벤트를 가리키면 화면을 닫지 않고 그 이벤트로 이어 간다.
 * 지나온 보상 명령은 모아 두었다가 끝날 때 한꺼번에 넘긴다 — ⚠️ 원본은 명령마다 그 자리에서 준다(0x8c460). 차례는 같고
 * 웹은 재생 중에 커리어를 안 바꿔, 한 이벤트 안 뒤 보상의 알림 글(연봉 · 지금 질병)은 앞 보상 전 값을 읽는다(데이터에는 겹치는 곳이 없다).
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
  /**
   * 이 걸음이 아직 멈출 명령을 돌리지 않았는가 — 지나온 명령 5(id 4~7)가 끝나기를 기다린다(0x8b564, `isStepHeld`).
   * 그동안은 초상화를 안 바꾸고(0x7f54c 는 say · 선택지 명령이 돌 때) 경기 · 끝으로도 안 나간다. 안 주면 늘 돈다.
   */
  isHeld?: (step: EventStep) => boolean,
  /** 보상 명령 7 의 알림(0x8d4c4 · 0x8beb8) — 안 주면 예전처럼 보상은 창 없이 지나간다 */
  rewardNoticeOf?: RewardNoticeOf,
): {
  step: EventStep
  /** 멈출 명령이 돌고 있는가 (`isHeld` 가 거짓) */
  isReleased: boolean
  /** 지금 멈춘 명령이 보상이면 그 알림 (`rewardNoticeOf` 를 준 때만) */
  rewardNotice: RewardNotice | null
  portraits: readonly EventPortrait[]
  next: () => void
  /** say 중 취소(−16) — 다음 보상 · system · 선택지 · 예아니오 · 4 · 경기 명령까지 건너뛴다 (0x8b7b0, `skipSayCursor`) */
  skip: () => void
  jump: (eventId: number) => void
  /** 초상화 셋을 비운다 — 0x7f7a8 → 0x7b870 (화면효과 6 · 7 이 끝난 그리기, `drawEventBackdrop`) */
  clearPortraits: () => void
} {
  const [cursor, setCursor] = useState(() => jumpToEvent(startEvent.id))
  // 창 글은 커리어에서 나온다 — 부르는 쪽이 렌더마다 새 함수를 넘겨도 걸음이 다시 계산되지 않게 ref 로 든다
  const windowTextOfRef = useRef(windowTextOf)
  windowTextOfRef.current = windowTextOf
  const rewardNoticeOfRef = useRef(rewardNoticeOf)
  rewardNoticeOfRef.current = rewardNoticeOf
  /**
   * 보상 알림은 커서 하나에 한 번만 짓는다 — 종류 11 이 굴리므로(0xbfa55) 다시 그려도 다시 굴리면 안 된다.
   * 커서 객체마다 담아 두니 선택지로 같은 이벤트에 다시 오면(새 커서) 원본처럼 새로 짓는다.
   */
  const noticeCacheRef = useRef(new WeakMap<EventCursor, Map<number, RewardNoticeResult>>())
  const step = useMemo(() => {
    const noticeOf = rewardNoticeOfRef.current
    const cached = noticeCacheRef.current.get(cursor) ?? new Map<number, RewardNoticeResult>()
    noticeCacheRef.current.set(cursor, cached)
    return stopAtWindow(stepFrom(events, cursor), windowTextOfRef.current, noticeOf === undefined
      ? undefined
      : (command, commandIndex) => {
        const known = cached.get(commandIndex)
        if (known !== undefined) return known
        const result = noticeOf(command.items, cursor.eventId)
        cached.set(commandIndex, result)
        return result
      })
  }, [events, cursor])
  const rewardNotice = step.command?.op === 'reward'
    ? (noticeCacheRef.current.get(cursor)?.get(step.cursor.commandIndex)?.notice ?? null)
    : null

  const isReleased = isHeld === undefined || !isHeld(step)

  const [portraits, setPortraits] = useState<readonly EventPortrait[]>([])
  useEffect(() => {
    if (!isReleased) return
    const command = step.command
    if (command !== null && (command.op === 'say' || command.op === 'choice')) setPortraits(command.portraits)
  }, [step, isReleased])

  // 같은 칸을 두 번 세지 않도록 커서별로 담는다 (개발 모드의 이펙트 재실행 포함).
  const rewardsByCursorRef = useRef(new Map<string, readonly EventReward[]>())
  useEffect(() => {
    rewardsByCursorRef.current.set(`${step.cursor.eventId}:${step.cursor.commandIndex}`, rewardsOfStep(step))
  }, [step])

  const carriedRef = useRef(carried)
  const collect = (): StoryCarry => mergeStoryCarry(carriedRef.current, rewardsByCursorRef.current)

  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete
  const onMatchRef = useRef(onMatch)
  onMatchRef.current = onMatch
  const isCompletedRef = useRef(false)
  useEffect(() => {
    if (isCompletedRef.current || !isReleased) return
    if (step.command?.op === 'match') {
      isCompletedRef.current = true
      // 경기 명령까지 지나온 보상도 담기도록 이 칸을 먼저 기록한다
      rewardsByCursorRef.current.set(`${step.cursor.eventId}:${step.cursor.commandIndex}`, rewardsOfStep(step))
      onMatchRef.current(step.command, collect())
      return
    }
    if (step.command !== null) return
    isCompletedRef.current = true
    const collected = collect()
    onCompleteRef.current(collected.rewards, collected.viewedEventIds)
  }, [step, isReleased])

  const stepRef = useRef(step)
  stepRef.current = step
  const isReleasedRef = useRef(isReleased)
  isReleasedRef.current = isReleased
  const next = () => setCursor(advanceCursor(stepRef.current.cursor))
  const skip = () => setCursor(skipSayCursor(events, stepRef.current.cursor))
  const jump = (eventId: number) => setCursor(jumpToEvent(eventId))
  const clearPortraits = () => setPortraits([])

  // 올해의 목표 창(system 1, 0x8d304 가 키 표에 OK −5 · '5' → 0 을 넣는다)은 Enter/Space 로 닫는다.
  // 대사(say)는 대사 상자(`EventDialogueBox` — 키 0x8b804)가, 선택지는 메뉴가, 알림 · 예아니오(0x74ef4)는 공용 창(`MessageBox`)이 키를 가져간다.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const command = stepRef.current.command
      if (!isReleasedRef.current || command?.op !== 'system' || command.sub !== SYSTEM_YEAR_GOAL_WINDOW) return
      if (event.key !== 'Enter' && event.key !== ' ') return
      if (event.target instanceof HTMLButtonElement) return
      event.preventDefault()
      setCursor(advanceCursor(stepRef.current.cursor))
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return { step, isReleased, rewardNotice, portraits, next, skip, jump, clearPortraits }
}
