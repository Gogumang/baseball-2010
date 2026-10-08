import { randomIntegerBelow } from '@/shared/lib/random/originalRandom'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { ORIGINAL_SEASON_EVENTS } from '@/shared/config/original/seasonEvents'
import type { SeasonOriginalEvent } from '@/shared/config/original/seasonEvents'
import type { EventCommand, OriginalEvent } from '@/shared/config/original/eventTypes'
import { ORIGINAL_USER_EVENTS } from '@/shared/config/original/userEvents'
import {
  clampTo, MONEY_LIMIT, MORALE_LIMIT, POPULARITY_LIMIT, REPUTATION_LIMIT, SEASON_GAME_COUNT,
} from '@/entities/season-mode/model/seasonRecord'
import type { SeasonRecord, SeasonState } from '@/entities/season-mode/model/seasonRecord'
import { SEASON_SCENE_STATE } from '@/entities/season-mode/model/seasonStateMachine'
import type { SeasonSceneState } from '@/entities/season-mode/model/seasonStateMachine'

/**
 * 시즌모드 이벤트(s_event) — 고르기 · 판정 · 보상 (장면 0x105 의 **이벤트 재생 0xd3** 앞뒤).
 *
 * 근거는 원본을 직접 떴다 (P4 2a·2b · A 1~3절을 대조해 고친 곳은 각 함수 주석에 적었다):
 *
 * ```
 * 0xe9ac  갱신 — 상태가 **막 바뀐 틀에만**(0xbc9c8 이 참) ① 상태별 진입 함수 ② 이벤트 폴링을 돈다
 *         (e9c2~e9cc: 바뀌지 않았으면 ec6a 로 건너뜀 — 관리 메뉴에 머무는 동안 매 틀 굴리지 않는다)
 * eb74    현재 상태가 0xc9(관리 메뉴) 또는 0xd1(외출 지도)일 때:
 *           this+0xf9(새 선수) → 0x8bde0(모드 2 → 400) · [이전 0xc9, 다음 0xd3] · 플래그 지움
 *           다음 상태 == 0xd4(연초 목표) → 건너뜀
 *           0x8be80(관리자, 모드, 화면코드 = 현재 상태, SR, SR+0x80) → 0xadc70 고르기
 *             찾으면 [이전 = 현재 상태, 다음 0xd3]
 * ```
 * 화면코드는 상태 번호 그대로라 관리 메뉴 = **201**, 외출 지도 = **209** 다.
 */

/** 이벤트 폴링이 쓰는 화면 코드 (= 상태 번호) */
export const SEASON_SCREEN_CODE = {
  관리메뉴: 201,
  외출지도: 209,
} as const

/** 시즌모드(모드 2)가 받는 대상 — 판정 0xacfbc 의 ad008 `cmp r0,#4` */
export const SEASON_EVENT_AUDIENCE = 4
/** 오프닝 — 새 선수 플래그로 0x8bde0 이 튼다 (모드 2) */
export const OPENING_EVENT_ID = 400
/** 20경기 축하 — G +1000, 전역 저장 +0xbe 로 기기당 한 번 */
export const EVENT_100_ID = 100
/** 질병 유행 */
export const ILLNESS_EVENT_ID = 490
/** 올해의 목표 확인 (0xee 0x6d6c) */
export const SEASON_GOAL_INTRO_EVENT_ID = 392
/** 국가대항전 개막 (0xf2 0xe5f8) */
export const NATIONAL_CUP_INTRO_EVENT_ID = 461
/** 10년 종료 (새 해 0x6e0c 의 엔딩 갈래) */
export const SEASON_FINAL_EVENT_ID = 500

/** 연초 목표 0xd4 가 메모리에 만드는 내장 이벤트의 웹 번호 — s_event 에 없는 번호(0)를 쓴다 */
export const YEAR_GOAL_EVENT_ID = 0

/** 이벤트 폴링이 도는 상태 (0xeb74~0xeb7c) */
export function pollsSeasonEvents(state: SeasonSceneState): boolean {
  return state === SEASON_SCENE_STATE.관리메뉴 || state === SEASON_SCENE_STATE.외출지도
}

/** 폴링 화면코드 — 상태 번호 그대로 */
export function seasonScreenCodeOf(state: SeasonSceneState): number {
  return state
}

/* ── 본 이벤트 비트 SR+8 ~ SR+0x47 ─────────────────────────────────────────── */

/** `0xb6e80(SR, id)` — 본 이벤트인가 */
export function hasSeenEvent(record: SeasonRecord, eventId: number): boolean {
  return record.seenEvents.includes(eventId)
}

/** `0xb6ec0(SR, id, 1)` — 본 것으로 켠다 */
export function markEventSeen(record: SeasonRecord, eventId: number): SeasonRecord {
  if (hasSeenEvent(record, eventId)) return record
  return { ...record, seenEvents: [...record.seenEvents, eventId] }
}

/**
 * 장면 0x105 를 만들 때 (`0x3b14` 의 4016 → `0x8ce94` → `0xacf60`) — **반복 이벤트의 본 비트를 지운다.**
 * 경기를 마치고 돌아올 때도 장면을 새로 만들므로 질병 490 은 경기마다 다시 뜰 수 있다.
 */
export function clearRepeatableSeen(
  record: SeasonRecord,
  events: readonly SeasonOriginalEvent[] = ORIGINAL_SEASON_EVENTS,
): SeasonRecord {
  const repeatable = new Set(events.filter((event) => event.repeatable).map((event) => event.id))
  if (!record.seenEvents.some((id) => repeatable.has(id))) return record
  return { ...record, seenEvents: record.seenEvents.filter((id) => !repeatable.has(id)) }
}

/* ── 판정 0xacfbc (모드 2) ─────────────────────────────────────────────────── */

export interface SeasonEventJudgeInput {
  readonly record: SeasonRecord
  /** 팀 레코드 +2 — 조건 22 가 모드 2 에서 읽는 사기 (0xadb40~0xadb4e) */
  readonly teamMorale: number
  /** 폴링 화면코드 (201 관리 메뉴 · 209 외출 지도) */
  readonly screenCode: number
  /** 전역 저장 +0xbe — 이벤트 100 의 G 를 이미 받았는가 */
  readonly event100Awarded: boolean
}

export interface SeasonEventJudgement {
  readonly passes: boolean
  /** 이벤트 100 특례가 본 비트를 켜고 끝낼 수 있다 (ad070~ad07a) */
  readonly record: SeasonRecord
}

/**
 * 날짜 창 — 네 바이트 a,b,c,d 가운데 **하나라도 0 이면 생략**,
 * `from = (a−1)·45 + b` · `to = (c−1)·45 + d` · `now = 연차idx·45 + 경기수 + 1` (A-2).
 */
export function isInSeasonEventWindow(event: SeasonOriginalEvent, record: SeasonRecord): boolean {
  const [a, b] = event.dateFrom
  const [c, d] = event.dateTo
  if (a === 0 || b === 0 || c === 0 || d === 0) return true
  const from = (a - 1) * SEASON_GAME_COUNT + b
  const to = (c - 1) * SEASON_GAME_COUNT + d
  const now = record.yearIndex * SEASON_GAME_COUNT + record.games + 1
  return from <= now && now <= to
}

/**
 * 질병 확률 (조건 22, `0xadb32` 의 모드 2 갈래 adb3a~adb76).
 * 사기를 **팀 사기**로 읽고, 나리 쪽 유리몸(+10)·행운(−20) 보정을 건너뛰고 곧장 굴림(adbd2)으로 간다.
 */
export function illnessChancePercentOf(teamMorale: number): number {
  if (teamMorale > 70) return 0
  if (teamMorale > 50) return 2
  if (teamMorale > 30) return 4
  if (teamMorale > 10) return 7
  return 14
}

/** 조건 하나 (switch 0xad1ba, 점프표 0xd83a0) — 모드 2 에서 쓰이는 갈래 */
function passesCondition(
  condition: { readonly type: number; readonly value: number },
  input: SeasonEventJudgeInput,
  random: RandomPort,
): boolean {
  const { record } = input
  const compare = (actual: number) =>
    condition.value >= 0 ? actual >= condition.value : actual < Math.abs(condition.value)
  switch (condition.type) {
    // 0~3 능력치 — 모드 2 는 통과 (0xad1ca)
    case 0:
    case 1:
    case 2:
    case 3:
      return true
    case 18:
      return compare(record.popularity)
    case 19:
      return compare(record.reputation)
    case 22:
      // SR+5 ≠ 0 이면 굴리지 않고 불발. p 가 0 이어도 rand 는 돈다 (adbd2 `rand(0,100) < p`)
      if (record.illness !== 0) return false
      return randomIntegerBelow(random, 0, 100) < illnessChancePercentOf(input.teamMorale)
    // 23 — 모드 2 는 불발 (0xadbe6)
    case 23:
      return false
    case 24:
      return condition.value <= 0 || hasSeenEvent(record, condition.value)
    case 25:
      return condition.value <= 0 || !hasSeenEvent(record, condition.value)
    // 20·21 스킬 조건 — s_event 에 쓰는 곳이 없다. 시즌 SR 의 스킬 비트 갈래는 확인하지 않았다(미해결)
    case 20:
    case 21:
      return false
    // 4~17, 26 이상 — 통과
    default:
      return true
  }
}

/**
 * 판정 `0xacfbc` 의 모드 2 차례 (acfc6~adc44, 직접 떴다):
 * ```
 * 대상 0 → 불발 · 모드 2 는 대상 4 만
 * id 490 이고 SR+0x7c(질병 쿨다운) > 0 → 불발
 * id 100 · 대상 4 · 전역 +0xbe ≠ 0 → 본 비트를 켜고(0xacf48) 불발
 * 본 이벤트 → 불발 (반복 이벤트도)
 * trigger 0 ↔ 화면 105·201 · 1 ↔ 112 · ≥2 ↔ 113
 * requiresEvent > 0 → 그 이벤트를 봤어야
 * 날짜 창 · 조건 목록
 * ```
 */
export function judgeSeasonEvent(
  event: SeasonOriginalEvent,
  input: SeasonEventJudgeInput,
  random: RandomPort,
): SeasonEventJudgement {
  const { record } = input
  const fail = { passes: false, record }
  if (event.audience !== SEASON_EVENT_AUDIENCE) return fail
  if (event.id === ILLNESS_EVENT_ID && record.illnessCooldown > 0) return fail
  if (event.id === EVENT_100_ID && input.event100Awarded) {
    return { passes: false, record: markEventSeen(record, EVENT_100_ID) }
  }
  if (hasSeenEvent(record, event.id)) return fail
  if (!triggerAccepts(event.trigger, input.screenCode)) return fail
  if (event.requiresEvent > 0 && !hasSeenEvent(record, event.requiresEvent)) return fail
  if (!isInSeasonEventWindow(event, record)) return fail
  for (const condition of event.conditions) {
    if (!passesCondition(condition, input, random)) return fail
  }
  return { passes: true, record }
}

/** trigger ↔ 화면코드 (0xacbec 뒤 ad090~) */
function triggerAccepts(trigger: number, screenCode: number): boolean {
  if (trigger === 0) return screenCode === 105 || screenCode === 201
  if (trigger === 1) return screenCode === 112
  return screenCode === 113
}

/* ── 고르기 0xadc70 (커서를 이어 쓴다) ─────────────────────────────────────── */

/**
 * 읽기 객체의 커서 두 칸 — `+0x28` 지금 레코드 · `+0x2c` 번호로 부른 뒤 이어 훑을 자리.
 * 웹은 바이트 오프셋 대신 **파일 차례 첨자**로 든다 (레코드가 빈틈없이 이어져 있어 같은 뜻이다).
 * 이벤트 관리자는 장면 0x105 를 만들 때 새로 생기므로 커서도 그때 0 이다.
 */
export interface SeasonEventCursor {
  readonly position: number
  readonly pending: number
}

export const START_SEASON_EVENT_CURSOR: SeasonEventCursor = { position: 0, pending: 0 }

export interface SeasonEventSelection {
  readonly eventId: number | null
  readonly cursor: SeasonEventCursor
  readonly record: SeasonRecord
}

/**
 * 고르기 `0xadc70` — 커서에서부터 파일 차례로 훑어 **처음 통과한 한 건**에 멈춘다.
 * ```
 * if +0x2c > 0: cursor = +0x2c ; +0x2c = 0
 * while cursor < 끝: if 판정 통과 → 1 (커서는 그 레코드에 멈춘다) ; cursor += 길이
 * cursor = 0 ; return 0
 * ```
 * 다음 호출은 지난 당첨(이제 본 것)부터 다시 훑는다. 끝까지 없으면 되감고 그 호출은 "없음" 이다.
 */
export function selectSeasonEvent(
  cursor: SeasonEventCursor,
  input: SeasonEventJudgeInput,
  random: RandomPort,
  events: readonly SeasonOriginalEvent[] = ORIGINAL_SEASON_EVENTS,
): SeasonEventSelection {
  let position = cursor.pending > 0 ? cursor.pending : cursor.position
  let record = input.record
  while (position < events.length) {
    const event = events[position]
    const judged = judgeSeasonEvent(event, { ...input, record }, random)
    record = judged.record
    if (judged.passes) return { eventId: event.id, cursor: { position, pending: 0 }, record }
    position += 1
  }
  return { eventId: null, cursor: START_SEASON_EVENT_CURSOR, record }
}

/**
 * 번호로 부르기 `0x8bdc8` → `0xae170` — 레코드를 찾고 **그 다음 자리**를 `+0x2c` 에 남긴다.
 * 본 비트·반복 가드는 보지 않는다. 다음 고르기는 그 자리부터 훑는다.
 */
export function cursorAfterCalling(
  cursor: SeasonEventCursor,
  eventId: number,
  events: readonly SeasonOriginalEvent[] = ORIGINAL_SEASON_EVENTS,
): SeasonEventCursor {
  const index = events.findIndex((event) => event.id === eventId)
  if (index < 0) return cursor
  return { position: cursor.position, pending: index + 1 }
}

/* ── 관리 메뉴·외출 지도에 들어왔을 때 (0x4efc 끝 + 폴링) ────────────────────── */

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
export function pollSeasonEvents(
  cursor: SeasonEventCursor,
  input: SeasonEventPollInput,
  random: RandomPort,
): SeasonEventPollResult {
  const { record } = input
  if (!pollsSeasonEvents(input.scene)) return { poll: { kind: '없음' }, cursor, record }
  const goesToYearGoal = input.scene === SEASON_SCENE_STATE.관리메뉴 && !record.endingSeen && !record.yearGoalShown
  if (input.newPlayerFlag) {
    return { poll: { kind: '오프닝' }, cursor: cursorAfterCalling(cursor, OPENING_EVENT_ID), record }
  }
  if (goesToYearGoal) return { poll: { kind: '연초목표' }, cursor, record }
  const selected = selectSeasonEvent(cursor, { ...input, screenCode: seasonScreenCodeOf(input.scene) }, random)
  return {
    poll: selected.eventId === null ? { kind: '없음' } : { kind: '이벤트', eventId: selected.eventId },
    cursor: selected.cursor,
    record: selected.record,
  }
}

/* ── 연초 목표 0xd4 의 내장 이벤트 (0x8a680) ─────────────────────────────────── */

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

/* ── 보상 (명령 7) — 0x8c460 의 모드 2 갈래 ─────────────────────────────────── */

export interface SeasonEventReward {
  readonly kind: number
  readonly value: number
}

/** 보상 명령들의 항목을 차례대로 모은다 */
export function seasonRewardsIn(commands: readonly EventCommand[]): SeasonEventReward[] {
  return commands.flatMap((command) => (command.op === 'reward' ? command.items : []))
}

/**
 * 목표 결과 393~396 의 **연차 보정** (`0x8d508`, 모드 2 갈래 — 직접 떴다):
 * ```
 * 393·394·395: 항목 종류 0(인기도)·1(평판)·3(소지금) 이면 값 += 5y     (8d550~8d580)
 * 396:         종류 0 이면 −10y · 종류 1 이면 −2y                     (8d5f4~8d624)
 * ```
 * y = SR+0xb3(연차 idx). **명령에 있는 항목만** 고친다 — 394 의 평판·395 의 전부는 항목이 없어 그대로다.
 */
export function withSeasonYearAdjust(
  rewards: readonly SeasonEventReward[],
  eventId: number,
  yearIndex: number,
): readonly SeasonEventReward[] {
  if (eventId === 393 || eventId === 394 || eventId === 395) {
    return rewards.map((reward) =>
      reward.kind === 0 || reward.kind === 1 || reward.kind === 3
        ? { ...reward, value: reward.value + 5 * yearIndex }
        : reward,
    )
  }
  if (eventId === 396) {
    return rewards.map((reward) => {
      if (reward.kind === 0) return { ...reward, value: reward.value - 10 * yearIndex }
      if (reward.kind === 1) return { ...reward, value: reward.value - 2 * yearIndex }
      return reward
    })
  }
  return rewards
}

/** 질병 종류 수 (1~4, StrMODE[186+r]) — 보상 글 0x8beb8 의 `rand(0,4) + 1` */
export const ILLNESS_KIND_COUNT = 4
/** 질병이 걸리거나 나을 때 SR+0x7c 에 넣는 쿨다운 (0x8c738 · 0x8c74a) */
export const ILLNESS_COOLDOWN = 20
/** `0xd4d98[종류]` — SR+6 (0 = 건강 · 1~4 = 3) */
const ILLNESS_SLACK_TABLE: readonly number[] = [0, 3, 3, 3, 3]
/** 질병에 걸릴 때 들어가는 SR+6 (`0xd4d98[1~4]` = 3) */
export const ILLNESS_SLACK_ON_CATCH = 3
/** G 상한 (0x8c6ca 0x1869f) */
const GAME_POINT_LIMIT = 99_999

export interface SeasonRewardApplication {
  readonly state: SeasonState
  /** 전역 G(+0x64)에 더할 값 — 0..99999 자르기는 지갑이 한다 */
  readonly gamePoint: number
  /** 보상 10 이 이벤트 100 에서 났다 → 전역 +0xbe = 1 (0x8c6fc~0x8c714) */
  readonly event100Awarded: boolean
  /** 첫 항목이 21 이면 엔딩 진입 (0x8d4c4) */
  readonly entersEnding: boolean
}

/**
 * 보상 항목을 모드 2 대로 적용한다 (`0x8c460`, 점프표 0xd4e50):
 * ```
 * 0  인기도 SR+0x48 += v (0..9999)          1  평판 SR+0x62 += v (0..999)
 * 2  모드 2 는 팀 레코드 +2 사기 += v (0..100) 3  소지금 SR+2 += v (0..9999, 100만 단위)
 * 10 전역 G += v · 이벤트 100 이면 전역 +0xbe = 1
 * 11 v > 0: SR+5 = v · SR+6 = 0xd4d98[v] · SR+0x7c = 20 / v ≤ 0: SR+5 = 0 · SR+6 = 0 · SR+0x7c = 20
 * ```
 * 질병 11 은 적용 전에 보상 글 만들기 `0x8beb8` 이 **값 ≥ 0 이면 `rand(0,4)+1` 로 다시 쓴다**(0x8c1b6~)
 * — 490 의 값 0 이 실제로 병 1~4 가 된다. 난수는 그 자리에서 한 번 돈다.
 * 연차 보정(393~396)은 이 앞에서 `withSeasonYearAdjust` 로 먹인다.
 */
export function applySeasonEventRewards(
  state: SeasonState,
  rewards: readonly SeasonEventReward[],
  eventId: number,
  random: RandomPort,
): SeasonRewardApplication {
  const adjusted = withSeasonYearAdjust(rewards, eventId, state.record.yearIndex)
  let record = state.record
  let teamMorale = state.teamMorale
  let gamePoint = 0
  let event100Awarded = false
  for (const reward of adjusted) {
    switch (reward.kind) {
      case 0:
        record = { ...record, popularity: clampTo(record.popularity + reward.value, POPULARITY_LIMIT) }
        break
      case 1:
        record = { ...record, reputation: clampTo(record.reputation + reward.value, REPUTATION_LIMIT) }
        break
      case 2:
        teamMorale = clampTo(teamMorale + reward.value, MORALE_LIMIT)
        break
      case 3:
        record = { ...record, money: clampTo(record.money + reward.value, MONEY_LIMIT) }
        break
      case 10:
        gamePoint = Math.min(gamePoint + reward.value, GAME_POINT_LIMIT)
        if (eventId === EVENT_100_ID) event100Awarded = true
        break
      case 11: {
        // 값 > 0 은 알림 글 0x8beb8 이 이미 굴려 적은 번호(r + 1, `rewardNoticeOf`) — 0x8c718 은 그 번호를 건다.
        // 값 0 은 알림을 안 거친 재생(굴림 0xbfa55(0, 4) 한 번을 여기서)
        const kind = reward.value > 0
          ? reward.value
          : reward.value === 0 ? randomIntegerBelow(random, 0, ILLNESS_KIND_COUNT) + 1 : reward.value
        record = kind > 0
          ? { ...record, illness: kind, illnessSlack: ILLNESS_SLACK_TABLE[kind] ?? 0, illnessCooldown: ILLNESS_COOLDOWN }
          : { ...record, illness: 0, illnessSlack: ILLNESS_SLACK_TABLE[0] ?? 0, illnessCooldown: ILLNESS_COOLDOWN }
        break
      }
      default:
        // 4·6·7·9·13~20 은 나리 선수 칸을 만진다 — s_event 에 쓰는 곳이 없다. 21 은 아래 entersEnding
        break
    }
  }
  return {
    state: { ...state, record, teamMorale },
    gamePoint,
    event100Awarded,
    entersEnding: adjusted[0]?.kind === 21,
  }
}

/* ── 질병 ─────────────────────────────────────────────────────────────────── */

/** 입원 치료 확률의 경계 — `r = rand(0,101)` 이 89 이하면 낫는다 (90/101) */
export const HOSPITAL_CURE_THRESHOLD = 89

export interface IllnessCureResult {
  readonly record: SeasonRecord
  readonly cured: boolean
}

/**
 * 외출 "입원" 의 치료 굴림 (`0xcc6a`).
 * `r ≤ 89` 이거나 남은 여유 칸이 0 이면 낫고, 아니면 여유 칸이 하나 준다(0 바닥).
 * 낫지 못해도 여유 칸이 0 이 되면 다음엔 반드시 낫는다.
 */
export function cureIllnessAtHospital(record: SeasonRecord, random: RandomPort): IllnessCureResult {
  const roll = randomIntegerBelow(random, 0, 101)
  if (roll <= HOSPITAL_CURE_THRESHOLD || record.illnessSlack === 0) {
    return {
      record: { ...record, illness: 0, illnessSlack: 0, illnessCooldown: ILLNESS_COOLDOWN },
      cured: true,
    }
  }
  return { record: { ...record, illnessSlack: Math.max(record.illnessSlack - 1, 0) }, cured: false }
}

/** GP 아이템 칸 2 는 무조건 낫는다 (StrMODE[123]) */
export function cureIllnessByItem(record: SeasonRecord): SeasonRecord {
  return { ...record, illness: 0, illnessSlack: 0, illnessCooldown: ILLNESS_COOLDOWN }
}

/**
 * 질병 중에는 내 팀 선수 전원의 경기용 능력치가 30% 깎인다 (`0xb5824`).
 * ⚠️ 원본이 보는 칸은 질병 종류 SR+5 가 아니라 **s8 SR+6 > 0** 이다 (b5824 `movs r3,#6 ; ldrsb`) —
 * 입원에 실패해 SR+6 이 0 까지 내려가면 아직 앓고 있어도(SR+5 ≠ 0) 깎이지 않는다. 원본 그대로.
 */
export const ILLNESS_ABILITY_PENALTY_PERCENT = 30

/** 경기 능력치 보정이 보는 질병 칸 — SR+6 (`0xb5824`) */
export function illnessPenaltyFieldOf(record: Pick<SeasonRecord, 'illnessSlack'>): number {
  return record.illnessSlack
}

/** 팀 능력치 정액 감소 — 사기 구간별 (J-4). 질병은 여기가 아니라 별도로 −30% 다 */
export function moralePenaltyOf(teamMorale: number): number {
  if (teamMorale > 50) return 0
  if (teamMorale > 30) return 50
  if (teamMorale > 10) return 100
  return 200
}

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
