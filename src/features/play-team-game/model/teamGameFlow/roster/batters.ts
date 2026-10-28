import { type TeamEntryBatter, entryBatterGameAbilities, type TeamEntryPitcher } from '@/features/play-team-game/model/teamGameRoster'
import type { BatterAbility } from '@/entities/batting/model/batter'
import { ACE_BATTERS, ACE_PITCHERS } from '@/entities/game/model/aceOpponent'
import { aceSkillIdsOf } from '@/entities/mission/model/aceLevel'
import { skillIdsOfBits } from '@/entities/team/model/teamRoster'
import { abilityContextOf } from '@/features/play-team-game/model/teamGameFlow/context/abilityContext'
import { pitcherEntryAt } from '@/features/play-team-game/model/teamGameFlow/roster/pitchers'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/**
 * 한 팀의 **명단** — 양 팀 모두 대타로 바뀔 수 있어 진행 상태가 들고 있다
 * (우리 쪽은 `#` 대타 `0xaf06c`, 상대 쪽은 CPU 대타 `0xac228`).
 */
export function entryBattersOf(progress: TeamGameProgress, teamId: number): readonly TeamEntryBatter[] {
  return teamId === progress.options.ourTeamId ? progress.ourEntry : progress.opponentEntry
}

/** 지금 타석에 선 우리 타자 (명단 칸 = 타순 칸) */
export function currentBatterEntry(progress: TeamGameProgress): TeamEntryBatter | undefined {
  return progress.ourEntry[progress.game.battingOrderIndex]
}

/** 명단 한 칸의 경기용 능력치 네 칸 — 없는 칸이면 0 이다 */
export function entryAbilitiesAt(progress: TeamGameProgress, teamId: number, slot: number): readonly number[] {
  const entry = entryBattersOf(progress, teamId)[slot]
  if (entry === undefined) return [0, 0, 0, 0]
  return entryBatterGameAbilities(abilityContextOf(progress.options), teamId, entry, slot)
}

/** 타석 화면이 보는 능력치 (0~999 그대로) */
export function entryStageAbilityOf(progress: TeamGameProgress, teamId: number, slot: number): BatterAbility {
  const ability = entryAbilitiesAt(progress, teamId, slot)
  return { hit: ability[0], power: ability[1], defense: ability[2], run: ability[3] }
}

/** 타자 스킬 22 압도 — 레코드 +0x14 비트 (`0xb62b4(타자, 22)`) */
const INTIMIDATE_SKILL_BIT = 22

/**
 * 그 명단 칸 타자가 **압도(스킬 22)** 를 달았나 — 공 하나 소모 0xa5e14(×2) · 실투 판정 0x33cbc(+5)가 공격 팀 지금 타자의
 * `0xb62b4(타자, 22)` 로 본다 (`TeamEntryBatter.skillBits`, 마타자는 XlsACE_BAT 행 — 킹타이거 22)
 */
export function entryBatterIntimidatesAt(progress: TeamGameProgress, teamId: number, slot: number): boolean {
  return (((entryBattersOf(progress, teamId)[slot]?.skillBits ?? 0) >>> INTIMIDATE_SKILL_BIT) & 1) === 1
}

/**
 * 명단 타자의 0xab214 스킬 번호 — 스윙 판정의 스킬 갈래(ab91c~)가 모드 검사 없이 `0xb62b4(타자, n)` 로 레코드 +0x14 를 읽는다.
 * 붙박이 · 기록 줄은 `TeamEntryBatter.skillBits`, 마타자(0xb53f0 이 XlsACE_BAT 행을 통째 베낀 레코드)는 `aceSkillIdsOf`
 */
export function entryBatterSkillIdsOf(entry: TeamEntryBatter | undefined): readonly number[] {
  if (entry === undefined) return []
  const ace = entry.aceIndex >= 0 ? ACE_BATTERS[entry.aceIndex] : undefined
  return ace !== undefined ? aceSkillIdsOf(ace) : skillIdsOfBits(entry.skillBits ?? 0, false)
}

/** 명단 투수의 0xab214 스킬 번호(비트 + 16) — 마투수(0xb521c 가 XlsACE_PIT 행을 베낀 레코드)는 `aceSkillIdsOf` */
export function entryPitcherSkillIdsOf(entry: TeamEntryPitcher | undefined): readonly number[] {
  if (entry === undefined) return []
  const ace = entry.aceIndex >= 0 ? ACE_PITCHERS[entry.aceIndex] : undefined
  return ace !== undefined ? aceSkillIdsOf(ace) : skillIdsOfBits(entry.skillBits ?? 0, true)
}

/**
 * **사람 수비 타석의 경기 스킬 표시 판 재료** (`PitcherSideStage.skillPanel`) — CPU 스윙 0xab214 가 읽는 것과 같은 두 레코드:
 * 상대 지금 타자(+0x14 · 0xb6394 · 그 타순 칸 결과 링)와 우리 마운드 투수(+0x14).
 */
export function humanDefenseSkillPanelOf(progress: TeamGameProgress): {
  readonly batterSkillIds: readonly number[]
  readonly batterRecordSlot: number
  readonly pitcherSkillIds: readonly number[]
  readonly recentAtBatCodes: readonly number[]
} {
  const { options } = progress
  const batter = entryBattersOf(progress, options.opponentTeamId)[progress.opponentOrderIndex]
  return {
    batterSkillIds: entryBatterSkillIdsOf(batter),
    batterRecordSlot: batter?.recordSlot ?? 0,
    pitcherSkillIds: entryPitcherSkillIdsOf(pitcherEntryAt(progress, options.ourTeamId, progress.ourPitcherIndex)),
    recentAtBatCodes: progress.opponentEntryRecords[progress.opponentOrderIndex]?.results ?? [],
  }
}

/** 지금 타석에 선 우리 타자의 경기용 능력치 */
export function currentBatterAbility(progress: TeamGameProgress) {
  return entryStageAbilityOf(progress, progress.options.ourTeamId, progress.game.battingOrderIndex)
}

/** 타순 한 칸의 경기용 주루 능력치 (칸 3) — 진행기의 주자 속도가 된다 */
export function runAbilityFor(progress: TeamGameProgress, teamId: number, battingOrderIndex: number): number {
  return entryAbilitiesAt(progress, teamId, battingOrderIndex)[3]
}
