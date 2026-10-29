import type { BatterAbility } from '@/entities/batting/model/batter'
import type { MissionRun } from '@/entities/mission/model/missionRun'
import { isMissionBatterUp } from '@/entities/mission/model/missionRun'
import { battingRecordAt, missionHumanRecordSlotOf } from '@/entities/mission/model/missionGame'
import { masterBatterAbilityOf } from '@/entities/mission/model/missionCpuTeam'
import { teamBatters } from '@/entities/team/model/teamRoster'
import type { RosterPlayer } from '@/shared/config/original/roster'
import type { ModeBatterLook } from '@/app/model/modeBatter'

/**
 * **지금 사람 칸 타석의 타자** (타자 미션) — 미션 타자면 `isMissionBatter`, 아니면 사람 칸 팀 마스터 줄(0xaa57c 의 사람 칸 팀 · 0xaf020 타순).
 * 원본은 미션 타자 타석이 끝나고 3아웃 전이면 다음 타순 마스터 타자도 사람이 친다(0xc2198 는 0x18 · 0x21 에서만 자동을 묻는다).
 * 화면(타석 능력치 · 이름 · 장착 스킬)은 이 값으로 그려야 한다 — 마스터 줄의 필살 남은 칸은 0(+0x18 = 0, 0xaebe4).
 */
export function missionHumanBatterOf(
  run: MissionRun,
): { readonly isMissionBatter: true } | { readonly isMissionBatter: false; readonly row: RosterPlayer | null } {
  if (isMissionBatterUp(run)) return { isMissionBatter: true }
  const record = battingRecordAt(run.game.humanBatting)
  return { isMissionBatter: false, row: teamBatters(run.game.humanBatting.teamId)[record] ?? null }
}

/** 지금 타자의 장착 스킬 — 미션 타자면 세션이 받은 것, 마스터 줄이면 그 줄 +0x14 의 켜진 비트 (0xb62b4(타자, n) — 압도 22) */
export function missionBatterSkillIdsOf(run: MissionRun, missionBatterSkillIds: readonly number[]): readonly number[] {
  const batter = missionHumanBatterOf(run)
  if (batter.isMissionBatter) return missionBatterSkillIds
  const bits = batter.row?.skillBits ?? 0
  return Array.from({ length: 32 }, (_unused, bit) => bit).filter((bit) => ((bits >>> bit) & 1) === 1)
}

interface MissionStageBatterInput {
  readonly ability: BatterAbility
  readonly skillIds: readonly number[]
  readonly specialSwingNumber?: number
  readonly look?: ModeBatterLook
}

interface MissionStageBatter {
  readonly ability: BatterAbility
  readonly skillIds: readonly number[]
  readonly specialSwingNumber: number
  readonly name?: string
  /** 타자 레코드 칸 0xb6394 — 스윙 0xab214 의 투수 스킬 31 (`missionHumanRecordSlotOf`) */
  readonly recordSlot: number
  /**
   * 타석 교대 0x47d98~0x47dd6 이 지금 타자 `0xae89c(공격 팀)` 레코드 +0xb 에서 싣는 그림 · 손 재료 — 폼 `rec[0xb] >> 4` ·
   * 피부 `(rec[0xb] >> 2) & 3` (손 0xb63c0 = 폼 & 1 — 사람 칸에 마타자는 없다). 모르면(옛 명전 기록) 없다
   */
  readonly look?: ModeBatterLook
}

/** 받은 미션 타자 그대로 — 필살 번호가 없으면 0, 생김새는 있을 때만 */
function givenStageBatterOf(missionBatter: MissionStageBatterInput, recordSlot: number): MissionStageBatter {
  return {
    ability: missionBatter.ability,
    skillIds: missionBatter.skillIds,
    specialSwingNumber: missionBatter.specialSwingNumber ?? 0,
    recordSlot,
    ...(missionBatter.look === undefined ? {} : { look: missionBatter.look }),
  }
}

/**
 * **타석 화면이 그릴 사람 칸 타자** (타자 미션) — 미션 타자 차례면 받은 미션 타자 그대로, 마스터 타순 차례면 그 줄의
 * 능력치 `0xb6415(타자, k, 1)` · 이름 · +0x14 장착 스킬, 필살은 0(마스터 줄 +0x18 = 0 — '0' 키 0x51dee 가 안 받는다).
 */
export function missionStageBatterOf(run: MissionRun, missionBatter: MissionStageBatterInput): MissionStageBatter {
  const batter = missionHumanBatterOf(run)
  // 투수 미션은 사람이 안 친다 — 0
  const recordSlot = run.mission.side === '타자' ? missionHumanRecordSlotOf(run.game, battingRecordAt(run.game.humanBatting)) : 0
  if (batter.isMissionBatter || batter.row === null) return givenStageBatterOf(missionBatter, recordSlot)
  return {
    ability: masterBatterAbilityOf(batter.row),
    skillIds: missionBatterSkillIdsOf(run, missionBatter.skillIds),
    specialSwingNumber: 0,
    name: batter.row.name,
    recordSlot,
    // 마스터 줄 +0xb (`RosterPlayer.profile`)
    look: { form: (batter.row.profile >> 4) & 0xf, skinIndex: (batter.row.profile >> 2) & 3 },
  }
}
