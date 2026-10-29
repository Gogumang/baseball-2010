import type { OriginalEvent } from '@/shared/config/original/eventTypes'
import { isEmptyPlaceEventId, type PlayerCareer } from '@/entities/story/model/storyScene/otherSlices'

/**
 * 장면이 새로 설 때 — 반복 이벤트는 다시 볼 수 있게 기록에서 지운다. 나리 장면 셋업 0xf684 의 fb1c `0x8ce94` → `0xacf60`
 * (레코드마다 반복(+5 == 1)이고 본 표시가 서 있으면 `0xacf48(…, 0)` · 커서 reader+0x28 = 0). 장면은 이어하기와 **경기 뒤마다**
 * (경기 장면 0x104 를 지나 0x106 이 다시 선다) · 마선수 대결 뒤에 선다. 나리 두 편 공용.
 */
export function forgetRepeatableEvents<C extends { readonly seenEventIds: readonly string[] }>(career: C, events: readonly OriginalEvent[]): C {
  const repeatable = new Set(events.filter((event) => event.repeatable).map((event) => String(event.id)))
  return { ...career, seenEventIds: career.seenEventIds.filter((id) => !repeatable.has(id)) }
}

/** 0x8c460 끝이 보는 칸 — 나리 타자편 `PlayerCareer` · 투수편 `PitcherCareer` 가 같은 이름으로 든다 */
export interface RewardedEventHolder {
  readonly seenEventIds: readonly string[]
  readonly hasActedThisCycle: boolean
}

/** 장소 이벤트 trigger 2~6 (장소 = trigger − 2) — 0x8cbfc `0xacbed(지금 이벤트) − 2 ≤ 4` */
const FIRST_PLACE_TRIGGER = 2
const LAST_PLACE_TRIGGER = 6

function isPlaceEvent(event: Pick<OriginalEvent, 'id' | 'trigger'> | null): boolean {
  return event !== null && event.id > 0 && event.trigger >= FIRST_PLACE_TRIGGER && event.trigger <= LAST_PLACE_TRIGGER
}

/**
 * **보상 명령 하나를 준 뒤** — 0x8c460 의 끝(0x8cba2~0x8cd5e, 항목을 다 돈 뒤, 모드 3 · 4 · 2 공용, 직접 떴다):
 * ```
 * 8cbe0  [mgr+0xa] == 0(파일 이벤트) → 0xacf49([mgr+4], 지금 이벤트, 1)            ; 본 표시
 * 8cbfa  0xacbed([mgr+4]) − 2 ≤ 4(지금 이벤트 trigger 2~6, 장소) → [[mgr+0x2f8]+4] = 1   ; S+4 행동함
 * 8cc1a  0x8b0e4(mgr) — 떠나온 이벤트 줄 [mgr+0x38a](수 [mgr+0x39e])마다 0xacf49(…, 1) → 0x1fded · 0x22755(저장, 1)
 *        (외출 장면 0x70 · 0x71 이면 저장 앞에 갈래가 하나 더 있다 — 0x8b12c~0x8b15e)
 * 8cc2e  시즌모드(0x7b999)가 아니면 이벤트 번호로 S+0x50 을 고치고(371~374 · 377 · 393~396 · 463 · 464) 0x8cd44 저장 · 0x1f1b9
 * ```
 * 곧 원본은 **보상 명령마다 저장하고, 그 저장에는 본 표시 · 장소 행동함이 든다.** 웹은 그 자리에서 본 이벤트를 남기고
 * (`viewedEventIds` — 지금 이벤트와 이 재생에서 거친 이벤트, 파일 이벤트만) 장소 이벤트면 행동함을 켠다. 둘 다 끝
 * (`finishEvent` · 장소 끝 처리)에서 다시 해도 같은 값이다. 8cc2e 의 이벤트별 S+0x50(이어하기 자리) 고치기는 `rewardResumePatchOf`.
 */
export function markRewardedEvent<C extends RewardedEventHolder>(
  career: C,
  event: Pick<OriginalEvent, 'id' | 'trigger'> | null,
  viewedEventIds: readonly number[],
): C {
  const added = [...new Set(viewedEventIds.filter((id) => id > 0).map(String))].filter((id) => !career.seenEventIds.includes(id))
  const seen = added.length === 0 ? career : { ...career, seenEventIds: [...career.seenEventIds, ...added] }
  return isPlaceEvent(event) && !seen.hasActedThisCycle ? { ...seen, hasActedThisCycle: true } : seen
}

/**
 * **0x8b0e4 안의 외출 갈래 0x8b12c~0x8b15e** (직접 떴다) — 떠나온 이벤트 줄 본 표시 뒤, 저장(0x1fded · 0x22755) **앞에**:
 * ```
 * 8b116  u = [mgr+0xb4]                                 ; 그림 객체(+0x20 = 모드, +0x174 = 마지막 상태)
 * 8b11c  [u+0x174] == 0x70 | 0x71 ?                    ; 외출 지도 112 · 장소 113
 * 8b12c    0x7b999(u)(시즌모드) → S+4 = 1
 * 8b138    아니면 e = 0xacb61([mgr+4])(지금 이벤트): e ≤ 0x1b7 || e > 0x1bc → [[mgr+0x2f8]+4] = 1   ; 440~444 만 뺀다
 * ```
 * [u+0x174] 는 상태 틀 0x1cdec 가 상태를 바꿀 때마다 `0x7e84c(u, 새 상태)` 로 적는데 **새 상태가 114 면 안 적는다**(1ce18~1ce20)
 * — 그래서 이벤트 재생 중에는 이벤트를 연 상태(112 외출 진입 · 113 장소)가 남는다. 0x8b0e4 는 보상 명령 끝(0x8c460 8cc1a) ·
 * 선택지 확인(0x8b804) · 114 끝(0x1c014 1c02e)마다 돌므로, 112 · 113 에서 연 이벤트는 그 자리마다 행동함(S+4)이 켜진 채
 * 저장된다. 113 끝 처리(1c03a~1c076 — +0x167 == 0 이면 S+4 · 외출 수 · 105)와 달리 **112 에서 연 이벤트(외출 진입)도 켠다.**
 * 시즌모드 상태 번호(0xc9~)는 0x70 · 0x71 이 아니라 시즌에는 닿지 않는다.
 */
export function withOutingEventActed<C extends { readonly hasActedThisCycle: boolean }>(career: C, isOpenedFromOuting: boolean, eventId: number): C {
  if (!isOpenedFromOuting || isEmptyPlaceEventId(eventId) || career.hasActedThisCycle) return career
  return { ...career, hasActedThisCycle: true }
}

/** 이벤트를 마친다. 선택지로 이어 본 이벤트까지 모두 본 것으로 남긴다. */
export function finishEvent(career: PlayerCareer, viewedEventIds: readonly number[]): PlayerCareer {
  const added = viewedEventIds.map(String).filter((id) => !career.seenEventIds.includes(id))
  return { ...career, seenEventIds: [...career.seenEventIds, ...new Set(added)] }
}
