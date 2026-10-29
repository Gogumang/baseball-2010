import type { RandomPort } from '@/shared/api/random/randomPort'
import type { SeasonOriginalEvent } from '@/shared/config/original/seasonEvents'
import { SEASON_GAME_COUNT, type SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import { EVENT_100_ID, ILLNESS_EVENT_ID, SEASON_EVENT_AUDIENCE } from '@/entities/season-mode/model/seasonEventFlow/ids'
import { hasSeenEvent, markEventSeen } from '@/entities/season-mode/model/seasonEventFlow/seen'
import { passesCondition } from '@/entities/season-mode/model/seasonEventFlow/judge/conditions'
import type { SeasonEventJudgeInput, SeasonEventJudgement } from '@/entities/season-mode/model/seasonEventFlow/judge/types'

/** trigger 0 이 받는 화면코드 — 105 · 201(관리 메뉴) */
const TRIGGER_0_SCREENS: readonly number[] = [105, 201]
/** trigger 1 이 받는 화면코드 */
const TRIGGER_1_SCREEN = 112
/** trigger ≥ 2 가 받는 화면코드 */
const TRIGGER_2_SCREEN = 113

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

/** trigger ↔ 화면코드 (0xacbec 뒤 ad090~) */
function triggerAccepts(trigger: number, screenCode: number): boolean {
  if (trigger === 0) return TRIGGER_0_SCREENS.includes(screenCode)
  if (trigger === 1) return screenCode === TRIGGER_1_SCREEN
  return screenCode === TRIGGER_2_SCREEN
}

/** id 490 이고 SR+0x7c(s8 질병 쿨다운) > 0 — 장면이 새로 선 뒤(reader+0x34)면 안 본다 */
function isIllnessOnCooldown(event: SeasonOriginalEvent, input: SeasonEventJudgeInput): boolean {
  if (input.isFreshScene === true || event.id !== ILLNESS_EVENT_ID) return false
  return (input.record.illnessCooldown << 24) >> 24 > 0
}

/** 본 이벤트가 아니고 · trigger 가 화면을 받고 · 앞 이벤트를 봤고 · 날짜 창 안 */
function isEventOpen(event: SeasonOriginalEvent, input: SeasonEventJudgeInput): boolean {
  const { record } = input
  if (hasSeenEvent(record, event.id)) return false
  if (!triggerAccepts(event.trigger, input.screenCode)) return false
  if (event.requiresEvent > 0 && !hasSeenEvent(record, event.requiresEvent)) return false
  return isInSeasonEventWindow(event, record)
}

/**
 * 판정 `0xacfbc` 의 모드 2 차례 (acfc6~adc44, 직접 떴다):
 * ```
 * 대상 0 → 불발 · 모드 2 는 대상 4 만
 * id 490 이고 SR+0x7c(질병 쿨다운) > 0 → 불발 — 단 reader+0x34(mgr+0x304, 장면이 새로 선 뒤 0xc9 확인 전)가 서 있으면 안 본다
 * id 100 · 대상 4 · 전역 +0xbe ≠ 0 → 본 비트를 켜고(0xacf48) 불발
 * 본 이벤트 → 불발 (반복 이벤트도)
 * trigger 0 ↔ 화면 105·201 · 1 ↔ 112 · ≥2 ↔ 113
 * requiresEvent > 0 → 그 이벤트를 봤어야
 * 날짜 창 · 조건 목록 (조건 22 가 굴린다 — 앞 조건이 불발이면 뒤 조건은 굴리지 않는다)
 * ```
 */
export function judgeSeasonEvent(event: SeasonOriginalEvent, input: SeasonEventJudgeInput, random: RandomPort): SeasonEventJudgement {
  const { record } = input
  const fail = { passes: false, record }
  if (event.audience !== SEASON_EVENT_AUDIENCE) return fail
  if (isIllnessOnCooldown(event, input)) return fail
  if (event.id === EVENT_100_ID && input.event100Awarded) {
    return { passes: false, record: markEventSeen(record, EVENT_100_ID) }
  }
  if (!isEventOpen(event, input)) return fail
  for (const condition of event.conditions) {
    if (!passesCondition(condition, input, random)) return fail
  }
  return { passes: true, record }
}
