import { teamBatters } from '@/entities/team/model/teamRoster'
import type { RosterPlayer } from '@/shared/config/original/roster'
import { rowAbilityOf } from '@/features/play-team-game/model/teamGameRoster/abilityContext'
import {
  NO_ACE_BATTER,
  NO_ROSTER_SLOT,
  type TeamEntryBatter,
  type TeamEntryBatterRecord,
  type TeamEntryOrder,
} from '@/features/play-team-game/model/teamGameRoster/entryTypes'
import { equipmentOf, isForeignTable, tableSlotsOfOrder } from '@/features/play-team-game/model/teamGameRoster/orderSlots'

type OrderBatter = TeamEntryOrder['batters'][number]

/** 기록으로 선 영입 선수(명전 · 나리) — 기록 사본에 든 칸만 싣는다 */
function recordBatterOf(record: TeamEntryBatterRecord, position: number): TeamEntryBatter {
  const { recordId, salaryGrade, skillBits, equipment, profile } = record
  return {
    name: record.name,
    ability: record.ability,
    position,
    aceIndex: NO_ACE_BATTER,
    rosterSlot: NO_ROSTER_SLOT,
    ...(recordId === undefined ? {} : { recordId }),
    ...(salaryGrade === undefined ? {} : { salaryGrade }),
    ...(skillBits === undefined ? {} : { skillBits }),
    ...equipmentOf(equipment),
    ...(profile === undefined ? {} : { profile }),
  }
}

/** 옮겨 온 선수 — 레코드는 옛 팀 Xls 행 사본이라 그 행의 이름·능력치로 서고, 기록도 그 자리로 쌓는다 */
function foreignBatterOf(batter: OrderBatter, tableTeamId: number, position: number): TeamEntryBatter {
  const player = teamBatters(tableTeamId)[batter.rosterSlot]
  const equipment = batter.equipment ?? player?.equipment
  return {
    name: player?.name ?? '',
    ability: rowAbilityOf(player, false, equipment),
    ...equipmentOf(equipment),
    position,
    aceIndex: NO_ACE_BATTER,
    rosterSlot: batter.rosterSlot,
    tableTeamId,
    skillBits: player?.skillBits ?? 0,
  }
}

/** 경기 팀 표 칸 선수 — 표 밖 칸을 채운 자리(`tableSlotsOfOrder` 근사)는 그 표 선수로 서므로 차례의 니블을 안 쓴다 */
function tableBatterOf(batter: OrderBatter, rosterSlot: number, player: RosterPlayer | undefined, position: number): TeamEntryBatter {
  const equipment = (rosterSlot === batter.rosterSlot ? batter.equipment : undefined) ?? player?.equipment
  return {
    name: player?.name ?? '',
    ability: rowAbilityOf(player, false, equipment),
    ...equipmentOf(equipment),
    position,
    aceIndex: NO_ACE_BATTER,
    rosterSlot,
    skillBits: player?.skillBits ?? 0,
  }
}

/** 고친 차례로 세운 타자 명단 — 수비 위치는 차례가 든 값(편집기가 고친 +0x1c)이다 */
export function entryBattersOfOrder(teamId: number, order: TeamEntryOrder): readonly TeamEntryBatter[] {
  const table = teamBatters(teamId)
  const slots = tableSlotsOfOrder(
    order.batters.map((batter) => (batter.record === undefined && !isForeignTable(batter.tableTeamId, teamId) ? batter.rosterSlot : null)),
    table.length,
  )
  return order.batters.map((batter, index) => {
    const position = batter.position & 0xf
    if (batter.record !== undefined) return recordBatterOf(batter.record, position)
    if (isForeignTable(batter.tableTeamId, teamId)) return foreignBatterOf(batter, batter.tableTeamId, position)
    const rosterSlot = slots[index] ?? 0
    return tableBatterOf(batter, rosterSlot, table[rosterSlot], position)
  })
}
