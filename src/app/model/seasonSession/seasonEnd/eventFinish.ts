import type { AnnalsStatEvent } from '@/entities/collection/model/annalsStats'
import { type SeasonEventReward, YEAR_GOAL_EVENT_ID, markEventSeen, opensSeasonGoalWindow } from '@/entities/season-mode/model/seasonEventFlow'
import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import { SEASON_STAT_MODE } from '@/app/model/seasonSession/constants/seasonConstants'
import { type SeasonGlobalSlots, withEvent100Awarded } from '@/app/model/seasonSession/save/globals'

/**
 * 이벤트 재생 0xd3 의 끝 — 본 이벤트를 켜고(8cf92~8cfc2) 목표 창이 닫혔으면 SR+0x187 = 1 (8d928~8d942).
 * 첫 종류 21(s_event 500)로 끝났으면 그 이벤트만 본 표시를 안 한다 — 0x8d4ce 는 0x8cf8c 를 안 지나고, 0xd3 끝 0x78f0 의
 * 0x8b0e4 가 떠나온 이벤트 줄만 켠다. [0x1552adc] 는 0xe9ac(ec04)가 지우기만 한다 — 엔딩 0xf5 는 500 을 튼 쪽이 줄에 넣었다
 */
export function recordAfterEventPlayback(
  record: SeasonRecord,
  eventId: number,
  viewedEventIds: readonly number[],
  endingEventId: number | null,
): SeasonRecord {
  const fileEvents = viewedEventIds.filter((id) => id !== YEAR_GOAL_EVENT_ID && id !== endingEventId)
  const seen = fileEvents.reduce(markEventSeen, record)
  return [eventId, ...viewedEventIds].some(opensSeasonGoalWindow) ? { ...seen, yearGoalShown: true } : seen
}

/** 선택지가 번호로 부른 마지막 이벤트 — 지금 이벤트 그대로면 없다(커서를 안 옮긴다, 0xae170) */
export function lastCalledEventOf(viewedEventIds: readonly number[], eventId: number): number | undefined {
  const lastCalled = viewedEventIds[viewedEventIds.length - 1]
  return lastCalled === eventId ? undefined : lastCalled
}

/**
 * 보상 명령의 곁일 — G(종류 10)는 지갑으로 · 0x8c6e4 `0x22c7d(v, 모드)` 획득 GP 통계, 이벤트 100 이면 전역 +0xbe (0x8c714).
 * 시즌 저장을 쓴 **뒤에** 부른다.
 */
export function payEventRewardExtras(
  rewards: readonly SeasonEventReward[],
  applied: { readonly gamePoint: number; readonly event100Awarded: boolean },
  gainGamePoint: (amount: number) => void,
  recordStat: ((event: AnnalsStatEvent) => void) | undefined,
  updateGlobals: (change: (current: SeasonGlobalSlots) => SeasonGlobalSlots) => void,
): void {
  if (rewards.some((reward) => reward.kind === 10)) {
    gainGamePoint(applied.gamePoint)
    recordStat?.({ kind: 'G획득', mode: SEASON_STAT_MODE, amount: applied.gamePoint })
  }
  if (applied.event100Awarded) updateGlobals(withEvent100Awarded)
}
