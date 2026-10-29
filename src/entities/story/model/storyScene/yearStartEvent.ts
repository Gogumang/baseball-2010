import type { OriginalEvent } from '@/shared/config/original/eventTypes'
import { ORIGINAL_USER_EVENTS } from '@/shared/config/original/userEvents'

/**
 * **연초 115** 의 내장 이벤트 (0x8a680 — 파일 이벤트가 아니다, R9 7절 확정).
 * ```
 *   cmd[0] say: 인물 1명 (캐릭터 2 = 감독, 오른쪽, 표정 0) · 글 StrUSER_EVT[1] · 말하는 이 2(StrMODE[93] "감독")
 *   cmd[1] system sub 1 arg 0 — 올해의 목표 창 (0x741a1 → 0x86fdc)
 * ```
 * 초상화 번호 = 캐릭터 기본번호 표 0xd0ae6[2] = 16 + 표정 0. 파일 레코드가 아니라 본 표시를 남기지 않는다.
 * 나리 두 편(모드 3 · 4) 공용 — 진입 0x16aac 가 모드를 넘기지만 명령 두 줄은 모드로 갈리지 않는다(R9 7절).
 * 올해의 목표 창(SYS 1)은 재생기가 띄운다 — `pages/story/lib/yearGoalWindow`(0x8d304 → 0x86fdc · 0x8656c). 392 의 SYS(1, …) 도 같은 창.
 */
export const NARI_YEAR_START_EVENT_ID = -115
const DIRECTOR_SPEAKER = 2
const DIRECTOR_PORTRAIT_ANIMATION = 16
const YEAR_START_TEXT_INDEX = 1

export const NARI_YEAR_START_EVENT: OriginalEvent = {
  id: NARI_YEAR_START_EVENT_ID,
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
      text: ORIGINAL_USER_EVENTS[YEAR_START_TEXT_INDEX] ?? '',
      speaker: DIRECTOR_SPEAKER,
      format: 0,
      portraits: [{ file: 'event_char_0', animation: DIRECTOR_PORTRAIT_ANIMATION, side: 'right' }],
    },
    { op: 'system', sub: 1, arg: 0 },
  ],
}
