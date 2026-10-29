import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import { SEASON_GOAL_INTRO_EVENT_ID } from '@/entities/season-mode/model/seasonEventFlow/ids'

/**
 * 경기 끝 0x4ea0c 의 모드 2·3·4 공통 꼬리 (4f374~4f3b2) — **경기 갈래(정규·포스트시즌·국가대항전)와 상관없이**:
 * ```
 * SR+0x54 > 0 → min(SR+0x54 − 1, 99)     ; 상대 투구 목표점 보기
 * SR+0x7c > 0 → SR+0x7c − 1              ; 질병 쿨다운
 * ```
 */
export function tickAfterAnyGame(record: SeasonRecord): SeasonRecord {
  return {
    ...record,
    aimVisionGames: record.aimVisionGames > 0 ? Math.min(record.aimVisionGames - 1, 99) : record.aimVisionGames,
    illnessCooldown: record.illnessCooldown > 0 ? record.illnessCooldown - 1 : record.illnessCooldown,
  }
}

/** 이벤트 재생이 끝난 뒤 이어 트는 이벤트 — 392 는 목표 달성 수로 393~396 (`0x8d0d2~0x8d12c`) */
export function seasonEventFollowUpOf(eventId: number, goalResultEventId: () => number): number | null {
  if (eventId === SEASON_GOAL_INTRO_EVENT_ID) return goalResultEventId()
  return null
}
