import { NARI_YEAR_START_EVENT, NARI_YEAR_START_EVENT_ID, OPENING_EVENT_ID } from '@/entities/pitcher-career/model/pitcherStoryScene/otherSlices'
import { isPitcherEventEligible } from '@/entities/pitcher-career/model/pitcherStoryScene/eligibility/eligible'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import type { OriginalEvent } from '@/shared/config/original/eventTypes'
import type { RandomPort } from '@/shared/api/random/randomPort'

/* ── 자동 발동 (0x1cf9c → 0x8be80 → 0xadc70) ───────────────────────────────────────────── */

/** 한 번 훑기의 결과 — 뽑힌 이벤트와 **다음 호출이 이어서 볼 자리**(reader+0x28) */
export interface PitcherEventScan {
  readonly event: OriginalEvent | null
  readonly cursor: number
}

/**
 * 선택 0xadc70 (A 3절 확정) — 커서에서 이어 훑어 처음 통과한 한 건, 커서는 그 레코드에 멈춘다.
 * 끝까지 없으면 커서를 0 으로 되감고 이번 호출은 "없음". 0x8be80 은 장소 인자로 늘 −1 을 넘긴다.
 * 무작위 조건(22 질병 · 23)은 `random` 이 있을 때만 굴린다.
 */
export function scanPitcherEventFrom(
  career: PitcherCareer,
  events: readonly OriginalEvent[],
  trigger: number,
  cursor: number,
  random?: RandomPort,
  isFreshScene = false,
): PitcherEventScan {
  for (let at = Math.max(0, cursor); at < events.length; at += 1) {
    if (isPitcherEventEligible(events[at], career, trigger, random, isFreshScene)) return { event: events[at], cursor: at }
  }
  return { event: null, cursor: 0 }
}

/**
 * 오프닝 451 — 새 선수 플래그(장면+0x165, 100 진입 끝 0x1c3be: 이전 상태가 104 면 1)가 서 있으면 0x1cfa6 이
 * 자동 발동 대신 `0x8bde0`(모드 3·4 → 451)을 번호로 부른다. 번호 호출(0xae170)은 "그 다음 칸" 을 커서로 남긴다.
 */
export function pitcherOpeningScanOf(events: readonly OriginalEvent[], cursor: number): PitcherEventScan {
  const index = events.findIndex((event) => event.id === OPENING_EVENT_ID)
  return index < 0 ? { event: null, cursor } : { event: events[index], cursor: index + 1 }
}

/** **연초 115** 의 내장 이벤트 0x8a680 — 타자편과 같은 함수라 `entities/story` 의 것을 쓴다 */
export const PITCHER_YEAR_START_EVENT_ID = NARI_YEAR_START_EVENT_ID
export const PITCHER_YEAR_START_EVENT: OriginalEvent = NARI_YEAR_START_EVENT
