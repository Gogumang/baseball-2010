import {
  equippedPitcherAbilityOf,
  equippedPitcherSkillIdsOf,
  isPitcherSkillEquipped,
  pitcherFormOfCareer,
  pitcherRecordLineOf,
} from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import {
  DEFAULT_PITCHER_ROOKIE_PROFILE,
  pitcherFormOf,
  rookiePitcherAbilityOf,
  rookiePitchMaskOf,
} from '@/entities/pitcher-career/model/pitcherRegistration'
import type { HallOfFamePitcher } from '@/entities/collection/model/collection'
import type { PitcherAbility } from '@/entities/pitcher-career/model/pitcherAbility'
import { fatiguedStatsOf } from '@/features/play-pitcher-game/model/pitcherPitch'
import type { ModePitcher } from '@/app/model/modePitcher/modePitcherTypes'

/** 체력 100% — `stats` 는 피로 없는 값이다 */
const MISSION_STAMINA = 10000

/** 실투 판정이 보는 투수 비트 번호 (커리어 `equippedSkillIds` 는 투수 비트 번호로 든다 — pitcherGameOptions 와 같다) */
const STEADY_SKILL = 16
const TIMID_SKILL = 17
const COOL_SKILL = 22
const SPIRIT_SKILL = 23
/** 소모 0xa5e14 가 보는 투수 비트 (`pitcherGameOptions` 의 COWARD · ENDURE 와 같다) */
const COWARD_SKILL = 18
const ENDURE_SKILL = 10

function rookieModePitcher(): ModePitcher {
  // 등록 화면의 처음 값은 변화구가 비어 있다(0x10b18) — 커리어 없는 웹 대체 투수는 예전처럼 칸 0·1 을 준다
  const profile = { ...DEFAULT_PITCHER_ROOKIE_PROFILE, breakingPitchSlots: [0, 1] }
  const ability = rookiePitcherAbilityOf(profile.role, profile.typeIndex)
  return {
    stats: fatiguedStatsOf(ability, MISSION_STAMINA),
    ability,
    stamina: MISSION_STAMINA,
    staminaAbility: ability.stamina,
    isCoward: false,
    endures: false,
    repertoire: {
      pitchMask: rookiePitchMaskOf(profile.breakingPitchSlots),
      form: pitcherFormOf(profile.typeIndex, profile.handIndex),
      magicNumber: 0,
      isAce: false,
    },
    isSteady: false,
    isTimid: false,
    isCool: false,
    hasSpiritSkill: false,
    skillIds: [],
    skinIndex: profile.skinIndex,
  }
}

/** 선수 기록 한 장에서 미션 투수를 만든다 — 나리 투수(`[저장+0x3c]`)와 명전 투수(0x1f62c)가 같은 길이다 */
function modePitcherFromRecord(
  equippedAbility: PitcherAbility,
  repertoire: { readonly pitchMask: number; readonly form: number; readonly magicNumber: number },
  record: { readonly equippedSkillIds: readonly number[]; readonly equipmentLevels?: PitcherAbility },
  stamina: number,
  plate: ModePitcher['plate'],
  skinIndex: number,
  recordLine?: readonly number[],
): ModePitcher {
  return {
    skinIndex,
    ...(plate === undefined ? {} : { plate }),
    ...(recordLine === undefined ? {} : { recordLine }),
    ...(record.equipmentLevels === undefined ? {} : { equipmentLevels: record.equipmentLevels }),
    stats: fatiguedStatsOf(equippedAbility, MISSION_STAMINA),
    ability: equippedAbility,
    stamina,
    staminaAbility: equippedAbility.stamina,
    isCoward: isPitcherSkillEquipped(record, COWARD_SKILL),
    endures: isPitcherSkillEquipped(record, ENDURE_SKILL),
    repertoire: { ...repertoire, isAce: false },
    isSteady: isPitcherSkillEquipped(record, STEADY_SKILL),
    isTimid: isPitcherSkillEquipped(record, TIMID_SKILL),
    isCool: isPitcherSkillEquipped(record, COOL_SKILL),
    hasSpiritSkill: isPitcherSkillEquipped(record, SPIRIT_SKILL),
    skillIds: equippedPitcherSkillIdsOf(record),
  }
}

export function modePitcherOf(career: PitcherCareer | null): ModePitcher {
  if (career === null) return rookieModePitcher()
  return modePitcherFromRecord(
    equippedPitcherAbilityOf(career),
    { pitchMask: career.pitchMask, form: pitcherFormOfCareer(career), magicNumber: career.selectedMagicNumber },
    career,
    // 저장된 나리 투수의 +0x2c (`PitcherCareer.stamina`)
    career.stamina,
    { name: career.name, role: career.role },
    career.skinIndex,
    pitcherRecordLineOf(career.stats),
  )
}

/** 등록은 FASTBALL(1) 을 무조건 준다(`0xb6dfd(p, 1)`) — 구질 마스크가 없는 옛 명전 기록의 대체 */
const FASTBALL_ONLY_MASK = 1

/**
 * **명예 투수** — `0x1f62c(저장, +0xa5)` = 전역기록 +0x880 + i·0x30 의 기록. 0xb6414 · 0xb6d2c · 0xb62b4 를
 * 나리 투수와 똑같이 그 기록에 건다 (폼 = 0xb6e24 = 2×타입 + 손, 생김새 +0xb).
 * ⚠️ 옛 저장(기록 칸을 남기기 전에 등록한 선수): 장비 니블이 없으면 등록 때 남긴 0xb6415 값(`equippedAbility`)을 그대로,
 *    장착 비트가 없으면 스킬 없음, 구질 마스크가 없으면 직구만, 마구 번호가 없으면 0 — 원본 기록에는 늘 있는 칸이다.
 */
export function modePitcherOfHallOfFame(famer: HallOfFamePitcher): ModePitcher {
  const equippedSkillIds = famer.equippedSkillIds ?? []
  const equippedAbility =
    famer.equipmentLevels === undefined
      ? famer.equippedAbility
      : equippedPitcherAbilityOf({ ability: famer.ability, equipmentLevels: famer.equipmentLevels, equippedSkillIds })
  return modePitcherFromRecord(
    equippedAbility,
    {
      pitchMask: famer.pitchMask ?? FASTBALL_ONLY_MASK,
      form: pitcherFormOf(famer.look.typeIndex, famer.look.handIndex),
      magicNumber: famer.selectedMagicNumber ?? 0,
    },
    { equippedSkillIds, ...(famer.equipmentLevels === undefined ? {} : { equipmentLevels: famer.equipmentLevels }) },
    // 명전 기록 +0x2c — 등록 0x1f654 가 그때 투수 레코드를 통째 베낀 값(시즌 영입이면 0xc554 가 10000 으로 고친 값).
    // 옛 기록은 `normalizeCollection` 이 10000 으로 이사해 두지만, 이사를 안 거친 값(시험 등)도 같은 10000 으로 본다
    famer.stamina ?? MISSION_STAMINA,
    // ⚠️ 보직을 안 남긴 옛 명전 기록은 보직이 없다(판 없음) — 원본 기록에는 늘 있는 칸이다
    famer.role === undefined ? { name: famer.name } : { name: famer.name, role: famer.role },
    famer.look.skinIndex,
    famer.recordLine,
  )
}
