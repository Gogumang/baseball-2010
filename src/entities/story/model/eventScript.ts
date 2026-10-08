import type { EventCommand, OriginalEvent } from '@/shared/config/original/eventTypes'

/**
 * 원작 이벤트 스크립트 진행 (binary.mod 0x8cf64 실행기 기준).
 *
 * 화면에 멈추는 명령은 대사(say)·선택지(choice)·예아니오(yesno)·알림(system 0)·경기(match) 이다.
 * 경기는 마선수 대결을 치르고 결과 이벤트로 이어 간다 (aceMatch).
 * 소리·화면효과·보상 명령은 멈추지 않고 지나간다 — 넘어가며 모아서 돌려주므로
 * 부르는 쪽이 보상을 반영할 수 있다.
 */
export interface EventCursor {
  readonly eventId: number
  readonly commandIndex: number
}

export type StoppingCommand = Extract<EventCommand, { op: 'say' | 'choice' | 'yesno' | 'match' }> | Extract<EventCommand, { op: 'system' }>

export interface EventStep {
  readonly cursor: EventCursor
  /** 멈춰서 보여줄 명령. null 이면 이벤트가 끝났다. */
  readonly command: StoppingCommand | null
  /** 멈추기 전에 지나온 명령 (소리·효과·보상) */
  readonly passed: readonly EventCommand[]
}

export function findEvent(events: readonly OriginalEvent[], eventId: number): OriginalEvent | null {
  return events.find((event) => event.id === eventId) ?? null
}

function isStopping(command: EventCommand): command is StoppingCommand {
  if (command.op === 'say' || command.op === 'choice' || command.op === 'match') return true
  // 예아니오 0x8d426 — 하위([명령+4]) 0 일 때만 창을 띄운다. ≠ 0 이면 아무것도 안 하고(0x8d432 → 0x8d906)
  // 기다림 0x8d954 가 창이 없음([창+9] == 0)을 보고 곧바로 다음 명령으로 넘긴다(0x8dac2)
  if (command.op === 'yesno') return command.sub === 0
  // system 0 = 알림 팝업. 다른 system 은 원작의 다른 화면을 부른다 (아직 대응 없음).
  return command.op === 'system' && command.sub === 0
}

/** cursor 부터 다음에 멈출 명령을 찾는다. */
export function stepFrom(events: readonly OriginalEvent[], cursor: EventCursor): EventStep {
  const event = findEvent(events, cursor.eventId)
  if (event === null) return { cursor, command: null, passed: [] }

  const passed: EventCommand[] = []
  for (let index = cursor.commandIndex; index < event.commands.length; index += 1) {
    const command = event.commands[index]
    if (isStopping(command)) return { cursor: { eventId: event.id, commandIndex: index }, command, passed }
    passed.push(command)
  }
  return { cursor: { eventId: event.id, commandIndex: event.commands.length }, command: null, passed }
}

/** 지금 명령을 마치고 다음 명령으로. */
export function advanceCursor(cursor: EventCursor): EventCursor {
  return { eventId: cursor.eventId, commandIndex: cursor.commandIndex + 1 }
}

/**
 * say 중 취소(−16) 가 건너뛰어 멈출 명령 종류 — 0x8b7b0 의 비교(0x8b7d8~0x8b7ee): 보상 7 · system 2 · 선택지 1 ·
 * 예아니오 3 · 4 · 경기 8. say 0 · 화면효과 5 · 소리 6 은 건너뛴다.
 */
const SKIP_STOPPING_OPS: ReadonlySet<EventCommand['op']> = new Set(['reward', 'system', 'choice', 'yesno', 'op4', 'match'])

/**
 * **say 중 취소** (키 0x8b804 — 지금 명령이 say(0)이고 키 −16 이면 0x8b7b0, 상자 단계와 상관없이).
 * ```
 * 0x8b7b0: [mgr+8] = 1
 *          [mgr+0x10] ≤ 명령 수 − 2 인 동안 [mgr+0x10] += 1 ; 그 명령 종류가 7 · 2 · 1 · 3 · 4 · 8 이면
 *                                             [mgr+9] = 1 · [mgr+8] = 0 → 다음 갱신이 그 명령을 곧바로 돈다(0x8d1ca)
 *          못 찾으면 [mgr+0x10] = 명령 수 − 1 · [mgr+8] = 1 → 다음 갱신이 끝 갈래(0x8cf8c)로 — 마지막 명령도 안 돈다
 * ```
 * 건너뛴 say · 화면효과 · 소리는 아예 안 돈다(초상화 · 효과 · 소리 모두). 멈출 명령은 지금 이벤트 안에서만 찾는다.
 */
export function skipSayCursor(events: readonly OriginalEvent[], cursor: EventCursor): EventCursor {
  const event = findEvent(events, cursor.eventId)
  if (event === null) return cursor
  for (let index = cursor.commandIndex + 1; index < event.commands.length; index += 1) {
    if (SKIP_STOPPING_OPS.has(event.commands[index].op)) return { eventId: event.id, commandIndex: index }
  }
  return { eventId: event.id, commandIndex: event.commands.length }
}

/** 선택지·예아니오가 가리키는 이벤트의 처음으로. */
export function jumpToEvent(eventId: number): EventCursor {
  return { eventId, commandIndex: 0 }
}
