import { quickBatterOf, quickPitcherOf, teamBatters, teamPitchers } from '@/entities/team/model/teamRoster'
import { recordAbilityOf } from '@/entities/team/model/recordAbility'
import type { QuickAtBatBatter, QuickAtBatPitcher } from '@/entities/game/model/quickAtBat'

/**
 * 팀 레코드 한 칸에 앉은 선수의 **붙박이 표 자리** — 원본 선수 레코드의 id(+0)는 Xls 행 번호(투수 `팀 × 8 + 칸` ·
 * 타자 `팀 × 12 + 칸`)라 트레이드(0xd1cc~0xd3ae)로 다른 팀 레코드에 옮겨져도 그대로다. 이름·능력치·구질·보직(+0xb)은
 * 그 행의 사본이고, 성적 칸(+0x20~)도 레코드에 있어 선수를 따라간다 — 리그 선수 기록표는 이 자리(`leagueBatterIdOf` ·
 * `leaguePitcherIdOf`)로 센다.
 */
export interface LeagueRecordPlayer {
  readonly tableTeamId: number
  readonly tableSlot: number
  /**
   * 레코드 +0x19 · +0x1a 장비 니블 네 칸 — 시즌 저장 명단의 값(새 해 CPU 장비 굴림 0x665e8 · `SeasonPlayer.equipment`).
   * 경기는 레코드를 `0xb6414(rec, k, 1)` 로 읽어 니블 보너스를 먹는다(`recordAbilityOf`). 없으면 그 Xls 행의 니블
   */
  readonly equipment?: readonly number[]
}

/**
 * **팀 레코드의 선수 배열** — 시즌 저장 `0x1f570(저장, 팀)` 의 투수 8 · 타자 12. CPU 경기 준비 `0xc239c` 가 세우는 팀 객체
 * `0xb891c` 는 `team[i] = i` 첨자만 들고 선수는 `0xb8680` 이 모드 2·3·4 에서 `팀객체+0x25` 의 팀 번호로 그 레코드에서
 * 꺼낸다(b869e → 0x1f570 — 직접 떴다). 그래서 트레이드로 바뀐 레코드가 그대로 경기에 선다.
 * 투수 배열은 로테이션 전 자리 차례(웹 명단 첨자)다 — 로테이션은 `pitcherOrders` 가 따로 든다.
 */
export interface LeagueTeamRecord {
  readonly batters: readonly LeagueRecordPlayer[]
  readonly pitchers: readonly LeagueRecordPlayer[]
}

/** 레코드 칸 k 의 붙박이 표 자리 — 레코드가 없거나 그 칸이 없으면 그 팀 표 칸 k 그대로 */
export function recordPlayerAt(record: LeagueTeamRecord | undefined, teamId: number, isPitcher: boolean, slot: number): LeagueRecordPlayer {
  const found = (isPitcher ? record?.pitchers : record?.batters)?.[slot]
  return found ?? { tableTeamId: teamId, tableSlot: slot }
}

/** 레코드 칸 k 의 투수 표 줄 (표 행 그대로 — 구질·손을 행 차례로 찾으므로 사본을 만들지 않는다) */
export function recordPitcherRowAt(record: LeagueTeamRecord | undefined, teamId: number, slot: number) {
  const at = recordPlayerAt(record, teamId, true, slot)
  const roster = teamPitchers(at.tableTeamId)
  return roster[at.tableSlot % roster.length]
}

/** 레코드 칸 k 의 투수 장비 니블 — 레코드의 것(`LeagueRecordPlayer.equipment`), 없으면 undefined(표 행 니블) */
function recordPitcherEquipmentAt(record: LeagueTeamRecord | undefined, teamId: number, slot: number) {
  return recordPlayerAt(record, teamId, true, slot).equipment
}

/** 레코드 칸 k 의 투수 간이 타석 능력 — 밑값 0xb6414(장비 니블 · 장착 스킬, `quickPitcherOf`) */
export function recordQuickPitcherAt(record: LeagueTeamRecord | undefined, teamId: number, slot: number): QuickAtBatPitcher {
  return quickPitcherOf(recordPitcherRowAt(record, teamId, slot), recordPitcherEquipmentAt(record, teamId, slot))
}

/** 레코드 칸 k 의 투수 `0xb6414(rec, k, 1)` 네 칸 — 장비 니블 · 장착 스킬을 먹인 밑값 */
export function recordPitcherAbilityAt(record: LeagueTeamRecord | undefined, teamId: number, slot: number): readonly number[] {
  const row = recordPitcherRowAt(record, teamId, slot)
  if (row === undefined) return [0, 0, 0, 0]
  return recordAbilityOf({ ...row, equipment: recordPitcherEquipmentAt(record, teamId, slot) ?? row.equipment }, true)
}

/** 명단의 레코드 칸 k 에 앉은 타자 — 트레이드로 옮겨 온 선수는 옛 팀 표 행이다 (`LeagueTeamRecord`) */
export function recordBatterAt(teamId: number, record: LeagueTeamRecord | undefined, slot: number): QuickAtBatBatter {
  const at = recordPlayerAt(record, teamId, false, slot)
  // 표 칸을 12 로 돌려 쓰는 것은 `batterAt` 과 같다 — 장비 니블은 레코드의 것(없으면 표 행)
  const roster = teamBatters(at.tableTeamId)
  return quickBatterOf(roster[at.tableSlot % roster.length], at.equipment)
}
