import type { OriginalEvent } from '@/shared/config/original/eventTypes'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { meetsSkillAcquireCondition, meetsSkillReleaseCondition } from '@/entities/story/model/skillCondition'
import { illnessChanceOf } from '@/entities/story/model/storyScene/illness'
import type { PlayerCareer } from '@/entities/story/model/storyScene/otherSlices'

/**
 * 이벤트 조건 (switch 0xad1ba · 점프표 0xd83a0, r253 직접 떴다) — 값 v 는 s16 (0xacd80):
 *   0~3 기본 능력치(0xb6414(레코드, 종류, 0) — 히트·파워·수비·주루, 장비·스킬 보정 전) · 18 인기도(0xb6e78) ·
 *   19 평판(+0x62) — 셋 다 v ≥ 0 이면 `값 ≥ v`, v < 0 이면 `값 < |v|` ·
 *   20/21 스킬 v−1 획득/해제 (`skillCondition`) · 22 질병 확률(0xadb32 — 선수 +5 질병 중이면 불발) ·
 *   23 질병 중 rand(0, 100) ≤ 9 (0xadbe6, 데이터 미사용) · 24 v ≤ 0 이거나 이벤트 v 를 봤다 · 25 v ≤ 0 이거나 아직 안 봤다 ·
 *   **4~17 · 26 이상은 통과**(점프표 칸 0xadc34 · 0xad1bc `cmp r7, #0x19 ; bls` 밖도 0xadc34).
 *   질병 쿨다운(+0x7c)은 조건 22 가 아니라 판정 머리(②, `isIllnessCooldownBlocked`)가 본다.
 */
const CONDITION = { 인기도: 18, 평판: 19, 스킬획득: 20, 스킬해제: 21, 질병: 22, 아플때: 23, 봤음: 24, 안봤음: 25 } as const
const ABILITY_CONDITIONS = ['hit', 'power', 'defense', 'run'] as const

const PERCENT = 100
/** 조건 23 의 문턱 — rand(0, 100) ≤ 9 면 통과 (0xadc02 `cmp r0, #9 ; ble`) */
const SICK_EVENT_ROLL_MAX = 9

export const hasSeen = (career: PlayerCareer, eventId: number) => career.seenEventIds.includes(String(eventId))

/**
 * 0~3 · 18 · 19 의 견주기 (0xad1e0~0xad20e · 0xad212~0xad23e) — v ≥ 0 이면 `값 ≥ v`, v < 0 이면 `값 < |v|`.
 * 원본 데이터에는 음수 값이 없다
 */
const meetsSigned = (actual: number, value: number) => (value >= 0 ? actual >= value : actual < -value)

/** 조건 22 — 0xadb32: 선수 +5(질병 중)만 본다. 쿨다운은 판정 머리 ②(`isIllnessCooldownBlocked`) */
function rollIllnessCondition(career: PlayerCareer, random: RandomPort | undefined): boolean {
  if (random === undefined || career.isSick) return false
  return random.rand(0, PERCENT) < illnessChanceOf(career.morale, career.skillIds, career.equippedSkillIds)
}

/** 조건 23 — 0xadbe6: (모드 2 면 불발) 질병 중이 아니면 불발, 이어서 rand(0, 100) ≤ 9. 원본 데이터는 이 조건을 안 쓴다 */
function rollSickCondition(career: PlayerCareer, random: RandomPort | undefined): boolean {
  if (random === undefined || !career.isSick) return false
  return random.rand(0, PERCENT) <= SICK_EVENT_ROLL_MAX
}

type ConditionCheck = (career: PlayerCareer, value: number, random: RandomPort | undefined) => boolean

/** 조건 종류 → 판정 (점프표 0xd83a0). 표에 없는 종류(4~17 · 26 이상)는 0xadc34(다음 조건)로 곧장 간다 */
const CONDITION_CHECKS: Readonly<Record<number, ConditionCheck>> = {
  [CONDITION.인기도]: (career, value) => meetsSigned(career.popularity, value),
  [CONDITION.평판]: (career, value) => meetsSigned(career.reputation, value),
  // 0xadc0c — v ≤ 0 이면 곧 통과
  [CONDITION.봤음]: (career, value) => value <= 0 || hasSeen(career, value),
  // 0xadc22 — v ≤ 0 이면 곧 통과
  [CONDITION.안봤음]: (career, value) => value <= 0 || !hasSeen(career, value),
  [CONDITION.스킬획득]: (career, value, random) => meetsSkillAcquireCondition(career, value, random),
  [CONDITION.스킬해제]: (career, value) => meetsSkillReleaseCondition(career, value),
  [CONDITION.질병]: (career, _value, random) => rollIllnessCondition(career, random),
  [CONDITION.아플때]: (career, _value, random) => rollSickCondition(career, random),
}

type EventCondition = OriginalEvent['conditions'][number]

function meetsCondition(condition: EventCondition, career: PlayerCareer, random: RandomPort | undefined): boolean {
  const ability = ABILITY_CONDITIONS[condition.type]
  if (ability !== undefined) return meetsSigned(career.ability[ability], condition.value)
  const check = CONDITION_CHECKS[condition.type]
  return check === undefined || check(career, condition.value, random)
}

/** 조건을 차례로 본다 — 하나라도 불발이면 뒤 조건은 굴리지 않는다 */
export function meetsConditions(event: OriginalEvent, career: PlayerCareer, random: RandomPort | undefined): boolean {
  return event.conditions.every((condition) => meetsCondition(condition, career, random))
}
