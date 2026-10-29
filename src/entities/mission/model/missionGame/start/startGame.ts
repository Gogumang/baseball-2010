import type { OriginalMission } from '@/shared/config/original/missions'
import { missionKeyOf } from '@/entities/mission/model/missionGoal'
import { MISSION_CPU_START, startMissionCpuPitching, type MissionCpuPitching } from '@/entities/mission/model/missionCpuTeam'
import { missionStartInningRunsOf } from '@/entities/mission/model/missionScoreboard'
import { FULL_STAMINA, rosterLineupOf } from '@/entities/mission/model/missionGame/otherSlices'
import { humanRecordsOf, missionRecordSlotOf } from '@/entities/mission/model/missionGame/start/humanRecords'
import { cpuSideOf, humanSideOf, missionHumanTeamIdOf, type MissionAceMatchOrigin } from '@/entities/mission/model/missionGame/start/sides'
import { MISSION_HUMAN_START_ORDER } from '@/entities/mission/model/missionGame/start/startOrder'
import { BATTERS_PER_TEAM, PITCHERS_PER_TEAM, type MissionGame, type MissionTeamBatting } from '@/entities/mission/model/missionGame/types'

/** 경기 세우기 0xaa57c 의 바깥 재료 — 마선수 대결의 사람 칸 팀 · 미션 타자의 레코드 칸 */
export interface MissionGameSetup {
  readonly aceMatch?: MissionAceMatchOrigin
  /**
   * 타자 미션 — 미션 타자(0x1fc20) +0xa & 0x1f (`humanRecordsOf`). 나리 타자편 저장 선수면 자기 나리 팀 타자 칸,
   * 명예 타자면 0 (등록 0x1f680 이 +0xa = 0x20 을 적고 0xb53f0 b5532 의 0x20 갈래가 같은 0xb6720 으로 꺼낸다 — `useMissionSession`).
   * 안 주면 `MISSION_NARI_RECORD_FALLBACK`(12).
   */
  readonly nariRecordSlot?: number
}

/** 타자 미션 · 투수 미션이 따로 세우는 칸 — 미션 타자 레코드 칸과 자동진행 반 이닝의 팀들 */
type MissionSideFields = Pick<MissionGame, 'humanRecordSlot' | 'cpuAutoPitching' | 'cpuAutoBatting' | 'humanPitching'>

/** 경기 세우기 0xaa57c — 이닝 · 공격 측(aa6ac: 모드 5 는 다른 칸, 6 은 사람 칸) · 점수판(사람 칸 = 우리 점수) */
export function startMissionGame(mission: OriginalMission, setup: MissionGameSetup = {}): MissionGame {
  const human = humanSideOf(mission)
  const cpu = cpuSideOf(mission)
  const scores: [number, number] = [0, 0]
  scores[human] = mission.start.ourScore
  scores[cpu] = mission.start.opponentScore
  const humanTeamId = missionHumanTeamIdOf(mission, setup.aceMatch)
  const humanOrder = MISSION_HUMAN_START_ORDER[missionKeyOf(mission)] ?? 0
  const isBatterMission = mission.side === '타자'
  // 투수 미션(모드 5)은 aa7f2 갈래 — 사람 칸 타선에 아무도 안 넣는다
  const humanRecords = isBatterMission ? humanRecordsOf(humanOrder, setup.nariRecordSlot) : masterRecords()
  return {
    inning: mission.start.inning - 1,
    offenseSide: mission.side === '투수' ? cpu : human,
    scores,
    // aa608~aa64e — 레코드 +0x8e 아홉 칸씩 (합은 위 `scores` 와 같다)
    inningRuns: missionStartInningRunsOf(mission),
    aceCheckedInning: -1,
    humanBatting: {
      teamId: humanTeamId,
      lineup: rosterLineupOf(humanRecords.length),
      records: humanRecords,
      order: humanOrder,
    },
    ...(isBatterMission ? batterMissionSidesOf(mission, setup, cpu, humanTeamId) : pitcherMissionSidesOf(mission)),
    halfEnded: false,
    autoRelay: null,
  }
}

/** 마스터 팀 타자 줄 그대로 (팀 안 0~11) */
function masterRecords(): number[] {
  return Array.from({ length: BATTERS_PER_TEAM }, (_unused, record) => record)
}

/** 타자 미션(모드 6) — 미션 타자 레코드 칸 · CPU 가 치는 반 이닝의 CPU 타선과 사람 칸 팀 투수진 */
function batterMissionSidesOf(mission: OriginalMission, setup: MissionGameSetup, cpu: 0 | 1, humanTeamId: number): MissionSideFields {
  return {
    humanRecordSlot: missionRecordSlotOf(setup.nariRecordSlot),
    cpuAutoPitching: null,
    cpuAutoBatting: cpuAutoBattingOf(mission, cpu),
    humanPitching: humanPitchingOf(humanTeamId),
  }
}

/** 투수 미션(모드 5) — 사람 칸 팀이 치는 반 이닝의 CPU 수비 */
function pitcherMissionSidesOf(mission: OriginalMission): MissionSideFields {
  return { cpuAutoPitching: startMissionCpuPitching(mission), cpuAutoBatting: null, humanPitching: null }
}

/** 타자 미션의 CPU 타선 (타순 = 레코드 +7 아래 4비트) */
function cpuAutoBattingOf(mission: OriginalMission, cpu: 0 | 1): MissionTeamBatting {
  return {
    teamId: mission.sideTeams[cpu],
    lineup: rosterLineupOf(BATTERS_PER_TEAM),
    records: masterRecords(),
    order: MISSION_CPU_START[missionKeyOf(mission)]?.battingOrder ?? 0,
  }
}

/** 타자 미션의 사람 칸 팀 투수진 — 명부 차례 그대로 (0xaa57c 는 모드 6 에서 안 바꾼다) */
function humanPitchingOf(humanTeamId: number): MissionCpuPitching {
  return {
    teamId: humanTeamId,
    roster: Array.from({ length: PITCHERS_PER_TEAM }, (_unused, slot) => slot),
    mound: { pitcherSlot: 0, stamina: FULL_STAMINA, runsAllowed: 0, pitches: 0, usedSlots: [], justChanged: false },
    inningRunsAllowed: 0,
    ourRuns: 0,
  }
}
