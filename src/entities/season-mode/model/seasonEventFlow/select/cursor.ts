import type { RandomPort } from '@/shared/api/random/randomPort'
import { ORIGINAL_SEASON_EVENTS, type SeasonOriginalEvent } from '@/shared/config/original/seasonEvents'
import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import { judgeSeasonEvent } from '@/entities/season-mode/model/seasonEventFlow/judge/judgeEvent'
import type { SeasonEventJudgeInput } from '@/entities/season-mode/model/seasonEventFlow/judge/types'

/**
 * 읽기 객체의 커서 두 칸 — `+0x28` 지금 레코드 · `+0x2c` 번호로 부른 뒤 이어 훑을 자리.
 * 웹은 바이트 오프셋 대신 **파일 차례 첨자**로 든다 (레코드가 빈틈없이 이어져 있어 같은 뜻이다).
 * 이벤트 관리자는 장면 0x105 를 만들 때 새로 생기므로 커서도 그때 0 이다.
 */
export interface SeasonEventCursor {
  readonly position: number
  readonly pending: number
}

export const START_SEASON_EVENT_CURSOR: SeasonEventCursor = { position: 0, pending: 0 }

export interface SeasonEventSelection {
  readonly eventId: number | null
  readonly cursor: SeasonEventCursor
  readonly record: SeasonRecord
}

/**
 * 고르기 `0xadc70` — 커서에서부터 파일 차례로 훑어 **처음 통과한 한 건**에 멈춘다.
 * ```
 * if +0x2c > 0: cursor = +0x2c ; +0x2c = 0
 * while cursor < 끝: if 판정 통과 → 1 (커서는 그 레코드에 멈춘다) ; cursor += 길이
 * cursor = 0 ; return 0
 * ```
 * 다음 호출은 지난 당첨(이제 본 것)부터 다시 훑는다. 끝까지 없으면 되감고 그 호출은 "없음" 이다.
 */
export function selectSeasonEvent(
  cursor: SeasonEventCursor,
  input: SeasonEventJudgeInput,
  random: RandomPort,
  events: readonly SeasonOriginalEvent[] = ORIGINAL_SEASON_EVENTS,
): SeasonEventSelection {
  let position = cursor.pending > 0 ? cursor.pending : cursor.position
  let record = input.record
  while (position < events.length) {
    const event = events[position]
    const judged = judgeSeasonEvent(event, { ...input, record }, random)
    record = judged.record
    if (judged.passes) return { eventId: event.id, cursor: { position, pending: 0 }, record }
    position += 1
  }
  return { eventId: null, cursor: START_SEASON_EVENT_CURSOR, record }
}

/**
 * 번호로 부르기 `0x8bdc8` → `0xae170` — 레코드를 찾고 **그 다음 자리**를 `+0x2c` 에 남긴다.
 * 본 비트·반복 가드는 보지 않는다. 다음 고르기는 그 자리부터 훑는다.
 */
export function cursorAfterCalling(
  cursor: SeasonEventCursor,
  eventId: number,
  events: readonly SeasonOriginalEvent[] = ORIGINAL_SEASON_EVENTS,
): SeasonEventCursor {
  const index = events.findIndex((event) => event.id === eventId)
  if (index < 0) return cursor
  return { position: cursor.position, pending: index + 1 }
}
