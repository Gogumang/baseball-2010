import { ORIGINAL_SEASON_EVENTS } from '@/shared/config/original/seasonEvents'
import type { OriginalEvent } from '@/shared/config/original/eventTypes'
import { ORIGINAL_USER_EVENTS } from '@/shared/config/original/userEvents'
import { YEAR_GOAL_EVENT_ID } from '@/entities/season-mode/model/seasonEventFlow/ids'

/** 감독 — 캐릭터 2 → 0xd0ae6[2] = 16, 표정 0, 오른쪽 (R9 7절) */
const MANAGER_PORTRAIT = { file: 'event_char_0', animation: 16, side: 'right' } as const
/** 화자 2 = StrMODE[93] "감독" */
const MANAGER_SPEAKER = 2
/** StrUSER_EVT[1] "올해의 목표다!! 많이 달성할수록 1년 후 높은 보너스를 받을 수 있지!!" */
const YEAR_GOAL_LINE = 1
/** SYS sub 1 — 올해의 목표 창 (0x741a1 팝업 id 0, 그리기 0x86fdc) */
export const SEASON_GOAL_WINDOW_SUB = 1

/**
 * `0x8a680` 이 관리자 메모리에 바로 만드는 두 줄짜리 이벤트 (파일 이벤트가 아니다, R9 7절·R13 2절):
 * ① 감독 대사 StrUSER_EVT[1] ② SYS(sub 1) 올해의 목표 창. 내장 표시(mgr+0x39f)라 본 비트를 켜지 않는다.
 */
export const YEAR_GOAL_EVENT: OriginalEvent = {
  id: YEAR_GOAL_EVENT_ID,
  audience: 0,
  repeatable: true,
  trigger: 0,
  requiresEvent: 0,
  dateFrom: [0, 0],
  dateTo: [0, 0],
  conditions: [],
  commands: [
    {
      op: 'say',
      text: ORIGINAL_USER_EVENTS[YEAR_GOAL_LINE] ?? '',
      speaker: MANAGER_SPEAKER,
      format: 0,
      portraits: [MANAGER_PORTRAIT],
    },
    { op: 'system', sub: SEASON_GOAL_WINDOW_SUB, arg: 0 },
  ],
}

/** 재생기에 넘길 이벤트 묶음 — s_event 30편 + 내장 연초 목표. 재생에는 대상 칸이 쓰이지 않는다 */
export const SEASON_PLAYABLE_EVENTS: readonly OriginalEvent[] = [
  ...ORIGINAL_SEASON_EVENTS.map((event): OriginalEvent => ({ ...event, audience: 0 })),
  YEAR_GOAL_EVENT,
]

/** 이 이벤트가 목표 창(SYS sub 1)을 여는가 — 창이 닫히면 `0x7fe90` 이 SR+0x187 = 1 로 켜고 저장한다 */
export function opensSeasonGoalWindow(eventId: number): boolean {
  const event = SEASON_PLAYABLE_EVENTS.find((candidate) => candidate.id === eventId)
  return event?.commands.some((command) => command.op === 'system' && command.sub === SEASON_GOAL_WINDOW_SUB) ?? false
}
