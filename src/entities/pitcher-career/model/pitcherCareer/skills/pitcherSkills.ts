import { skillIdsOfBits } from '@/entities/team/model/teamRoster'
import { skillBitsOfIds } from '@/entities/team/model/recordAbility'
import { isSkillEquipped, setSkillEquipped } from '@/entities/career/model/playerCareer'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer/types/pitcherCareer'

/** 보유 비트(+0x1b8) — 0xa3a74. 엔딩 전설(0xa3ade)·칭호(0x1a1c0)처럼 **보유** 를 보는 곳이 쓴다 */
export function hasPitcherSkill(career: PitcherCareer, skillId: number): boolean {
  return career.skillIds.includes(skillId)
}

/**
 * 장착 비트(선수기록 +0x14) — 0xb62b4 / 0xa4bf8. 투수 경기의 스태미나 소모(0xa5e14 의 18·10)·마구 횟수
 * (0xaebe4 의 23)·실투(0x33cbc)·경기 뒤 사기 행운(0xa741c)·훈련 병아리/몹쓸몸(0x17f5c)이 이 칸을 본다.
 */
export function isPitcherSkillEquipped(career: Pick<PitcherCareer, 'equippedSkillIds'>, skillId: number): boolean {
  return isSkillEquipped(career, skillId)
}

/**
 * 장착 비트(선수기록 +0x14)를 스윙 판정 0xab214 의 **투수 스킬 번호**(비트 + 16)로 — 스킬 갈래(ab91c~)가 모드 검사 없이
 * `0xb62b4(투수, n)` 로 읽는다 (`skillIdsOfBits(비트, 투수)`). 나리 투수 · 미션(명전) 투수가 던지는 CPU 타석이 쓴다
 */
export function equippedPitcherSkillIdsOf(record: Pick<PitcherCareer, 'equippedSkillIds'>): readonly number[] {
  return skillIdsOfBits(skillBitsOfIds(record.equippedSkillIds), true)
}

/**
 * 장착 동작 0xa4b04(P, s, on) — 타자편 `setSkillEquipped` 를 그대로 탄다 (모드 3 도 같은 함수, 상한 0xd7e8e[P+0x1c6]).
 * ⚠️ 모드 3 은 켤 때 팀 칸 `0xb51fd(팀, 0)` 에도 켜는데(0xa4b7a) 끌 때는 기록만 끈다(0xa4b96) —
 *    그 칸이 기록(`[저장+0x3c]`)과 같은 칸인지 못 짚어 웹은 한 칸으로 둔다 (미해결, 모드 4 와 같은 물음).
 */
export function setPitcherSkillEquipped(career: PitcherCareer, skillId: number, on: boolean): PitcherCareer {
  return setSkillEquipped(career, skillId, on)
}

/** 마지막 공통 스킬 비트 — 0x8457c: 비트 ≤ 7 이면 두 편 같은 이름 */
const LAST_SHARED_SKILL_BIT = 7
/** 모드 3 은 비트 8 부터 이름 칸을 16 칸 밀어 읽는다 (StrCOMMON[0x47 + 비트] = [55 + (비트 + 16)]) */
const PITCHER_SKILL_TABLE_OFFSET = 16

/**
 * 투수 스킬 비트 → 표(skills.json·StrSKILL) 번호. 이름 함수 0x8457c(s):
 *   `s ≤ 7 → StrCOMMON[0x37 + s]` · 그 밖에 모드 4(0x7b970) 면 `[0x37 + s]`, 아니면 `[0x47 + s]`.
 */
export function pitcherSkillTableIdOf(skillBit: number): number {
  return skillBit <= LAST_SHARED_SKILL_BIT ? skillBit : skillBit + PITCHER_SKILL_TABLE_OFFSET
}
