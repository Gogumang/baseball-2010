import type { PlayerCareer, SeasonEndState } from '@/entities/career/model/playerCareer'
import { GAMES_PER_SEASON } from '@/entities/career/model/playerCareer'
import { isEmptyPlaceEventId } from '@/entities/career/model/battingOrder'
import type { OriginalEvent } from '@/shared/config/original/eventTypes'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { ORIGINAL_USER_EVENTS } from '@/shared/config/original/userEvents'
import { meetsSkillAcquireCondition, meetsSkillReleaseCondition } from '@/entities/story/model/skillCondition'
import { EVENT_REWARD_KIND } from '@/entities/story/model/eventReward'
import type { EventReward } from '@/entities/story/model/eventReward'

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
export function illnessChanceOf(
  morale: number,
  skillIds: readonly number[] = [],
  equippedSkillIds: readonly number[] = skillIds,
): number {
  const base = morale > 70 ? 0 : morale > 50 ? 2 : morale > 30 ? 4 : morale > 10 ? 7 : 14
  // 유리몸은 보유(0xa3a74, 0xadba8) · 행운은 **장착**(0xa4bf8, 0xadbba)으로 본다
  const adjusted =
    base +
    (skillIds.includes(FRAGILE_SKILL) ? 10 : 0) -
    (equippedSkillIds.includes(LUCK_SKILL) ? 20 : 0)
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
        return random.nextInRange(0, PERCENT) < illnessChanceOf(career.morale, career.skillIds, career.equippedSkillIds)
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

/** 0x8c460 끝이 보는 칸 — 나리 타자편 `PlayerCareer` · 투수편 `PitcherCareer` 가 같은 이름으로 든다 */
export interface RewardedEventHolder {
  readonly seenEventIds: readonly string[]
  readonly hasActedThisCycle: boolean
}

/** 장소 이벤트 trigger 2~6 (장소 = trigger − 2) — 0x8cbfc `0xacbed(지금 이벤트) − 2 ≤ 4` */
const FIRST_PLACE_TRIGGER = 2
const LAST_PLACE_TRIGGER = 6

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
  const isPlaceEvent = event !== null && event.id > 0 && event.trigger >= FIRST_PLACE_TRIGGER && event.trigger <= LAST_PLACE_TRIGGER
  return isPlaceEvent && !seen.hasActedThisCycle ? { ...seen, hasActedThisCycle: true } : seen
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
export function withOutingEventActed<C extends { readonly hasActedThisCycle: boolean }>(
  career: C,
  isOpenedFromOuting: boolean,
  eventId: number,
): C {
  if (!isOpenedFromOuting || isEmptyPlaceEventId(eventId) || career.hasActedThisCycle) return career
  return { ...career, hasActedThisCycle: true }
}

/** 0x8cc2e 가 가르는 모드 — `0x7b999([mgr+0xb4])`(게임 +0x20 == 2, 시즌모드)와 나리 갈래의 `0x7b971`(== 4, 타자편) */
export type RewardResumeMode = '나리타자' | '나리투수' | '시즌'

/** 보상 명령 뒤 고치는 이어하기 자리 — S+0x50 값과 S+0x12c(국가대항전 중, 463 · 464 만) */
export interface RewardResumePatch {
  /** S+0x50 (나리 0x1c154 · 시즌 0xcb 가 이 값으로 돌아갈 곳을 고른다) */
  readonly resumeCode: number
  /** S+0x12c — 463 은 1, 464 는 0. 그 밖 이벤트는 안 건드린다 */
  readonly nationalCup?: boolean
}

/**
 * **보상 명령 뒤 이벤트 번호로 이어하기 자리를 고친다** — 0x8c460 끝 8cc1e~8cd42 (직접 떴다). 0x8b0e4 저장 뒤 지금 이벤트
 * 번호(0xacb61([mgr+4]))로 S = [mgr+0x2f8] 의 +0x50 을 쓰고, 갈래와 상관없이 8cd44 에서 `0x1fded · 0x22755(…, 1) · 0x1f1b9`
 * (전역기록 game_o.sav) 로 **한 번 더 저장한다**. 고치는 번호가 아니어도 저장은 한다.
 * ```
 * 나리(0x7b999 거짓, 8cc32~8ccc6)                    시즌(0x7b999 참, 8ccc8~8cd42 — S = SR)
 *   371~374 → 0xe                                     372 · 373 → 0xd       374 · 375 → 0xe
 *   377     → 0xf                                     378 · 379 → 0x10      393~396  → 0xc
 *   393~396 → 0x7b971(타자편) ? 0xc : 0xd              401~403  → 0xf
 *   463     → 3 · S+0x12c = 1
 *   464     → 0x11 · S+0x12c = 0
 * ```
 * 곧 시즌 끝 사슬의 결과 이벤트가 보상을 주면 이어하기 자리가 **다음 상태**로 넘어간다 — 나리 393~396(136 의 결과) → 130,
 * 371~374(130) → 131, 377(131) → 128 (0x1c154: 0xc|0xd → 130 · 0xe → 131 · 0xf → 그 밖 갈래 128), 시즌 393~396(0xee) → 0xeb ·
 * 373(0xeb) → 0xec · 375(0xec) → 0xed · 379(0xed) → 0xf0 · 401~403(0xf0) → 0xf(결산). 보상 창을 띄운 채 끄고 이어해도 그 결과
 * 이벤트를 다시 틀지 않는다(보상이 겹치지 않는다). 보상이 없는 결과 이벤트(나리 371 · 376, 시즌 372 · 374 · 378 · 395)는
 * 0x8c460 이 안 돌아 그대로다 — 끄고 이어하면 그 상태가 이벤트를 다시 튼다(보상이 없어 겹칠 것도 없다).
 * 463(출전) · 464(거절)는 461 의 선택지 결과다 — 3 · S+0x12c 면 0x1c154 그 밖 갈래가 134 대진판, 0x11 이면 1c25e 새 시즌 0x1b768.
 * 시즌 갈래는 463 · 464 를 안 본다(시즌 461 은 선택지가 없다 — s_event).
 */
export function rewardResumePatchOf(eventId: number, mode: RewardResumeMode): RewardResumePatch | null {
  if (mode === '시즌') {
    if (eventId === 372 || eventId === 373) return { resumeCode: 0xd }
    if (eventId === 374 || eventId === 375) return { resumeCode: 0xe }
    if (eventId === 378 || eventId === 379) return { resumeCode: 0x10 }
    if (eventId >= 393 && eventId <= 396) return { resumeCode: 0xc }
    if (eventId >= 401 && eventId <= 403) return { resumeCode: 0xf }
    return null
  }
  if (eventId >= 371 && eventId <= 374) return { resumeCode: 0xe }
  if (eventId === 377) return { resumeCode: 0xf }
  if (eventId >= 393 && eventId <= 396) return { resumeCode: mode === '나리타자' ? 0xc : 0xd }
  if (eventId === 463) return { resumeCode: 3, nationalCup: true }
  if (eventId === 464) return { resumeCode: 0x11, nationalCup: false }
  return null
}

/** 보상 20(연봉)이 쓰는 S+0x50 — 0x8cac0 갈래 끝 8cb84~8cb92: 새 연봉을 `0xa4fd9(S, 값)` 로 쓰고 곧 `S+0x50 = 0xa` */
export const SALARY_REWARD_RESUME_CODE = 0xa

/**
 * **보상 명령의 줄이 쓰는 이어하기 자리** — 0x8c460 이 줄마다 갈래를 돌 때 종류 20(연봉, 0x8cac0)만 S+0x50 을 쓴다(0xa,
 * 8cb90 — 바이너리 전체의 `str rX,[rY,#0x50]` 앞 `movs rX,#0xa` 를 훑어 이 자리 하나뿐이다). 이 값은 줄을 다 돈 뒤 8cc2e 가 이벤트 번호로 다시
 * 고칠 수 있다(`rewardResumePatchOf` — 연봉 결과 384~391 은 그 목록에 없어 0xa 가 남는다). 연봉 줄이 없으면 null.
 */
export function rewardItemsResumeCodeOf(items: readonly EventReward[]): number | null {
  return items.some((item) => item.kind === EVENT_REWARD_KIND.연봉) ? SALARY_REWARD_RESUME_CODE : null
}

/**
 * 나리 S+0x50 값 → 웹 `seasonEndState` (상태 번호). 0x1c154 가 그 값으로 돌아가는 상태다 — 0xc|0xd 130 · 0xe 131 · 0xf 128 ·
 * 0x11 새 시즌 0x1b768(→ 137) · 0xa 연봉 뒤 갈래(→ 133, 1c2a2 — `resumePointOf`). 3 은 웹이 null 로 든다(그 밖 갈래).
 */
export function nariSeasonEndStateOfResumeCode(resumeCode: number): SeasonEndState | null {
  if (resumeCode === SALARY_REWARD_RESUME_CODE) return 133
  if (resumeCode === 0xc || resumeCode === 0xd) return 130
  if (resumeCode === 0xe) return 131
  if (resumeCode === 0xf) return 128
  if (resumeCode === 0x11) return 137
  return null
}

/** 이벤트를 마친다. 선택지로 이어 본 이벤트까지 모두 본 것으로 남긴다. */
export function finishEvent(career: PlayerCareer, viewedEventIds: readonly number[]): PlayerCareer {
  const added = viewedEventIds.map(String).filter((id) => !career.seenEventIds.includes(id))
  return { ...career, seenEventIds: [...career.seenEventIds, ...new Set(added)] }
}

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
