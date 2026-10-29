import {
  averageEquippedPitcherAbilityOf,
  fightingValueOf,
  inningsOf,
  isLeftHandedPitcher,
  mvpSeasonCountOf,
  pitcherSavesPlusWinsOf,
  seasonTrainingByteCountOf,
} from '@/entities/pitcher-career/model/pitcherStoryScene/skills/careerReads'
import { PITCHER_SKILL, STARTER_ROLE, wasRemoved } from '@/entities/pitcher-career/model/pitcherStoryScene/skills/pitcherSkills'
import { toInt16, toInt8 } from '@/entities/pitcher-career/model/pitcherStoryScene/signedReads'
import { equippedPitcherAbilityOf } from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { PITCHER_ABILITY_NAMES } from '@/entities/pitcher-career/model/pitcherAbility'
import { seasonPitcherTrainingTotalOf } from '@/entities/pitcher-career/model/pitcherManagement'
import type { RandomPort } from '@/shared/api/random/randomPort'

/** 먹튀 얻기 — 연차idx > 1 이고 g == 14 에서 +0x1c2 ≤ 15 · g == 32 에서 ≤ 35 (0xad2a2~) */
const MONEY_GRUBBER_YEAR_ABOVE = 1
/** 몹쓸몸 · 유리몸 얻기 — 실효 능력치 넷 평균 상한 `0xaf << 2` (0xad324 · 0xad3f2) */
const WEAK_BODY_AVERAGE_LIMIT = 700
/** 무력감 얻기 — 사기 ≤ 20 · 연차idx > 2 · rand(0,100) > 69 (0xad43a~0xad46e) */
const HELPLESS_MORALE_LIMIT = 20
const HELPLESS_YEAR_ABOVE = 2
const HELPLESS_ROLL_ABOVE = 69
const PERCENT_ROLL = 100
/** 깃털이 보는 훈련 칸 2(변화) */
const BREAKING_MENU_ID = PITCHER_ABILITY_NAMES[2]

const yearIndexOf = (career: PitcherCareer) => career.season - 1
/** 실효 능력치 넷 평균이 상한 안 — 몹쓸몸 · 유리몸 공통 관문 */
const isWeakBodied = (career: PitcherCareer) => averageEquippedPitcherAbilityOf(career) <= WEAK_BODY_AVERAGE_LIMIT

/** 하위 표 0xd8408 의 투수 갈래 하나 — 무작위는 무력감만 굴린다 */
type AcquireCheck = (career: PitcherCareer, random: RandomPort | undefined) => boolean

/** 0xad2a2: 0xa4f31(S, 2) 해제했으면 불발 · s16 +0x1c2(이번 시즌 인기도 변화 합) — 두 편 공용 식 */
function acquiresMoneyGrubber(career: PitcherCareer): boolean {
  if (wasRemoved(career, PITCHER_SKILL.먹튀) || yearIndexOf(career) <= MONEY_GRUBBER_YEAR_ABOVE) return false
  const gain = toInt16(career.seasonPopularityGain)
  const g = career.gamesPlayed
  return (g === 14 && gain <= 15) || (g === 32 && gain <= 35)
}

/**
 * 0xad2e6: 0xa4f31(S, 3) 해제했으면 불발 → 평균실효 ≤ 700 → (g == 12 && T == 0) | (g == 28 && T ≤ 1) | (g == 42 && T ≤ 2)
 * 모드 갈림이 없다 — 레코드만 0x1fc75(저장, [r6+8] 모드) 로 그 편 것을 읽는다
 */
function acquiresBadBody(career: PitcherCareer): boolean {
  if (wasRemoved(career, PITCHER_SKILL.몹쓸몸) || !isWeakBodied(career)) return false
  const t = seasonPitcherTrainingTotalOf(career)
  const g = career.gamesPlayed
  return (g === 12 && t === 0) || (g === 28 && t <= 1) || (g === 42 && t <= 2)
}

/** 0xad3ac: 0xa4f31(S, 4) → 연차idx > 0([sp+8], 0xad3be) → 평균실효 ≤ 700 → (g == 18 && T ≤ 2) | (g == 38 && T ≤ 4) */
function acquiresFragile(career: PitcherCareer): boolean {
  if (wasRemoved(career, PITCHER_SKILL.유리몸) || yearIndexOf(career) <= 0 || !isWeakBodied(career)) return false
  const t = seasonPitcherTrainingTotalOf(career)
  const g = career.gamesPlayed
  return (g === 18 && t <= 2) || (g === 38 && t <= 4)
}

/**
 * 0xad53c(12) · 0xad5c8(13): 0xb63c0(내 레코드)가 12 는 거짓 · 13 은 참이어야 → 통산 (+0xe 승) + (+4 세이브) 가
 * 보직 0(0xb6705) 이면 ≥ 120, 아니면 ≥ 200
 */
function acquiresHandUp(career: PitcherCareer, needsLeftHanded: boolean): boolean {
  if (isLeftHandedPitcher(career) !== needsLeftHanded) return false
  return pitcherSavesPlusWinsOf(career) >= (career.role === STARTER_ROLE ? 120 : 200)
}

/** 0xad668: 연차idx > 2 → 지난 세 해(y−3 · y−2 · y−1) 모두 보직 0 이면 승 ≥ 15, 아니면 세이브 + 승 ≥ 20 */
function acquiresFightingSpirit(career: PitcherCareer): boolean {
  const yearIndex = yearIndexOf(career)
  if (yearIndex <= 2) return false
  const limit = career.role === STARTER_ROLE ? 15 : 20
  return [3, 2, 1].every((back) => fightingValueOf(career, yearIndex - back) >= limit)
}

/** 0xad43a: 해제 기록 → 사기(0xa3a25) ≤ 20 → 연차idx > 2 → rand(0,100) 굴림 (앞이 막히면 안 굴린다) */
function rollHelpless(career: PitcherCareer, random: RandomPort | undefined): boolean {
  if (wasRemoved(career, PITCHER_SKILL.무력감) || career.morale > HELPLESS_MORALE_LIMIT || yearIndexOf(career) <= HELPLESS_YEAR_ABOVE) return false
  return random !== undefined && random.rand(0, PERCENT_ROLL) > HELPLESS_ROLL_ABOVE
}

/** 0xad7ec: 이닝 = 통산 +0(아웃)/3 · 보직 0(0xb6705) 이면 ≥ 500, 아니면 ≥ 400 · 그리고 통산 +6(탈삼진) ≥ 200 */
function acquiresStability(career: PitcherCareer): boolean {
  const innings = inningsOf(career.careerStats.outs)
  const strikeouts = toInt16(career.careerStats.strikeouts)
  return innings >= (career.role === STARTER_ROLE ? 500 : 400) && strikeouts >= 200
}

/** 0xad842 → 0xad89a: 이번 시즌 기록 +0x20(아웃)/3 이 g == 16 에서 ≤ 14 · g == 36 에서 ≤ 32 */
function acquiresCoward(career: PitcherCareer): boolean {
  if (wasRemoved(career, PITCHER_SKILL.비겁자)) return false
  const innings = inningsOf(career.stats.outs)
  if (career.gamesPlayed === 16) return innings <= 14
  return career.gamesPlayed === 36 && innings <= 32
}

/** 0xad8c8 → 0xad91a: 연차idx > 2 · 0xb6415(기록, 2, 1) ≤ 500 (변화 실효) · g == 30 · 이번 시즌 칸 2 훈련 0 */
function acquiresFeather(career: PitcherCareer): boolean {
  if (wasRemoved(career, PITCHER_SKILL.깃털)) return false
  return (
    yearIndexOf(career) > 2 &&
    equippedPitcherAbilityOf(career).breaking <= 500 &&
    career.gamesPlayed === 30 &&
    seasonTrainingByteCountOf(career, BREAKING_MENU_ID) === 0
  )
}

/**
 * 조건 20 하위 표 0xd8408 의 투수 갈래 (스킬 → 판정). 표에 없는 6 행운 · 8 의외성 · 9 베테랑 · 15(투수 31 집중, 0xad794 모드 ≠ 4 통과) ·
 * 17 하락세 는 추가 조건 없이 통과
 */
export const ACQUIRE_CHECKS: Readonly<Record<number, AcquireCheck>> = {
  [PITCHER_SKILL.먹튀]: acquiresMoneyGrubber,
  [PITCHER_SKILL.몹쓸몸]: acquiresBadBody,
  [PITCHER_SKILL.유리몸]: acquiresFragile,
  // 0xad474 (모드 갈림 없음): s8 +0x7a(정규시즌 1위 횟수) ≥ 8 이고 0xa4d51(+0x1ca MVP 비트 수) > 6
  [PITCHER_SKILL.전설]: (career) => toInt8(career.regularSeasonFirstCount) >= 8 && mvpSeasonCountOf(career.mvpSeasonBits) > 6,
  [PITCHER_SKILL.좌타UP]: (career) => acquiresHandUp(career, false),
  [PITCHER_SKILL.우타UP]: (career) => acquiresHandUp(career, true),
  [PITCHER_SKILL.투지]: acquiresFightingSpirit,
  [PITCHER_SKILL.무력감]: rollHelpless,
  // 0xad4ac: 0xb6415(기록, 3, 1) > 599 (체력 실효) 이고 통산 +8(투구 수) ≥ 6000
  [PITCHER_SKILL.끈기]: (career) => equippedPitcherAbilityOf(career).stamina > 599 && toInt16(career.careerStats.pitches) >= 6000,
  // 0xad4f8: 통산 +6(탈삼진) ≥ 500
  [PITCHER_SKILL.닥터K]: (career) => toInt16(career.careerStats.strikeouts) >= 500,
  [PITCHER_SKILL.안정감]: acquiresStability,
  [PITCHER_SKILL.비겁자]: acquiresCoward,
  [PITCHER_SKILL.깃털]: acquiresFeather,
  // 0xad93a: 해제 기록만 보고, 모드 ≠ 4 는 곧 통과 (0xad952)
  [PITCHER_SKILL.더티볼]: (career) => !wasRemoved(career, PITCHER_SKILL.더티볼),
}
