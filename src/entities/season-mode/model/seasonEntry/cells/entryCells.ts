import type { AcePlayer } from '@/shared/config/original/acePlayers'
import type { RosterPlayer } from '@/shared/config/original/roster'
import { entryBatterLineOfRecord, entryPitcherLineOfRecord } from '@/entities/season-mode/model/entryEditor'
import type { SeasonPlayer } from '@/entities/season-mode/model/playerRecruit'
import { aceDetailSourceOf, seasonDetailSourceOf } from '@/entities/season-mode/model/seasonEntry/detail/detailSource'
import { staminaCapacityOf } from '@/entities/season-mode/model/seasonEntry/otherSlices'
import { tableRowOf } from '@/entities/season-mode/model/seasonEntry/roster/tableRow'
import type { SeasonEntryCellSource, SeasonEntryCells } from '@/entities/season-mode/model/seasonEntry/types/entryLists'

/** 레코드 +0x2c 가득 (Xls 투수 행 바이트 44~45 = 10000) */
export const FULL_RECORD_STAMINA = 10000

/**
 * 일반모드(상태 23) — Xls 행 줄 · 스태미나 가득 · 모드 1 · 사기 100. 모드 1 의 팀 레코드(`0x1f9d2` → `0x1f874` = [g+0xb0]+0x5c8 칸)는
 * 경기정보 0x30f20 이 `0x1f8c0`(마스터)을 `0x21d30` → `0x1fe5c` 로 통째 복사한 것이고 +2 에 쓰는 곳이 없다(0xa3a44 는 모드 3·4 칸만,
 * 0x8e3dc 는 모드 2 만 — `teamGameFlow.ourTeamMoraleOf`) → XlsTEAM_DATA 표값 = 전 팀 100
 */
export const GENERAL_ENTRY_CELL_SOURCE: SeasonEntryCellSource = {
  staminaMode: 1,
  teamMorale: 100,
  staminaOf: () => FULL_RECORD_STAMINA,
}

/** 체력 줄 퍼센트 0x572a4 — [ed+0x334] ∈ {1, 2, 3, 4, 8, 9} 면 trunc(+0x2c / 100), 그 밖 100 */
export const staminaPercentOf = (mode: number, stamina: number) =>
  mode >= 0 && mode <= 9 && ((0x31e >> mode) & 1) === 1 ? Math.trunc(stamina / 100) : 100

/** 시즌 진입들의 [ed+0x333] = 1 · [ed+0x334] = 2 — 칸 재료를 따로 안 줄 때 */
export const SEASON_ENTRY_CELL_SOURCE: SeasonEntryCellSource = { staminaMode: 2, teamMorale: 100 }

/** 명단 선수 한 줄의 칸 재료 */
export function seasonEntryCellsOf(
  teamId: number,
  player: SeasonPlayer,
  isPitcher: boolean,
  index: number,
  ability: readonly number[],
  source: SeasonEntryCellSource,
): SeasonEntryCells {
  const table = tableRowOf(teamId, player, isPitcher)
  const profileLow = profileLowOf(table, player)
  const detailSource = seasonDetailSourceOf(teamId, player, isPitcher, ability)
  const head = profileLow === undefined ? {} : { profileLow }
  const detail = detailSource === undefined ? {} : { detailSource }
  if (!isPitcher) return { ...head, ...batterLineCellOf(table, player, source), ...detail }
  return {
    ...head,
    ...pitcherLineCellOf(table, player, source),
    ...detail,
    stamina: staminaCellOf(ability, source, source.staminaOf?.(player, index) ?? player.stamina),
  }
}

/** 시즌 줄 — 부르는 쪽이 준 줄, 안 주면 붙박이 표 칸의 Xls 줄, 표 밖 선수는 비운다 */
function batterLineCellOf(table: RosterPlayer | undefined, player: SeasonPlayer, source: SeasonEntryCellSource): SeasonEntryCells {
  const batterLine = source.batterLineOf?.(player) ?? (table === undefined ? undefined : entryBatterLineOfRecord(table.recordLine))
  return batterLine === undefined ? {} : { batterLine }
}

function pitcherLineCellOf(table: RosterPlayer | undefined, player: SeasonPlayer, source: SeasonEntryCellSource): SeasonEntryCells {
  const pitcherLine = source.pitcherLineOf?.(player) ?? (table === undefined ? undefined : entryPitcherLineOfRecord(table.recordLine))
  return pitcherLine === undefined ? {} : { pitcherLine }
}

/** 레코드 `+0xb & 3` — 붙박이 표 행, 영입 사본의 +0xb, 그것도 없는 투수 사본은 보직 */
function profileLowOf(table: RosterPlayer | undefined, player: SeasonPlayer): number | undefined {
  const record = player.record
  const profile = table?.profile ?? record?.profile ?? (record !== undefined && 'role' in record ? record.role : undefined)
  return profile === undefined ? undefined : profile & 3
}

/** 체력 줄 — 용량 0x66e44(팀, rec, 0) = 사기 보정 체력 + 250 · 퍼센트 0x572a4 */
function staminaCellOf(ability: readonly number[], source: SeasonEntryCellSource, stamina: number): NonNullable<SeasonEntryCells['stamina']> {
  return { capacity: staminaCapacityOf(ability[3] ?? 0, source.teamMorale, false), percent: staminaPercentOf(source.staminaMode, stamina) }
}

/** 마선수 줄 — XlsACE 행을 통째 베낀 레코드(0xb521c · 0xb53f0): +0xb 는 표의 `profile`, 줄은 표의 `recordLine` */
export function aceCellsOf(
  ace: AcePlayer,
  aceIndex: number,
  ability: readonly number[],
  isPitcher: boolean,
  source: SeasonEntryCellSource,
  /** 레코드 +0x2c — 넣은 그때는 10000, 경기 · 하루 끝을 지난 레코드면 그 값 (`SeasonRecordAces.pitcherStamina`) */
  recordStamina: number = FULL_RECORD_STAMINA,
): SeasonEntryCells {
  const detailSource = aceDetailSourceOf(ace, aceIndex, ability, isPitcher)
  if (!isPitcher) return { profileLow: ace.profile & 3, batterLine: entryBatterLineOfRecord(ace.recordLine), detailSource }
  return {
    profileLow: ace.profile & 3,
    detailSource,
    pitcherLine: entryPitcherLineOfRecord(ace.recordLine),
    // 레코드 +0x2c = 10000 — 0xdd 진입 66da `0xb88c8` 이 저장의 마투수 레코드 `0x1f825(app, 번호)`(앱 데이터 +0xc64 + 번호×0x30,
    // 0x20094 6번 갈래가 XlsACE_PIT 행을 부은 것 — 다섯 줄 모두 0x2710)를 0xb521c 로 +0x2c 까지 통째 8번 칸에 넣는다(b5296~b529c).
    // 0x1f824 를 부르는 넷(0x48d50 · 0x5aefc · 0xaae7c · 0xb88c8)은 모두 베껴 가는 쪽이고, 0xe0 에서 돌아온 0xdd 는 다시 안 넣는다
    stamina: staminaCellOf(ability, source, recordStamina),
  }
}
