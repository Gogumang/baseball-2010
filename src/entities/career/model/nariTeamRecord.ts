import { LEAGUE_TEAM_COUNT } from '@/entities/league/model/league'
import { ACE_BATTER_ROSTER_SLOT } from '@/entities/league/model/leagueDay'
import { teamBatters } from '@/entities/team/model/teamRoster'
import { QUICK_LINEUP_SIZE } from '@/entities/game/model/quickLineup'
import type { QuickLineup } from '@/entities/game/model/quickLineup'
import { EMPTY_BATTER_GAME_RECORD } from '@/entities/batting/model/pinchHitAi'

/**
 * **나만의리그 팀 레코드** — 나리 저장 블록 `[저장+0xb8]`(투수편 모드 3) · `[저장+0xbc]`(타자편 모드 4) 의
 * `+4 + 0x1c·팀` 열 칸 (`0x1f989(저장, 팀)` → 모드 3 `0x1f940` · 모드 4 `0x1f8f8`). 직접 떴다:
 * ```
 * 0xb8680(팀객체)   모드 3·4 → 0xb86c6 → 0x1f989(저장, 팀객체+0x25)        ; 경기용 팀 객체가 선수를 꺼내는 곳
 * 0xb891c(팀객체…)  team[i] = i (투수) · team[0xe + i] = i (타자) · +0x33 = 투수 수 − 1 · +0x28c = 타자 수 − 9
 *                   → **타순 = 레코드 타자 배열 차례**, 앞 아홉이 타순 · 그 뒤가 벤치 (CPU 대타 rand(0, 벤치 수))
 * 0xb8768(팀객체)   0xb603c — 마선수가 아닌 선수의 칸 번호(+0xa 아랫 5비트)를 배열 첨자로 다시 매긴다
 *                   (142 진입 0x1c54a · 경기 장면 0x3a2fa/0x3a302 가 두 팀 모두 — 143 안에서 말고는 늘 칸 번호 = 첨자)
 * ```
 * 레코드는 저장에 남아 경기 사이·시즌 사이로 이어진다(새 시즌 `0x204e0(저장, 편, 0)` 은 성적 칸만 지운다).
 *
 * ## 웹 꼴
 * 타자 배열은 줄마다 **붙박이 표 칸**(그 팀 `XlsBATTER_DATA` 행 0~11) · **내 선수**(`MY_RECORD_SLOT`) · **마타자**
 * (`ACE_BATTER_ROSTER_SLOT` + `ace` 번호)와 수비 위치 니블(`+0x1c & 0xf`, 0 = 벤치)만 든다. 이름·능력치는 그 행에서 빌린다.
 * 투수 배열의 0~7 차례는 예전대로 리그 칸(`League.pitcherOrders` · 포스트시즌 `baseOrders` — 로테이션 `0xb5ca8` 이 섞는
 * 그 차례)이 들고, 여기에는 8번 칸 마투수(`0xb521c` 의 0x60 갈래)만 둔다.
 *
 * 투수편 **내 팀** 은 투수 배열 전체(`pitchers` — 내 투수 줄 포함)를 레코드가 든다. 등록 0x10fb4 가 보직대로 칸을 정해
 * (`0xb6605` — 선발 0 · 구원 7) `0xb521d(내 팀, 내 투수, 1)` 로 넣고, 142 진입 0x1c46c 가 날마다 그 배열을 제자리에서
 * 돌리거나 맞바꾼다 (`entities/pitcher-career/model/myPitcherRecord`).
 */

/** 내 선수 줄의 붙박이 표 칸 표지 — 원본 레코드 +0 = 0xfe (등록 0x10ff8 · 0x110e2) */
export const MY_RECORD_SLOT = -1

/** 마선수가 없다 — 표 0xd7638[0] = −1 */
export const NO_RECORD_ACE = -1

/** 마타자를 넣는 칸 — `0xb53f0` 의 0x40 갈래 9번 (첫 벤치) */
const ACE_BATTER_INDEX = 9
/** 마선수 번호 상한 — `0x1f824` · `0x1f84c` 가 0..4 로 자른다 */
const ACE_INDEX_MAXIMUM = 4

/**
 * 새 선수의 타자 칸 — 생성 0x17360 의 모드 4 갈래가 내 선수 레코드 +0xa 에 **0xa7** 을 쓴다(0x17646~0x1764c, 0xa0 을 덮어씀)
 * → 등록 0x10fb4 의 `0xb53f1(내 팀, 내 선수, 1)` 이 그 아랫 5비트 **7** 칸(8번 타자)에 넣는다. 타순 판정 0xa4c2c 도
 * `0xb6395(내 선수) + 1` = 8 을 사다리 0xd7e80 에서 찾는다(4번 경로 칸 1).
 */
export const ROOKIE_BATTER_SLOT = 7

/** 레코드 타자 한 줄 */
export interface NariRecordBatter {
  /** 붙박이 표 칸(그 팀 타자 0~11) · 내 선수 `MY_RECORD_SLOT` · 마타자 `ACE_BATTER_ROSTER_SLOT` */
  readonly slot: number
  /** 수비 위치 니블 `+0x1c & 0xf` — 0 은 벤치 */
  readonly position: number
  /** 마타자 번호 0~4 (`slot` 이 `ACE_BATTER_ROSTER_SLOT` 일 때만) */
  readonly ace?: number
}

/** 팀 하나의 레코드 */
export interface NariTeamRecord {
  /** 타자 배열 `[팀+0x18]` 차례 그대로 — 앞 아홉이 타순, 그 뒤가 벤치 */
  readonly batters: readonly NariRecordBatter[]
  /** 투수 배열 8번 칸의 마투수 번호 0~4 — 없으면 `NO_RECORD_ACE` */
  readonly acePitcher: number
  /**
   * 투수편 내 팀만 — 투수 배열 차례(마투수 8번 칸은 빼고): 붙박이 표 칸 0~7 · 내 투수 `MY_RECORD_SLOT`. 앞이 선발, 뒤가 벤치 차례.
   * 마투수는 `acePitcher` 가 들고 8번 칸에 끼운다(옛 8번은 맨 끝 — 0xb521c 0x60 갈래). 없으면(옛 저장) 보직·날짜로 세운다.
   */
  readonly pitchers?: readonly number[]
}

/** 열 팀 레코드 (첨자 = 팀 번호 0~9) */
export type NariTeamRecords = readonly NariTeamRecord[]

/** 마선수 번호를 `0x1f824` · `0x1f84c` 처럼 0..4 로 자른다 — −1 도 0 이 된다 */
function clampAceIndex(index: number): number {
  return Math.min(ACE_INDEX_MAXIMUM, Math.max(0, Math.trunc(index)))
}

/** 붙박이 표 그대로의 팀 레코드 — 등록 `0x204e1(저장, 편, 1)` 이 마스터 팀(`0x1f8c1`)을 깊은 복사(0x1fe5c)한 꼴 */
export function tableNariTeamRecord(teamId: number): NariTeamRecord {
  return {
    batters: teamBatters(teamId).map((player, slot) => ({ slot, position: player.position ?? 0 })),
    acePitcher: NO_RECORD_ACE,
  }
}

/**
 * 내 선수를 타자 배열에 넣는다 — `0xb53f0(팀, 내 선수, 1)` 의 0x80 갈래(b549e~b552c, 직접 떴다):
 * 배열을 하나 늘리고(0xb4e34) 칸 t(내 선수 +0xa & 0x1f)의 선수를 수비 위치 0 · 칸 번호 끝으로 **맨 끝에 옮긴 뒤**,
 * 칸 t 에 내 선수를 그 선수의 수비 위치로 앉힌다.
 */
export function insertMyBatter(record: NariTeamRecord, slot: number): NariTeamRecord {
  const batters = [...record.batters]
  const seated = batters[slot]
  if (seated === undefined) return { ...record, batters: [...batters, { slot: MY_RECORD_SLOT, position: 0 }] }
  batters.push({ ...seated, position: 0 })
  batters[slot] = { slot: MY_RECORD_SLOT, position: seated.position }
  return { ...record, batters }
}

/**
 * 열 팀 레코드를 새로 — 등록 104 확정 0x10fb4: `0x204e1(저장, 4|3, 1)` 로 열 팀을 마스터에서 다시 짓고, 타자편이면
 * 내 팀에 `0xb53f1(내 팀, 내 선수, 1)` (투수편 내 투수는 위 머리말 미해결).
 */
export function createNariTeamRecords(myTeamId: number, myBatterSlot: number | null): NariTeamRecords {
  return Array.from({ length: LEAGUE_TEAM_COUNT }, (_unused, team) => {
    const table = tableNariTeamRecord(team)
    return team === myTeamId && myBatterSlot !== null ? insertMyBatter(table, myBatterSlot) : table
  })
}

/** 레코드를 든 커리어 칸 — 없으면(옛 저장·아직 안 고친 새 선수) 붙박이 표와 타순에서 세운다 */
export interface NariTeamRecordFields {
  readonly teamId: number
  readonly nariTeams?: NariTeamRecords
}

/**
 * 커리어의 열 팀 레코드. 저장에 없으면 등록 때의 꼴로 세운다 — 타자편은 `battingOrder − 1` 칸에 내 선수를 넣고 그 칸의
 * 선수를 맨 끝으로(`insertMyBatter`), 투수편(`battingOrder` 없음)은 붙박이 그대로다.
 *
 * 옛 저장(레코드가 없던 웹)의 타순은 타순 이벤트(보상 19 → `0xb5d09`)만 바꿔 왔고, 0xb5d09 는 "내 선수를 새 칸에, 그 칸의 선수를
 * 맨 끝에, 떠난 칸의 원래 주인을 그 자리로" 돌리므로 마선수가 없는 동안은 늘 이 꼴과 같다.
 */
export function nariTeamsOf(fields: NariTeamRecordFields & { readonly battingOrder?: number }): NariTeamRecords {
  if (fields.nariTeams !== undefined && fields.nariTeams.length === LEAGUE_TEAM_COUNT) return fields.nariTeams
  return createNariTeamRecords(fields.teamId, fields.battingOrder === undefined ? null : fields.battingOrder - 1)
}

/** 레코드에서 한 팀 — 팀 번호가 리그 밖(국가대항전 팀 10~)이면 붙박이 표 */
export function nariTeamRecordOf(records: NariTeamRecords, teamId: number): NariTeamRecord {
  return records[teamId] ?? tableNariTeamRecord(teamId)
}

/** 한 팀을 바꿔 끼운다 */
export function withNariTeamRecord(records: NariTeamRecords, teamId: number, record: NariTeamRecord): NariTeamRecords {
  if (teamId < 0 || teamId >= LEAGUE_TEAM_COUNT) return records
  return records.map((current, team) => (team === teamId ? record : current))
}

/**
 * 마타자를 넣는다 — `0xb8870(팀, k)` → `0xb53f1(명부, 0x1f84d(저장, k), 1)` 의 0x40 갈래(b5418~b547c, 직접 떴다):
 * 타자가 9명보다 많고 9번 칸이 이미 마선수면 **그 칸을 덮어쓴다**(−1, 배열 그대로). 아니면 배열을 하나 늘려 9번 칸의 선수를
 * 맨 끝으로 옮기고 9번 칸에 마타자를 앉힌다. 마타자 레코드의 수비 위치는 안 떠서 0(벤치)으로 둔다.
 * 번호는 `0x1f84c` 가 0..4 로 자른다(−1 도 0 — 웹 개방 표는 0 번이 늘 열려 있어 −1 이 오지 않는다).
 */
export function seatAceBatter(record: NariTeamRecord, aceIndex: number): NariTeamRecord {
  const ace: NariRecordBatter = { slot: ACE_BATTER_ROSTER_SLOT, position: 0, ace: clampAceIndex(aceIndex) }
  const batters = [...record.batters]
  const seated = batters[ACE_BATTER_INDEX]
  if (batters.length > ACE_BATTER_INDEX && seated?.ace !== undefined) {
    batters[ACE_BATTER_INDEX] = ace
    return { ...record, batters }
  }
  if (seated !== undefined) batters.push(seated)
  batters[ACE_BATTER_INDEX] = ace
  return { ...record, batters }
}

/**
 * 마투수를 넣는다 — `0xb88c8(팀, k)` → `0xb521d(명부, 0x1f825(저장, k), 1)` 의 0x60 갈래(b5244~b528e): 8번 칸이 이미
 * 마선수면 덮어쓰고, 아니면 8번 칸(옛 8번은 맨 끝)에 넣는다. 0~7 차례는 리그가 들고 있어 번호만 남긴다.
 */
export function seatAcePitcher(record: NariTeamRecord, aceIndex: number): NariTeamRecord {
  return { ...record, acePitcher: clampAceIndex(aceIndex) }
}

/** 142 진입이 두 팀에 넣은 마선수 번호 넷 */
export interface NariRecordAces {
  readonly myBatter: number
  readonly myPitcher: number
  readonly opponentPitcher: number
  readonly opponentBatter: number
}

/**
 * 142 진입 0x1c46c 의 넣기 (1c62e~1c660) — `0xb88c8(내 팀, p)` · `0xb8870(내 팀, b)` · `0xb88c8(상대, …)` ·
 * `0xb8870(상대, …)`. 레코드에서 마선수를 빼는 코드가 없어 다음 장면의 142 가 같은 칸을 덮을 때까지 남는다.
 */
export function seatNariMatchAces(
  records: NariTeamRecords,
  myTeamId: number,
  opponentTeamId: number,
  aces: NariRecordAces,
): NariTeamRecords {
  const mine = seatAceBatter(seatAcePitcher(nariTeamRecordOf(records, myTeamId), aces.myPitcher), aces.myBatter)
  const withMine = withNariTeamRecord(records, myTeamId, mine)
  const theirs = seatAceBatter(
    seatAcePitcher(nariTeamRecordOf(withMine, opponentTeamId), aces.opponentPitcher),
    aces.opponentBatter,
  )
  return withNariTeamRecord(withMine, opponentTeamId, theirs)
}

/** 레코드 9번 칸 마타자 번호 — 없으면 `NO_RECORD_ACE` */
export function recordAceBatterOf(record: NariTeamRecord): number {
  return record.batters[ACE_BATTER_INDEX]?.ace ?? NO_RECORD_ACE
}

/** 내 선수 줄의 첨자 — 없으면 −1 */
export function myBatterIndexOf(record: NariTeamRecord): number {
  return record.batters.findIndex((row) => row.slot === MY_RECORD_SLOT)
}

/**
 * 타순 보상 19 — `0x8ca7e`: `0xb5d09(0x1f989(저장, 내 팀), 0xb6395(내 선수), 값 − 1)` (직접 떴다, b5d08~b5e54).
 * a = 내 선수 칸 번호(=첨자 — 142·경기 장면이 0xb8768 로 늘 다시 매긴다), b = 새 칸:
 * ```
 * posA = rec[a].+0x1c & 0xf ; posB = rec[b].+0x1c & 0xf ; A = rec[a] ; B = rec[b]
 * x    = 마스터 팀(0x1f8c1) 타자 a 번   ; i = 레코드에서 처음으로 +0 이 x 의 +0 과 같은 칸 (못 찾으면 0) ; C = rec[i]
 * rec[b] = A (위치 posB) ; rec[i] = B (위치 0) ; rec[a] = C (위치 posA) — 차례대로 쓴다 ; 0x1faa1 로 내 선수를 다시 찾는다
 * ```
 * 곧 "내 선수는 새 칸에, 그 칸의 선수는 떠난 칸의 원래 주인이 있던 자리(벤치)로, 원래 주인은 떠난 칸으로" 셋이 돈다.
 * ⚠️ 원본 그대로: i == b 면(떠난 칸의 원래 주인이 새 칸에 서 있으면) 쓰는 차례 때문에 내 선수가 레코드에서 사라진다. b == a 면
 * 내 선수가 벤치로 내려간다. 마스터 행의 +0 이 마선수 레코드의 +0 과 겹칠 수 있는지는 안 읽었다 — 표 칸으로만 견준다.
 */
export function moveMyBatter(record: NariTeamRecord, newIndex: number): NariTeamRecord {
  const a = myBatterIndexOf(record)
  const b = newIndex
  const rowA = record.batters[a]
  const rowB = record.batters[b]
  if (a < 0 || rowA === undefined || rowB === undefined) return record
  const positionA = rowA.position & 0xf
  const positionB = rowB.position & 0xf
  const found = record.batters.findIndex((row) => row.ace === undefined && row.slot === a)
  const i = found < 0 ? 0 : found
  // 못 찾으면 C 는 빈 레코드(0xb8de5) — 웹은 표 칸 a 로 둔다
  const rowC = found < 0 ? { slot: a, position: 0 } : record.batters[i] ?? { slot: a, position: 0 }
  const batters = [...record.batters]
  batters[b] = { ...rowA, position: positionB }
  batters[i] = { ...rowB, position: 0 }
  batters[a] = { ...rowC, position: positionA }
  return { ...record, batters }
}

/**
 * 경기용 명단 칸 — `QuickLineup.rosterSlots` 의 값(붙박이 표 칸 · 마타자 `ACE_BATTER_ROSTER_SLOT`).
 * 내 선수 줄은 사람이 치므로 간이 타석을 안 지나지만, 진행기가 지금 타석 칸의 주루(`runnerRunAbilityOf`)를 그 칸 번호의
 * 표 행으로 읽는 근사가 있어 예전과 같게 **내 첨자**를 표 칸으로 둔다.
 */
export function nariLineupSlotsOf(record: NariTeamRecord): readonly number[] {
  return record.batters.map((row, index) => {
    if (row.ace !== undefined) return ACE_BATTER_ROSTER_SLOT
    return row.slot === MY_RECORD_SLOT ? index : row.slot
  })
}

/**
 * 경기용 명단 — `0xb891c` 의 `team[0xe + i] = i` · 벤치 수 `team+0x28c` = 타자 수 − 9 (b897c~b8988). 경기 기록 칸은 빈 채로.
 */
export function nariQuickLineupOf(record: NariTeamRecord): QuickLineup {
  const rosterSlots = nariLineupSlotsOf(record)
  return {
    rosterSlots,
    records: rosterSlots.map(() => EMPTY_BATTER_GAME_RECORD),
    benchBatters: Math.max(0, rosterSlots.length - QUICK_LINEUP_SIZE),
  }
}

/** 타순 칸을 든 타자편 커리어 칸 */
export interface NariBattingOrderFields extends NariTeamRecordFields {
  readonly battingOrder: number
}

/**
 * 타순 보상 19 를 레코드에 — 값마다 차례대로 `0xb5d09(내 팀, 내 칸, 값 − 1)` 를 돌리고, 타순(`0xb6395 + 1`)을 레코드 안
 * 내 줄 첨자 + 1 로 다시 읽는다. `before` 는 **보상을 얹기 전** 커리어다(레코드가 저장에 없으면 그 타순으로 세운다).
 * 레코드에서 내 선수가 사라졌으면(`moveMyBatter` 의 원본 버그 갈래) 타순은 마지막 보상 값 그대로 둔다.
 */
export function applyBattingOrderRewards(
  before: NariBattingOrderFields,
  values: readonly number[],
): { readonly battingOrder: number; readonly nariTeams: NariTeamRecords } | null {
  if (values.length === 0) return null
  const records = nariTeamsOf(before)
  const moved = values.reduce((record, value) => moveMyBatter(record, value - 1), nariTeamRecordOf(records, before.teamId))
  const index = myBatterIndexOf(moved)
  return {
    battingOrder: index < 0 ? values[values.length - 1] ?? before.battingOrder : index + 1,
    nariTeams: withNariTeamRecord(records, before.teamId, moved),
  }
}

/**
 * 142 진입 `0x1c54a` · 경기 장면 `0x3a2fa` 의 `0xb8768` — 칸 번호를 첨자로 다시 매긴다. 타자편 타순(= 내 칸 번호 + 1)을
 * 레코드 안 내 줄 첨자 + 1 로 맞춘다. 내 줄이 없으면 그대로.
 */
export function renumberedBattingOrderOf(fields: NariBattingOrderFields): number {
  const index = myBatterIndexOf(nariTeamRecordOf(nariTeamsOf(fields), fields.teamId))
  return index < 0 ? fields.battingOrder : index + 1
}

/** 한 팀에 실린 마선수 번호 (`features/play-game` 의 `GameTeamAces` 와 같은 꼴) */
export interface NariRecordTeamAces {
  readonly batter: number
  readonly pitcher: number
}

/** 그 팀 레코드의 마선수 — 마타자 9번 칸 · 마투수 8번 칸 */
export function recordTeamAcesOf(record: NariTeamRecord): NariRecordTeamAces {
  return { batter: recordAceBatterOf(record), pitcher: record.acePitcher }
}

/** 레코드에 든 마선수 넷 — 142 경기정보 마투수·마타자 줄 · 곧장 경기가 읽는다. 아무도 없으면 null */
export function recordMatchAcesOf(
  records: NariTeamRecords,
  myTeamId: number,
  opponentTeamId: number,
): NariRecordAces | null {
  const mine = recordTeamAcesOf(nariTeamRecordOf(records, myTeamId))
  const theirs = recordTeamAcesOf(nariTeamRecordOf(records, opponentTeamId))
  const none = [mine.batter, mine.pitcher, theirs.batter, theirs.pitcher].every((index) => index === NO_RECORD_ACE)
  return none
    ? null
    : { myBatter: mine.batter, myPitcher: mine.pitcher, opponentPitcher: theirs.pitcher, opponentBatter: theirs.batter }
}
