import { HALL_OF_FAME_FIRST_ID } from '@/entities/season-mode/model/playerRecruit'
import type { SeasonPlayer, SeasonTeamRoster } from '@/entities/season-mode/model/playerRecruit'
import { seasonRecordAbilityOf } from '@/entities/season-mode/model/seasonEntry/records/recordAbility'
import { NOT_IN_ROSTER } from '@/entities/season-mode/model/seasonEntry/roster/seats'
import type { SeasonEntryBatterRecord, SeasonEntryOrder, SeasonEntryRecordSource } from '@/entities/season-mode/model/seasonEntry/types/records'

type BatterOrder = SeasonEntryOrder['batters'][number]
type PitcherOrder = SeasonEntryOrder['pitchers'][number]

/** 붙박이 표 선수(id < 0xb4) — 표 밖(영입 나리 · 명전) 선수는 기록으로 선다 */
const isTablePlayer = (player: SeasonPlayer) => player.id < HALL_OF_FAME_FIRST_ID

/**
 * 기록으로 선 선수의 지금 레코드 니블 — 시즌 장비 창(0xdc → 0x7d90)이 쓴 시즌 명단 값, 없으면 영입 0xc554 가 옮긴 기록 사본의 니블.
 * 둘 다 없으면(니블 칸이 생기기 전의 옛 사본) 싣지 않는다 — 맨몸으로 그린다.
 * ⚠️ 이사 못 함: 1514e8c 앞에 영입한 나리 사본은 영입 순간의 니블을 남기지 않았고 지금 나리 저장은 그 뒤에 바뀌었을 수 있어
 *    되찾을 길이 없다(지어내지 않는다). 니블 없는 옛 명전 기록도 같다
 */
function recordNibblesOf(player: SeasonPlayer, record: Pick<SeasonEntryBatterRecord, 'equipment'>): { readonly equipment?: readonly number[] } {
  const equipment = player.equipment ?? record.equipment
  return equipment === undefined ? {} : { equipment }
}

/** 팀 경기에 넘길 내 팀 명단 순서 (`SeasonEntryBatterRecord` 머리 설명) */
export function seasonEntryOrderOf(roster: SeasonTeamRoster, recordOf?: SeasonEntryRecordSource): SeasonEntryOrder {
  return {
    batters: roster.batters.map((player) => batterOrderOf(player, recordOf)),
    pitchers: roster.pitchers.map((player) => pitcherOrderOf(player, recordOf)),
  }
}

function batterOrderOf(player: SeasonPlayer, recordOf: SeasonEntryRecordSource | undefined): BatterOrder {
  const position = player.fieldPosition & 0xf
  if (isTablePlayer(player)) {
    // 장비 니블(+0x19 · +0x1a)은 레코드에 있어 경기의 0xb6414 가 먹는다 — 저장 명단에 있을 때만 싣는다(없으면 표 행 값)
    return {
      rosterSlot: player.id,
      position,
      ...(player.tableTeamId === undefined ? {} : { tableTeamId: player.tableTeamId }),
      ...(player.equipment === undefined ? {} : { equipment: player.equipment }),
    }
  }
  const record = player.record ?? recordOf?.batter(player)
  if (record === undefined) return { rosterSlot: NOT_IN_ROSTER, position }
  return { rosterSlot: NOT_IN_ROSTER, position, record: batterRecordOrderOf(player, record) }
}

/**
 * 원본 id 를 함께 실어 그 선수의 시즌 기록을 제 줄(리그 기록표의 표 밖 줄)로 쌓게 한다.
 * 능력치는 그 기록의 0xb6414 를 지금 니블로 다시 셈한다 — 시즌 장비 창이 산 장비가 얹힌다 (`seasonRecordAbilityOf`)
 */
function batterRecordOrderOf(player: SeasonPlayer, record: SeasonEntryBatterRecord): SeasonEntryBatterRecord {
  return {
    name: record.name,
    ability: seasonRecordAbilityOf(record, player.equipment, false),
    recordId: player.id,
    // +0x1b(연봉 칸) — 팀 경기 교체 창의 상세 창 0x5b798 이 5c87c~5c884 로 연봉을 찍는다(옛 사본엔 없다)
    ...(record.salaryGrade === undefined ? {} : { salaryGrade: record.salaryGrade }),
    // 장착 비트(+0x14) — 간이 타석 0xab214 의 스킬 판정이 본다(옛 사본은 없다)
    ...(record.skillBits === undefined ? {} : { skillBits: record.skillBits }),
    // 니블 +0x19 · +0x1a(타석 그림 장비 겹 0x78fd8) · +0xb(폼 · 피부 · 손) — 영입 0xc554 가 통째로 옮긴 0x30 바이트의 칸
    ...recordNibblesOf(player, record),
    ...(record.profile === undefined ? {} : { profile: record.profile }),
  }
}

function pitcherOrderOf(player: SeasonPlayer, recordOf: SeasonEntryRecordSource | undefined): PitcherOrder {
  if (isTablePlayer(player)) return tablePitcherOrderOf(player)
  const carried = player.record
  const record = carried !== undefined && 'repertoire' in carried ? carried : recordOf?.pitcher(player)
  if (record === undefined) return NOT_IN_ROSTER
  // 0xb6414 를 지금 니블로 다시 셈한다(`seasonRecordAbilityOf`). 장착 비트(+0x14)도 실어 경기의 스킬 판정이 본다.
  // 니블(+0x19 · +0x1a)은 마운드 그림 장비 겹(타석 교대 0x47cc8 48138~4816a → 0x79790)이 고른다
  const { baseAbility: _base, equipment: _equipment, ...rest } = record
  return {
    ...rest,
    ability: seasonRecordAbilityOf(record, player.equipment, true),
    recordId: player.id,
    ...recordNibblesOf(player, record),
  }
}

/** 붙박이 표 투수 — 트레이드로 옮겨 온 투수 · 장비 니블을 든 투수만 표 자리(`SeasonEntryTablePitcher`), 아니면 로스터 칸 */
function tablePitcherOrderOf(player: SeasonPlayer): PitcherOrder {
  if (player.tableTeamId === undefined && player.equipment === undefined) return player.id
  return {
    ...(player.tableTeamId === undefined ? {} : { tableTeamId: player.tableTeamId }),
    tableSlot: player.id,
    ...(player.equipment === undefined ? {} : { equipment: player.equipment }),
  }
}

/*
 * **트레이드로 옮겨 온 리그 선수**(`tableTeamId` 가 선 선수) — 원본 경기용 팀 0xb891c 는 팀 레코드의 0x30 바이트를 그대로
 * 쓰므로(0xb8680) 그 선수는 옛 팀 Xls 행 사본(이름 0xaa458 표의 제 id · 능력치 0xb6414 · 구질 · 보직 +0xb)으로 서고, 기록 함수
 * 0xa8024 는 그 레코드 +0x20~ 에 쌓아 성적이 선수를 따라간다. 그래서 명단 차례에 **표 팀 + 칸**(`tableTeamId` · id)을 실어
 * 넘긴다 — 팀 경기가 그 표 행으로 세우고 리그 기록표도 그 자리(`leagueBatterIdOf(옛 팀, id)`)로 쌓는다.
 */
