import { ACE_PITCHER_REPERTOIRES } from '@/shared/config/original/pitcherRepertoires'
import { teamPitchers } from '@/entities/team/model/teamRoster'
import { ACE_PITCHERS } from '@/entities/game/model/aceOpponent'
import { rosterPitcherRoleOf } from '@/entities/pitching/model/pitcherChange'
import type { PitcherGameAbilityParts } from '@/entities/pitching/model/pitcherGameStats'
import { gameAbilitiesOf, pitcherGameAbilityPartsOf } from '@/features/play-team-game/model/gameAbilities'
import {
  pitcherFightingSpiritOf,
  rowAbilityOf,
  teamAbilitiesOf,
  type TeamGameAbilityContext,
} from '@/features/play-team-game/model/teamGameRoster/abilityContext'
import { aceLeveledAbility } from '@/features/play-team-game/model/teamGameRoster/aceLevel'
import { rosterRepertoireOf } from '@/features/play-team-game/model/teamGameRoster/rosterAbilities'
import { NO_ACE_BATTER, PITCHER_ENTRY_ACE_SLOT, type TeamEntryPitcher } from '@/features/play-team-game/model/teamGameRoster/entryTypes'

/**
 * **마운드 투수 그림의 피부** `(rec[0xb] >> 2) & 3` — 타석 교대 0x47cc8 의 482c0~482fc 가 마운드 그림 적재 0x793b0 에 넘겨 794c2 가
 * `pitcher.pzx` 를 피부 × 15 + 수비 팀 벌로 연다. 붙박이 표 칸(`tableSlot` · `tableTeamId`)이면 그 Xls 행의 +0xb 다.
 * ⚠️ 표 밖 투수(영입한 명전·나리 기록 사본)는 명단에 +0xb 칸이 없어 0(구운 벌과 같은 피부)으로 둔다. 마투수는 ace/pitcher_* 라 안 쓴다
 */
export function teamPitcherSkinIndexOf(teamId: number, entry: TeamEntryPitcher | undefined): number {
  if (entry === undefined || entry.aceIndex >= 0 || entry.tableSlot === undefined) return 0
  const row = teamPitchers(entry.tableTeamId ?? teamId)[entry.tableSlot]
  return row === undefined ? 0 : (row.profile >> 2) & 3
}

/** 로스터 투수 여덟을 그대로 명단으로 — 0번이 선발, 1~7 이 벤치다 */
export function rosterEntryPitchersOf(teamId: number): readonly TeamEntryPitcher[] {
  return teamPitchers(teamId).map((player, slot) => ({
    name: player.name,
    ability: rowAbilityOf(player, true),
    equipment: player.equipment,
    repertoire: rosterRepertoireOf(teamId, slot),
    aceIndex: NO_ACE_BATTER,
    orderIndex: slot,
    role: rosterPitcherRoleOf(slot),
    tableSlot: slot,
    skillBits: player.skillBits,
  }))
}

/**
 * 고른 **마투수를 8번 칸에 끼워 넣는다** — `0xb88c8` → `0xb521c` 의 `0x60` 가지 (위 상수 주석).
 * 성공하면 원본은 `team+0x26` 과 **벤치 투수 수 `team+0x33`** 을 하나씩 올린다 (`b88f6~b8906`) —
 * 웹은 벤치 칸을 명단 길이에서 셈하므로 그 둘을 따로 들지 않는다.
 *
 * 마투수 능력치 네 칸의 뜻은 로스터 투수와 같다 — 레코드 `+0xc` 부터 u16 넷이고 **제구·구속·변화·체력**
 * 이다 (`XlsACE_PIT_DATA` 싸이커 줄 `9e 02 26 02 34 03 2c 01` = 670·550·820·300 이 웹
 * `acePlayers` 의 hit·power·defense·run 과 차례까지 같다).
 */
export function withAcePitcher(entry: readonly TeamEntryPitcher[], aceIndex: number): readonly TeamEntryPitcher[] {
  const ace = ACE_PITCHERS[aceIndex]
  if (ace === undefined) return entry
  const inserted: TeamEntryPitcher = {
    name: ace.name,
    ability: [ace.ability.hit, ace.ability.power, ace.ability.defense, ace.ability.run],
    repertoire: ACE_PITCHER_REPERTOIRES[aceIndex] ?? {
      name: ace.name,
      form: 0,
      magicId: 0,
      pitchMask: 1,
    },
    aceIndex,
    orderIndex: NO_ACE_BATTER,
    // 레코드 +0x14 — 0xb521c 가 XlsACE_PIT 행을 통째 베낀다 (실투 16 · 17 · 22 · 소모 18 · 10)
    skillBits: ace.skillBits,
  }
  const out = [...entry]
  const seated = out[PITCHER_ENTRY_ACE_SLOT]
  // 이미 마투수가 앉아 있으면 원본은 늘리지 않고 그 자리를 덮어쓴다 (b5262 의 r4 = 0 가지)
  if (seated !== undefined && seated.aceIndex >= 0) {
    out[PITCHER_ENTRY_ACE_SLOT] = inserted
    return out
  }
  // 옛 8번은 맨 끝으로 옮긴다 (b527e). 8칸짜리 로스터면 옮길 것이 없어 그냥 덧붙는 꼴이다
  if (seated !== undefined) out.push(seated)
  out[PITCHER_ENTRY_ACE_SLOT] = inserted
  return out
}

/** 투수 명단 한 칸을 피로 앞뒤로 쪼갠 재료 — `entryPitcherGameAbilities` 와 같은 보정 (마선수는 레벨 배율 먼저) */
export function entryPitcherGameAbilityParts(context: TeamGameAbilityContext, teamId: number, entry: TeamEntryPitcher): PitcherGameAbilityParts {
  return pitcherGameAbilityPartsOf(aceLeveledAbility(entry.ability, '투수', entry.aceIndex, context.aceLevels), {
    mode: context.mode,
    isMyTeam: context.seasonTeamId === teamId,
    teamAbilities: teamAbilitiesOf(context, teamId),
    season: context.season,
    // 레코드 +0x14 — 붙박이 줄은 Xls 행, 마투수는 XlsACE_PIT 행 (붕붕머신 0x16000 은 비트 14 가 섰다)
    fightingSpirit: pitcherFightingSpiritOf(context, teamId, entry.skillBits),
  })
}

/** 투수 명단 한 칸의 경기용 능력치 — `pitcherGameAbilities` 와 같은 보정을 명단 쪽으로 돌린 것 */
export function entryPitcherGameAbilities(
  context: TeamGameAbilityContext,
  teamId: number,
  entry: TeamEntryPitcher,
): [number, number, number, number] {
  return gameAbilitiesOf(aceLeveledAbility(entry.ability, '투수', entry.aceIndex, context.aceLevels), {
    mode: context.mode,
    isPitcher: true,
    isMyTeam: context.seasonTeamId === teamId,
    teamAbilities: teamAbilitiesOf(context, teamId),
    season: context.season,
    fightingSpirit: pitcherFightingSpiritOf(context, teamId, entry.skillBits),
  })
}
