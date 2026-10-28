import type { PitcherAbility } from '@/entities/pitching/model/pitch'
import { entryPitcherGameAbilityParts, NO_ACE_BATTER, teamPitcherSkinIndexOf } from '@/features/play-team-game/model/teamGameRoster'
import { staminaPercentOf } from '@/entities/pitcher-career/model/pitcherStamina'
import { type PitcherStats, type PitchSlot, pitchSlotsOf } from '@/features/play-pitcher-game/model/pitcherPitch'
import { pitcherAbilityContextOf } from '@/features/play-team-game/model/teamGameFlow/context/abilityContext'
import { entryPitcherSkillIdsOf } from '@/features/play-team-game/model/teamGameFlow/roster/batters'
import { pitcherAbilitiesAt, pitcherEntryAt, pitcherRepertoireAt } from '@/features/play-team-game/model/teamGameFlow/roster/pitchers'
import { opponentStaminaAfterPitch } from '@/features/play-team-game/model/teamGameFlow/stamina/opponentPitch'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/** 원본 0~999 를 타석 화면의 0~100 눈금으로 (다른 화면들이 쓰는 것과 같은 나눗셈) */
const STAGE_PITCHER_DIVISOR = 10

/**
 * 지금 우리 타자를 상대하는 투수의 경기용 능력치 (0~100 눈금).
 *
 * 투구 AI·스윙 판정은 0~100 칸 대신 `gameAbility`·`staminaPercent` 로 원본 눈금을 다시 낸다 — 사람 타석의
 * 0x34968·0x4dbac·0xab214(ab548·ab582)는 수비 투수를 `0xb570c(…, [sp] = 체력% 0xaebb0)` 로 불러 시즌 내 팀 보정 →
 * **피로 0xb58e6** → 팀 능력치·코치 정액 차례로 먹인다 (45f5d4a). 체력%는 그 투수 레코드 +0x2c / 100.
 */
export function currentPitcherAbility(progress: TeamGameProgress): PitcherAbility {
  const teamId = progress.options.opponentTeamId
  const slot = progress.opponentPitcherIndex
  const ability = pitcherAbilitiesAt(progress, teamId, slot)
  const repertoire = pitcherRepertoireAt(progress, teamId, slot)
  const entry = pitcherEntryAt(progress, teamId, slot)
  return {
    control: Math.round(ability[0] / STAGE_PITCHER_DIVISOR),
    velocity: Math.round(ability[1] / STAGE_PITCHER_DIVISOR),
    breaking: Math.round(ability[2] / STAGE_PITCHER_DIVISOR),
    ...(entry === undefined ? {} : { gameAbility: entryPitcherGameAbilityParts(pitcherAbilityContextOf(progress), teamId, entry) }),
    staminaPercent: staminaPercentOf(progress.opponentStamina),
    // 공이 손을 떠나는 0x11 진입(0x3dec6 → 0xa5e14)에서 깎은 뒤 체력을 놓기 0x4dc78 · 스윙 0xab214 가 본다 — 깎는 셈은
    // 진행기(`throwOpponentPitch`)와 같은 것이고, 화면이 판정된 공을 넘기면 진행기가 같은 값으로 깎는다
    staminaPercentAfterPitch: (pitchTypeNumber) => staminaPercentOf(opponentStaminaAfterPitch(progress, pitchTypeNumber)),
    repertoire: {
      form: repertoire.form,
      pitchMask: repertoire.pitchMask,
      magicId: repertoire.magicId,
    },
    // 레코드 +0x14 — 실투 판정 0x33cbc 의 투수 비트 16 · 17 · 22 (`TeamEntryPitcher.skillBits`, 마투수는 제 행)
    ...(entry?.skillBits === undefined ? {} : { skillBits: entry.skillBits }),
    // 사람 타석 스윙 0xab214 의 투수 스킬 — 마투수는 제 행 (`entryPitcherSkillIdsOf`)
    skillIds: entryPitcherSkillIdsOf(entry),
  }
}

/**
 * 사람 타석의 CPU 투수가 구질을 고를 때 볼 마구 상태 — 상대 팀+0x28 과 경기에 하나뿐인 공+0x10.
 * 타석 화면(`BattingStage.cpuMagic`)에 넘기면 화면이 따로 상태를 세우지 않는다.
 */
export function opponentMagicStateOf(progress: TeamGameProgress): {
  readonly remaining: number
  readonly ballMagicNumber: number
} {
  return { remaining: progress.opponentMagicRemaining, ballMagicNumber: progress.ballMagicNumber }
}

/** 지금 마운드에 선 상대 투수가 마투수면 `ACE_PITCHERS` 칸 0~4, 아니면 −1 */
export function currentPitcherAceIndex(progress: TeamGameProgress): number {
  return pitcherEntryAt(progress, progress.options.opponentTeamId, progress.opponentPitcherIndex)?.aceIndex ?? NO_ACE_BATTER
}

/**
 * **사람 타석 마운드의 상대 투수 장비 니블** — 레코드 +0x19 · +0x1a 네 칸(`TeamEntryPitcher.equipment`). 타석 교대 0x47cc8 이
 * 마운드 그림(장면 +0xf1c)을 다시 실을 때 0xae83c(수비 팀)가 마투수(0xb633c)가 아니면 48138~4816a 가 이 니블 − 1 로 장비 겹
 * 0x79790 을 부른다(모드를 안 가린다). 표 줄은 Xls 행(외인구단 팀 14 는 제구 니블 3) · 시즌 CPU 명단 니블(0x665e8) ·
 * 기록으로 선 영입 투수는 기록 사본의 니블이다. 마투수면 undefined(그림은 0x793b0 의 ace/pitcher_*)
 */
export function currentPitcherEquipment(progress: TeamGameProgress): readonly number[] | undefined {
  const entry = pitcherEntryAt(progress, progress.options.opponentTeamId, progress.opponentPitcherIndex)
  if (entry === undefined || entry.aceIndex >= 0) return undefined
  return entry.equipment
}

/** 사람 타석 마운드의 상대 투수 피부 (`teamPitcherSkinIndexOf` — 0x47cc8 의 482c0~482fc → 0x793b0 의 794c2) */
export function currentPitcherSkinIndex(progress: TeamGameProgress): number {
  const teamId = progress.options.opponentTeamId
  return teamPitcherSkinIndexOf(teamId, pitcherEntryAt(progress, teamId, progress.opponentPitcherIndex))
}

/** 우리 선발 투수의 경기용 능력치 (제구·구속·변화·체력) */
export function ourPitcherStats(progress: TeamGameProgress): PitcherStats {
  const ability = pitcherAbilitiesAt(progress, progress.options.ourTeamId, progress.ourPitcherIndex)
  return { control: ability[0], velocity: ability[1], breaking: ability[2], stamina: ability[3] }
}

/** 고를 수 있는 구질 칸 여섯 (0xb6d2c) */
export function pitchSlotsFor(progress: TeamGameProgress): readonly PitchSlot[] {
  const repertoire = pitcherRepertoireAt(progress, progress.options.ourTeamId, progress.ourPitcherIndex)
  return pitchSlotsOf({
    pitchMask: repertoire.pitchMask,
    form: repertoire.form,
    magicNumber: repertoire.magicId,
  })
}
