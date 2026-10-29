import { illnessChanceOf } from '@/entities/pitcher-career/model/pitcherStoryScene/otherSlices'
import { meetsPitcherSkillCondition } from '@/entities/pitcher-career/model/pitcherStoryScene/skills/skillCondition'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { PITCHER_ABILITY_ORDER } from '@/entities/pitcher-career/model/pitcherAbility'
import type { OriginalEvent } from '@/shared/config/original/eventTypes'
import type { RandomPort } from '@/shared/api/random/randomPort'

const CONDITION = { 인기도: 18, 평판: 19, 스킬획득: 20, 스킬해제: 21, 질병: 22, 아플때: 23, 봤음: 24, 안봤음: 25 } as const
const PERCENT = 100
const SICK_CHANCE_MAXIMUM = 9

export const hasSeen = (career: PitcherCareer, eventId: number) => career.seenEventIds.includes(String(eventId))

/** 부호 규칙 — v ≥ 0 이면 ≥ v, 음수면 < |v| (0xad1ca · 0xad212 · 0xad240) */
const meets = (actual: number, value: number) => (value >= 0 ? actual >= value : actual < -value)

/** 22 질병 — 0xadb32 는 선수 +5(질병 중)만 본다. 쿨다운은 판정 머리 ②(`isIllnessCooldownBlocked`). 미리 보기([!])는 굴리지 않는다 */
function rollIllness(career: PitcherCareer, random: RandomPort | undefined): boolean {
  if (random === undefined || career.isSick) return false
  return random.rand(0, PERCENT) < illnessChanceOf(career.morale, career.skillIds, career.equippedSkillIds)
}

/** 23 아플 때 — 0xadbe6: 아플 때만 rand[0,100) ≤ 9 (데이터는 쓰지 않는다) */
function rollWhileSick(career: PitcherCareer, random: RandomPort | undefined): boolean {
  if (random === undefined || !career.isSick) return false
  return random.rand(0, PERCENT) <= SICK_CHANCE_MAXIMUM
}

/** 조건 하나의 판정 — 무작위 조건은 굴릴 수 있을 때만 굴린다 */
type ConditionCheck = (career: PitcherCareer, value: number, random: RandomPort | undefined) => boolean

/** switch 0xad1ba 의 모드 3 갈래 (조건 번호 → 판정). 0~3 능력치는 따로, 4~17 · 26 이상은 통과 (0xad1ba 점프표) */
const CONDITION_CHECKS: Readonly<Record<number, ConditionCheck>> = {
  [CONDITION.인기도]: (career, value) => meets(career.popularity, value),
  [CONDITION.평판]: (career, value) => meets(career.reputation, value),
  [CONDITION.봤음]: (career, value) => value <= 0 || hasSeen(career, value),
  [CONDITION.안봤음]: (career, value) => value <= 0 || !hasSeen(career, value),
  [CONDITION.스킬획득]: (career, value, random) => meetsPitcherSkillCondition(career, 'acquire', value, random),
  [CONDITION.스킬해제]: (career, value) => meetsPitcherSkillCondition(career, 'release', value),
  [CONDITION.질병]: (career, _value, random) => rollIllness(career, random),
  [CONDITION.아플때]: (career, _value, random) => rollWhileSick(career, random),
}

/**
 * 판정 8 조건 — 0~3 은 `0xb6414(선수기록, i, 0)` = 투수 기록의 **제구·구속·변화·체력** 기본값.
 * 처음 막힌 조건에서 멈춘다(뒤 조건의 굴림은 안 한다)
 */
export function meetsConditions(event: OriginalEvent, career: PitcherCareer, random: RandomPort | undefined): boolean {
  return event.conditions.every((condition) => {
    const ability = PITCHER_ABILITY_ORDER[condition.type]
    if (ability !== undefined) return meets(career.ability[ability], condition.value)
    return CONDITION_CHECKS[condition.type]?.(career, condition.value, random) ?? true
  })
}
