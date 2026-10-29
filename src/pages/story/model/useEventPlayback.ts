import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { advanceCursor, findEvent, jumpToEvent } from '@/entities/story/model/eventScript'
import type { EventCursor, EventStep } from '@/entities/story/model/eventScript'
import type { RewardNotice, RewardNoticeResult } from '@/entities/story/model/rewardNotice'
import type { EventReward } from '@/entities/story/model/eventReward'
import type { EventPortrait, OriginalEvent } from '@/shared/config/original/eventTypes'
import { EMPTY_STORY_CARRY } from '@/entities/story/model/aceMatch'
import type { StoryCarry } from '@/entities/story/model/aceMatch'
import type { EventCompleteHandler, EventRewardHandler, MatchCommand, RewardNoticeOf, SystemCommand } from './eventPlayback/playbackTypes'
import {
  buildStep,
  cachedNoticeOf,
  givenRewardOf,
  isBuiltFor,
  isEndingRewardStep,
  isStepReleasedOf,
  staysOnRewardWindow,
} from './eventPlayback/playbackSteps'
import type { BuiltStep } from './eventPlayback/playbackSteps'
import { collectedCarryOf, usePlaybackEnd } from './eventPlayback/usePlaybackEnd'
import { usePlaybackControls } from './eventPlayback/usePlaybackControls'
import { useStepPortraits } from './eventPlayback/useStepPortraits'

export type { EventChoiceConfirmHandler, EventCompleteHandler, EventRewardHandler, MatchCommand, SystemCommand } from './eventPlayback/playbackTypes'

/**
 * 이벤트 한 편을 원본 명령 순서대로 재생한다.
 * 대사·선택지는 초상화 묶음을 통째로 바꾸고(0x7f54c), 알림·예아니오는 앞 초상화를 그대로 둔다.
 * 선택지가 다른 이벤트를 가리키면 화면을 닫지 않고 그 이벤트로 이어 간다.
 * **보상**: `onReward` 를 주면 원본처럼 명령마다 그 자리에서 준다 — 0x8d4c4 가 글(0x8beb8)을 짓고 창을 띄운 **그 갱신에**
 * 0x8c460 이 준다. 보상 명령마다 멈춰(`stopAtWindow`) 그 걸음이 돌 때(막는 효과를 다 기다린 뒤) 한 번 주고, 창을 안 띄우는
 * 보상(웹이 글을 못 짓는 첫 종류 7)은 주고 곧바로 다음 명령으로 넘긴다. 첫 종류 21 은 주지 않고 그 자리에서 재생을 끝낸다
 * (`endsPlayback`). 그래서 이벤트 도중의 저장(0x7fe90)에 그때까지 준 보상이 들고,
 * 뒤 보상의 글은 앞 보상을 준 뒤 값을 읽는다. 이때 끝(`onComplete`) · 경기(`onMatch`)로 넘기는 보상은 비어 있다.
 * `onReward` 가 없으면 예전처럼 지나온 보상 명령을 모아 두었다가 끝날 때 한꺼번에 넘긴다.
 * 경기(match)에 닿으면 모은 것을 들고 대결로 나간다 — 결과 이벤트로 돌아올 때 carried 로 다시 받는다.
 */
export function useEventPlayback(
  events: readonly OriginalEvent[],
  startEvent: OriginalEvent,
  /** `endingEventId` — 첫 종류 21 로 재생이 끝났으면 그 이벤트([0x1552adc] = 1, 본 표시 없음), 보통 끝이면 null */
  onComplete: EventCompleteHandler,
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
  /** 올해의 목표 창을 키(OK · '5')로 닫을 때 다음 명령 앞에 부른다 — 0x7fe90(목표 창 봤음 · 저장) */
  onYearGoalWindowConfirm?: () => void,
  /** 보상 명령을 그 자리에서 준다(0x8c460) — 안 주면 예전처럼 끝에 모아 넘긴다 */
  onReward?: EventRewardHandler,
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
  /**
   * 떠나온 이벤트 줄 [mgr+0x38a] 을 꺼낸다 — 이 재생에서 넘어온 이벤트 중 지금 이벤트 말고, 앞 선택지 확인에서 이미 알린 것 말고
   * (대결 앞 이벤트 carried 는 없다). 꺼내면 줄이 빈다(0x8b0e4 끝) — 선택지 OK 자리에서 한 번 부른다 (`EventChoiceConfirmHandler`)
   */
  leftEventIds: () => readonly number[]
} {
  const [cursor, setCursor] = useState(() => jumpToEvent(startEvent.id))
  /**
   * 보상 알림은 커서 하나에 한 번만 짓는다 — 종류 11 이 굴리므로(0xbfa55) 다시 그려도 다시 굴리면 안 된다.
   * 커서 객체마다 담아 두니 선택지로 같은 이벤트에 다시 오면(새 커서) 원본처럼 새로 짓는다.
   */
  const [noticeCache] = useState(() => new WeakMap<EventCursor, Map<number, RewardNoticeResult>>())
  const stopsAtEveryReward = onReward !== undefined
  /**
   * 걸음은 (이벤트 표 · 커서 · 보상마다 멈춤) 이 바뀔 때만 다시 짓는다 — 창 글 · 보상 알림 함수는 부르는 쪽이 렌더마다 새로 넘겨도
   * 다시 짓지 않고, 지을 때의 것을 쓴다. 지은 걸음은 상태로 들고 열쇠가 바뀐 렌더에서 맞춘다(useMemo 와 같은 때 한 번)
   */
  const [built, setBuilt] = useState<BuiltStep | null>(null)
  const isBuiltFresh = isBuiltFor(built, events, cursor, stopsAtEveryReward)
  const current: BuiltStep = isBuiltFresh
    ? built
    : { events, cursor, stopsAtEveryReward, step: buildStep(events, cursor, stopsAtEveryReward, windowTextOf, rewardNoticeOf, noticeCache) }
  if (!isBuiltFresh) setBuilt(current)
  const { step } = current
  const rewardNotice = step.command?.op === 'reward' ? (cachedNoticeOf(noticeCache, cursor, step.cursor.commandIndex) ?? null) : null
  const isReleased = isStepReleasedOf(isHeld, step)
  const [portraits, clearPortraits] = useStepPortraits(step, isReleased)

  const onRewardRef = useRef(onReward)
  useLayoutEffect(() => {
    onRewardRef.current = onReward
  })
  const rewardedCursorsRef = useRef(new WeakSet<EventCursor>())
  /** 커서별 모은 보상 칸("이벤트:명령" → 보상) — 떠나온 이벤트 줄(`leftEventIds`)도 그 열쇠를 본다 */
  const rewardsByCursorRef = useRef(new Map<string, readonly EventReward[]>())
  const carriedRef = useRef(carried)
  /** 첫 종류 21 로 끝낸 이벤트 — [0x1552adc] 자리 (`EventCompleteHandler`) */
  const endingEventIdRef = useRef<number | null>(null)
  useEffect(() => {
    if (!isEndingRewardStep(step, isReleased)) return
    // 0x8d4ce — [0x1552adc] = 1 · 주지 않고 재생 끝(이 이벤트의 끝 커서 — 뒤 명령은 지나온 명령에도 안 든다)
    endingEventIdRef.current = step.cursor.eventId
    const event = findEvent(events, step.cursor.eventId)
    // oxlint-disable-next-line react/set-state-in-effect -- 끝 보상 칸이 한 번 커밋돼야 같은 커밋의 칸 기록 효과(rewardsByCursorRef)가 그 칸을 담는다 — 렌더 중으로 옮기면 모은 보상 · 본 이벤트가 달라진다
    setCursor({ eventId: step.cursor.eventId, commandIndex: event?.commands.length ?? step.cursor.commandIndex + 1 })
  }, [events, step, isReleased])

  /**
   * 보상을 그 자리에서 준다 (`onReward`) — 보상 명령마다 멈춘 걸음이 돌 때(막는 효과를 다 기다린 뒤) 한 번.
   * 커서 객체마다 한 번이라 개발 모드의 이펙트 재실행에는 다시 안 주고, 선택지로 같은 이벤트에 다시 오면(새 커서) 원본처럼 또 준다.
   * 창을 안 띄우는 보상은 주고 곧바로 다음 명령으로 — 세션의 커리어가 바뀐 다음 렌더에 다음 걸음(과 그 글)을 짓는다.
   */
  useEffect(() => {
    const give = onRewardRef.current
    const command = givenRewardOf(step, isReleased)
    if (give === undefined || command === null || rewardedCursorsRef.current.has(cursor)) return
    rewardedCursorsRef.current.add(cursor)
    give(command.items, step.cursor.eventId, [...new Set([...collectedCarryOf(carriedRef, rewardsByCursorRef).viewedEventIds, step.cursor.eventId])])
    // oxlint-disable-next-line react/set-state-in-effect -- 0x8c460 은 보상을 준 그 자리에서 다음 명령으로 간다 — 주기(세션 콜백)가 효과라 넘김도 그 뒤 같은 효과에서
    if (!staysOnRewardWindow(cachedNoticeOf(noticeCache, cursor, step.cursor.commandIndex))) setCursor(advanceCursor(step.cursor))
  }, [cursor, step, isReleased, noticeCache])

  usePlaybackEnd(step, isReleased, onRewardRef, carriedRef, rewardsByCursorRef, endingEventIdRef, onComplete, onMatch)
  const [next, skip, jump, leftEventIds] = usePlaybackControls(events, step, isReleased, onYearGoalWindowConfirm, setCursor, rewardsByCursorRef)

  return { step, isReleased, rewardNotice, portraits, next, skip, jump, clearPortraits, leftEventIds }
}
