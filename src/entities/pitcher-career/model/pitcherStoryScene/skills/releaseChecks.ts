import { fightingValueOf } from '@/entities/pitcher-career/model/pitcherStoryScene/skills/careerReads'
import { PITCHER_SKILL, STARTER_ROLE } from '@/entities/pitcher-career/model/pitcherStoryScene/skills/pitcherSkills'
import { toInt16, toInt8, toUint8 } from '@/entities/pitcher-career/model/pitcherStoryScene/signedReads'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'

/** 몹쓸몸 · 유리몸 해제 — u8 S+0x75 > 5 (0xad9fc) · u8 S+0x76 > 7 (0xadb18) */
const BAD_BODY_RELEASE_ABOVE = 5
const FRAGILE_RELEASE_ABOVE = 7
/** 해제 카운터 +0x70+s 를 보는 칸 — 0xadad0~0xadb20 모드 3 갈래: 18 → +0x73 · 19 → +0x72 · 20 → +0x70 */
const PITCHER_RELEASE_STREAK_SLOT: Readonly<Record<number, number>> = { 18: 3, 19: 2, 20: 0 }
const RELEASE_STREAK_LIMIT = 7

/** 2 먹튀 (0xad9ce): s8 +0x1cd > 4 이고 s16 +0x1c0 / +0x1cd (0 쪽 버림, 0xca7b5) > 3 — ldrsb · ldrsh, 넘치면 음수로 읽힌다(원본 그대로) */
function releasesMoneyGrubber(career: PitcherCareer): boolean {
  const games = toInt8(career.moneyGrubberGames ?? 0)
  return games > 4 && Math.trunc(toInt16(career.moneyGrubberPopularityGain ?? 0) / games) > 3
}

/** 14 투지 (0xada22 모드 3): 연차idx > 2 → 작년(y−1) 보직 0 이면 승 ≤ 6, 아니면 세이브 + 승 ≤ 10 */
function releasesFightingSpirit(career: PitcherCareer): boolean {
  const yearIndex = career.season - 1
  if (yearIndex <= 2) return false
  return fightingValueOf(career, yearIndex - 1) <= (career.role === STARTER_ROLE ? 6 : 10)
}

/** 18·19·20 — 해제 카운터 +0x70+칸 > 7 (훈련 0x18a80: 그 스킬을 **가진 채** 그 칸만 연달아 8번) */
const releasesByStreak = (slot: number) => (career: PitcherCareer) => (career.releaseTrainingStreaks[slot] ?? 0) > RELEASE_STREAK_LIMIT

/** 조건 21 하위 표 0xd8454 의 투수 갈래 (스킬 → 판정). 표에 없는 6~13 · 15 · 16 · 17 은 0xadc34 (통과) */
export const RELEASE_CHECKS: Readonly<Record<number, (career: PitcherCareer) => boolean>> = {
  [PITCHER_SKILL.먹튀]: releasesMoneyGrubber,
  // 5 무력감 (0xada0e): s8 +0x1c7 > 5
  [PITCHER_SKILL.무력감]: (career) => (career.highMoraleStreak ?? 0) > 5,
  // 3 몹쓸몸 (0xad9f6): u8 S+0x75 > 5 · 4 유리몸 (0xada06 → 0xadb18): u8 S+0x76 > 7 — 가진 채 이어 한 훈련 수 (0x18b86)
  [PITCHER_SKILL.몹쓸몸]: (career) => toUint8(career.badBodyTrainings ?? 0) > BAD_BODY_RELEASE_ABOVE,
  [PITCHER_SKILL.유리몸]: (career) => toUint8(career.fragileTrainings ?? 0) > FRAGILE_RELEASE_ABOVE,
  ...Object.fromEntries(Object.entries(PITCHER_RELEASE_STREAK_SLOT).map(([skill, slot]) => [skill, releasesByStreak(slot)])),
  [PITCHER_SKILL.투지]: releasesFightingSpirit,
}
