import type { RosterPlayer } from '@/shared/config/original/roster'
import { QUICK_LINEUP_SIZE, lineupSlotOf, rosterSlotAt, teamPitchers } from '@/entities/mission/model/missionCpuTeam/otherSlices'
import { MISSION_ACE_ROSTER_SLOT } from '@/entities/mission/model/missionCpuTeam/types'
import type { MissionCpuBatting, MissionCpuPitching, MissionCpuTeam } from '@/entities/mission/model/missionCpuTeam/types'

/**
 * **레코드 k 의 수비 자리 니블(+0x1c & 0xf)이 어느 줄의 것인가** — 마타자 맞바꿈 `0xb8cb8(팀, team+0x32, 9)` → `0xb5e98(…, r3 = 0)`
 * 은 0x30 바이트를 맞바꾼 뒤(b5ee0~b5f0c) 두 칸 중 하나라도 자리가 0 이면 **자리를 칸에 그대로 되쓴다**(b5f10~b5f30 → b5f48, 0xb8e84),
 * 둘 다 0 이 아닐 때만 자리가 선수를 따라간다(b5f32~b5f4a). 마타자 행 +0x1c 는 다섯 줄 모두 0 이라 늘 앞 갈래 — 마타자가 선 칸은
 * 옛 그 칸 선수의 니블, 레코드 9(밀려난 붙박이)는 0 이다. 0 이면 null. 마타자가 없으면 레코드 줄 그대로
 */
export function missionRecordNibbleRowOf(records: readonly number[], record: number): number | null {
  const aceRecord = records.indexOf(MISSION_ACE_ROSTER_SLOT)
  if (aceRecord < 0 || aceRecord === QUICK_LINEUP_SIZE) return records[record] ?? record
  if (record === QUICK_LINEUP_SIZE) return null
  if (record === aceRecord) return records[QUICK_LINEUP_SIZE] ?? record
  return records[record] ?? record
}

/** 0x4e136 — 필살 스윙이 나간 틱에 그 타순 칸의 남은 횟수를 줄인 값으로 */
export function withMissionCpuSpecialSwing(team: MissionCpuTeam, order: number, remaining: number): MissionCpuTeam {
  const batting = team.batting
  if (batting === null) return team
  return {
    ...team,
    batting: { ...batting, specialSwing: { ...batting.specialSwing, [lineupSlotOf(order)]: remaining } },
  }
}

/** 명단 칸이 가리키는 레코드에 든 선수 (마스터 줄 또는 마타자 표지) */
export function batterRecordAt(batting: MissionCpuBatting, order: number): number {
  const record = rosterSlotAt(batting.lineup, order)
  return batting.records[record] ?? record
}

/** 마운드에 지금 마투수가 서 있는가 — 아니면 상대 투수는 마선수가 아니다 */
export function isMissionCpuMoundAce(team: MissionCpuTeam): boolean {
  const pitching = team.pitching
  return pitching !== null && pitching.roster[pitching.mound.pitcherSlot] === MISSION_ACE_ROSTER_SLOT
}

/** 지금 타순에 선 CPU 타자가 마타자인가 */
export function isMissionCpuBatterAce(team: MissionCpuTeam): boolean {
  const batting = team.batting
  return batting !== null && batterRecordAt(batting, batting.order) === MISSION_ACE_ROSTER_SLOT
}

/** 그 팀 투수 칸의 마스터 줄 (팀 안 0~7) — 마투수 칸이면 null */
export function masterPitcherRowAt(pitching: MissionCpuPitching, slot: number): RosterPlayer | null {
  const row = pitching.roster[slot] ?? slot
  if (row === MISSION_ACE_ROSTER_SLOT) return null
  return teamPitchers(pitching.teamId)[row] ?? null
}
