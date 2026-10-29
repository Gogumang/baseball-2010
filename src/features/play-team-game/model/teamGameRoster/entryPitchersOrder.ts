import { teamPitchers } from '@/entities/team/model/teamRoster'
import { rosterPitcherRoleOf } from '@/entities/pitching/model/pitcherChange'
import { rowAbilityOf } from '@/features/play-team-game/model/teamGameRoster/abilityContext'
import { rosterRepertoireOf } from '@/features/play-team-game/model/teamGameRoster/rosterAbilities'
import {
  NO_ACE_BATTER,
  type TeamEntryOrder,
  type TeamEntryPitcher,
  type TeamEntryPitcherRecord,
  type TeamEntryTablePitcher,
} from '@/features/play-team-game/model/teamGameRoster/entryTypes'
import { equipmentOf, tableSlotsOfOrder } from '@/features/play-team-game/model/teamGameRoster/orderSlots'

type OrderPitcher = TeamEntryOrder['pitchers'][number]

/** 장비 니블을 실은 제 팀 표 자리(`TeamEntryTablePitcher`, 표 팀 = 경기 팀)도 그 표 칸을 쓴 것으로 센다 — 수로 온 칸과 같다 */
function ownTableSlotOf(pitcher: OrderPitcher, teamId: number): number | null {
  if (typeof pitcher === 'number') return pitcher
  return 'tableSlot' in pitcher && (pitcher.tableTeamId ?? teamId) === teamId ? pitcher.tableSlot : null
}

/** 표 자리의 보직(+0xb & 3, 칸 차례) · 표 칸 · (옮겨 온 투수만) 표 팀 */
function tableSeatOf(tableSlot: number, tableTeamId: number, teamId: number): Pick<TeamEntryPitcher, 'role' | 'tableSlot' | 'tableTeamId'> {
  const role = rosterPitcherRoleOf(tableSlot)
  return { ...(role === undefined ? {} : { role }), tableSlot, ...(tableTeamId === teamId ? {} : { tableTeamId }) }
}

/**
 * 표 자리 투수(트레이드로 옮겨 온 투수 · 장비 니블을 실은 제 팀 투수) — 그 표 행의 이름·능력치·구질(전역 행 = 팀 × 8 + 칸)·
 * 보직(+0xb & 3, 칸 차례)으로 서고, 능력치는 레코드의 장비 니블로 0xb6414 를 먹인다
 */
function tableSeatPitcherOf(pitcher: TeamEntryTablePitcher, teamId: number, orderIndex: number): TeamEntryPitcher {
  const tableTeamId = pitcher.tableTeamId ?? teamId
  const player = teamPitchers(tableTeamId)[pitcher.tableSlot]
  return {
    name: player?.name ?? '',
    ability: rowAbilityOf(player, true, pitcher.equipment),
    ...equipmentOf(pitcher.equipment ?? player?.equipment),
    repertoire: rosterRepertoireOf(tableTeamId, pitcher.tableSlot),
    aceIndex: NO_ACE_BATTER,
    orderIndex,
    skillBits: player?.skillBits ?? 0,
    ...tableSeatOf(pitcher.tableSlot, tableTeamId, teamId),
  }
}

/** 붙박이 표 밖 투수(영입한 명전·나리) — 기록 사본에 든 칸만 싣는다 */
function recordPitcherOf(pitcher: TeamEntryPitcherRecord, orderIndex: number): TeamEntryPitcher {
  return {
    name: pitcher.name,
    ability: pitcher.ability,
    repertoire: pitcher.repertoire,
    aceIndex: NO_ACE_BATTER,
    orderIndex,
    ...(pitcher.role === undefined ? {} : { role: pitcher.role }),
    ...(pitcher.recordId === undefined ? {} : { recordId: pitcher.recordId }),
    ...(pitcher.salaryGrade === undefined ? {} : { salaryGrade: pitcher.salaryGrade }),
    ...(pitcher.skillBits === undefined ? {} : { skillBits: pitcher.skillBits }),
    ...equipmentOf(pitcher.equipment),
  }
}

/** 경기 팀 표 칸 투수 */
function rosterSlotPitcherOf(teamId: number, slot: number, orderIndex: number): TeamEntryPitcher {
  const player = teamPitchers(teamId)[slot]
  return {
    name: player?.name ?? '',
    ability: rowAbilityOf(player, true),
    ...equipmentOf(player?.equipment),
    repertoire: rosterRepertoireOf(teamId, slot),
    aceIndex: NO_ACE_BATTER,
    orderIndex,
    role: rosterPitcherRoleOf(slot),
    tableSlot: slot,
    skillBits: player?.skillBits ?? 0,
  }
}

/** 고친 차례로 세운 투수 명단 — 0번이 저장 레코드의 0번이다 (선발 칸은 부르는 쪽이 정한다) */
export function entryPitchersOfOrder(teamId: number, order: TeamEntryOrder): readonly TeamEntryPitcher[] {
  const tableSize = teamPitchers(teamId).length
  const slots = tableSlotsOfOrder(
    order.pitchers.map((pitcher) => ownTableSlotOf(pitcher, teamId)),
    tableSize,
  )
  return order.pitchers.map((pitcher, orderIndex): TeamEntryPitcher => {
    if (typeof pitcher !== 'number' && 'tableSlot' in pitcher) return tableSeatPitcherOf(pitcher, teamId, orderIndex)
    if (typeof pitcher !== 'number') return recordPitcherOf(pitcher, orderIndex)
    return rosterSlotPitcherOf(teamId, slots[orderIndex] ?? 0, orderIndex)
  })
}
