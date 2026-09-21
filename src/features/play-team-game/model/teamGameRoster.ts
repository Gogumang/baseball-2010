import { TEAMS } from '@/shared/config/original/teams'
import { ROSTER_PITCHER_REPERTOIRES } from '@/shared/config/original/pitcherRepertoires'
import type { PitcherRepertoire } from '@/shared/config/original/pitcherRepertoires'
import {
  BATTERS_PER_TEAM,
  PITCHERS_PER_TEAM,
  teamBatters,
  teamPitchers,
} from '@/entities/team/model/teamRoster'
import type { QuickAtBatBatter, QuickAtBatPitcher } from '@/entities/game/model/quickAtBat'
import type { BatterAbility } from '@/entities/batting/model/batter'
import type { PitcherAbility } from '@/entities/pitching/model/pitch'
import { gameAbilitiesOf } from '@/features/play-team-game/model/gameAbilities'
import type {
  FieldingAssignment,
  SeasonTeamCondition,
} from '@/features/play-team-game/model/gameAbilities'

/**
 * 팀 경기에 서는 선수의 **경기용 능력치**를 만든다 (J-4 를 로스터 표에 먹이는 자리).
 *
 * 웹판 로스터(`shared/config/original/roster.ts`)는 이름·능력치 네 칸뿐인 붙박이 표라
 * 원본 선수 레코드의 보직(+0xb)·수비 자리(+0x1c)·스킬 비트(+0x14)가 없다. 그래서
 * **보직 불일치 −20% 의 입력은 부르는 쪽이 `lineup` 으로 넘긴다** — 엔트리 편집 화면
 * (0x55864, 아직 웹에 없다)이 생기면 그 화면이 채워 줄 자리다. 안 넘기면 벌점이 없다.
 */

/** XlsTEAM_DATA 한 줄의 u16 6개 중 뒤 4개가 팀 능력치다 (앞 둘은 id·100) */
const TEAM_ABILITY_OFFSET = 2

export interface TeamGameAbilityContext {
  /** 원본 게임 모드 (1 일반 · 2 시즌 · 8·9 대전) */
  readonly mode: number
  /** 시즌모드 내 팀 번호. 시즌이 아니면 −1 (그러면 내 팀 보정 셋이 아무 데도 안 붙는다) */
  readonly seasonTeamId: number
  /** 시즌 팀 질병·사기·코치 */
  readonly season?: SeasonTeamCondition
  /**
   * 팀별 능력치 네 칸 [투구, 타격, 집중, 근성].
   * 안 넘기면 XlsTEAM_DATA 값을 그대로 쓴다 (일반·대전모드는 트레이닝이 없어 늘 이 값이다).
   */
  readonly teamAbilities?: readonly (readonly number[])[]
  /** 내 팀 타순 칸(0~11)별 수비 자리·보직 — 보직 불일치 판정 입력 */
  readonly lineup?: readonly FieldingAssignment[]
}

function teamAbilitiesOf(context: TeamGameAbilityContext, teamId: number): readonly number[] {
  const given = context.teamAbilities?.[teamId]
  if (given !== undefined) return given
  return TEAMS[teamId]?.values.slice(TEAM_ABILITY_OFFSET) ?? []
}

/** 타자 한 명의 경기용 능력치 네 칸 — 히트·파워·수비·주루 */
export function batterGameAbilities(
  context: TeamGameAbilityContext,
  teamId: number,
  rosterSlot: number,
): [number, number, number, number] {
  const roster = teamBatters(teamId)
  const slot = ((rosterSlot % BATTERS_PER_TEAM) + BATTERS_PER_TEAM) % BATTERS_PER_TEAM
  const player = roster[slot]
  const isMyTeam = context.seasonTeamId === teamId
  return gameAbilitiesOf(player?.ability ?? [0, 0, 0, 0], {
    mode: context.mode,
    isPitcher: false,
    isMyTeam,
    teamAbilities: teamAbilitiesOf(context, teamId),
    season: context.season,
    assignment: isMyTeam ? context.lineup?.[slot] : undefined,
  })
}

/** 투수 한 명의 경기용 능력치 네 칸 — 제구·구속·변화·체력 */
export function pitcherGameAbilities(
  context: TeamGameAbilityContext,
  teamId: number,
  rosterSlot: number,
): [number, number, number, number] {
  const roster = teamPitchers(teamId)
  const slot = ((rosterSlot % PITCHERS_PER_TEAM) + PITCHERS_PER_TEAM) % PITCHERS_PER_TEAM
  const player = roster[slot]
  return gameAbilitiesOf(player?.ability ?? [0, 0, 0, 0], {
    mode: context.mode,
    isPitcher: true,
    isMyTeam: context.seasonTeamId === teamId,
    teamAbilities: teamAbilitiesOf(context, teamId),
    season: context.season,
  })
}

/** 간이 타석 엔진이 보는 타자 — 히트·파워·주루만 쓴다 */
export function quickBatterFor(
  context: TeamGameAbilityContext,
  teamId: number,
  battingOrderIndex: number,
): QuickAtBatBatter {
  const ability = batterGameAbilities(context, teamId, battingOrderIndex)
  return { hit: ability[0], power: ability[1], run: ability[3], skillIds: [] }
}

/** 간이 타석 엔진이 보는 투수 */
export function quickPitcherFor(
  context: TeamGameAbilityContext,
  teamId: number,
  rosterSlot: number,
): QuickAtBatPitcher {
  const ability = pitcherGameAbilities(context, teamId, rosterSlot)
  return { control: ability[0], velocity: ability[1], stamina: ability[3], skillIds: [] }
}

/** 타석 화면이 보는 타자 능력치 (0~999 그대로) */
export function stageBatterAbility(
  context: TeamGameAbilityContext,
  teamId: number,
  battingOrderIndex: number,
): BatterAbility {
  const ability = batterGameAbilities(context, teamId, battingOrderIndex)
  return { hit: ability[0], power: ability[1], defense: ability[2], run: ability[3] }
}

/** 원본 0~999 를 타석 화면의 0~100 눈금으로 (기존 화면들이 쓰는 것과 같은 나눗셈) */
const STAGE_ABILITY_DIVISOR = 10

/** 타석 화면이 보는 투수 능력치 (0~100 눈금) */
export function stagePitcherAbility(
  context: TeamGameAbilityContext,
  teamId: number,
  rosterSlot: number,
): PitcherAbility {
  const ability = pitcherGameAbilities(context, teamId, rosterSlot)
  const repertoire = rosterRepertoireOf(teamId, rosterSlot)
  return {
    control: Math.round(ability[0] / STAGE_ABILITY_DIVISOR),
    velocity: Math.round(ability[1] / STAGE_ABILITY_DIVISOR),
    breaking: Math.round(ability[2] / STAGE_ABILITY_DIVISOR),
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
  const slot = ((rosterSlot % PITCHERS_PER_TEAM) + PITCHERS_PER_TEAM) % PITCHERS_PER_TEAM
  const index = teamId * PITCHERS_PER_TEAM + slot
  return (
    ROSTER_PITCHER_REPERTOIRES[index] ??
    ROSTER_PITCHER_REPERTOIRES[0] ?? { name: '', form: 0, magicId: 0, pitchMask: 1 }
  )
}
