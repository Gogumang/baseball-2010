import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { GAMES_PER_SEASON } from '@/entities/career/model/playerCareer'
import type { OriginalEvent } from '@/shared/config/original/eventTypes'
import type { RandomPort } from '@/shared/api/random/randomPort'

/**
 * 원작 이벤트 일정 (r_event 레코드 머리).
 *
 *   trigger   0 관리 화면 · 1 외출 지도 진입 · 2~6 장소(event_map 프레임 1~5 + 1: 경기장·번화가·병원·학교·방송국)
 *             — 장소마다 대사 내용이 그 장소 인물(병원=메디카, 방송국=발렌타인…)이라 맞춘 것이다
 *   audience  0 코드가 직접 부름(분기·평가·엔딩) · 1 공통 · 2 타자 · 3 투수 → 타자편은 1·2 만
 *   날짜 창   [연차, 경기 번호] 범위. [0,0]~[0,0] 이면 언제든. 경기 번호는 "다음 경기" 로 본다 (추정)
 *   requiresEvent 이 이벤트를 본 뒤에만
 *   조건      (switch 0xd83a0, 점검 에이전트 확인) 0~3 능력치 ≥ 값(0~999) · 18 인기도 ≥ 값 ·
 *             19 평판 ≥ 값 · 22 질병 확률(0xadb32, 쿨다운 중이면 불발) · 24 이벤트를 봤다 · 25 아직 안 봤다.
 *             20/21 은 스킬 v−1 획득/해제 조건(세부 표 0xd8408·0xd8454 미해독)이라 아직 띄우지 않는다.
 *             능력치 0~3 의 순서는 StrMODE 순서(히트·파워·수비·주루)로 둔다 — 추정
 * 본 이벤트는 반복 이벤트까지 모두 막힌다 (0xacf30). 원본은 저장을 불러올 때 반복 이벤트 기록을 푼다 (0xacf60).
 */
export const EVENT_TRIGGER = { 관리: 0, 외출: 1 } as const

/** event_map 프레임 번호(1~5) → trigger */
export function placeTriggerOf(placeFrame: number): number {
  return placeFrame + 1
}

/** 배열 첫 이벤트. audience 0 이지만 나만의리그 시작 때 관리 화면에서 먼저 본다 (추정: 코드가 직접 부름) */
export const OPENING_EVENT_ID = 451

const BATTER_AUDIENCES: ReadonlySet<number> = new Set([1, 2])

const CONDITION = { 인기도: 18, 평판: 19, 질병: 22, 봤음: 24, 안봤음: 25 } as const
const ABILITY_CONDITIONS = ['hit', 'power', 'defense', 'run'] as const

/** 조건 22 — 사기 구간별 질병 확률(%) */
export function illnessChanceOf(morale: number): number {
  if (morale > 70) return 0
  if (morale > 50) return 2
  if (morale > 30) return 4
  if (morale > 10) return 7
  return 14
}

const PERCENT = 100

const branchOnlyCache = new WeakMap<readonly OriginalEvent[], ReadonlySet<number>>()

/** 다른 이벤트의 선택지·예아니오·경기 결과가 가리키는 이벤트 번호 */
export function branchOnlyEventIds(events: readonly OriginalEvent[]): ReadonlySet<number> {
  const cached = branchOnlyCache.get(events)
  if (cached !== undefined) return cached

  const ids = new Set<number>()
  for (const event of events) {
    for (const command of event.commands) {
      if (command.op === 'choice') command.choices.forEach((choice) => ids.add(choice.gotoEvent))
      if (command.op === 'yesno') ids.add(command.yesEvent).add(command.noEvent)
      if (command.op === 'match') command.resultEvents.forEach((eventId) => ids.add(eventId))
    }
  }
  ids.delete(0)
  branchOnlyCache.set(events, ids)
  return ids
}

const hasSeen = (career: PlayerCareer, eventId: number) => career.seenEventIds.includes(String(eventId))

function isInDateWindow(event: OriginalEvent, career: PlayerCareer): boolean {
  const [fromSeason, fromGame] = event.dateFrom
  const [toSeason, toGame] = event.dateTo
  if (fromSeason === 0 && toSeason === 0) return true
  const game = Math.min(career.gamesPlayed + 1, GAMES_PER_SEASON)
  const now = career.season * PERCENT + game
  return now >= fromSeason * PERCENT + fromGame && now <= toSeason * PERCENT + toGame
}

function meetsConditions(event: OriginalEvent, career: PlayerCareer, random: RandomPort | undefined): boolean {
  return event.conditions.every((condition) => {
    const ability = ABILITY_CONDITIONS[condition.type]
    if (ability !== undefined) return career.ability[ability] >= condition.value
    switch (condition.type) {
      case CONDITION.인기도:
        return career.popularity >= condition.value
      case CONDITION.평판:
        return career.reputation >= condition.value
      case CONDITION.봤음:
        return hasSeen(career, condition.value)
      case CONDITION.안봤음:
        return !hasSeen(career, condition.value)
      case CONDITION.질병:
        if (random === undefined || career.isSick || career.illnessCooldown > 0) return false
        return random.nextInRange(0, PERCENT) < illnessChanceOf(career.morale)
      default:
        return false
    }
  })
}

function isEligible(event: OriginalEvent, career: PlayerCareer, trigger: number, random: RandomPort | undefined): boolean {
  return (
    event.trigger === trigger &&
    BATTER_AUDIENCES.has(event.audience) &&
    (event.requiresEvent === 0 || hasSeen(career, event.requiresEvent)) &&
    isInDateWindow(event, career) &&
    meetsConditions(event, career, random)
  )
}

/**
 * 이 trigger 에서 지금 볼 이벤트. 무작위 조건(질병)은 random 이 있을 때만 판정한다 —
 * 지도 [!] 표시처럼 미리 보기만 할 때는 random 없이 부른다.
 */
export function nextEventFor(
  career: PlayerCareer,
  events: readonly OriginalEvent[],
  trigger: number,
  random?: RandomPort,
): OriginalEvent | null {
  if (trigger === EVENT_TRIGGER.관리 && !hasSeen(career, OPENING_EVENT_ID)) {
    return events.find((event) => event.id === OPENING_EVENT_ID) ?? null
  }
  const branchOnly = branchOnlyEventIds(events)
  const candidates = events.filter(
    (event) => !branchOnly.has(event.id) && isEligible(event, career, trigger, random),
  )
  return candidates.find((event) => !hasSeen(career, event.id)) ?? null
}

/** 저장을 불러올 때 — 반복 이벤트는 다시 볼 수 있게 기록에서 지운다 (0xacf60) */
export function forgetRepeatableEvents(career: PlayerCareer, events: readonly OriginalEvent[]): PlayerCareer {
  const repeatable = new Set(events.filter((event) => event.repeatable).map((event) => String(event.id)))
  return { ...career, seenEventIds: career.seenEventIds.filter((id) => !repeatable.has(id)) }
}

/** 이벤트를 마친다. 선택지로 이어 본 이벤트까지 모두 본 것으로 남긴다. */
export function finishEvent(career: PlayerCareer, viewedEventIds: readonly number[]): PlayerCareer {
  const added = viewedEventIds.map(String).filter((id) => !career.seenEventIds.includes(id))
  return { ...career, seenEventIds: [...career.seenEventIds, ...new Set(added)] }
}
