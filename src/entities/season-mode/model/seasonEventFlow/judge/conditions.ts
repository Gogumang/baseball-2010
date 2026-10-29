import type { RandomPort } from '@/shared/api/random/randomPort'
import { hasSeenEvent } from '@/entities/season-mode/model/seasonEventFlow/seen'
import type { SeasonEventJudgeInput } from '@/entities/season-mode/model/seasonEventFlow/judge/types'

/** 조건 22 의 사기 구간 — 사기가 경계보다 크면 그 확률(%) (adb3a~adb76). 가장 낮은 구간 아래는 14% */
const ILLNESS_CHANCE_BY_MORALE: readonly (readonly [moraleAbove: number, percent: number])[] = [
  [70, 0],
  [50, 2],
  [30, 4],
  [10, 7],
]
const ILLNESS_CHANCE_LOWEST_PERCENT = 14

/**
 * 질병 확률 (조건 22, `0xadb32` 의 모드 2 갈래 adb3a~adb76).
 * 사기를 **팀 사기**로 읽고, 나리 쪽 유리몸(+10)·행운(−20) 보정을 건너뛰고 곧장 굴림(adbd2)으로 간다.
 */
export function illnessChancePercentOf(teamMorale: number): number {
  const band = ILLNESS_CHANCE_BY_MORALE.find(([moraleAbove]) => teamMorale > moraleAbove)
  return band === undefined ? ILLNESS_CHANCE_LOWEST_PERCENT : band[1]
}

interface EventCondition {
  readonly type: number
  readonly value: number
}

type ConditionCheck = (condition: EventCondition, input: SeasonEventJudgeInput, random: RandomPort) => boolean

/** 값이 0 이상이면 "그 이상", 음수면 "|값| 미만" */
function comparesTo(condition: EventCondition, actual: number): boolean {
  return condition.value >= 0 ? actual >= condition.value : actual < Math.abs(condition.value)
}

/** 조건 22 — SR+5 ≠ 0 이면 굴리지 않고 불발. p 가 0 이어도 rand 는 돈다 (adbd2 `rand(0,100) < p`) */
function rollIllnessCondition(_condition: EventCondition, input: SeasonEventJudgeInput, random: RandomPort): boolean {
  if (input.record.illness !== 0) return false
  const roll = random.rand(0, 100)
  return roll < illnessChancePercentOf(input.teamMorale)
}

const passes: ConditionCheck = () => true
const fails: ConditionCheck = () => false

/** 조건 하나 (switch 0xad1ba, 점프표 0xd83a0) — 모드 2 에서 쓰이는 갈래. 표에 없는 4~17, 26 이상은 통과 */
const CONDITION_CHECKS: Readonly<Record<number, ConditionCheck>> = {
  // 0~3 능력치 — 모드 2 는 통과 (0xad1ca)
  0: passes,
  1: passes,
  2: passes,
  3: passes,
  18: (condition, input) => comparesTo(condition, input.record.popularity),
  19: (condition, input) => comparesTo(condition, input.record.reputation),
  // 20·21 스킬 조건 — s_event 에 쓰는 곳이 없다. 시즌 SR 의 스킬 비트 갈래는 확인하지 않았다(미해결)
  20: fails,
  21: fails,
  22: rollIllnessCondition,
  // 23 — 모드 2 는 불발 (0xadbe6)
  23: fails,
  24: (condition, input) => condition.value <= 0 || hasSeenEvent(input.record, condition.value),
  25: (condition, input) => condition.value <= 0 || !hasSeenEvent(input.record, condition.value),
}

export function passesCondition(condition: EventCondition, input: SeasonEventJudgeInput, random: RandomPort): boolean {
  const check = CONDITION_CHECKS[condition.type] ?? passes
  return check(condition, input, random)
}
