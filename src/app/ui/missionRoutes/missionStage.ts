import { missionPitchingSkillPanelOf } from '@/app/model/useMissionSession'
import type { useMissionSession } from '@/app/model/useMissionSession'
import { humanSideOf } from '@/entities/mission/model/missionGame'
import type { MissionRun } from '@/entities/mission/model/missionRun'
import type { PitcherRun } from '@/entities/mission/model/pitcherRun'
import type { OriginalMission } from '@/shared/config/original/missions'
import { staminaPercentOf } from '@/entities/pitcher-career/model/pitcherStamina'
import type { PitchingStageSource } from '@/pages/pitching/ui/PitchingScreen'
import { missionCpuBatterOf } from '@/entities/mission/model/missionCpuTeam'
import { pitcherHandOf } from '@/entities/pitching/model/pitcherHand'
import { aceBatterProfileOf, batterHandOf } from '@/widgets/matchup-cards/lib/matchupRecord'
import { batterEquipmentOf, pitcherEquipmentOf } from '@/widgets/batting-stage/lib/batterLayers'
import { missionRunnerAcesOf, missionWalkTeamOf } from '@/entities/mission/model/missionRunners'
import type { BenchClearingOffenseAces } from '@/widgets/field-walk/lib/benchClearingFieldInput'
import { aceRunnerBasesOf } from '@/widgets/field-walk/lib/benchClearingFieldInput'

/**
 * 경기[0x28 + 칸] 두 측 팀 — 다른 칸은 레코드 +2 아래 4비트 그대로, 사람 칸은 0xaa57c 가 세운 팀(`MissionGame.humanBatting.teamId`:
 * 보통 미션은 레코드 팀, 마선수 대결은 그 편 나리 저장 팀). 점수판 재료(`missionRunScoreBoardOf`)는 레코드의 `sideTeams` 를 읽는다.
 */
export function missionWithSideTeamsOf(mission: OriginalMission, humanTeamId: number): OriginalMission {
  const human = humanSideOf(mission)
  if (mission.sideTeams[human] === humanTeamId) return mission
  const other = mission.sideTeams[human === 0 ? 1 : 0]
  return { ...mission, sideTeams: human === 0 ? [humanTeamId, other] : [other, humanTeamId] }
}

type MissionSession = ReturnType<typeof useMissionSession>

/** 지금 CPU 타자 0xae89c — 마타자 칸이면 미션 상대 마선수(`opponentAce` − 1)의 XlsACE_BAT_DATA +0xb, 아니면 명단 줄 `+0xb` */
function cpuBatterOf(run: PitcherRun) {
  const batter = missionCpuBatterOf(run.cpu)
  const aceIndex = batter?.isAce === true ? run.mission.opponentAce - 1 : -1
  const profile = aceIndex >= 0 ? aceBatterProfileOf(aceIndex) : (batter?.row?.profile ?? 0)
  return { batter, aceIndex, profile }
}

/** 지금 CPU 타자의 손 0xb63c0 — 마타자 칸은 손 표 0xd88b0, 아니면 명단 줄 `+0xb` 폼 & 1 (`pitchingStageOf` 와 같은 길) */
export function missionCpuBatterHandOf(run: PitcherRun): number {
  const { aceIndex, profile } = cpuBatterOf(run)
  return batterHandOf(profile, aceIndex)
}

/** 마운드 미션 투수 — 폼 · 손 · 장비 겹 · 피부 · 체력% */
function missionPitcherStageOf(session: MissionSession) {
  const form = session.pitcher.repertoire.form
  const equipment = session.pitcher.equipmentLevels
  return {
    pitcherForm: form,
    pitcherMagicNumber: session.pitcher.repertoire.magicNumber,
    pitcherHand: pitcherHandOf(form, false),
    ...(equipment === undefined ? {} : { pitcherEquipment: pitcherEquipmentOf(equipment) }),
    // 마운드 바탕 벌 = 피부 × 15 + 사람 칸 팀 (482c0~482fc → 0x793b0 의 794c2) — 팀은 hud.ourTeamId
    pitcherSkinIndex: session.pitcher.skinIndex,
    // 0x38d1c 의 지친 표시 — 미션 투수 +0x2c 도 공마다 깎인다(0xa5e14). 모드 5 는 0xaebb0 의 모드 7 갈래가 아니라 실제 체력%
    pitcherStaminaPercent: staminaPercentOf(session.pitcherStamina),
  }
}

/** 타석 CPU 타자 — 폼 · 피부 · 마타자 손 · 장비 겹 */
function cpuBatterStageOf(run: PitcherRun) {
  const { batter, aceIndex, profile } = cpuBatterOf(run)
  return {
    batterForm: profile >> 4,
    batterSkinIndex: (profile >> 2) & 3,
    ...(aceIndex >= 0 ? { batterSide: batterHandOf(profile, aceIndex), aceBatterOrder: aceIndex } : {}),
    // 타석 교대 0x47cc8 — 0x768b4 로 장비 칸을 비운 뒤 마타자가 아니면 47e80~47eb6 이 지금 타자 레코드(0xae89c(공격 팀))
    // +0x19 · +0x1a 니블 − 1 로 장비 겹 0x78fd8 을 싣는다(모드 갈래 없음). 미션 CPU 팀은 마스터 줄(Xls 행)이라 그 행의 니블
    ...(aceIndex < 0 && batter?.row != null
      ? {
          batterEquipment: batterEquipmentOf({
            hit: batter.row.equipment[0],
            power: batter.row.equipment[1],
            run: batter.row.equipment[3],
          }),
        }
      : {}),
  }
}

/**
 * 투수 미션 타석 장면 재료 — 마운드는 미션 투수(폼 · 손 0xb63c0 = 폼 & 1 · 장비 겹 — 0x108f8 이 선수 게터 0x1fbd0 의 기록 사본을
 * 0x10810 에 넘겨 니블로 0x79790), 타석은 지금 CPU 타자 0xae89c 의 명단 줄(폼 `rec[0xb] >> 4` · 피부 `(rec[0xb] >> 2) & 3` · 팀).
 * 마타자 칸은 미션 상대 마선수(`opponentAce` − 1)의 XlsACE_BAT_DATA +0xb · 손 표 0xd88b0.
 * 마타자는 순번 0xb63a0 으로 몸통 적재 0x78ab0 이 `ace/batter_*` 를 싣는다(`aceBatterOrder`).
 */
export function pitchingStageOf(session: MissionSession, run: PitcherRun): PitchingStageSource {
  return {
    lastThrow: session.lastPitcherThrow,
    // 3e0aa — 0x12 진입 틀에 공 도착이 적는다(`lastPitchJudgementCleared`)
    isJudgementCleared: session.lastPitchJudgementCleared,
    // 붙든 삼진의 0x12 대기 — HUD 아웃은 진입 3e1a6 이 올린 값 (r298)
    resultHold: session.pendingBenchClearing,
    ...missionPitcherStageOf(session),
    ...cpuBatterStageOf(run),
    batterTeamIndex: run.cpu.batting?.teamId ?? 0,
    // 경기 스킬 표시 판 — 지금 CPU 타자 · 미션 투수(장착 비트 + 16) · 공격 측(CPU 칸)
    skillPanel: missionPitchingSkillPanelOf(run, session.pitcher.skillIds),
  }
}

/**
 * 투수 미션 벤치 클리어링 공격 줄(CPU 타선) 재료 — 3a97e: 사구를 맞은 지금 타자가 마타자면 그 레코드 니블(마타자는 0 — `missionWalkTeamOf`)로
 * 맞바꾼다(니블 0 이면 원본은 O[−1] = [장면+0x1754], `benchOffenseSeatsOf`). 3aa1a: 루 위 마선수 주자(+0x9c)는 수비 판 재료 `missionRunnerAcesOf`
 */
export function missionBenchOffenseOf(run: MissionRun | PitcherRun): BenchClearingOffenseAces | null {
  const team = missionWalkTeamOf(run, false)
  if (team === null) return null
  const aces = missionRunnerAcesOf(run)
  const batterAce = aces.batter ?? null
  const batterRecord = batterAce === null ? undefined : team.records.find((record) => record.ace === batterAce)
  return {
    ...team,
    batter: batterAce === null ? null : { position: batterRecord?.position ?? 0, ace: batterAce },
    aceRunnerBases: aceRunnerBasesOf(aces, run.bases),
  }
}
