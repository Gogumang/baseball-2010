import { ORIGINAL_SEASON_EVENTS, type SeasonOriginalEvent } from '@/shared/config/original/seasonEvents'
import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'

/** `0xb6e80(SR, id)` — 본 이벤트인가 */
export function hasSeenEvent(record: SeasonRecord, eventId: number): boolean {
  return record.seenEvents.includes(eventId)
}

/** `0xb6ec0(SR, id, 1)` — 본 것으로 켠다 */
export function markEventSeen(record: SeasonRecord, eventId: number): SeasonRecord {
  if (hasSeenEvent(record, eventId)) return record
  return { ...record, seenEvents: [...record.seenEvents, eventId] }
}

/**
 * 장면 0x105 를 만들 때 (`0x3b14` 의 4016 → `0x8ce94` → `0xacf60`) — **반복 이벤트의 본 비트를 지운다.**
 * 경기를 마치고 돌아올 때도 장면을 새로 만들므로 질병 490 은 경기마다 다시 뜰 수 있다.
 */
export function clearRepeatableSeen(record: SeasonRecord, events: readonly SeasonOriginalEvent[] = ORIGINAL_SEASON_EVENTS): SeasonRecord {
  const repeatable = new Set(events.filter((event) => event.repeatable).map((event) => event.id))
  if (!record.seenEvents.some((id) => repeatable.has(id))) return record
  return { ...record, seenEvents: record.seenEvents.filter((id) => !repeatable.has(id)) }
}
