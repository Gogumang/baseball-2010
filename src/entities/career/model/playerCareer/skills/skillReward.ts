import { MINUS_SKILL_IDS, isSkillEquipped, setSkillEquipped } from '@/entities/career/model/playerCareer/skills/skillEquip'
import type { PlayerCareer } from '@/entities/career/model/playerCareer/types/playerCareer'

/** 스킬 보상이 건드리는 칸 — 모드 3(투수편) 레코드도 같은 칸이라(0xa4430 · 0xa4bd8 공용) 꼴만 받는다 */
export type SkillRewardCareer = Pick<PlayerCareer, 'skillIds' | 'removedMinusSkillIds' | 'equippedSkillIds' | 'skillSlotLevel'>

/**
 * 보상 종류 4 — 양수 n 은 스킬 n−1 획득, 음수 −n 은 스킬 n−1 해제 (0x8c5bc).
 *
 * **마이너스 스킬을 해제하면 `+0x1d0+k` 해제 기록이 선다** (0xa4430 → 0xa43fc(P, s, 1), A-6) — 연초 115 의 0xa4ee8 이
 * 지운다(R9 7절, `useCareerSession` 105 진입). 이 기록을 보고 막는 곳은 **이벤트 조건 20 의 하위 조건**(2 · 3 · 4 · 5 · 18 · 19 · 20,
 * `skillCondition` 의 `wasRemoved`)뿐이다 — 보상 실행기는 막지 않는다 (r253, 0x8c580~0x8c5b6 · 0xa4bd8 · 0xa4430 직접 떴다):
 * ```
 * 8c580  v = 명령 값(s16) ; s = |v| − 1
 * 8c596  v > 0 → 0xa4bd9(S, s)   ; 0xa4bd8: S+0x1b8 |= 1<<s ; 0xa4b04(S, s, 1) 자동 장착 — 해제 기록을 안 본다
 * 8c5a6  v < 0 → 0xa4431(S, s)   ; 0xa4430: 0xa3a74(보유)면 비트를 끄고(a4440~a444e) · **보유와 상관없이** 0xb66dd 장착 끄기 ·
 *                                 ;          0xa43fc(P, s, 1) — 표 0xd7e10 에 있으면 S+0x1d0+칸 = 1
 * ```
 * 그래서 그 해 풀었던 하락세(17)도 0x8a6fc 의 보상(+18)이 오면 다시 얻는다. 앞서 웹은 획득 쪽에서 해제 기록을 보고 막았고(원본에
 * 없는 가드), 안 가진 스킬의 해제 보상은 해제 기록을 안 남겼다.
 */
export function applySkillReward<T extends SkillRewardCareer>(career: T, value: number): T {
  const skillId = Math.abs(value) - 1
  return value > 0 ? gainRewardSkill(career, skillId) : removeRewardSkill(career, skillId)
}

/**
 * 획득 0xa4bd8 = 보유 비트를 켜고 **곧바로 0xa4b04(P, s, 1)** — 자리가 있으면 자동 장착.
 * 이미 가진 스킬이어도 장착은 다시 시도한다(0xa4bd8 에 보유 검사가 없다) — 창에서 뺀 플러스 스킬이
 * 다시 들어오면 자리가 있는 한 다시 끼워진다.
 */
function gainRewardSkill<T extends SkillRewardCareer>(career: T, skillId: number): T {
  const owned = career.skillIds.includes(skillId) ? career : { ...career, skillIds: [...career.skillIds, skillId] }
  return setSkillEquipped(owned, skillId, true)
}

/** 제거 0xa4430 = 가졌으면 보유 비트를 끄고, 가졌든 안 가졌든 0xb66dd 로 장착을 끄고 해제 기록(0xa43fc)을 남긴다 */
function removeRewardSkill<T extends SkillRewardCareer>(career: T, skillId: number): T {
  const owns = career.skillIds.includes(skillId)
  const removed = MINUS_SKILL_IDS.includes(skillId) && !career.removedMinusSkillIds.includes(skillId)
  if (!owns && !removed && !isSkillEquipped(career, skillId)) return career
  return setSkillEquipped(
    {
      ...career,
      skillIds: owns ? career.skillIds.filter((id) => id !== skillId) : career.skillIds,
      removedMinusSkillIds: removed ? [...career.removedMinusSkillIds, skillId] : career.removedMinusSkillIds,
    },
    skillId,
    false,
  )
}
