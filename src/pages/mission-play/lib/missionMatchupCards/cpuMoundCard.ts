import type { MissionRun } from '@/entities/mission/model/missionRun'
import { MISSION_ACE_ROSTER_SLOT, masterGameAbilityOf, missionAcePitcherOf } from '@/entities/mission/model/missionCpuTeam'
import { missionOpponentOf } from '@/entities/game/model/aceOpponent'
import { teamPitchers } from '@/entities/team/model/teamRoster'
import { teamRecordMoraleOf } from '@/entities/team/model/teamMorale'
import { pitcherHandOf } from '@/entities/pitching/model/pitcherHand'
import { pitcherCardStatsOf, pitcherLineOfRecord, staminaGaugeOf } from '@/widgets/matchup-cards/lib/matchupRecord'
import type { MatchupPitcherCard } from '@/widgets/matchup-cards/ui/MatchupCards'

type AceLevels = Readonly<Record<number, number>> | undefined

/** 마투수 판 — XlsACE_PIT 행 줄 · 체력은 마투수 실효 능력치(없으면 표의 주력) */
function aceMoundCardOf(run: MissionRun, aceLevels: AceLevels, teamMorale: number, isFirstPitcher: boolean, stamina: number): MatchupPitcherCard {
  const ace = missionOpponentOf('투수', run.mission.opponentAce)
  if (ace === null) return { isComputer: true }
  const acePitcher = missionAcePitcherOf(run.mission, aceLevels)
  return {
    isComputer: true,
    name: ace.name,
    role: ace.profile & 3,
    throwsLeft: pitcherHandOf(ace.profile >> 4, true) === 1,
    ...pitcherCardStatsOf(pitcherLineOfRecord(ace.recordLine)),
    stamina: staminaGaugeOf({
      staminaAbility: acePitcher?.staminaAbility ?? ace.ability.run,
      teamMorale,
      isFirstPitcher,
      stamina,
    }),
  }
}

/** 타자 미션의 CPU 마운드 판 — 마스터 줄이면 그 행, 마투수면 XlsACE_PIT 행 */
export function cpuMoundCardOf(run: MissionRun, aceLevels: AceLevels): MatchupPitcherCard {
  const pitching = run.cpu.pitching
  if (pitching === null) return { isComputer: true }
  const { mound } = pitching
  const row = pitching.roster[mound.pitcherSlot] ?? mound.pitcherSlot
  const teamMorale = teamRecordMoraleOf(pitching.teamId)
  const isFirstPitcher = mound.usedSlots.length === 0
  if (row === MISSION_ACE_ROSTER_SLOT) return aceMoundCardOf(run, aceLevels, teamMorale, isFirstPitcher, mound.stamina)
  const player = teamPitchers(pitching.teamId)[row]
  if (player === undefined) return { isComputer: true }
  return {
    isComputer: true,
    name: player.name,
    role: player.profile & 3,
    throwsLeft: pitcherHandOf(player.profile >> 4, false) === 1,
    ...pitcherCardStatsOf(pitcherLineOfRecord(player.recordLine)),
    stamina: staminaGaugeOf({
      staminaAbility: masterGameAbilityOf(player, true, 3),
      teamMorale,
      isFirstPitcher,
      stamina: mound.stamina,
    }),
  }
}
