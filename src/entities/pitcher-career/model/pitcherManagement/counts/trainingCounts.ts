import { toInt8 } from '@/entities/pitcher-career/model/pitcherManagement/counts/int8'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { isBugFixed } from '@/shared/config/bugfixes'

/** 몹쓸몸 · 유리몸 보유 비트 — 투수 비트 0~7 은 타자와 같은 공통 스킬이다(2 먹튀 · 5 무력감과 같은 짝) */
const BAD_BODY_SKILL = 3
const FRAGILE_SKILL = 4
/** 몹쓸몸 · 유리몸 카운터는 u8 (S+0x75 · S+0x76) */
const U8_MASK = 0xff

/** 그 스킬을 가졌으면 u8 카운터 +1, 아니면 0 (0x18b86~0x18bd6) */
function heldSkillStreakOf(career: PitcherCareer, skill: number, current: number | undefined): number {
  return career.skillIds.includes(skill) ? ((current ?? 0) + 1) & U8_MASK : 0
}

/**
 * 훈련 한 번을 센다 (0x18a80) — 통산 수와 **칸별 연속 훈련 수**(같은 칸 +1, 나머지 0).
 * 이어서 0x18b86~0x18bd6(모드 갈림 없음, 직접 떴다): `0xa3a75(S, 3)` 보유면 u8 S+0x75 += 1 · 아니면 S+0x75 = 0,
 * `0xa3a75(S, 4)` 보유면 S+0x76 += 1 · 아니면 0 — 몹쓸몸 · 유리몸을 **가진 채** 이어 한 훈련 수.
 */
export function countPitcherTraining(career: PitcherCareer, menuId: string): PitcherCareer {
  return {
    ...career,
    trainingCounts: { ...career.trainingCounts, [menuId]: (career.trainingCounts[menuId] ?? 0) + 1 },
    consecutiveTrainingCounts: { [menuId]: (career.consecutiveTrainingCounts[menuId] ?? 0) + 1 },
    badBodyTrainings: heldSkillStreakOf(career, BAD_BODY_SKILL, career.badBodyTrainings),
    fragileTrainings: heldSkillStreakOf(career, FRAGILE_SKILL, career.fragileTrainings),
  }
}

/**
 * 한 칸의 이번 시즌 훈련 수 — 통산 칸은 ldrb, 새 시즌 사본은 ldrsb 로 읽는다(사본이 128 을 넘으면 음수로 읽히는 원본 그대로).
 * 고침(bugfixes.json B-70, 기본 켬): u8 − s8 대신 참 값끼리 뺀다(사본 128 이상에서 차이가 256 커지는 원본 버그)
 */
function seasonTrainingDifferenceOf(count: number, copy: number): number {
  if (isBugFixed('B-70')) return count - copy
  return (count & U8_MASK) - toInt8(copy & U8_MASK)
}

/**
 * 이번 시즌 훈련 수 합 T — 조건 20 의 몹쓸몸 · 유리몸 식(0xad32e~0xad34c · 0xad3fc~0xad41a):
 * `Σ i=0..4 (u8 S+0x4b+i − s8 S+0x6b+i)`.
 */
export function seasonPitcherTrainingTotalOf(career: PitcherCareer): number {
  const menuIds = new Set([...Object.keys(career.trainingCounts), ...Object.keys(career.seasonStartTrainingCounts)])
  let total = 0
  for (const menuId of menuIds) {
    total += seasonTrainingDifferenceOf(career.trainingCounts[menuId] ?? 0, career.seasonStartTrainingCounts[menuId] ?? 0)
  }
  return total
}

/** 이번 시즌 훈련 수 = 통산 − 새 시즌 사본 (A-4) */
export function seasonPitcherTrainingCountOf(career: PitcherCareer, menuId: string): number {
  return (career.trainingCounts[menuId] ?? 0) - (career.seasonStartTrainingCounts[menuId] ?? 0)
}
