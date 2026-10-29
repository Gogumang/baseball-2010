import type { EventReward } from '@/entities/story/model/eventReward'
import type { RewardNoticeResult } from '@/entities/story/model/rewardNotice'
import type { EventCommand } from '@/shared/config/original/eventTypes'

export type MatchCommand = Extract<EventCommand, { op: 'match' }>
export type SystemCommand = Extract<EventCommand, { op: 'system' }>

export type RewardCommand = Extract<EventCommand, { op: 'reward' }>

/** 보상 명령 하나의 알림 — 부르는 쪽이 맥락(모드 · 선수 · 난수)을 묶어 준다 (`rewardNoticeOf`) */
export type RewardNoticeOf = (items: readonly EventReward[], eventId: number) => RewardNoticeResult

/**
 * 보상 명령 하나를 그 자리에서 준다 — 항목(0x8beb8 이 고친 값)과 그 명령이 든 이벤트 번호(연차 보정 · 중간평가가 본다).
 * `viewedEventIds` 는 이 재생에서 지금까지 거친 이벤트(대결 앞 이벤트 · 선택지로 떠난 이벤트 · 지금 이벤트) — 0x8c460 끝이
 * 지금 이벤트(0xacf49)와 떠나온 이벤트 줄 [mgr+0x38a](0x8b0e4)에 본 표시를 하고 저장한다.
 */
export type EventRewardHandler = (items: readonly EventReward[], eventId: number, viewedEventIds: readonly number[]) => void

/**
 * **선택지 확인** — 대사 상자 키 0x8b804 가 선택지 명령에서 OK(−5)를 받으면(8b8b2~8b8d8) [mgr+0x2bc] = 고른 줄의 goto 이벤트 ·
 * [mgr+8] = 1 을 쓰고 곧 0x8b0e4(mgr)를 부른다 — 떠나온 이벤트 줄(이 재생에서 선택지 · 예아니오로 떠난 이벤트)을 본 표시하고,
 * 외출 갈래(0x8b12c — 지금 이벤트 0xacb61 이 440~444 가 아니면 S+4)를 지난 뒤 저장한다(0x1fded · 0x22755). 지금 이벤트는
 * 아직 줄에 없다(이벤트 끝 0x8cfc8 이 넣는다). `eventId` 는 선택지가 든 지금 이벤트, `leftEventIds` 는 그 줄이다.
 */
export type EventChoiceConfirmHandler = (eventId: number, leftEventIds: readonly number[]) => void

/**
 * 재생이 끝났다 — 끝에 모아 넘기는 보상 · 이 재생에서 거친 이벤트 · 엔딩 요청.
 * `endingEventId` 는 첫 종류 21 로 끝났을 때 그 이벤트다(0x8d4ce — [0x1552adc] = 1). 원본은 그 이벤트만 본 표시를 안 하고
 * 거친 다른 이벤트(선택지로 떠나온 줄)는 끝 0x8b0e4 가 본 표시한다. 보통 끝이면 null.
 */
export type EventCompleteHandler = (rewards: readonly EventReward[], viewedEventIds: readonly number[], endingEventId: number | null) => void
