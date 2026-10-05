import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { GAMES_PER_SEASON } from '@/entities/pitcher-career/model/pitcherCareer'
import { PITCHER_ABILITY_ORDER } from '@/entities/pitcher-career/model/pitcherAbility'
import { illnessChanceOf, placeTriggerOf } from '@/entities/story/model/storyScene'
import type { OriginalEvent } from '@/shared/config/original/eventTypes'
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
 * ⚠️ 미해결: 조건 20/21(스킬 v−1 획득/해제 하위 표 0xd8408·0xd8454)의 **투수 갈래**는 해독하지 않았다
 *    (타자편 `skillCondition.ts` 는 `PlayerCareer` 칸만 본다). 이 두 조건은 trigger 0 이벤트(402~437)에만
 *    있고 아래 장소 배정(trigger ≥ 2)에는 나오지 않으므로 여기서는 불발로 둔다.
 * ⚠️ 관리 화면(105)·지도(112)에서 매 갱신 이벤트를 고르는 자동 발동(0x1cf9c → 0xadc70, 커서 이어 쓰기)은
 *    투수편 웹에 아직 잇지 않았다 — 히든 변화구 30~33 만 `openableHiddenPitchEventOf` 로 따로 본다.
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
      case CONDITION.스킬해제:
        return false
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
