import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { hasSkill } from '@/entities/career/model/playerCareer'
import type { RandomPort } from '@/shared/api/random/randomPort'

/**
 * 이벤트 조건 20(스킬 획득) · 21(스킬 해제) — 0xad1ba 의 하위 switch (A-3·A-4 확정).
 *
 * ```
 * 20: 스킬 v−1 을 **안 가졌을 때**만, 이어서 하위 조건 0xd8408[v−3] 를 본다
 * 21: 스킬 v−1 을 **가졌을 때**만, 이어서 하위 조건 0xd8454[v−3] 를 본다
 * ```
 * 표는 19칸(스킬 2~20)이고, 표에 없는 스킬은 그냥 통과다.
 *
 * ⚠️ **아직 다 옮기지 못했다.** 원본 조건 가운데 아래 것들은 웹에 없는 카운터를 본다:
 *   - 2 먹튀: 이번 시즌 인기도 변화 합(+0x1c2) · 먹튀 보유 중 합/경기 수(+0x1c0/+0x1cd)
 *   - 3 몹쓸몸 · 4 유리몸: 이번 시즌 훈련 수(통산 +0x4b+i 와 새 시즌 사본 +0x6b+i 의 차)
 *   - 5 무력감 해제: 경기 뒤 사기 ≥ 90 연속 경기 수(+0x1c7)
 *   - 7 전설: 우승 횟수(+0x7a) · 그 해 MVP 비트(+0x1ca)
 *   - 10~16 · 18~20: 연도·통산 세부 기록 칸(+0x20~+0x2c, +0x1f0[])
 *   - 18·19·20 해제: 같은 칸 연속 훈련 수(+0x70~+0x74)
 * 그 조건들은 **아직 통과시키지 않는다**(= 이벤트가 뜨지 않는다). 카운터를 만들면서 하나씩 옮긴다.
 */

/** 조건표를 다 옮긴 스킬 — 나머지는 아직 판정하지 않는다 */
const ACQUIRE_RULES: Readonly<Record<number, (career: PlayerCareer, random: RandomPort | undefined) => boolean>> = {
  // 5 무력감 — 사기 ≤ 20, 연차 인덱스 ≥ 3, rand[0,100) ≥ 70 (30%) (0xad43a)
  5: (career, random) =>
    career.morale <= 20 && career.season - 1 >= 3 && random !== undefined && random.nextInRange(0, 100) >= 70,
  // 추가 조건이 없는 것들 (0xad9a2)
  6: () => true, // 행운
  8: () => true, // 의외성
  9: () => true, // 베테랑
  17: () => true, // 하락세
}

/** 해제 쪽에서 "표에 없음(통과)" 인 스킬 */
const RELEASE_ALWAYS: ReadonlySet<number> = new Set([6, 8, 9, 16, 17])

/** 조건 20 — 스킬을 아직 안 가졌고 하위 조건을 통과하면 획득 이벤트가 뜬다 */
export function meetsSkillAcquireCondition(
  career: PlayerCareer,
  value: number,
  random: RandomPort | undefined,
): boolean {
  const skillId = value - 1
  if (hasSkill(career, skillId)) return false
  // 한 번 해제한 마이너스 스킬은 다시 얻지 못한다 (+0x1d0)
  if (career.removedMinusSkillIds.includes(skillId)) return false
  return ACQUIRE_RULES[skillId]?.(career, random) ?? false
}

/** 조건 21 — 스킬을 가졌고 하위 조건을 통과하면 해제 이벤트가 뜬다 */
export function meetsSkillReleaseCondition(career: PlayerCareer, value: number): boolean {
  const skillId = value - 1
  if (!hasSkill(career, skillId)) return false
  return RELEASE_ALWAYS.has(skillId)
}
