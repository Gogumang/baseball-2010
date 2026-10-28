import type { RandomPort } from '@/shared/api/random/randomPort'
import { LEAGUE_TEAM_COUNT } from '@/entities/league/model/league'
import type { LeagueRecordPlayer, LeagueTeamRecord } from '@/entities/league/model/leagueDay'
import { teamBatters, teamPitchers } from '@/entities/team/model/teamRoster'
import type { TeamRecordEquipment } from '@/entities/team/model/teamRoster'
import { NARI_CPU_EQUIPMENT_YEAR_LIMIT, rollCpuEquipment } from '@/entities/season-mode/model/cpuEquipment'
import { MY_RECORD_SLOT, nariTeamRecordOf, withNariTeamRecord } from '@/entities/career/model/nariTeamRecord'
import type { NariTeamRecord, NariTeamRecords } from '@/entities/career/model/nariTeamRecord'

/**
 * **나리 새 시즌 CPU 장비 굴림** — 새 시즌 처리 `0x1b768` 의 1b86c~1b87e(직접 떴다):
 * ```
 * 1b86c  0x665e8([0x1552cfc], S+0xb3(1b780 에서 +1 한 새 연차), ldrsb S[1](내 팀))   ; 모드 가리지 않고 부른다
 * 665e8  r4 = 새 연차 + 1 · [0x1552d10] ≠ 2(나리 3·4) 이면 r4 > 13 → 끝 (66600~66604)
 * 66530  i = 0..9, i ≠ 내 팀: 레코드 = 0x1f989(저장, i)(66558 — 모드 ≠ 2 갈래) → 모드 3 0x1f940 · 모드 4 0x1f8f8
 *        선수 = 타자? 0xb53d1(레코드, 칸) = [레코드+0x18] + 0x30·칸 : 0xb51fd(레코드, 칸) = [레코드+0x14] + 0x30·칸
 *        니블 = 기준 + 0xbfa55 rand(0, 2) + 1 → 바이트 +0x19 + 부위/2 의 그 니블만 (665a4~665bc)
 * ```
 * 줄 차례·표·기준은 시즌 새 해 0x6e0c 가 부르는 같은 함수다(`season-mode/model/cpuEquipment` — 그 머리말). 다른 것은 문턱(13)과
 * 레코드(나리 열 팀 `nariTeams`)뿐이다. 앞 1b768~1b86a 에는 난수가 없다(0xa39a9 리그 초기화 · 0xa3a45 사기 · 0x204e1(…, 0) 성적
 * 칸 지우기 · 모드 3 의 0x1b684 · 0x1faa1) — 곧 새 시즌의 난수는 이 굴림이 전부이고, 2년차(r4 = 2)부터 줄 수 × 9 번 돈다.
 *
 * 레코드는 등록 0x204e1(저장, 편, 1)이 마스터 팀(Xls 행)을 베낀 것이라 **첫 시즌 니블은 Xls 행 그대로** — 리그 열 팀은 모두 0
 * (`RosterPlayer.equipment`)이고, 새 시즌 0x204e0(…, 0)은 성적 칸만 지우므로 굴린 니블은 다음 굴림이 덮을 때까지 남는다.
 *
 * ## 웹 꼴
 * - 타자: 레코드 타자 줄(`NariRecordBatter.equipment`) — 칸 = `batters` 첨자 그대로(0xb53d1).
 * - 투수: 레코드 투수 배열 0~7 차례는 리그(`League.pitcherOrders`)가 들고 있어, 칸 → 붙박이 표 칸으로 바꿔
 *   `NariTeamRecord.pitcherEquipment[표 칸]` 에 둔다(니블은 레코드째 로테이션 0xb5ca8 을 따라 돈다).
 * 둘 다 없으면 Xls 행 니블이다(옛 저장 = 굴리지 않은 첫 시즌 값).
 * **투수 칸 차례 확인 (r143, 직접 뜸)**: 0xb51fc(레코드, k) = [레코드+0x14] + 0x30·k 가 가리키는 배열을 0~3 자리에서 섞는 곳은
 * 0xb5ca8(제자리 memmove 0x1400418) 하나이고, 그 유일한 호출지 0xb8c80 = 0xb8680(팀) → 0xb5ca8 이다. 0xb8680 은 모드 3·4 에서
 * 0x1f989 가 돌려주는 **같은 레코드 포인터**를 넘긴다(b86c6~b86d0). 0xb8c80 을 부르는 곳은 0x6548(시즌) · 0x1c46c(나리 사람 경기
 * 1c582 · 1c5e8) · 0xc239c(CPU 경기 · 포스트시즌 c2518 · c2542) 셋뿐 — 웹 `League.pitcherOrders` 의 로테이션 · 포스트시즌 이월
 * (`pitcherOrdersAfterPostseason`)이 옮긴 그 길이다. 그 밖에 투수 배열을 고치는 0xb521c(끼워넣기)는 칸 8(마투수 0xb88c8 · 미션
 * 0xaae7c)이나 내 팀(0x1a090 등록)이라 0~3 차례를 안 건드리고, 0x1b684 는 내 팀만이다. 국가대항전 중에는 0x1f940 이 대회 칸
 * (+0xbc4 / +0xbe0)을 돌려 리그 레코드가 안 돈다(웹 `nariCupTeams` 따로) · 1b774 가 S+0x12c 를 굴림 앞에서 내린다.
 * 곧 굴림 때 칸 차례 = 새 시즌 리그의 `pitcherOrders` 다.
 */

const NO_EQUIPMENT: readonly number[] = [0, 0, 0, 0]

/** 레코드 타자 줄 index 의 장비 니블 네 칸 — 레코드의 값, 없으면 그 팀 Xls 행(마타자·내 선수 줄은 0) */
export function nariBatterEquipmentOf(record: NariTeamRecord, teamId: number, index: number): readonly number[] {
  const row = record.batters[index]
  if (row === undefined) return NO_EQUIPMENT
  if (row.equipment !== undefined) return row.equipment
  if (row.ace !== undefined || row.slot === MY_RECORD_SLOT) return NO_EQUIPMENT
  return teamBatters(teamId)[row.slot]?.equipment ?? NO_EQUIPMENT
}

/** 붙박이 표 칸 tableSlot 투수의 장비 니블 네 칸 — 레코드의 값, 없으면 Xls 행 */
export function nariPitcherEquipmentOf(record: NariTeamRecord, teamId: number, tableSlot: number): readonly number[] {
  return record.pitcherEquipment?.[tableSlot] ?? teamPitchers(teamId)[tableSlot]?.equipment ?? NO_EQUIPMENT
}

function withPart(equipment: readonly number[], part: number, value: number): readonly number[] {
  const next = [...equipment]
  next[part] = value
  return next
}

/**
 * `0x665e8` 를 나리 열 팀 레코드에 — 난수 차례는 `rollCpuEquipment`(줄마다 팀 0..9, 내 팀 빼고 rand(0, 2)) 그대로.
 * `pitcherOrderOf(팀)` 은 새 시즌 리그의 투수 레코드 차례(칸 p 에 앉은 표 칸)다.
 */
export function rollNariCpuEquipment(
  records: NariTeamRecords,
  random: RandomPort,
  newYearIndex: number,
  myTeamId: number,
  pitcherOrderOf: (teamId: number) => readonly number[],
): NariTeamRecords {
  const writes = rollCpuEquipment(random, newYearIndex, myTeamId, NARI_CPU_EQUIPMENT_YEAR_LIMIT)
  let next = records
  for (const write of writes) {
    if (write.teamId < 0 || write.teamId >= LEAGUE_TEAM_COUNT) continue
    const record = nariTeamRecordOf(next, write.teamId)
    if (write.isBatter) {
      const row = record.batters[write.recordIndex]
      // 0xb53d1 이 칸 밖이면 0 을 돌려 원본은 [0 + 0x19] 를 건드린다 — 웹은 버린다 (열 팀 타자는 늘 12 줄이라 오지 않는다)
      if (row === undefined) continue
      const equipment = withPart(nariBatterEquipmentOf(record, write.teamId, write.recordIndex), write.part, write.value)
      const batters = record.batters.map((current, index) => (index === write.recordIndex ? { ...current, equipment } : current))
      next = withNariTeamRecord(next, write.teamId, { ...record, batters })
    } else {
      const tableSlot = pitcherOrderOf(write.teamId)[write.recordIndex] ?? write.recordIndex
      const equipment = withPart(nariPitcherEquipmentOf(record, write.teamId, tableSlot), write.part, write.value)
      next = withNariTeamRecord(next, write.teamId, {
        ...record,
        pitcherEquipment: { ...record.pitcherEquipment, [tableSlot]: equipment },
      })
    }
  }
  return next
}

/**
 * 경기에 싣는 그 팀의 레코드 장비 니블 — 붙박이 표 칸 → 네 칸(`TeamRecordEquipment`). 굴린 니블이 없는 팀(첫 시즌 · 옛 저장 ·
 * 내 팀 · 리그 밖 팀)은 undefined 라 경기는 Xls 행 그대로 선다. 사람 경기(타자편 0x39fdc · 투수편 142)도 상대 팀 객체가
 * 0xb8680 → 0x1f989 로 같은 레코드를 읽는다.
 */
export function nariTeamRecordEquipmentOf(records: NariTeamRecords | undefined, teamId: number): TeamRecordEquipment | undefined {
  if (records === undefined || teamId < 0 || teamId >= LEAGUE_TEAM_COUNT) return undefined
  const record = records[teamId]
  if (record === undefined) return undefined
  const batters: Record<number, readonly number[]> = {}
  for (const row of record.batters) {
    if (row.equipment === undefined || row.ace !== undefined || row.slot === MY_RECORD_SLOT) continue
    if (batters[row.slot] === undefined) batters[row.slot] = row.equipment
  }
  const hasBatter = Object.keys(batters).length > 0
  const hasPitcher = record.pitcherEquipment !== undefined && Object.keys(record.pitcherEquipment).length > 0
  if (!hasBatter && !hasPitcher) return undefined
  return {
    ...(hasBatter ? { batters } : {}),
    ...(hasPitcher && record.pitcherEquipment !== undefined ? { pitchers: record.pitcherEquipment } : {}),
  }
}

/**
 * CPU 끼리 경기(`playLeagueDay` · 포스트시즌)가 읽는 그 팀 레코드 — 원본 하루 경기 0xc2a48 → 준비 0xc239c → 팀 객체 0xb891c ·
 * 0xb8680(모드 3·4 → 0x1f989)이 나리 레코드를 그대로 읽어 0xb6414 로 니블 보너스를 먹는다.
 * 웹 CPU 경기 명단은 붙박이 표 칸 차례라 칸 k = 표 칸 k 로 니블만 싣는다. 굴린 니블이 없는 팀은 undefined(붙박이 표 그대로).
 */
export function nariLeagueTeamRecordOf(records: NariTeamRecords | undefined, teamId: number): LeagueTeamRecord | undefined {
  const equipment = nariTeamRecordEquipmentOf(records, teamId)
  if (equipment === undefined) return undefined
  const playerOf = (tableSlot: number, nibbles: readonly number[] | undefined): LeagueRecordPlayer =>
    nibbles === undefined ? { tableTeamId: teamId, tableSlot } : { tableTeamId: teamId, tableSlot, equipment: nibbles }
  return {
    batters: teamBatters(teamId).map((_row, slot) => playerOf(slot, equipment.batters?.[slot])),
    pitchers: teamPitchers(teamId).map((_row, slot) => playerOf(slot, equipment.pitchers?.[slot])),
  }
}
