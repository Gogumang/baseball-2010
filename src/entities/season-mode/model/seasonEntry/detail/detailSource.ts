import type { AcePlayer } from '@/shared/config/original/acePlayers'
import { PITCHERS } from '@/shared/config/original/roster'
import type { RosterPlayer } from '@/shared/config/original/roster'
import { ACE_PITCHER_REPERTOIRES, ROSTER_PITCHER_REPERTOIRES } from '@/shared/config/original/pitcherRepertoires'
import type { PitcherRepertoire } from '@/shared/config/original/pitcherRepertoires'
import type { PlayerDetailSource } from '@/entities/season-mode/model/entryEditor'
import type { SeasonPlayer } from '@/entities/season-mode/model/playerRecruit'
import { tableRowOf } from '@/entities/season-mode/model/seasonEntry/roster/tableRow'
import type { SeasonEntryBatterRecord, SeasonEntryPitcherRecord } from '@/entities/season-mode/model/seasonEntry/types/records'

const detailRepertoireOf = (repertoire: Pick<PitcherRepertoire, 'form' | 'magicId' | 'pitchMask'> | undefined) =>
  repertoire === undefined ? undefined : { form: repertoire.form, magicNumber: repertoire.magicId, pitchMask: repertoire.pitchMask }

/**
 * 명단 선수 레코드의 상세 창 칸 — 0xe0 그림 0xb074 → 0x5cfec(0x5c984) 끝 0x5cfc8 이 커서 줄 레코드를 0x5b798 에 넘긴다.
 * 붙박이 표 선수는 Xls 행(+0xb · +0x14 · +0x1b · 레퍼토리 `ROSTER_PITCHER_REPERTOIRES`, 같은 차례), 영입 사본은 옮긴 기록 칸.
 * 레코드 +0x18(필살)은 붙박이 표가 0 이고 타자 사본은 `specialNumber` 다.
 * 영입 사본의 +0x1b(연봉)는 나리 연봉 쓰기 0xa4fd8 가 둔 min(연봉 / 10, 255) 이다(`salaryGrade` — 나리 사본은 영입 때 커리어 연봉,
 * 명전 칸은 등록 때 연봉으로 센다). 그 칸이 없는 옛 사본 · 옛 명전 기록은 비운다. 명전 칸에서만 이름을 찾는 표 밖 선수(사본 없음)는 칸을 모른다.
 */
export function seasonDetailSourceOf(
  teamId: number,
  player: SeasonPlayer,
  isPitcher: boolean,
  ability: readonly number[],
): PlayerDetailSource | undefined {
  const table = tableRowOf(teamId, player, isPitcher)
  if (table !== undefined) return tableDetailSourceOf(table, isPitcher, ability)
  const record = player.record
  if (record === undefined) return undefined
  return copiedRecordDetailSourceOf(record, isPitcher, ability)
}

/** 영입 사본 — 옮긴 기록 칸(+0xb · +0x14 · +0x1b), 투수 사본은 레퍼토리 · 타자 사본은 +0x18 `specialNumber` */
function copiedRecordDetailSourceOf(
  record: SeasonEntryBatterRecord | SeasonEntryPitcherRecord,
  isPitcher: boolean,
  ability: readonly number[],
): PlayerDetailSource {
  const common = {
    isPitcher,
    abilities: ability,
    aceIndex: -1,
    profile: record.profile ?? 0,
    skillBits: record.skillBits ?? 0,
    grade: record.salaryGrade ?? null,
  }
  if ('repertoire' in record) return { ...common, repertoire: detailRepertoireOf(record.repertoire) }
  return { ...common, specialNumber: record.specialNumber ?? 0 }
}

/** 붙박이 표 행(Xls 0x30 바이트) 레코드의 상세 창 칸 — +0xb · +0x14 · +0x1b · 레퍼토리(`PITCHERS` 와 같은 차례) · +0x18 = 0 */
export function tableDetailSourceOf(table: RosterPlayer, isPitcher: boolean, ability: readonly number[]): PlayerDetailSource {
  return {
    isPitcher,
    abilities: ability,
    aceIndex: -1,
    profile: table.profile,
    skillBits: table.skillBits,
    grade: table.grade,
    ...(isPitcher ? { repertoire: detailRepertoireOf(ROSTER_PITCHER_REPERTOIRES[PITCHERS.indexOf(table)]) } : { specialNumber: 0 }),
  }
}

/** 마선수 줄 — XlsACE 행을 통째 베낀 레코드 (+0xb · +0x14 · 마투수 레퍼토리 `ACE_PITCHER_REPERTOIRES`) */
export function aceDetailSourceOf(ace: AcePlayer, aceIndex: number, ability: readonly number[], isPitcher: boolean): PlayerDetailSource {
  return {
    isPitcher,
    abilities: ability,
    aceIndex,
    profile: ace.profile,
    skillBits: ace.skillBits,
    grade: null,
    ...(isPitcher ? { repertoire: detailRepertoireOf(ACE_PITCHER_REPERTOIRES[aceIndex]) } : {}),
  }
}
