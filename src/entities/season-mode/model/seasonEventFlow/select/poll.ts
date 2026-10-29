import type { RandomPort } from '@/shared/api/random/randomPort'
import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import { SEASON_SCENE_STATE, type SeasonSceneState } from '@/entities/season-mode/model/seasonStateMachine'
import { OPENING_EVENT_ID, pollsSeasonEvents, seasonScreenCodeOf } from '@/entities/season-mode/model/seasonEventFlow/ids'
import type { SeasonEventJudgeInput } from '@/entities/season-mode/model/seasonEventFlow/judge/types'
import {
  cursorAfterCalling,
  selectSeasonEvent,
  type SeasonEventCursor,
  type SeasonEventSelection,
} from '@/entities/season-mode/model/seasonEventFlow/select/cursor'

export type SeasonEventPoll =
  | { readonly kind: '없음' }
  /** 새 선수 플래그 → 오프닝 400 (0x8bde0) */
  | { readonly kind: '오프닝' }
  /** 연초 목표 0xd4 → 내장 이벤트 (0x8a680) */
  | { readonly kind: '연초목표' }
  | { readonly kind: '이벤트'; readonly eventId: number }

export interface SeasonEventPollInput extends Omit<SeasonEventJudgeInput, 'screenCode'> {
  readonly scene: SeasonSceneState
  /** this+0xf9 — 진입 분기 0xcb 가 새 시즌 초기화(0xcc)에서 왔을 때 켠다 (4c62~4c78) */
  readonly newPlayerFlag: boolean
}

export interface SeasonEventPollResult {
  readonly poll: SeasonEventPoll
  readonly cursor: SeasonEventCursor
  readonly record: SeasonRecord
}

/** 0xc9 진입 0x4efc 끝 (4ffc~5028): SR+0x1bc == 0 && SR+0x187 == 0 → 다음 = 0xd4 */
function goesToYearGoal(scene: SeasonSceneState, record: SeasonRecord): boolean {
  return scene === SEASON_SCENE_STATE.관리메뉴 && !record.endingSeen && !record.yearGoalShown
}

/** 고르기 결과 → 폴링 결과 */
function pollOfSelection(selected: SeasonEventSelection): SeasonEventPollResult {
  return {
    poll: selected.eventId === null ? { kind: '없음' } : { kind: '이벤트', eventId: selected.eventId },
    cursor: selected.cursor,
    record: selected.record,
  }
}

/**
 * 관리 메뉴(0xc9)·외출 지도(0xd1)에 **들어온 틀** 한 번:
 * ```
 * 0xc9 진입 0x4efc 끝 (4ffc~5028): SR+0x1bc == 0 && SR+0x187 == 0 → 다음 = 0xd4
 * 폴링 eb7e: this+0xf9 → 400 (다음 0xd4 를 덮는다)
 *            다음 == 0xd4 → 건너뜀
 *            0xadc70(화면코드 = 현재 상태)
 * ```
 * 외출 지도(209)에서는 s_event(전부 trigger 0)가 하나도 통과하지 못한다 — 커서만 움직인다.
 */
export function pollSeasonEvents(cursor: SeasonEventCursor, input: SeasonEventPollInput, random: RandomPort): SeasonEventPollResult {
  const { record } = input
  if (!pollsSeasonEvents(input.scene)) return { poll: { kind: '없음' }, cursor, record }
  if (input.newPlayerFlag) {
    return { poll: { kind: '오프닝' }, cursor: cursorAfterCalling(cursor, OPENING_EVENT_ID), record }
  }
  if (goesToYearGoal(input.scene, record)) return { poll: { kind: '연초목표' }, cursor, record }
  return pollOfSelection(selectSeasonEvent(cursor, { ...input, screenCode: seasonScreenCodeOf(input.scene) }, random))
}
