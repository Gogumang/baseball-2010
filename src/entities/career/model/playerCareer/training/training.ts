import { hasSkill } from '@/entities/career/model/playerCareer/skills/skillEquip'
import type { PlayerCareer } from '@/entities/career/model/playerCareer/types/playerCareer'

/**
 * 훈련 한 번을 메뉴별로 센다. 칭호 23(200회)·24(100회)가 이 합을 본다 (titles.ts).
 * 메뉴별로 나눠 두는 것은 원본 저장 구조를 아직 못 찾아서다 — 합계만 쓰므로 안전하다 (추정).
 */
export function trainingCountOf(career: PlayerCareer, menuId: string): number {
  return career.trainingCounts[menuId] ?? 0
}

/** 몹쓸몸·유리몸 스킬 번호 — 그 스킬을 가진 채로 훈련한 횟수를 따로 센다 (A-4) */
const BAD_BODY_SKILL = 3
const FRAGILE_SKILL = 4
/**
 * 해제 카운터 +0x70+칸 을 올리는 (훈련 메뉴, 보유 스킬) 짝 — 0x18a5c~0x18b58 의 모드 4(타자편) 갈래(직접 떴다):
 * 칸 0 히트 · 18 / 칸 1 파워 · 19 / 칸 2 수비 · 20 (0xa3a75 = **보유** 비트)
 */
const RELEASE_STREAK_SKILL_OF_MENU: Readonly<Record<string, number>> = { 히트: 18, 파워: 19, 수비: 20 }
/** 칸은 s8 (ldrsb · strb, 0x18b68~0x18b6c) */
const toSignedByte = (value: number) => ((value & 0xff) << 24) >> 24

/**
 * 훈련 한 번을 센다 (0x18a80).
 * 통산 수와 함께 **칸별 연속 훈련 수**(+0x70+칸)도 갱신한다 — 0x18a5c~0x18b84: 훈련한 칸이 그 칸의 해제 스킬(18 · 19 · 20)을
 * **가진 채**면 그 칸만 +1(0x18b5a), 아니면 **다섯 칸 모두 0**(0x18b70 — 주루 · 필살타법 칸, 스킬이 없을 때).
 * (예전 웹은 스킬과 상관없이 같은 칸이면 올려, 스킬을 얻기 전 훈련이 해제 수에 들어갔다.)
 * 몹쓸몸·유리몸은 0x18b86~0x18bd6(모드 갈림 없음, 직접 떴다): 보유 비트(0xa3a75)면 u8 +0x75/+0x76 += 1, **아니면 0 으로** —
 * 가진 채 이어 한 훈련 수다(예전 웹은 안 가졌을 때 그대로 두어, 풀린 뒤 다시 얻으면 곧 풀렸다).
 */
export function countTraining(career: PlayerCareer, menuId: string): PlayerCareer {
  return {
    ...career,
    trainingCounts: { ...career.trainingCounts, [menuId]: trainingCountOf(career, menuId) + 1 },
    consecutiveTrainingCounts: hasSkill(career, RELEASE_STREAK_SKILL_OF_MENU[menuId] ?? -1)
      ? { [menuId]: toSignedByte((career.consecutiveTrainingCounts[menuId] ?? 0) + 1) }
      : {},
    badBodyTrainings: hasSkill(career, BAD_BODY_SKILL) ? (career.badBodyTrainings + 1) & 0xff : 0,
    fragileTrainings: hasSkill(career, FRAGILE_SKILL) ? (career.fragileTrainings + 1) & 0xff : 0,
  }
}
