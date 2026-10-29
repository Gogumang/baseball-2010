import { ROSTER_PITCHER_REPERTOIRES } from '@/shared/config/original/pitcherRepertoires'
import type { PitcherRepertoire } from '@/shared/config/original/pitcherRepertoires'
import { BATTERS_PER_TEAM, PITCHERS_PER_TEAM, skillIdsOfBits, teamBatters, teamPitchers } from '@/entities/team/model/teamRoster'
import type { QuickAtBatBatter, QuickAtBatPitcher } from '@/entities/game/model/quickAtBat'
import type { BatterAbility } from '@/entities/batting/model/batter'
import type { PitcherAbility } from '@/entities/pitching/model/pitch'
import type { PitcherGameAbilityParts } from '@/entities/pitching/model/pitcherGameStats'
import { gameAbilitiesOf, pitcherGameAbilityPartsOf } from '@/features/play-team-game/model/gameAbilities'
import {
  pitcherFightingSpiritOf,
  rowAbilityOf,
  teamAbilitiesOf,
  type TeamGameAbilityContext,
} from '@/features/play-team-game/model/teamGameRoster/abilityContext'

/** 로스터 칸 번호를 팀 인원 안으로 감는다 — 음수 · 넘친 번호도 나머지로 (타순 첨자를 그대로 넘기는 곳이 있다) */
function wrappedSlotOf(slot: number, size: number): number {
  return ((slot % size) + size) % size
}

/** 타자 한 명의 경기용 능력치 네 칸 — 히트·파워·수비·주루 */
export function batterGameAbilities(context: TeamGameAbilityContext, teamId: number, rosterSlot: number): [number, number, number, number] {
  const roster = teamBatters(teamId)
  const slot = wrappedSlotOf(rosterSlot, BATTERS_PER_TEAM)
  const player = roster[slot]
  const isMyTeam = context.seasonTeamId === teamId
  return gameAbilitiesOf(rowAbilityOf(player, false), {
    mode: context.mode,
    isPitcher: false,
    isMyTeam,
    teamAbilities: teamAbilitiesOf(context, teamId),
    season: context.season,
    assignment: isMyTeam ? context.lineup?.[slot] : undefined,
  })
}

/** 투수 한 명의 경기용 능력치 네 칸 — 제구·구속·변화·체력 */
export function pitcherGameAbilities(context: TeamGameAbilityContext, teamId: number, rosterSlot: number): [number, number, number, number] {
  const roster = teamPitchers(teamId)
  const slot = wrappedSlotOf(rosterSlot, PITCHERS_PER_TEAM)
  const player = roster[slot]
  return gameAbilitiesOf(rowAbilityOf(player, true), {
    mode: context.mode,
    isPitcher: true,
    isMyTeam: context.seasonTeamId === teamId,
    teamAbilities: teamAbilitiesOf(context, teamId),
    season: context.season,
    fightingSpirit: pitcherFightingSpiritOf(context, teamId, player?.skillBits),
  })
}

/** 간이 타석 엔진이 보는 타자 — 히트·파워·주루만 쓴다 */
export function quickBatterFor(context: TeamGameAbilityContext, teamId: number, battingOrderIndex: number): QuickAtBatBatter {
  const ability = batterGameAbilities(context, teamId, battingOrderIndex)
  const roster = teamBatters(teamId)
  const slot = wrappedSlotOf(battingOrderIndex, BATTERS_PER_TEAM)
  const player = roster[slot]
  // 장착 스킬 — 0xab214 ab91c~ 가 `0xb62b4(타자, n)` 로 레코드 비트를 읽는다(모드 검사 없음).
  // 레코드 칸 0xb6394 = Xls 행 +0xa & 0x1f = 붙박이 칸 (`batterAt` 주석)
  return { hit: ability[0], power: ability[1], run: ability[3], skillIds: skillIdsOfBits(player?.skillBits ?? 0, false), recordSlot: slot }
}

/** 간이 타석 엔진이 보는 투수 */
export function quickPitcherFor(context: TeamGameAbilityContext, teamId: number, rosterSlot: number): QuickAtBatPitcher {
  const ability = pitcherGameAbilities(context, teamId, rosterSlot)
  const roster = teamPitchers(teamId)
  const player = roster[wrappedSlotOf(rosterSlot, PITCHERS_PER_TEAM)]
  // 장착 스킬 — `0xb62b4(투수, n)` (투수 번호 = 비트 + 16)
  return { control: ability[0], velocity: ability[1], stamina: ability[3], skillIds: skillIdsOfBits(player?.skillBits ?? 0, true) }
}

/** 타석 화면이 보는 타자 능력치 (0~999 그대로) */
export function stageBatterAbility(context: TeamGameAbilityContext, teamId: number, battingOrderIndex: number): BatterAbility {
  const ability = batterGameAbilities(context, teamId, battingOrderIndex)
  return { hit: ability[0], power: ability[1], defense: ability[2], run: ability[3] }
}

/** 원본 0~999 를 타석 화면의 0~100 눈금으로 (기존 화면들이 쓰는 것과 같은 나눗셈) */
const STAGE_ABILITY_DIVISOR = 10

/** 투수 한 명의 제구·구속·변화를 피로(0xb58e6) 앞뒤로 쪼갠 재료 — `pitcherGameAbilities` 와 같은 보정 */
export function pitcherGameAbilityParts(context: TeamGameAbilityContext, teamId: number, rosterSlot: number): PitcherGameAbilityParts {
  const roster = teamPitchers(teamId)
  const slot = wrappedSlotOf(rosterSlot, PITCHERS_PER_TEAM)
  return pitcherGameAbilityPartsOf(rowAbilityOf(roster[slot], true), {
    mode: context.mode,
    isMyTeam: context.seasonTeamId === teamId,
    teamAbilities: teamAbilitiesOf(context, teamId),
    season: context.season,
    fightingSpirit: pitcherFightingSpiritOf(context, teamId, roster[slot]?.skillBits),
  })
}

/**
 * 타석 화면이 보는 투수 능력치 (0~100 눈금) — 투구 AI 는 그 대신 `gameAbility`(0xb570c 의 피로 앞 값 ·
 * 피로 뒤 팀·코치 정액)와 `staminaPercent`(0xaebb0) 로 원본 눈금 값을 다시 낸다 (`cpuPitchStatsOf`).
 * 체력%를 안 넘기면 지치지 않은 것으로 본다.
 */
export function stagePitcherAbility(context: TeamGameAbilityContext, teamId: number, rosterSlot: number, staminaPercent?: number): PitcherAbility {
  const ability = pitcherGameAbilities(context, teamId, rosterSlot)
  const repertoire = rosterRepertoireOf(teamId, rosterSlot)
  return {
    control: Math.round(ability[0] / STAGE_ABILITY_DIVISOR),
    velocity: Math.round(ability[1] / STAGE_ABILITY_DIVISOR),
    breaking: Math.round(ability[2] / STAGE_ABILITY_DIVISOR),
    gameAbility: pitcherGameAbilityParts(context, teamId, rosterSlot),
    ...(staminaPercent === undefined ? {} : { staminaPercent }),
    repertoire: {
      form: repertoire.form,
      pitchMask: repertoire.pitchMask,
      magicId: repertoire.magicId,
    },
  }
}

/**
 * 로스터 투수의 구질 표 — `ROSTER_PITCHER_REPERTOIRES` 는 `PITCHERS` 와 **같은 순서**라
 * 전역 번호(`팀 × 8 + 칸`)로 바로 꺼낸다.
 */
export function rosterRepertoireOf(teamId: number, rosterSlot: number): PitcherRepertoire {
  const slot = wrappedSlotOf(rosterSlot, PITCHERS_PER_TEAM)
  const index = teamId * PITCHERS_PER_TEAM + slot
  return ROSTER_PITCHER_REPERTOIRES[index] ?? ROSTER_PITCHER_REPERTOIRES[0] ?? { name: '', form: 0, magicId: 0, pitchMask: 1 }
}
