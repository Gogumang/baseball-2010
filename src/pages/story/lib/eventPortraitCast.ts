import type { EventPortrait, OriginalEvent } from '@/shared/config/original/eventTypes'

/**
 * **이 재생이 띄울 수 있는 초상화 전부** — 시작 이벤트와, 그 대본이 선택지 · 예아니오 · 경기 결과로 넘어갈 수 있는 이벤트들의
 * `say` · `choice` 명령이 적어 둔 인물 · 표정(애니 번호). 대본(events.json)이 애니 번호를 다 정해 두므로 재생 전에 안다 —
 * 표정이 넘어갈 때 칠하기를 그제야 걸어 구운 벌이 한 박자 비치던 것을 미리 칠해 막는다(원본 초상화 적재 0x63a70 · 팔레트 0x63a7e 는
 * 표정을 바꿔도 같은 그림 객체 · 팔레트를 쓴다). 재생 차례 · 분기는 안 건드린다
 */
export function eventPortraitCastOf(events: readonly OriginalEvent[], start: OriginalEvent): EventPortrait[] {
  const byId = new Map(events.map((event) => [event.id, event]))
  const seen = new Set<number>()
  const queue: OriginalEvent[] = [start]
  const portraits = new Map<string, EventPortrait>()
  while (queue.length > 0) {
    const event = queue.shift()
    if (event === undefined || seen.has(event.id)) continue
    seen.add(event.id)
    for (const command of event.commands) {
      queueNextEvents(command, byId, seen, queue)
      addCommandPortraits(command, portraits)
    }
  }
  return [...portraits.values()]
}

type EventCommand = OriginalEvent['commands'][number]

/** 이 명령이 넘어갈 수 있는 이벤트 중 아직 안 본 것을 줄 끝에 */
function queueNextEvents(command: EventCommand, byId: ReadonlyMap<number, OriginalEvent>, seen: ReadonlySet<number>, queue: OriginalEvent[]) {
  for (const id of nextEventIdsOf(command)) {
    const next = byId.get(id)
    if (next !== undefined && !seen.has(id)) queue.push(next)
  }
}

/** `say` · `choice` 가 적어 둔 인물 · 표정 */
function addCommandPortraits(command: EventCommand, portraits: Map<string, EventPortrait>) {
  if (command.op !== 'say' && command.op !== 'choice') return
  for (const portrait of command.portraits) portraits.set(`${portrait.file}#${portrait.animation}`, portrait)
}

function nextEventIdsOf(command: EventCommand): readonly number[] {
  if (command.op === 'choice') return command.choices.map((choice) => choice.gotoEvent)
  if (command.op === 'yesno') return [command.yesEvent, command.noEvent]
  if (command.op === 'match') return command.resultEvents
  return []
}
