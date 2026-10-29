import { ACQUIRE_CHECKS } from '@/entities/pitcher-career/model/pitcherStoryScene/skills/acquireChecks'
import { RELEASE_CHECKS } from '@/entities/pitcher-career/model/pitcherStoryScene/skills/releaseChecks'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import type { RandomPort } from '@/shared/api/random/randomPort'

/** 하위 표 범위 — 스킬 2~20 (v − 3 ≤ 18). 밖이면 그냥 통과 (0xad298 · 0xad9c4) */
const FIRST_TABLE_SKILL = 2
const LAST_TABLE_SKILL = 20

const isInSubTable = (skill: number) => skill >= FIRST_TABLE_SKILL && skill <= LAST_TABLE_SKILL

type SkillConditionKind = 'acquire' | 'release'

/** 20 은 가졌으면, 21 은 못 가졌으면 불발 (0xa3a75 보유 비트) */
const isBlockedByOwnership = (career: PitcherCareer, kind: SkillConditionKind, skill: number) =>
  career.skillIds.includes(skill) === (kind === 'acquire')

/** 하위 표 칸 — 표에 없는 스킬은 통과 */
const SUB_TABLE: Readonly<Record<SkillConditionKind, (career: PitcherCareer, skill: number, random: RandomPort | undefined) => boolean>> = {
  acquire: (career, skill, random) => ACQUIRE_CHECKS[skill]?.(career, random) ?? true,
  release: (career, skill) => RELEASE_CHECKS[skill]?.(career) ?? true,
}

/**
 * 조건 20(획득)·21(해제)의 **투수 갈래**. 스킬 번호 = v − 1 = 투수 보유 비트 번호.
 * ```
 *   20 (0xad276): 0xa3a75(S, v−1) 가졌으면 불발 → 하위 표 0xd8408[v−3] (v−3 > 18 이면 통과)
 *   21 (0xad9ac): 못 가졌으면 불발 → 하위 표 0xd8454[v−3]
 * ```
 * 하위 표 안의 갈림은 `[r6+8]`(모드) == 4 로 타자·투수가 갈린다 — 여기 식은 모두 모드 3 쪽이다 (직접 재역어셈).
 * 하위 표 투수 갈래는 모두 옮겼다(7 · 12 · 13 · 14 포함).
 */
export function meetsPitcherSkillCondition(career: PitcherCareer, kind: SkillConditionKind, value: number, random?: RandomPort): boolean {
  const skill = value - 1
  if (isBlockedByOwnership(career, kind, skill)) return false
  if (!isInSubTable(skill)) return true
  return SUB_TABLE[kind](career, skill, random)
}
