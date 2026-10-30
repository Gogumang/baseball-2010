import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { applyPitcherEventRewards } from '@/entities/pitcher-career/model/pitcherEventReward'
import { rewardsIn } from '@/entities/pitcher-career/model/pitcherYearEnd/otherSlices'
import type { EventReward } from '@/entities/pitcher-career/model/pitcherYearEnd/otherSlices'
import type { OriginalEvent } from '@/entities/pitcher-career/model/pitcherYearEnd/otherSlices'

/** 이벤트 데이터의 보상 명령 7 (r_event) — 데이터(535KB)는 부르는 쪽이 넘긴다 (첫 화면 묶음에 넣지 않으려고) */
export function pitcherYearEndRewardsOf(eventId: number, events: readonly OriginalEvent[]): readonly EventReward[] {
  const event = events.find((candidate) => candidate.id === eventId)
  return event === undefined ? [] : rewardsIn(event.commands)
}

/**
 * 이벤트가 **끝날 때** 그 이벤트의 보상을 준다 (393~396 은 연차 보정 0x8d508 을 얹어서).
 * `rewards` 는 재생기가 지나온 보상 명령이다 — 선택지로 이어 본 이벤트(461 → 463 따위)의 것까지 들어 있다.
 * 보상 실행은 `applyPitcherEventRewards`(0x8c460 모드 3 갈래)에 맡긴다. 연말 사슬에 나오는 종류는
 * 0 인기도 · 1 평판 · 3 소지금 · 20 연봉 · 21 엔딩 진입(무시 — 세션이 엔딩으로 넘긴다) 뿐이라 무작위가 들지 않는다.
 */
export function finishPitcherYearEndEvent(career: PitcherCareer, eventId: number, rewards: readonly EventReward[]): PitcherCareer {
  return applyPitcherEventRewards(career, rewards, undefined, eventId)
}
