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
  if (command.op === 'say' || command.op === 'choice' || command.op === 'yesno' || command.op === 'match') return true
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

/** 선택지·예아니오가 가리키는 이벤트의 처음으로. */
export function jumpToEvent(eventId: number): EventCursor {
  return { eventId, commandIndex: 0 }
}
