import { EVENT_REWARD_KIND, rewardsIn } from '@/entities/story/model/eventReward'
import type { EventReward } from '@/entities/story/model/eventReward'
import { stepFrom } from '@/entities/story/model/eventScript'
import type { EventCursor, EventStep, StoppingCommand } from '@/entities/story/model/eventScript'
import type { RewardNotice, RewardNoticeResult } from '@/entities/story/model/rewardNotice'
import type { EventCommand, OriginalEvent } from '@/shared/config/original/eventTypes'
import type { RewardCommand, RewardNoticeOf, SystemCommand } from './playbackTypes'

/** 알림 창을 띄우는 보상 — 기다림 0x8daa0 이 확인까지 다음 명령을 막는다. 첫 종류 21 은 창 없이 재생을 끝낸다 */
const opensRewardWindow = (notice: RewardNotice) => notice.kind === '알림' || notice.kind === '스킬'

/**
 * **첫 종류 21 — 재생을 곧바로 끝낸다** (0x8d4c4 0x8d4ce~0x8d506, 직접 떴다):
 * ```
 * [명령+5] == 0x15 → [0x1552adc] = 1(엔딩) · 0x8a4ec(mgr — 실은 명령들 풀기) · 상자 0x7b871 · 0x7f7cd · 0x7b825(0) · (1)
 *                  → 0x8d8ee: 0x8a380(관리자 비우기) · 1(끝남)을 돌려준다   ; 보통 재생 끝 0x8d1b6 → 0x8d4e2 와 같은 꼬리
 * ```
 * 0x8c460 을 부르지 않는다(그 명령의 다른 항목도 안 준다) · 창이 없다 · 뒤 명령도 돌지 않는다. 보통 끝(마지막 명령 다음,
 * 0x8cf8c)과 달리 **지금 이벤트의 본 표시(0xacf49)를 하지 않는다**. 0x8a380 은 떠나온 이벤트 줄(수 [mgr+0x39e])을 안 비워
 * — 0x39f 까지만 지운다 — 재생을 연 쪽의 끝(나리 114 0x1c014 · 시즌 0xd3 0x78f0)이 0x8b0e4 로 **선택지로 떠나온 이벤트는
 * 본 표시하고 저장한다**. 엔딩은 본 이벤트가 아니라 [0x1552adc] 로 간다 — 나리 114 끝 1c088(이전 상태가 113 이 아니면) ·
 * 장면 틀 0x1cdec(1d056)가 그 칸을 지우고 141 로, 시즌 0xe9ac(ec04)는 지우기만 한다(시즌 엔딩은 0xf5 를 줄에 넣어 둔 쪽이 간다).
 * 141 의 엔딩 번호는 진입 0x12300 이 `0xa3a85(S)` 로 새로 판정한다(본 이벤트를 안 본다).
 * 웹은 이 자리의 이벤트 번호를 끝(`onComplete` 셋째 값 `endingEventId`)에 넘긴다 — 부르는 쪽이 그 이벤트만 빼고 본 표시하고
 * 엔딩으로 간다. 데이터의 종류 21(r_event 500 · 501 · 503 · 504, s_event 500)은 모두 그 이벤트의 마지막 명령이다.
 */
export const endsPlayback = (command: RewardCommand) => command.items[0]?.kind === EVENT_REWARD_KIND.엔딩진입

/**
 * 커서의 걸음을 짓는다 — 보상 알림(종류 11 은 굴린다)은 커서마다 칸에 담아 다시 지어도 다시 굴리지 않는다
 * (예전 `useMemo` 본문 그대로)
 */
export function buildStep(
  events: readonly OriginalEvent[],
  cursor: EventCursor,
  stopsAtEveryReward: boolean,
  windowTextOf: ((command: SystemCommand) => string | null) | undefined,
  noticeOf: RewardNoticeOf | undefined,
  noticeCache: WeakMap<EventCursor, Map<number, RewardNoticeResult>>,
): EventStep {
  const cached = noticeCache.get(cursor) ?? new Map<number, RewardNoticeResult>()
  noticeCache.set(cursor, cached)
  return stopAtWindow(
    stepFrom(events, cursor),
    windowTextOf,
    noticeOf === undefined
      ? undefined
      : (command, commandIndex) => {
          const known = cached.get(commandIndex)
          if (known !== undefined) return known
          const result = noticeOf(command.items, cursor.eventId)
          cached.set(commandIndex, result)
          return result
        },
    stopsAtEveryReward,
  )
}

/** 지은 걸음과 그 열쇠 (`useEventPlayback`) */
export interface BuiltStep {
  readonly events: readonly OriginalEvent[]
  readonly cursor: EventCursor
  readonly stopsAtEveryReward: boolean
  readonly step: EventStep
}

/**
 * 창을 띄우는 명령에서 멈춘다 — 이벤트 스크립트(`stepFrom`)는 system 0 만 멈추는 명령으로 보므로, 지나온 명령 가운데 첫 창 명령에서 끊는다.
 * - system 3 타이틀 · 4 MVP 발표(0x8cf64 → 0xd4ee4): `windowTextOf` 가 글을 주는 것만 — 그 글을 실어 알림 창(0x74ef4 종류 1)으로.
 * - 보상(명령 7, 0x8d4c4): `noticeOf` 가 알림 · 스킬 창을 주는 것 — 명령 값은 0x8beb8 이 고친 값(질병 굴림)으로 바꿔 둔다.
 *   창을 안 띄우는 보상(웹이 글을 못 짓는 첫 종류 7)은 고친 값으로 바꿔 지나간다. 첫 종류 21 은 늘 멈춘다 — 그 자리에서 재생을 끝낸다.
 * 다음 칸으로 넘기면 창 뒤 명령부터 이어 간다.
 */
function stopAtWindow(
  step: EventStep,
  windowTextOf: ((command: SystemCommand) => string | null) | undefined,
  noticeOf: ((command: RewardCommand, commandIndex: number) => RewardNoticeResult) | undefined,
  /** 보상 명령마다 멈춘다 — 그 자리에서 주려고(`onReward`). 창을 안 띄우는 보상은 주고 곧바로 넘긴다 */
  stopsAtEveryReward = false,
): EventStep {
  if (!needsWindowStops(step, windowTextOf !== undefined || noticeOf !== undefined || stopsAtEveryReward)) return step
  const firstIndex = step.cursor.commandIndex - step.passed.length
  const passed: EventCommand[] = []
  for (let index = 0; index < step.passed.length; index += 1) {
    const at = { eventId: step.cursor.eventId, commandIndex: firstIndex + index }
    const [isStop, command] = windowCommandOf(step.passed[index]!, at.commandIndex, windowTextOf, noticeOf, stopsAtEveryReward)
    if (isStop) return { cursor: at, command, passed }
    passed.push(command)
  }
  return unchangedOr(step, passed)
}

/** 바뀐 명령이 없으면 원래 걸음 그대로 (같은 객체) */
const unchangedOr = (step: EventStep, passed: readonly EventCommand[]): EventStep =>
  passed.length === step.passed.length && passed.every((command, index) => command === step.passed[index]) ? step : { ...step, passed }

/** 멈출 창을 찾아야 하는가 — 창 글 · 보상 알림 · 보상마다 멈춤 가운데 하나를 주었거나, 지나온 명령에 첫 종류 21 이 있을 때 */
function needsWindowStops(step: EventStep, hasWindowSource: boolean): boolean {
  return hasWindowSource || step.passed.some((command) => command.op === 'reward' && endsPlayback(command))
}

/** [true, 멈출 명령] 또는 [false, 지나갈 명령] */
type WindowCommand = readonly [true, StoppingCommand] | readonly [false, EventCommand]

/** 지나온 명령 하나 — [여기서 멈추는가, 실을 명령]. 멈추지 않는 명령도 보상이면 고친 값(0x8beb8)으로 바꿔 싣는다 */
function windowCommandOf(
  command: EventCommand,
  commandIndex: number,
  windowTextOf: ((command: SystemCommand) => string | null) | undefined,
  noticeOf: ((command: RewardCommand, commandIndex: number) => RewardNoticeResult) | undefined,
  stopsAtEveryReward: boolean,
): WindowCommand {
  if (command.op === 'system') return systemWindowOf(command, windowTextOf)
  if (command.op === 'reward') return rewardWindowOf(command, commandIndex, noticeOf, stopsAtEveryReward)
  return [false, command]
}

/** system 3 타이틀 · 4 MVP 발표 — `windowTextOf` 가 글을 주면 그 글을 실어 멈춘다 */
function systemWindowOf(command: SystemCommand, windowTextOf: ((command: SystemCommand) => string | null) | undefined): WindowCommand {
  if (windowTextOf === undefined) return [false, command]
  const text = windowTextOf(command)
  if (text === null) return [false, command]
  return [true, { ...command, text }]
}

/** 0x8beb8 이 고친 항목(질병 굴림)으로 바꾼 보상 명령 */
const resolvedRewardOf = (command: RewardCommand, result: RewardNoticeResult | undefined): RewardCommand =>
  result === undefined ? command : { ...command, items: result.items }

/** 보상 명령 7 — 알림 · 스킬 창 · 보상마다 멈춤 · 첫 종류 21 이면 멈춘다 */
function rewardWindowOf(
  command: RewardCommand,
  commandIndex: number,
  noticeOf: ((command: RewardCommand, commandIndex: number) => RewardNoticeResult) | undefined,
  stopsAtEveryReward: boolean,
): WindowCommand {
  const isStoppedAnyway = stopsAtEveryReward || endsPlayback(command)
  if (noticeOf === undefined && !isStoppedAnyway) return [false, command]
  const result = noticeOf?.(command, commandIndex)
  const resolved = resolvedRewardOf(command, result)
  if (isStoppedAnyway || (result !== undefined && opensRewardWindow(result.notice))) return [true, resolved]
  return [false, resolved]
}

/** 이 걸음이 주는 보상 — 지나온 보상 명령과, 알림 창에 멈춘 보상 명령 자신 (원본은 창을 띄운 그 갱신에 0x8c460 으로 준다) */
export const rewardsOfStep = (step: EventStep): readonly EventReward[] =>
  rewardsIn(step.command?.op === 'reward' && !endsPlayback(step.command) ? [...step.passed, step.command] : step.passed)

/** 커서에 담아 둔 보상 알림 (`buildStep` 이 지은 것) */
export const cachedNoticeOf = (noticeCache: WeakMap<EventCursor, Map<number, RewardNoticeResult>>, cursor: EventCursor, commandIndex: number) =>
  noticeCache.get(cursor)?.get(commandIndex)?.notice

/** 그 자리에서 줄 보상 명령 — 풀린 걸음이 멈춘 보상이고 첫 종류 21(재생 끝)이 아닐 때 */
export function givenRewardOf(step: EventStep, isReleased: boolean): RewardCommand | null {
  const command = step.command
  if (!isReleased || command?.op !== 'reward' || endsPlayback(command)) return null
  return command
}

/** 재생을 끝내는 보상(첫 종류 21)에 멈췄는가 */
export const isEndingRewardStep = (step: EventStep, isReleased: boolean) => isReleased && step.command?.op === 'reward' && endsPlayback(step.command)

/** 보상을 준 뒤 그 자리에 머무는가 — 알림 · 스킬 창을 띄운 보상만 확인까지 기다린다(0x8daa0) */
export const staysOnRewardWindow = (notice: RewardNotice | undefined) => notice !== undefined && opensRewardWindow(notice)

/** 이 걸음이 풀렸는가 — 지나온 명령 5(id 4~7)가 끝나기를 기다리는 동안은 아니다(0x8b564, `isStepHeld`) */
export const isStepReleasedOf = (isHeld: ((step: EventStep) => boolean) | undefined, step: EventStep) => isHeld === undefined || !isHeld(step)

/** 지은 걸음이 지금 열쇠(이벤트 표 · 커서 · 보상마다 멈춤)의 것인가 */
export const isBuiltFor = (
  built: BuiltStep | null,
  events: readonly OriginalEvent[],
  cursor: EventCursor,
  stopsAtEveryReward: boolean,
): built is BuiltStep => built !== null && built.events === events && built.cursor === cursor && built.stopsAtEveryReward === stopsAtEveryReward
