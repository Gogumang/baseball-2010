import type { OriginalMission } from '@/shared/config/original/missions'
import { cpuStartOf } from '@/entities/mission/model/missionCpuTeam/start/cpuStart'
import { cpuTeamIdOf } from '@/entities/mission/model/missionCpuTeam/start/missionSlot'
import {
  FRESH_HELD_CPU_MAGIC,
  FULL_STAMINA,
  QUICK_LINEUP_SIZE,
  lineupSlotOf,
  rosterLineupOf,
} from '@/entities/mission/model/missionCpuTeam/otherSlices'
import { BATTERS_PER_TEAM, MISSION_ACE_ROSTER_SLOT, PITCHERS_PER_TEAM } from '@/entities/mission/model/missionCpuTeam/types'
import type { MissionCpuBatting, MissionCpuPitching, MissionCpuTeam } from '@/entities/mission/model/missionCpuTeam/types'

/**
 * **CPU 팀 투수진** — 0xaa57c aa8a0 `0xb8c94(다른 칸 팀, 0, 레코드 +6 아래 4비트)` 로 명부 투수 0 ↔ 시작 칸(줄째 바뀌어 보직·능력치가
 * 따라간다). 마스터 줄 +0x2c 는 모두 10000. 타자 미션은 사람 타석의 수비, 투수 미션은 사람 칸 팀이 치는 자동진행 반 이닝의 수비다.
 */
export function startMissionCpuPitching(mission: OriginalMission): MissionCpuPitching {
  const start = cpuStartOf(mission)
  const roster = Array.from({ length: PITCHERS_PER_TEAM }, (_unused, slot) => slot)
  roster[0] = start.pitcherSlot
  roster[start.pitcherSlot] = 0
  return {
    teamId: cpuTeamIdOf(mission),
    roster,
    mound: { pitcherSlot: 0, stamina: FULL_STAMINA, runsAllowed: 0, pitches: 0, usedSlots: [], justChanged: false },
    inningRunsAllowed: 0,
    ourRuns: 0,
    // 팀 new 0xb891c 의 +0x28 = −1 · 공 new 의 +0x10 = 0
    magic: FRESH_HELD_CPU_MAGIC,
  }
}

/** 미션 한 판의 CPU 팀 — 경기 준비 0xaa57c · 0xd 메시지 0xaae7c 뒤의 모습 */
export function startMissionCpuTeam(mission: OriginalMission): MissionCpuTeam {
  const start = cpuStartOf(mission)
  const hasAce = mission.opponentAce > 0
  const teamId = cpuTeamIdOf(mission)
  if (mission.side === '타자') {
    const pitching = startMissionCpuPitching(mission)
    // 마투수 — 명부 8번에 베낀 뒤 0 ↔ 8 (aafca~ab06e). 0번에 섰던 투수는 팀 객체(8명) 밖으로 나간다
    const roster = hasAce ? [MISSION_ACE_ROSTER_SLOT, ...pitching.roster.slice(1)] : pitching.roster
    return { pitching: { ...pitching, roster }, batting: null, pinchHitBlocked: false }
  }
  const order = lineupSlotOf(start.battingOrder)
  const batting: MissionCpuBatting = {
    teamId,
    // 명단은 레코드 차례 그대로 (0xb891c)
    lineup: rosterLineupOf(BATTERS_PER_TEAM),
    records: Array.from({ length: BATTERS_PER_TEAM }, (_unused, record) => record),
    order,
    specialSwing: {},
  }
  return {
    pitching: null,
    // 마타자 — 첫 0xd 의 0xaae7c(aafca~)가 지금 타순 레코드에 끼운다
    batting: hasAce ? insertMissionAceBatter(batting) : batting,
    pinchHitBlocked: false,
  }
}

/**
 * **0xaae7c 의 마타자 끼우기** (ab078~ab0f4, 모드 5 · 수비가 사람) — `0xb53f0(명부, 마타자, 0)` 으로 레코드 9 에 저장된 마타자를 통째
 * 베끼고(옛 9 번 줄은 끝) `0xb8cb8(팀, team+0x32, 9)` 로 **레코드 [지금 타순 번호] ↔ 레코드 9** 를 맞바꾼 뒤 `0xaea84(팀, 1)` —
 * +0x295 를 세워 확정 0xaebe4(aee4c)가 그 타순 칸의 필살 남은 칸을 −1(0xae9e8)로 되돌린다(다음 타석 앞에 다시 채운다).
 * 인자가 목록 칸이 아니라 **레코드 번호**(= 타순 숫자)라, 목록이 레코드 차례 그대로인 칸이면 지금 타자가 마타자가 된다.
 */
export function insertMissionAceBatter(batting: MissionCpuBatting): MissionCpuBatting {
  const records = [...batting.records]
  const target = batting.order
  records[QUICK_LINEUP_SIZE] = records[target] ?? target
  records[target] = MISSION_ACE_ROSTER_SLOT
  const specialSwing = { ...batting.specialSwing }
  delete specialSwing[lineupSlotOf(batting.order)]
  return { ...batting, records, specialSwing }
}
