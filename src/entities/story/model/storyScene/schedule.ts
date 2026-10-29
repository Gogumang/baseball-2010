import type { OriginalEvent } from '@/shared/config/original/eventTypes'

/**
 * 원작 이벤트 일정 (r_event 레코드 머리).
 *
 *   trigger   0 관리 화면 · 1 외출 지도 진입 · 2~6 장소(event_map 프레임 1~5 + 1: 경기장·번화가·병원·학교·방송국)
 *             — 장소마다 대사 내용이 그 장소 인물(병원=메디카, 방송국=발렌타인…)이라 맞춘 것이다
 *   audience  0 코드가 직접 부름(분기·평가·엔딩) · 1 공통 · 2 타자 · 3 투수 → 타자편은 1·2 만
 *   날짜 창   [연차, 경기 번호] 범위 — 네 바이트 중 하나라도 0 이면 언제든 (`isInDateWindow`, 0xacfbc 7번)
 *   requiresEvent 이 이벤트를 본 뒤에만
 *   조건      (switch 0xad1ba · 점프표 0xd83a0, r253 직접 떴다) — `conditions` 머리 주석
 * 본 이벤트는 반복 이벤트까지 모두 막힌다 (0xacf30). 반복 이벤트의 본 표시는 나리 장면이 **새로 설 때마다**(셋업 0xf684 의
 * fb1c `0x8ce94` → `0xacf60`) 풀린다 — 이어하기 · 경기 뒤 · 마선수 대결 뒤 (`forgetRepeatableEvents`).
 */
export const EVENT_TRIGGER = { 관리: 0, 외출: 1 } as const

/** event_map 프레임 번호(1~5) → trigger */
export function placeTriggerOf(placeFrame: number): number {
  return placeFrame + 1
}

/** 배열 첫 이벤트. audience 0 이지만 나만의리그 시작 때 관리 화면에서 먼저 본다 (추정: 코드가 직접 부름) */
export const OPENING_EVENT_ID = 451

const branchOnlyCache = new WeakMap<readonly OriginalEvent[], ReadonlySet<number>>()

type EventCommand = OriginalEvent['commands'][number]

/** 명령 하나가 가리키는 이벤트 번호들 — 선택지 · 예아니오 · 경기 결과 */
function addBranchTargets(command: EventCommand, ids: Set<number>): void {
  if (command.op === 'choice') command.choices.forEach((choice) => ids.add(choice.gotoEvent))
  if (command.op === 'yesno') ids.add(command.yesEvent).add(command.noEvent)
  if (command.op === 'match') command.resultEvents.forEach((eventId) => ids.add(eventId))
}

/** 다른 이벤트의 선택지·예아니오·경기 결과가 가리키는 이벤트 번호 */
export function branchOnlyEventIds(events: readonly OriginalEvent[]): ReadonlySet<number> {
  const cached = branchOnlyCache.get(events)
  if (cached !== undefined) return cached

  const ids = new Set<number>()
  for (const event of events) {
    for (const command of event.commands) addBranchTargets(command, ids)
  }
  ids.delete(0)
  branchOnlyCache.set(events, ids)
  return ids
}
