import { type TeamEntryPitcher, entryPitcherGameAbilities } from '@/features/play-team-game/model/teamGameRoster'
import type { PitcherRepertoire } from '@/shared/config/original/pitcherRepertoires'
import { pitcherAbilityContextOf } from '@/features/play-team-game/model/teamGameFlow/context/abilityContext'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/**
 * 한 팀의 **투수 명단** — 타자 명단과 짝을 이루는 원본 `team+0x00` 목록이다 (0xb8950).
 * 0번이 선발, 1번부터가 벤치이고, 마투수가 있으면 8번에 앉아 있다 (`PITCHER_ENTRY_ACE_SLOT`).
 */
export function pitcherEntriesOf(progress: TeamGameProgress, teamId: number): readonly TeamEntryPitcher[] {
  return teamId === progress.options.ourTeamId ? progress.ourPitcherEntry : progress.opponentPitcherEntry
}

/** 투수 명단 한 칸 — 없는 칸이면 0번(선발)으로 떨어진다 */
export function pitcherEntryAt(progress: TeamGameProgress, teamId: number, slot: number): TeamEntryPitcher | undefined {
  const entry = pitcherEntriesOf(progress, teamId)
  return entry[slot] ?? entry[0]
}

/** 0xa5f30 `movs r1, #0x12` — 투수 스킬 18 비겁자 */
const COWARD_SKILL_BIT = 18

/** 0xa5f52 `movs r1, #0xa` — 투수 스킬 10 끈기 */
const ENDURE_SKILL_BIT = 10

/**
 * 공 하나 소모 0xa5e14 의 투수 비트 — `0xb62b4(0xae83c(수비 팀), 18)`(a5f32 비겁자 ×2) · `(…, 10)`(a5f56 끈기 −1).
 * 그 칸 레코드 +0x14 (`TeamEntryPitcher.skillBits` — 붙박이 줄은 Xls 행 그대로, 마투수는 XlsACE_PIT 행).
 */
export function pitcherSkillFlagsAt(
  progress: TeamGameProgress,
  teamId: number,
  slot: number,
): { readonly pitcherIsCoward: boolean; readonly pitcherEndures: boolean } {
  const bits = pitcherEntryAt(progress, teamId, slot)?.skillBits ?? 0
  return {
    pitcherIsCoward: ((bits >>> COWARD_SKILL_BIT) & 1) === 1,
    pitcherEndures: ((bits >>> ENDURE_SKILL_BIT) & 1) === 1,
  }
}

/** 실투 판정 0x33cbc 의 투수 비트 — 33d7a 16 안정감 · 33daa 17 새가슴 · 33dce 22 냉정 */
export function mistakeSkillFlagsOf(bits: number): {
  readonly pitcherIsSteady: boolean
  readonly pitcherIsTimid: boolean
  readonly pitcherIsCool: boolean
} {
  return {
    pitcherIsSteady: ((bits >>> 16) & 1) === 1,
    pitcherIsTimid: ((bits >>> 17) & 1) === 1,
    pitcherIsCool: ((bits >>> 22) & 1) === 1,
  }
}

/** 투수 명단 한 칸의 경기용 능력치 네 칸 (제구·구속·변화·체력) */
export function pitcherAbilitiesAt(progress: TeamGameProgress, teamId: number, slot: number): readonly number[] {
  const entry = pitcherEntryAt(progress, teamId, slot)
  if (entry === undefined) return [0, 0, 0, 0]
  return entryPitcherGameAbilities(pitcherAbilityContextOf(progress), teamId, entry)
}

/** 투수 명단 한 칸의 구질 표 (폼·마구·보유 구질) */
export function pitcherRepertoireAt(progress: TeamGameProgress, teamId: number, slot: number): PitcherRepertoire {
  return (
    pitcherEntryAt(progress, teamId, slot)?.repertoire ?? {
      name: '',
      form: 0,
      magicId: 0,
      pitchMask: 1,
    }
  )
}

/** 상대 투수의 체력 능력치 (칸 3) — 스태미나 용량 X 의 바탕 */
export function opponentPitcherStaminaAbility(progress: TeamGameProgress): number {
  return pitcherAbilitiesAt(progress, progress.options.opponentTeamId, progress.opponentPitcherIndex)[3]
}
