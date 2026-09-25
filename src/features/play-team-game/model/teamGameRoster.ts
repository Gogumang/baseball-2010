import { TEAMS } from '@/shared/config/original/teams'
import {
  ACE_PITCHER_REPERTOIRES,
  ROSTER_PITCHER_REPERTOIRES,
} from '@/shared/config/original/pitcherRepertoires'
import type { PitcherRepertoire } from '@/shared/config/original/pitcherRepertoires'
import {
  BATTERS_PER_TEAM,
  PITCHERS_PER_TEAM,
  teamBatters,
  teamPitchers,
} from '@/entities/team/model/teamRoster'
import type { QuickAtBatBatter, QuickAtBatPitcher } from '@/entities/game/model/quickAtBat'
import { ACE_BATTERS, ACE_PITCHERS } from '@/entities/game/model/aceOpponent'
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

/* ── 명단(엔트리) 한 줄 ─────────────────────────────────────────────────────── */

/**
 * 경기에 들어간 팀의 **명단 한 칸** — 원본 `team[0xe + 칸]` 이 가리키는 선수 레코드다.
 *
 * 원본은 팀 구조체에 "칸 → 선수" 이름 목록 하나를 두고 (`team+0xe`, 0x16칸), **앞 아홉 칸이
 * 타순**, 그 뒤가 벤치다 (벤치 타자 수 = `team+0x28c`). 대타 확정 `0xaebe4` 가 이 목록의 두 칸을
 * 맞바꾸고 빠진 선수를 목록에서 지운다(`0xb95b1`) — 그래서 웹도 로스터 칸 번호를 바로 쓰지 않고
 * 이 목록을 들고 다닌다.
 */
export interface TeamEntryBatter {
  readonly name: string
  /** 히트 · 파워 · 수비 · 주루 (원본 0~999 눈금 그대로) */
  readonly ability: readonly [number, number, number, number]
  /** 수비 위치 코드 = 레코드 `+0x1c & 0xf`. **0 은 자리 없는 후보(벤치)** 다 */
  readonly position: number
  /** 마타자면 `ACE_BATTERS` 칸 0~4, 아니면 −1 */
  readonly aceIndex: number
}

/** 타순 아홉 칸 — 그 뒤가 벤치다 */
export const BATTING_ORDER_SLOTS = 9

/** 마선수가 아니라는 표시 (준비 기록 `skin+0xbc` +0xd 가 비었을 때와 같은 값) */
export const NO_ACE_BATTER = -1

/** 로스터 12명을 그대로 명단으로 — 앞 아홉이 타순, 9~11 이 벤치다 */
export function rosterEntryBattersOf(teamId: number): readonly TeamEntryBatter[] {
  return teamBatters(teamId).map((player) => ({
    name: player.name,
    ability: player.ability,
    position: player.position ?? 0,
    aceIndex: NO_ACE_BATTER,
  }))
}

/**
 * 고른 **마타자를 벤치 첫 칸(9번)에 끼워 넣는다** — 원본 `0xb8870(team, k)`:
 * `0x1f84c(저장, k)` 로 마타자 레코드를 꺼내 `0xb53f0(team, 레코드, 1)` 로 넣고, 성공하면
 * `team+0x27` 과 **벤치 타자 수 `team+0x28c`(= `0xa3<<2`)를 하나씩 올린다**
 * (`b8898~b88b2`). `0xb53f0` 의 `0x40`(마타자) 가지가 **9번 = 첫 벤치 칸**이다.
 *
 * ⚠️ **끼워 넣는 방식은 "밀기" 가 아니라 "옛 9번을 맨 끝으로 옮기기" 다** (직접 떴다 — 앞서
 * 웹이 쓰던 `splice` 는 오독이었다):
 * ```
 * b5418: cmp 타자수(=12), #9 ; ble b543a
 * b541e:   0xb53d0(명부, 9) → &타자[9] ; 0xb6720(그 칸, 0x40, …) 이 참이면 r4 = 0 (덮어쓰고 −1)
 * b543a: 0xb4e34(명부, 0)                      ; 타자 벡터를 한 칸 늘리고
 * b544a:   memcpy(&타자[수−1], &타자[9], 0x30) ; 옛 9번을 **맨 끝(12번)으로** 옮긴 뒤
 * b5462: memcpy(&타자[9], 레코드, 0x30)        ; 9번에 마타자를 넣는다
 * b547a: return 9
 * ```
 * 곧 벤치 차례가 `[마타자, 옛10, 옛11, 옛9]` 가 된다 — 밀어 넣은 `[마타자, 옛9, 옛10, 옛11]` 이
 * 아니다. 대타 화면 목록 차례와 CPU 대타 `0xaf06c(팀, rand(0, 벤치수), 0)` 가 고르는 선수가
 * 달라지는 자리라 원본대로 맞춘다 (굴림 수는 그대로다).
 *
 * 일반모드 경기 세우기 `0x30f20` 이 준비 기록의 마타자 칸으로 이 함수를 부른다
 * (`31046: 0xb8870(teamA, [sp+0x45])`).
 *
 * ⚠️ **미확인**: 마타자 레코드의 수비 위치 니블(`+0x1c & 0xf`)은 저장 레코드에 있는 값이라
 * 못 읽었다. 벤치에 들어가는 선수이므로 **0(자리 없음)** 으로 둔다 — 대타 확정이 이 니블을
 * 옛 타자 것과 맞바꾸므로(0xaecce~0xacfe) 0 이어야 빠진 선수가 벤치로 내려간다.
 */
export function withAceBatter(
  entry: readonly TeamEntryBatter[],
  aceIndex: number,
): readonly TeamEntryBatter[] {
  const ace = ACE_BATTERS[aceIndex]
  if (ace === undefined) return entry
  const inserted: TeamEntryBatter = {
    name: ace.name,
    ability: [ace.ability.hit, ace.ability.power, ace.ability.defense, ace.ability.run],
    position: 0,
    aceIndex,
  }
  const out = [...entry]
  const seated = out[BATTING_ORDER_SLOTS]
  // 이미 마타자가 앉아 있으면 원본은 늘리지 않고 그 자리를 덮어쓴다 (b5436 의 r4 = 0 가지)
  if (seated !== undefined && seated.aceIndex >= 0) {
    out[BATTING_ORDER_SLOTS] = inserted
    return out
  }
  // 옛 9번은 맨 끝으로 옮긴다 (b544a) — 밀어 넣는 것이 아니다
  if (seated !== undefined) out.push(seated)
  out[BATTING_ORDER_SLOTS] = inserted
  return out
}

/** 명단 한 칸의 경기용 능력치 — `batterGameAbilities` 와 같은 보정을 명단 쪽으로 돌린 것 */
export function entryBatterGameAbilities(
  context: TeamGameAbilityContext,
  teamId: number,
  entry: TeamEntryBatter,
  lineupSlot: number,
): [number, number, number, number] {
  const isMyTeam = context.seasonTeamId === teamId
  return gameAbilitiesOf(entry.ability, {
    mode: context.mode,
    isPitcher: false,
    isMyTeam,
    teamAbilities: teamAbilitiesOf(context, teamId),
    season: context.season,
    assignment: isMyTeam ? context.lineup?.[lineupSlot] : undefined,
  })
}

/* ── 명단(엔트리) 한 줄 — 투수 ───────────────────────────────────────────────── */

/**
 * 경기에 들어간 팀의 **투수 명단 한 칸** — 원본 `team[0 + 칸]` 이 가리키는 투수 레코드다.
 *
 * 타자 목록(`team+0xe`, 0x16칸)과 **짝을 이루는 목록이 하나 더 있다**: `team+0x00`, 0xe칸.
 * 팀 세우기 `0xb891c` 가 두 목록을 나란히 채운다 (직접 떴다):
 * ```
 * b8950: r3 = 0      ; strb r3,[r5,r3] ; r3++ ; cmp r3,#0xd ; ble   → team[i]      = i  (i 0..13)
 * b895a: r2 = 0      ; strb r2,[r3,#0xe] ; r2++ ; cmp r2,#0x15 ; ble → team[0xe+i] = i  (i 0..21)
 * b896c: team[+0x33]  = 명부[0xc] − 1      ; 벤치 **투수** 수 = 투수 수 − 1 (선발 하나)
 * b8988: team[+0x28c] = 명부[0x10] − 9     ; 벤치 타자 수 = 타자 수 − 9 (타순 아홉)
 * ```
 * 곧 **투수는 0번이 선발, 1번부터가 벤치**다 (타자가 0~8 타순, 9부터 벤치인 것과 같은 꼴).
 */
export interface TeamEntryPitcher {
  readonly name: string
  /** 제구 · 구속 · 변화 · 체력 (원본 0~999 눈금 그대로 = 레코드 +0xc 부터 u16 넷) */
  readonly ability: readonly [number, number, number, number]
  /** 폼·마구·보유 구질 (레코드 `+0xb>>4` · `+0x18` · `+0x1c`) */
  readonly repertoire: PitcherRepertoire
  /** 마투수면 `ACE_PITCHERS` 칸 0~4, 아니면 −1 */
  readonly aceIndex: number
}

/**
 * **마투수가 들어가는 칸 = 8번**. 마타자의 9번과 **다르다** — 직접 떠서 확인했다.
 *
 * `0xb88c8(팀, k)` → `0x1f824(저장, k)` 로 마투수 레코드를 꺼내 `0xb521c(명부, 레코드, 1)`:
 * ```
 * b523a: 0xb6720(레코드, 0x60, &b)      ; 레코드[0xa] & 0x60 이면 참 (b = [0xa] & 0x1f)
 * b5244: cmp 명부[0xc], #8 ; ble b5266  ; 투수 수가 8 이하면 바로 늘린다
 * b524a:   0xb51fc(명부, 8) → 8번 칸 ; 0xb6720(그 칸, 0x60, …) 이 참이면 r4 = 0 (덮어쓰고 −1 반환)
 * b5266: 0xb4e34(명부, 1)              ; 투수 벡터를 한 칸 늘리고
 * b527e:   memcpy(&투수[수−1], &투수[8], 0x30)   ; 옛 8번을 **맨 끝으로** 옮긴 뒤
 * b528e: memcpy(&투수[8], 레코드, 0x30)          ; 8번에 마투수를 넣는다
 * b52aa: return 8
 * ```
 * 마투수 레코드 다섯의 `+0xa` 는 **0x60·0x61·0x62·0x63·0x64** 다 (`XlsACE_PIT_DATA.zt1` 을
 * 풀어 눈으로 확인). 비트 6 이 서 있어 늘 이 가지를 탄다. 마타자 쪽은 `+0xa` 가 0x40~0x44 라
 * `0xb53f0` 의 `0x40` 가지 → **9번**이다. 로스터 투수는 여덟(칸 0~7, `+0xa` = 0~7)이므로
 * 8번은 **한 칸 늘린 자리 = 맨 끝**이고, 옛 칸을 끝으로 옮기는 셈이 없다.
 *
 * ⚠️ 원본 그대로의 결말 하나: 8번에 이미 마투수가 있으면 **덮어쓰고 −1 을 돌려준다** →
 * 부르는 쪽 `0xb88c8` 이 `team[+0x26]`·`team[+0x33]` 을 안 올린다 (b88ee `beq`).
 */
export const PITCHER_ENTRY_ACE_SLOT = 8

/** 로스터 투수 여덟을 그대로 명단으로 — 0번이 선발, 1~7 이 벤치다 */
export function rosterEntryPitchersOf(teamId: number): readonly TeamEntryPitcher[] {
  return teamPitchers(teamId).map((player, slot) => ({
    name: player.name,
    ability: player.ability,
    repertoire: rosterRepertoireOf(teamId, slot),
    aceIndex: NO_ACE_BATTER,
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
export function withAcePitcher(
  entry: readonly TeamEntryPitcher[],
  aceIndex: number,
): readonly TeamEntryPitcher[] {
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

/** 투수 명단 한 칸의 경기용 능력치 — `pitcherGameAbilities` 와 같은 보정을 명단 쪽으로 돌린 것 */
export function entryPitcherGameAbilities(
  context: TeamGameAbilityContext,
  teamId: number,
  entry: TeamEntryPitcher,
): [number, number, number, number] {
  return gameAbilitiesOf(entry.ability, {
    mode: context.mode,
    isPitcher: true,
    isMyTeam: context.seasonTeamId === teamId,
    teamAbilities: teamAbilitiesOf(context, teamId),
    season: context.season,
  })
}
