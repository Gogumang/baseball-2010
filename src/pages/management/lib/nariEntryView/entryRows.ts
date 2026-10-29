import { MY_RECORD_SLOT } from '@/entities/career/model/nariTeamRecord'
import type { NariTeamRecord } from '@/entities/career/model/nariTeamRecord'
import { teamBatters, teamPitchers } from '@/entities/team/model/teamRoster'
import type { RosterPlayer } from '@/shared/config/original/roster'
import { ACE_BATTERS, ACE_PITCHERS } from '@/entities/game/model/aceOpponent'
import { aceDetailSourceOf, tableDetailSourceOf } from '@/entities/season-mode/model/seasonEntry'
import { aceCellsOf, equippedRowAbilityOf, nariBatterCellsOf, nariPitcherCellsOf } from './rowCells'
import type { NariEntryBatter, NariEntryCellSource, NariEntryFace, NariEntryPitcher } from './types'

type BatterRecordRow = NariTeamRecord['batters'][number]
type SpecialPitcher = (slot: number) => (NariEntryFace & { readonly isAce: boolean }) | undefined

/** 마선수 표 한 줄 — 네 칸은 타자 칸 이름으로 들었다(투수는 제구·구속·변화·체력 차례, `aceOpponent` 주석) */
function aceFaceOf(ace: (typeof ACE_BATTERS)[number], index: number, isPitcher: boolean): NariEntryFace {
  const ability = [ace.ability.hit, ace.ability.power, ace.ability.defense, ace.ability.run]
  return { name: ace.name, ability, profileLow: ace.profile & 3, detailSource: aceDetailSourceOf(ace, index, ability, isPitcher) }
}

const aceBatterFace = (index: number): NariEntryFace => {
  const ace = ACE_BATTERS[index]
  return ace === undefined ? { name: '마타자', ability: [] } : aceFaceOf(ace, index, false)
}

/** 마투수 표의 네 칸은 타자 칸 이름으로 들었다 — 제구·구속·변화·체력 차례 (`aceOpponent` 주석) */
export const acePitcherFace = (index: number): NariEntryFace => {
  const ace = ACE_PITCHERS[index]
  return ace === undefined ? { name: '마투수', ability: [] } : aceFaceOf(ace, index, true)
}

/** 붙박이 표 행의 보직 딱지 · 상세 창 재료 — 행이 없으면 아무 칸도 없다 */
const tableFaceCellsOf = (player: RosterPlayer, isPitcher: boolean, ability: readonly number[]) => ({
  profileLow: player.profile & 3,
  detailSource: tableDetailSourceOf(player, isPitcher, ability),
})

/** 붙박이 타자 줄 — 레코드 장비 니블(나리 새 시즌 CPU 장비 굴림 0x665e8)이 있으면 상세 창 도형 값 0xb6414(rec, k, 1) 이 그 보너스를 먹는다 */
function tableBatterOf(
  player: RosterPlayer | undefined,
  row: BatterRecordRow,
  teamId: number,
  cells: NariEntryCellSource | undefined,
): NariEntryBatter {
  if (player === undefined) return { name: '', ability: [], isAce: false, position: row.position }
  const ability = equippedRowAbilityOf(player, row.equipment, false)
  return {
    name: player.name,
    ability,
    isAce: false,
    position: row.position,
    ...tableFaceCellsOf(player, false, ability),
    ...nariBatterCellsOf(cells, teamId, row.slot, player),
  }
}

/**
 * 타자 탭 목록 — 레코드 타자 배열 차례 그대로(`0x55724` 가 `[팀+0x18]` 을 훑는다). 내 선수 줄은 `me`(타자편 커리어) 로,
 * 마타자 줄은 마선수 표로, 나머지는 그 팀 붙박이 표 행으로 채운다.
 */
export function nariEntryBattersOf(record: NariTeamRecord, teamId: number, me: NariEntryFace | null, cells?: NariEntryCellSource): NariEntryBatter[] {
  const table = teamBatters(teamId)
  return record.batters.map((row) => {
    if (row.ace !== undefined) {
      const aceLine = ACE_BATTERS[row.ace]?.recordLine ?? []
      return { ...aceBatterFace(row.ace), ...aceCellsOf(cells, aceLine, false, 0), isAce: true, position: row.position }
    }
    if (row.slot === MY_RECORD_SLOT) return { ...(me ?? { name: '', ability: [] }), isAce: false, position: row.position }
    return tableBatterOf(table[row.slot], row, teamId, cells)
  })
}

/** 붙박이 투수 줄 — 레코드 투수 장비 니블이 있으면 그 보너스를 먹는다 */
function tablePitcherOf(
  player: RosterPlayer | undefined,
  slot: number,
  teamId: number,
  cells: NariEntryCellSource | undefined,
  equipment: readonly number[] | undefined,
): NariEntryPitcher {
  if (player === undefined) return { name: '', ability: [], isAce: false }
  const ability = equippedRowAbilityOf(player, equipment, true)
  return { name: player.name, ability, isAce: false, ...tableFaceCellsOf(player, true, ability), ...nariPitcherCellsOf(cells, teamId, slot, player) }
}

/**
 * 투수 탭 목록 — 투수 배열 차례(붙박이 표 칸, 0번 = 오늘 선발). `special` 이 표 밖 칸(마투수 · 투수편 내 투수)을 채운다 —
 * 돌려준 값의 `isAce` 가 마선수 잠금이다.
 */
export function nariEntryPitchersOf(
  teamId: number,
  order: readonly number[],
  special: SpecialPitcher = () => undefined,
  cells?: NariEntryCellSource,
  aceRecordLineOf: (slot: number) => readonly number[] | undefined = () => undefined,
  /** 레코드 투수 장비 니블 — 붙박이 표 칸 → 네 칸 (`NariTeamRecord.pitcherEquipment`, 나리 새 시즌 0x665e8). 없으면 Xls 행 */
  pitcherEquipment?: Readonly<Record<number, readonly number[]>>,
): NariEntryPitcher[] {
  const table = teamPitchers(teamId)
  return order.map((slot) => {
    const found = special(slot)
    const aceLine = aceRecordLineOf(slot)
    if (found !== undefined && aceLine !== undefined) return { ...found, ...aceCellsOf(cells, aceLine, true, found.ability[3] ?? 0) }
    if (found !== undefined) return found
    return tablePitcherOf(table[slot], slot, teamId, cells, pitcherEquipment?.[slot])
  })
}
