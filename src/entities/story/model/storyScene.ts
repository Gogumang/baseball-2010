import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { GAMES_PER_SEASON } from '@/entities/career/model/playerCareer'
import type { OriginalEvent } from '@/shared/config/original/eventTypes'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { meetsSkillAcquireCondition, meetsSkillReleaseCondition } from '@/entities/story/model/skillCondition'

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

const CONDITION = { 인기도: 18, 평판: 19, 스킬획득: 20, 스킬해제: 21, 질병: 22, 봤음: 24, 안봤음: 25 } as const
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
      case CONDITION.스킬획득:
        return meetsSkillAcquireCondition(career, condition.value, random)
      case CONDITION.스킬해제:
        return meetsSkillReleaseCondition(career, condition.value)
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

/** 이벤트 한 번 훑기의 결과 — 뽑힌 이벤트와 **다음 호출이 이어서 볼 자리**(0xadc70 의 reader+0x28) */
export interface EventScan {
  readonly event: OriginalEvent | null
  readonly cursor: number
}

/**
 * 커서에서 이어 훑는다 (0xadc70, A-1 확정).
 *
 * ```
 * while cursor < 개수:
 *     if acfbc(레코드): return 찾음            ; 커서는 그 레코드에 **멈춘다**
 *     cursor += 1
 * cursor = 0; return 없음                      ; 끝까지 없으면 되감고 이번 호출은 "없음"
 * ```
 * 당첨 레코드에 커서가 멈추는 것이 핵심이다 — 그 이벤트는 본 것이 되므로 다음 호출은
 * 판정 4번(본 이벤트면 불발)에 걸려 곧바로 그 다음 칸으로 넘어간다.
 * 번호로 부를 때(0xae170)는 "현재 레코드 **다음** 위치" 를 커서로 남긴다 — 오프닝이 그 갈래다.
 *
 * 무작위 조건(질병)은 random 이 있을 때만 판정한다 — 지도 [!] 표시처럼 미리 보기만 할 때는
 * random 없이 부른다.
 */
export function scanEventFrom(
  career: PlayerCareer,
  events: readonly OriginalEvent[],
  trigger: number,
  cursor: number,
  random?: RandomPort,
): EventScan {
  if (trigger === EVENT_TRIGGER.관리 && !hasSeen(career, OPENING_EVENT_ID)) {
    const index = events.findIndex((event) => event.id === OPENING_EVENT_ID)
    // 오프닝은 번호로 부르는 갈래(0x8bde0 → 0x8bdc8)라 커서에 "그 다음 칸" 이 남는다 (0xae170)
    if (index >= 0) return { event: events[index], cursor: index + 1 }
    return { event: null, cursor }
  }

  for (let at = Math.max(0, cursor); at < events.length; at += 1) {
    const event = events[at]
    if (isEligible(event, career, trigger, random) && !hasSeen(career, event.id)) {
      return { event, cursor: at }
    }
  }
  return { event: null, cursor: 0 }
}

/**
 * 배열 처음부터 훑어 지금 볼 이벤트 (커서를 안 쓰는 갈래).
 * 외출 장소 [!] 배정 0x8cdc0 이 이렇게 **늘 처음부터** 훑으므로 미리 보기는 이 창구를 쓴다.
 *
 * **"분기 전용 이벤트 제외" 규칙은 원본에 없다** (A-1 확정). 원본은 분기로만 닿는 이벤트를
 * **대상(audience) 0** 으로 막는데, 그 검사는 `isEligible` 의 `BATTER_AUDIENCES` 가 이미 하고 있다.
 */
export function nextEventFor(
  career: PlayerCareer,
  events: readonly OriginalEvent[],
  trigger: number,
  random?: RandomPort,
): OriginalEvent | null {
  return scanEventFrom(career, events, trigger, 0, random).event
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
