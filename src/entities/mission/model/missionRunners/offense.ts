import { lineupSlotOf } from '@/entities/mission/model/missionRunners/otherSlices'
import type { MissionDefenseSituation, MissionOffense, MissionRunnerSituation } from '@/entities/mission/model/missionRunners/types'

/** 사람이 맡은 반 이닝의 공격 타선 — 타자 미션은 사람 칸 팀, 투수 미션은 CPU 팀 */
export function offenseOf(run: MissionRunnerSituation): MissionOffense | null {
  return run.mission.side === '타자' ? run.game.humanBatting : run.cpu.batting
}

/** 수비 팀 `팀[st[0xa]]` — 타자 미션(모드 6)은 CPU 팀(`game.cpuAutoBatting`), 투수 미션(모드 5)은 사람 칸 팀(`game.humanBatting`) */
export function defenseTeamOf(run: MissionDefenseSituation): MissionOffense | null {
  return run.mission.side === '타자' ? run.game.cpuAutoBatting : run.game.humanBatting
}

/** 그 팀 레코드 칸에 든 마스터 줄 (미션 타자 · 마타자 표지면 그 표지) */
export function rowAtRecord(team: Pick<MissionOffense, 'records'>, record: number): number {
  return team.records[record] ?? record
}

/** 지금 타석 타자의 타순 칸 (0~8) — 공격 팀 `team+0x32` */
export function missionBatterSlotOf(run: MissionRunnerSituation): number {
  return lineupSlotOf(offenseOf(run)?.order ?? 0)
}
