import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { equippedPitcherAbilityOf, GAMES_PER_SEASON } from '@/entities/pitcher-career/model/pitcherCareer'
import { PITCHER_ABILITY_NAMES, PITCHER_ABILITY_ORDER } from '@/entities/pitcher-career/model/pitcherAbility'
import { seasonPitcherTrainingCountOf } from '@/entities/pitcher-career/model/pitcherManagement'
import { illnessChanceOf, OPENING_EVENT_ID, placeTriggerOf } from '@/entities/story/model/storyScene'
import type { OriginalEvent } from '@/shared/config/original/eventTypes'
import { ORIGINAL_USER_EVENTS } from '@/shared/config/original/userEvents'
import type { RandomPort } from '@/shared/api/random/randomPort'

/**
 * 나만의리그 **투수편**(모드 3) 이벤트 고르기 — 판정 `0xacfbc` 의 모드 3 갈래 (A-2 · A-3 확정).
 *
 *   1. 대상 0 은 코드가 번호로 부를 때만 · 2. 모드 3 이 받는 대상은 **1·3** (타자편 1·2)
 *   4. 본 이벤트면 불발 · 5. trigger ↔ 화면 (0 ↔ 105 · 1 ↔ 112 · ≥2 ↔ 113)
 *   6. requiresEvent · 7. 날짜 창 (네 바이트 중 하나라도 0 이면 생략, now = 연차idx·45 + 경기 수 + 1)
 *   8. 조건 (switch 0xad1ba) — 0~3 은 `0xb6414(선수기록, i, 0)` = 투수 기록의 **제구·구속·변화·체력** 기본값,
 *      18 인기도 · 19 평판 · 22 질병 확률(0xadb32) · 24/25 이벤트 봤음/안 봤음. 4~17 · 26+ 는 통과.
 *
 *      20/21 은 스킬 v−1 획득/해제 — 투수 갈래는 `meetsPitcherSkillCondition` (아래).
 * 관리 화면(105)·지도(112)의 자동 발동(0x1cf9c → 0x8be80 → 0xadc70, 커서 이어 쓰기)은 `scanPitcherEventFrom`.
 */

const PITCHER_AUDIENCES: ReadonlySet<number> = new Set([1, 3])
const CONDITION = { 인기도: 18, 평판: 19, 스킬획득: 20, 스킬해제: 21, 질병: 22, 아플때: 23, 봤음: 24, 안봤음: 25 } as const
const PERCENT = 100
const SICK_CHANCE_MAXIMUM = 9

const hasSeen = (career: PitcherCareer, eventId: number) => career.seenEventIds.includes(String(eventId))

function isInDateWindow(event: OriginalEvent, career: PitcherCareer): boolean {
  const [fromSeason, fromGame] = event.dateFrom
  const [toSeason, toGame] = event.dateTo
  if (fromSeason === 0 || fromGame === 0 || toSeason === 0 || toGame === 0) return true
  const now = (career.season - 1) * GAMES_PER_SEASON + career.gamesPlayed + 1
  const from = (fromSeason - 1) * GAMES_PER_SEASON + fromGame
  const to = (toSeason - 1) * GAMES_PER_SEASON + toGame
  return now >= from && now <= to
}

/** 부호 규칙 — v ≥ 0 이면 ≥ v, 음수면 < |v| (0xad1ca · 0xad212 · 0xad240) */
const meets = (actual: number, value: number) => (value >= 0 ? actual >= value : actual < -value)

function meetsConditions(event: OriginalEvent, career: PitcherCareer, random: RandomPort | undefined): boolean {
  return event.conditions.every((condition) => {
    const ability = PITCHER_ABILITY_ORDER[condition.type]
    if (ability !== undefined) return meets(career.ability[ability], condition.value)
    switch (condition.type) {
      case CONDITION.인기도:
        return meets(career.popularity, condition.value)
      case CONDITION.평판:
        return meets(career.reputation, condition.value)
      case CONDITION.봤음:
        return condition.value <= 0 || hasSeen(career, condition.value)
      case CONDITION.안봤음:
        return condition.value <= 0 || !hasSeen(career, condition.value)
      case CONDITION.스킬획득:
        return meetsPitcherSkillCondition(career, 'acquire', condition.value)
      case CONDITION.스킬해제:
        return meetsPitcherSkillCondition(career, 'release', condition.value)
      case CONDITION.질병:
        // 무작위 조건은 굴릴 수 있을 때만 — 미리 보기([!])는 굴리지 않는다
        if (random === undefined || career.isSick || career.illnessCooldown > 0) return false
        return random.nextInRange(0, PERCENT) < illnessChanceOf(career.morale, career.skillIds, career.equippedSkillIds)
      case CONDITION.아플때:
        // 0xadbe6 — 아플 때만 rand[0,100) ≤ 9 (데이터는 쓰지 않는다)
        if (random === undefined || !career.isSick) return false
        return random.nextInRange(0, PERCENT) <= SICK_CHANCE_MAXIMUM
      default:
        // 4~17 · 26 이상은 통과 (0xad1ba 점프표)
        return true
    }
  })
}

/** `0xacfbc` 의 모드 3 판정 (본 이벤트 · 대상 · trigger · 선행 이벤트 · 날짜 · 조건) */
export function isPitcherEventEligible(
  event: OriginalEvent,
  career: PitcherCareer,
  trigger: number,
  random?: RandomPort,
): boolean {
  return (
    PITCHER_AUDIENCES.has(event.audience) &&
    !hasSeen(career, event.id) &&
    event.trigger === trigger &&
    (event.requiresEvent === 0 || hasSeen(career, event.requiresEvent)) &&
    isInDateWindow(event, career) &&
    meetsConditions(event, career, random)
  )
}

/**
 * 외출 장소 배정 `0x8cdc0` (지도 진입 0x118e4) — 처음부터 훑어 통과한 trigger ≥ 2 이벤트를 장소 trigger−2 칸에,
 * **비어 있을 때만** 넣는다 → 장소마다 파일 순서 첫 이벤트. [들어가기] 는 `0x8ce58` 이 이 번호를 부른다.
 * 무작위를 굴리지 않는다(장소 이벤트에는 질병 조건이 없다 — 판정이 trigger 를 조건보다 먼저 본다).
 */
export function pitcherPlaceEventOf(
  career: PitcherCareer,
  events: readonly OriginalEvent[],
  placeFrame: number,
): OriginalEvent | null {
  const trigger = placeTriggerOf(placeFrame)
  return events.find((event) => isPitcherEventEligible(event, career, trigger)) ?? null
}

/* ── 조건 20/21 — 스킬 v−1 획득/해제 (0xad276 · 0xad9ac → 하위 표 0xd8408 · 0xd8454), 투수 갈래 ───────── */

/** s16 로 읽는다 — 통산 합산 0x9da28 은 u16 로 적고(strh) 조건은 ldrsh 로 읽는다 */
const toInt16 = (value: number) => ((value & 0xffff) << 16) >> 16
/** 0xca7b5 — 0 쪽 버림 나눗셈 */
const OUTS_PER_INNING = 3

/** 투수 비트 번호 (8 이상은 표 번호 비트+16). 하위 표 칸 = 비트 − 2 (0xad292 `subs r0, r4, #3` = v − 3) */
const PITCHER_SKILL = {
  끈기: 10,
  닥터K: 11,
  안정감: 16,
  비겁자: 18,
  깃털: 19,
  더티볼: 20,
} as const
/** 하위 표 범위 — 스킬 2~20 (v − 3 ≤ 18). 밖이면 그냥 통과 (0xad298 · 0xad9c4) */
const FIRST_TABLE_SKILL = 2
const LAST_TABLE_SKILL = 20

/**
 * 하위 표에서 **투수 갈래를 아직 옮기지 못한** 스킬 — 불발로 둔다 (지어내지 않는다).
 *   2 먹튀 · 3 몹쓸몸 · 4 유리몸 · 5 무력감: 식은 두 편 공용으로 확정(A 4절)이지만, 투수 웹이 해제 쪽 칸
 *     (+0x1c0/+0x1cd 먹튀 카운터 · +0x75/+0x76 보유 중 훈련 수 · +0x1c7 사기 연속) 과 획득 쪽 +0x1c2(시즌 인기도 변화 합)를
 *     아직 세지 않는다 — 얻기만 하고 못 푸는 일을 막으려고 둘 다 불발.
 *   7 전설: +0x7a(우승 횟수 추정) — 투수 웹 칸 없음.
 *   12 좌타UP · 13 우타UP: 0xb63c0(투수 기록) 의 뜻(0xb6278 · 0xb63a0 갈래)을 다 풀지 못했다.
 *   14 투지: 지난 3년 연도 기록(0x1fa78(i) +0x24·+0x2e) — 투수 웹에 연도별 기록이 없다.
 */
const UNPORTED_ACQUIRE: ReadonlySet<number> = new Set([2, 3, 4, 5, 7, 12, 13, 14])
/** 해제 쪽 미이식 — 2·3·4·5 (위와 같은 칸) · 14 투지 (작년 +0x2e · +0x24, 0xada22) */
const UNPORTED_RELEASE: ReadonlySet<number> = new Set([2, 3, 4, 5, 14])

/** 해제 카운터 +0x70+s 를 보는 칸 — 0xadad0~0xadb20 모드 3 갈래: 18 → +0x73 · 19 → +0x72 · 20 → +0x70 */
export const PITCHER_RELEASE_STREAK_SLOT: Readonly<Record<number, number>> = { 18: 3, 19: 2, 20: 0 }
const RELEASE_STREAK_LIMIT = 7

/** `0xa4f31(S, k)` — 그 해 이미 해제한 마이너스 스킬이면 획득 불발 (연초 115 의 0xa4ee8 이 지운다) */
const wasRemoved = (career: PitcherCareer, skill: number) => career.removedMinusSkillIds.includes(skill)

function acquiresPitcherSkill(career: PitcherCareer, skill: number): boolean {
  const yearIndex = career.season - 1
  const g = career.gamesPlayed
  switch (skill) {
    case PITCHER_SKILL.끈기: {
      // 0xad4ac: 0xb6415(기록, 3, 1) > 599 (체력 실효) 이고 통산 +8(투구 수) ≥ 6000
      return equippedPitcherAbilityOf(career).stamina > 599 && toInt16(career.careerStats.pitches) >= 6000
    }
    case PITCHER_SKILL.닥터K:
      // 0xad4f8: 통산 +6(탈삼진) ≥ 500
      return toInt16(career.careerStats.strikeouts) >= 500
    case PITCHER_SKILL.안정감: {
      // 0xad7ec: 이닝 = 통산 +0(아웃)/3 · 보직 0(0xb6705) 이면 ≥ 500, 아니면 ≥ 400 · 그리고 통산 +6(탈삼진) ≥ 200
      const innings = Math.trunc(toInt16(career.careerStats.outs) / OUTS_PER_INNING)
      const strikeouts = toInt16(career.careerStats.strikeouts)
      return innings >= (career.role === 0 ? 500 : 400) && strikeouts >= 200
    }
    case PITCHER_SKILL.비겁자: {
      // 0xad842 → 0xad89a: 이번 시즌 기록 +0x20(아웃)/3 이 g == 16 에서 ≤ 14 · g == 36 에서 ≤ 32
      if (wasRemoved(career, skill)) return false
      const innings = Math.trunc(toInt16(career.stats.outs) / OUTS_PER_INNING)
      if (g === 16) return innings <= 14
      return g === 36 && innings <= 32
    }
    case PITCHER_SKILL.깃털:
      // 0xad8c8 → 0xad91a: 연차idx > 2 · 0xb6415(기록, 2, 1) ≤ 500 (변화 실효) · g == 30 · 이번 시즌 칸 2 훈련 0
      if (wasRemoved(career, skill)) return false
      return (
        yearIndex > 2 &&
        equippedPitcherAbilityOf(career).breaking <= 500 &&
        g === 30 &&
        seasonPitcherTrainingCountOf(career, PITCHER_ABILITY_NAMES[2]) === 0
      )
    case PITCHER_SKILL.더티볼:
      // 0xad93a: 해제 기록만 보고, 모드 ≠ 4 는 곧 통과 (0xad952)
      return !wasRemoved(career, skill)
    default:
      // 6 행운 · 8 의외성 · 9 베테랑 · 15(투수 31 집중, 0xad794 모드 ≠ 4 통과) · 17 하락세 — 추가 조건 없음
      return true
  }
}

function releasesPitcherSkill(career: PitcherCareer, skill: number): boolean {
  const slot = PITCHER_RELEASE_STREAK_SLOT[skill]
  // 18·19·20 — 해제 카운터 +0x70+칸 > 7 (훈련 0x18a80: 그 스킬을 **가진 채** 그 칸만 연달아 8번)
  if (slot !== undefined) return (career.releaseTrainingStreaks[slot] ?? 0) > RELEASE_STREAK_LIMIT
  // 6~13 · 15 · 16 · 17 — 표가 0xadc34 (통과)
  return true
}

/**
 * 조건 20(획득)·21(해제)의 **투수 갈래**. 스킬 번호 = v − 1 = 투수 보유 비트 번호.
 * ```
 *   20 (0xad276): 0xa3a75(S, v−1) 가졌으면 불발 → 하위 표 0xd8408[v−3] (v−3 > 18 이면 통과)
 *   21 (0xad9ac): 못 가졌으면 불발 → 하위 표 0xd8454[v−3]
 * ```
 * 하위 표 안의 갈림은 `[r6+8]`(모드) == 4 로 타자·투수가 갈린다 — 여기 식은 모두 모드 3 쪽이다 (직접 재역어셈).
 * 미이식 스킬은 `UNPORTED_ACQUIRE` · `UNPORTED_RELEASE` 머리글.
 */
export function meetsPitcherSkillCondition(
  career: PitcherCareer,
  kind: 'acquire' | 'release',
  value: number,
): boolean {
  const skill = value - 1
  const owns = career.skillIds.includes(skill)
  if (kind === 'acquire' ? owns : !owns) return false
  if (skill < FIRST_TABLE_SKILL || skill > LAST_TABLE_SKILL) return true
  if (kind === 'acquire') return !UNPORTED_ACQUIRE.has(skill) && acquiresPitcherSkill(career, skill)
  return !UNPORTED_RELEASE.has(skill) && releasesPitcherSkill(career, skill)
}

/* ── 자동 발동 (0x1cf9c → 0x8be80 → 0xadc70) ───────────────────────────────────────────── */

/** 한 번 훑기의 결과 — 뽑힌 이벤트와 **다음 호출이 이어서 볼 자리**(reader+0x28) */
export interface PitcherEventScan {
  readonly event: OriginalEvent | null
  readonly cursor: number
}

/**
 * 선택 0xadc70 (A 3절 확정) — 커서에서 이어 훑어 처음 통과한 한 건, 커서는 그 레코드에 멈춘다.
 * 끝까지 없으면 커서를 0 으로 되감고 이번 호출은 "없음". 0x8be80 은 장소 인자로 늘 −1 을 넘긴다.
 * 무작위 조건(22 질병 · 23)은 `random` 이 있을 때만 굴린다.
 */
export function scanPitcherEventFrom(
  career: PitcherCareer,
  events: readonly OriginalEvent[],
  trigger: number,
  cursor: number,
  random?: RandomPort,
): PitcherEventScan {
  for (let at = Math.max(0, cursor); at < events.length; at += 1) {
    if (isPitcherEventEligible(events[at], career, trigger, random)) return { event: events[at], cursor: at }
  }
  return { event: null, cursor: 0 }
}

/**
 * 오프닝 451 — 새 선수 플래그(장면+0x165, 100 진입 끝 0x1c3be: 이전 상태가 104 면 1)가 서 있으면 0x1cfa6 이
 * 자동 발동 대신 `0x8bde0`(모드 3·4 → 451)을 번호로 부른다. 번호 호출(0xae170)은 "그 다음 칸" 을 커서로 남긴다.
 */
export function pitcherOpeningScanOf(events: readonly OriginalEvent[], cursor: number): PitcherEventScan {
  const index = events.findIndex((event) => event.id === OPENING_EVENT_ID)
  return index < 0 ? { event: null, cursor } : { event: events[index], cursor: index + 1 }
}

/**
 * **연초 115** 의 내장 이벤트 (0x8a680 — 파일 이벤트가 아니다, R9 7절 확정).
 * ```
 *   cmd[0] say: 인물 1명 (캐릭터 2 = 감독, 오른쪽, 표정 0) · 글 StrUSER_EVT[1] · 말하는 이 2(StrMODE[93] "감독")
 *   cmd[1] system sub 1 arg 0 — 올해의 목표 창 (0x741a1 → 0x86fdc)
 * ```
 * 초상화 번호 = 캐릭터 기본번호 표 0xd0ae6[2] = 16 + 표정 0. 파일 레코드가 아니라 본 표시를 남기지 않는다.
 * ⚠️ 미해결: 올해의 목표 창(SYS 1)은 재생기가 아직 띄우지 않는다 — 392 의 SYS(1, 77) 과 같은 처지.
 */
export const PITCHER_YEAR_START_EVENT_ID = -115
const DIRECTOR_SPEAKER = 2
const DIRECTOR_PORTRAIT_ANIMATION = 16
const YEAR_START_TEXT_INDEX = 1

export const PITCHER_YEAR_START_EVENT: OriginalEvent = {
  id: PITCHER_YEAR_START_EVENT_ID,
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
