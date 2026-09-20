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

/** 유리몸 — 질병 확률 +10 (0xadb32) */
const FRAGILE_SKILL = 4
/** 행운 — 질병 확률 −20 */
const LUCK_SKILL = 6

/**
 * 조건 22 질병 확률(%) — 사기 구간표에 **스킬 보정**이 붙는다 (0xadb32, G-8 확정):
 * 유리몸(스킬 4) +10 · 행운(스킬 6) −20, 0 미만은 0 으로 자른다.
 * 앞서 웹은 사기 구간만 보고 보정을 빼먹고 있었다.
 */
export function illnessChanceOf(morale: number, skillIds: readonly number[] = []): number {
  const base = morale > 70 ? 0 : morale > 50 ? 2 : morale > 30 ? 4 : morale > 10 ? 7 : 14
  const adjusted =
    base +
    (skillIds.includes(FRAGILE_SKILL) ? 10 : 0) -
    (skillIds.includes(LUCK_SKILL) ? 20 : 0)
  return Math.max(0, adjusted)
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

/**
 * 날짜 창 검사 (0xacfbc 7번, A-2 확정).
 *
 * ```
 * 네 바이트 a,b,c,d 중 **하나라도 0 이면 검사 자체를 건너뛴다**
 * from = (a−1)·45 + b · to = (c−1)·45 + d
 * now  = 연차(0부터)·45 + 치른 경기 수 + 1        ; 45 로 자르지 않는다
 * from <= now <= to
 * ```
 * 앞서 웹은 ① 연차 둘 다 0 일 때만 생략하고 ② 경기 번호를 45 로 잘랐으며
 * ③ 한 시즌을 100 으로 셌다 — 셋 다 원본과 달랐다.
 */
function isInDateWindow(event: OriginalEvent, career: PlayerCareer): boolean {
  const [fromSeason, fromGame] = event.dateFrom
  const [toSeason, toGame] = event.dateTo
  if (fromSeason === 0 || fromGame === 0 || toSeason === 0 || toGame === 0) return true
  const now = (career.season - 1) * GAMES_PER_SEASON + career.gamesPlayed + 1
  const from = (fromSeason - 1) * GAMES_PER_SEASON + fromGame
  const to = (toSeason - 1) * GAMES_PER_SEASON + toGame
  return now >= from && now <= to
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
        return random.nextInRange(0, PERCENT) < illnessChanceOf(career.morale, career.skillIds)
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
 * 이 trigger 에서 지금 볼 이벤트 (0xadc70). 무작위 조건(질병)은 random 이 있을 때만 판정한다 —
 * 지도 [!] 표시처럼 미리 보기만 할 때는 random 없이 부른다.
 *
 * **"분기 전용 이벤트 제외" 규칙은 원본에 없다** (A-1 확정). 원본은 분기로만 닿는 이벤트를
 * **대상(audience) 0** 으로 막는데, 그 검사는 아래 `isEligible` 의 `BATTER_AUDIENCES` 가 이미 하고 있다.
 * 그래서 따로 빼던 목록을 없앴다 — 대상이 1·2 인 이벤트는 분기로도 닿고 평소에도 나오는 게 원본이다.
 *
 * ⚠️ 아직 다른 점: 원본은 **커서를 이어 쓴다** — 다음 호출이 지난 당첨 위치부터 훑고, 끝까지 없으면
 * 0 으로 되감으며 그 호출은 "없음" 이 된다 (0xae170 이 "현재 레코드 다음" 을 커서로 저장).
 * 커서는 저장에 들어가는 값이라 아직 넣지 않았다 — 지금은 늘 배열 처음부터 훑는다.
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
  const candidates = events.filter((event) => isEligible(event, career, trigger, random))
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
