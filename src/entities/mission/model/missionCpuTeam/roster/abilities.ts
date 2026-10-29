import type { OriginalMission } from '@/shared/config/original/missions'
import type { RosterPlayer } from '@/shared/config/original/roster'
import { ROSTER_PITCHER_REPERTOIRES } from '@/shared/config/original/pitcherRepertoires'
import { aceLevelOf, aceLevelSlotOf, aceRecordAbilityAtLevel, aceSkillIdsOf } from '@/entities/mission/model/aceLevel'
import {
  ACE_PITCHERS,
  equippedSeasonAbilityOf,
  staminaPercentOf,
  teamBatters,
  type BatterAbility,
  type PitcherAbility,
} from '@/entities/mission/model/missionCpuTeam/otherSlices'
import { batterRecordAt, masterPitcherRowAt } from '@/entities/mission/model/missionCpuTeam/roster/records'
import { MISSION_ACE_ROSTER_SLOT, PITCHERS_PER_TEAM } from '@/entities/mission/model/missionCpuTeam/types'
import type { MissionAcePitcher, MissionCpuTeam } from '@/entities/mission/model/missionCpuTeam/types'

/**
 * **`0xb6415(레코드, k, 1)`** — 마스터 줄(Xls 행 0x30 바이트 사본, 0x1ff98)의 기본값에 장비 니블 · 장착 스킬(+0x14)을 얹은 값.
 * 0xb570c 는 모드를 안 가리고 첫머리(b5728)에서 이 함수를 플래그 1 로 부른다. 마스터 줄은 마선수가 아니라(+0xa 비트 6 꺼짐)
 * 레벨 배율 단계는 건너뛴다 — 시즌 레코드 카드가 쓰는 `equippedSeasonAbilityOf` 와 같은 식이다.
 */
export function masterGameAbilityOf(row: RosterPlayer, isPitcher: boolean, slot: number): number {
  return equippedSeasonAbilityOf(
    {
      name: row.name,
      isPitcher,
      base: row.ability,
      profile: row.profile,
      skillBits: row.skillBits,
      equipment: row.equipment,
      fieldPosition: 0,
      isComplete: true,
    },
    slot,
  )
}

/** 원본 0~999 를 투구 엔진 0~100 칸으로 — 나리 타자편 `opponentPitcherAbilityOf` 와 같은 나눗셈 */
const STAGE_PITCHER_DIVISOR = 10

/**
 * **타자 미션 마운드의 마스터 줄 투수가 던지는 능력치** — 마투수가 서 있거나 CPU 수비 팀이 없으면 null(부르는 쪽이 마투수 값을 쓴다).
 *
 * 사람 타석의 투수는 수비 팀의 지금 투수 `0xae83c(팀)` → `0xb89dc(팀, team[0])` — 0xaa57c 가 0xb8c94 로 선발 칸(레코드 +6 아래 4비트)을
 * 0번에 세운 마스터 줄이고, CPU 투수 교체 0xac428 뒤에는 바뀐 줄이다. 투구 AI · 스윙 판정(0x34968 · 0x4dbac · 0xab214)은 0xb570c 를
 * 투수 체력% 0xaebb0(= 마운드 +0x2c / 100)로 부른다:
 * - 0xb570c 는 b5728 에서 0xb6415(P, k, 1) — 장비 · 스킬 보정(`masterGameAbilityOf`)을 먹인 값으로 시작한다.
 * - 모드 갈래(b573a~)는 2(시즌) · 3·4(나리)만 탄다 — 모드 6 은 곧장 b58e6(피로)으로 가고, 팀 능력치 마스크 {1, 2, 8, 9} 에도 없다.
 *   그래서 피로 앞 값이 위 보정값이다(`gameAbility.beforeFatigue`). 피로는 투구 AI 가 `staminaPercent` 로 먹인다.
 * 폼 · 보유 구질 · 마구 번호는 같은 줄의 +0xb · +0x1c · +0x18 (`ROSTER_PITCHER_REPERTOIRES`, 전역 번호 팀 × 8 + 줄).
 */
export function missionCpuMoundPitcherAbilityOf(team: MissionCpuTeam): PitcherAbility | null {
  const pitching = team.pitching
  if (pitching === null) return null
  const slot = pitching.mound.pitcherSlot
  const row = masterPitcherRowAt(pitching, slot)
  if (row === null) return null
  const control = masterGameAbilityOf(row, true, 0)
  const velocity = masterGameAbilityOf(row, true, 1)
  const breaking = masterGameAbilityOf(row, true, 2)
  const repertoire = ROSTER_PITCHER_REPERTOIRES[pitching.teamId * PITCHERS_PER_TEAM + (pitching.roster[slot] ?? slot)]
  return {
    control: Math.round(control / STAGE_PITCHER_DIVISOR),
    velocity: Math.round(velocity / STAGE_PITCHER_DIVISOR),
    breaking: Math.round(breaking / STAGE_PITCHER_DIVISOR),
    gameAbility: { beforeFatigue: { control, velocity, breaking } },
    staminaPercent: staminaPercentOf(pitching.mound.stamina),
    ...(repertoire === undefined ? {} : { repertoire: { form: repertoire.form, pitchMask: repertoire.pitchMask, magicId: repertoire.magicId } }),
    // 레코드 +0x14 — 실투 판정 0x33cbc 의 투수 비트 16 · 17 · 22 (마스터 줄 = Xls 행 사본)
    skillBits: row.skillBits,
  }
}

/**
 * **타자 미션 마운드 투수의 장비 니블** — 마스터 줄(Xls 행 사본, 0x1ff98) +0x19 · +0x1a 네 칸. 타석 교대 0x47cc8 이 마운드 그림을
 * 다시 실을 때 마투수(0xb633c)가 아니면 48138~4816a 가 이 니블 − 1 로 장비 겹 0x79790 을 부른다(모드 6 도 같다). 마투수 칸이거나
 * CPU 수비 팀이 없으면 undefined
 */
export function missionCpuMoundPitcherEquipmentOf(team: MissionCpuTeam): readonly number[] | undefined {
  const pitching = team.pitching
  if (pitching === null) return undefined
  return masterPitcherRowAt(pitching, pitching.mound.pitcherSlot)?.equipment
}

/**
 * **타자 미션 마운드 투수의 피부** `(rec[0xb] >> 2) & 3` — 마스터 줄(Xls 행 사본) +0xb. 타석 교대 0x47cc8 의 482c0~482fc 가 마운드 그림
 * 적재 0x793b0 에 넘겨 794c2 가 `pitcher.pzx` 를 피부 × 15 + 수비 팀(CPU 칸 팀) 벌로 연다. CPU 수비 팀이 없거나 줄이 없으면 0
 */
export function missionCpuMoundPitcherSkinIndexOf(team: MissionCpuTeam): number {
  const pitching = team.pitching
  if (pitching === null) return 0
  const row = masterPitcherRowAt(pitching, pitching.mound.pitcherSlot)
  return row === null ? 0 : (row.profile >> 2) & 3
}

/**
 * **투수 미션의 지금 CPU 타자** `0xae89c(공격 팀)` — 타순 `team+0x32` 칸에 선 명단 줄. 마타자 칸이면 `isAce`(줄은 null),
 * 아니면 마스터 팀 타자 줄(Xls 행 사본, 0x1ff98 — 대타로 들어온 벤치 줄 포함). CPU 공격 팀이 없으면(타자 미션) null.
 */
export function missionCpuBatterOf(team: MissionCpuTeam): {
  readonly order: number
  readonly isAce: boolean
  readonly row: RosterPlayer | null
  /** 마스터 줄의 팀 안 칸(0~11) — 레코드 +0xa 아랫 5비트(0xb6394). 마타자 칸은 `MISSION_ACE_ROSTER_SLOT` */
  readonly rosterSlot: number
} | null {
  const batting = team.batting
  if (batting === null) return null
  const rosterSlot = batterRecordAt(batting, batting.order)
  if (rosterSlot === MISSION_ACE_ROSTER_SLOT) return { order: batting.order, isAce: true, row: null, rosterSlot }
  return { order: batting.order, isAce: false, row: teamBatters(batting.teamId)[rosterSlot] ?? null, rosterSlot }
}

/** 마스터 줄 타자의 경기용 능력치 네 칸 — `0xb6415(타자, k, 1)` (사람 칸 팀 마스터 타자의 타석 화면도 같은 값) */
export function masterBatterAbilityOf(row: RosterPlayer): BatterAbility {
  return {
    hit: masterGameAbilityOf(row, false, 0),
    power: masterGameAbilityOf(row, false, 1),
    defense: masterGameAbilityOf(row, false, 2),
    run: masterGameAbilityOf(row, false, 3),
  }
}

/**
 * **지금 CPU 타자(마스터 줄)의 경기용 능력치** — 네 칸 모두 `0xb6415(타자, k, 1)`(장비 니블 · 장착 스킬 보정). 마타자 칸이거나
 * CPU 공격 팀이 없으면 null — 부르는 쪽이 마타자 값(레벨 배율)을 쓴다.
 * CPU 타자 결정 0x34334 의 h 는 `0xb570d(ctx, 0, 타자, 1, 90, 1)` — 0xb570c 가 b5728 에서 이 값을 받고 모드 5 는 모드 갈래 ·
 * 팀 능력치 마스크를 안 탄다(부르는 쪽 `gameAbilityOf` 가 0..999 로 자른다).
 */
export function missionCpuBatterAbilityOf(team: MissionCpuTeam): BatterAbility | null {
  const batter = missionCpuBatterOf(team)
  if (batter === null || batter.row === null) return null
  return masterBatterAbilityOf(batter.row)
}

/** 타자 미션의 마투수 (마투수 미션이 아니면 undefined) */
export function missionAcePitcherOf(mission: OriginalMission, aceLevels?: Readonly<Record<number, number>>): MissionAcePitcher | undefined {
  if (mission.side !== '타자' || mission.opponentAce <= 0) return undefined
  const ace = ACE_PITCHERS[mission.opponentAce - 1]
  if (ace === undefined) return undefined
  // 0xb6415(rec, k, 1) — 레벨 배율 뒤 장착 스킬(발렌타인 냉정 22 = 제구 + 1/10)
  const ability = aceRecordAbilityAtLevel(ace, aceLevelOf(aceLevels, aceLevelSlotOf('투수', mission.opponentAce)))
  return {
    quick: { control: ability.hit, velocity: ability.power, stamina: ability.run, skillIds: aceSkillIdsOf(ace) },
    staminaAbility: ability.run,
    name: ace.name,
    skillBits: ace.skillBits,
  }
}
