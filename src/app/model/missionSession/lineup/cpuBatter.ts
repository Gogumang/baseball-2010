import type { MissionRun } from '@/entities/mission/model/missionRun'
import { missionCpuBatterOf } from '@/entities/mission/model/missionCpuTeam'
import { runnerCountOf } from '@/entities/game/model/baseState'
import { lineupSlotOf } from '@/entities/game/model/quickLineup'
import { skillIdsOfBits } from '@/entities/team/model/teamRoster'
import { ACE_BATTERS } from '@/entities/game/model/aceOpponent'
import { aceSkillIdsOf } from '@/entities/mission/model/aceLevel'
import type { CpuSwingSkillSituation } from '@/entities/pitching/model/simulateBatter'
import { missionOpponent } from '@/app/model/missionSession/opponent/missionOpponent'

type CpuBatter = ReturnType<typeof missionCpuBatterOf>

/** 투수 미션 지금 CPU 타자의 0xab214 스킬 번호 — 마타자 칸이면 미션 마선수 행(`aceSkillIdsOf`), 아니면 마스터 줄 +0x14 */
export function missionCpuBatterSkillIdsOf(run: MissionRun, cpuBatter: CpuBatter): readonly number[] {
  if (cpuBatter === null) return []
  if (cpuBatter.isAce) {
    const ace = missionOpponent(run.mission)
    return ace === null ? [] : aceSkillIdsOf(ace)
  }
  return skillIdsOfBits(cpuBatter.row?.skillBits ?? 0, false)
}

/** 투수 미션 지금 CPU 타자의 레코드 칸 0xb6394 — 마타자면 마선수 순번, 아니면 마스터 줄 팀 안 칸 */
export function missionCpuBatterRecordSlotOf(run: MissionRun, cpuBatter: CpuBatter): number {
  if (cpuBatter === null) return 0
  if (!cpuBatter.isAce) return cpuBatter.rosterSlot
  const ace = missionOpponent(run.mission)
  return ace === null ? 0 : Math.max(ACE_BATTERS.indexOf(ace), 0)
}

/** 이 타순 칸의 오늘 타석 결과 링 — CPU 타선이 없으면 빈 줄 */
function recentAtBatCodesOf(run: MissionRun): readonly number[] {
  const batting = run.cpu.batting
  if (batting === null) return []
  return batting.lineup.records[lineupSlotOf(batting.order)]?.results ?? []
}

/**
 * 투수 미션 CPU 타자 스윙 0xab214 의 스킬 갈래가 보는 상황 — 이닝(`st[0x6b]` + 1) · 공격(CPU) 팀이 지는가(ab966: 수비 점수 >
 * 공격 점수) · 주자 · 2루 · 이 타순 칸의 오늘 타석 결과 링
 */
export function missionCpuSwingSituationOf(run: MissionRun, cpuBatter: CpuBatter): CpuSwingSkillSituation {
  const offense = run.game.offenseSide
  return {
    // 투수 스킬 31(0xabcd8)의 `0xb6394(타자)` = +0xa & 0x1f — 마스터 줄은 팀 안 칸(0~11, Xls 행 그대로 · 0xb603c 가 다시
    // 매겨도 0~8 칸은 같다), 마타자는 XlsACE_BAT 행의 순번(+0xa = 0x40 + 순번, 0xb603c 는 마선수를 안 건드린다)
    batterOrderIndex: missionCpuBatterRecordSlotOf(run, cpuBatter),
    inning: run.game.inning + 1,
    isLosing: run.game.scores[offense === 0 ? 1 : 0] > run.game.scores[offense],
    runnerCount: runnerCountOf(run.bases),
    hasSecondBaseRunner: run.bases.second,
    recentAtBatCodes: recentAtBatCodesOf(run),
  }
}

/**
 * **투수 미션 타석 장면의 경기 스킬 표시 판 재료** (`PitcherSideStage.skillPanel`) — CPU 스윙 0xab214 가 읽는 것과 같은 두 레코드:
 * 지금 CPU 타자(+0x14 · 0xb6394 · 그 타순 칸 결과 링)와 미션 투수(+0x14, 장착 비트 + 16). 공격 측 st[9] 는 CPU 칸이다.
 */
export function missionPitchingSkillPanelOf(
  run: MissionRun,
  pitcherSkillIds: readonly number[],
): {
  readonly attackSide: number
  readonly batterSkillIds: readonly number[]
  readonly batterRecordSlot: number
  readonly pitcherSkillIds: readonly number[]
  readonly recentAtBatCodes: readonly number[]
} {
  const cpuBatter = missionCpuBatterOf(run.cpu)
  return {
    attackSide: run.game.offenseSide,
    batterSkillIds: missionCpuBatterSkillIdsOf(run, cpuBatter),
    batterRecordSlot: missionCpuBatterRecordSlotOf(run, cpuBatter),
    pitcherSkillIds,
    recentAtBatCodes: missionCpuSwingSituationOf(run, cpuBatter).recentAtBatCodes,
  }
}
