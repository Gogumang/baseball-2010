import { ACE_BATTER_ROSTER_SLOT, LEAGUE_TEAM_COUNT } from '@/entities/career/model/nariTeamRecord/otherSlices'
import { nariTeamRecordOf, withNariTeamRecord } from '@/entities/career/model/nariTeamRecord/records'
import {
  ACE_BATTER_INDEX,
  NO_RECORD_ACE,
  type NariRecordAces,
  type NariRecordBatter,
  type NariRecordTeamAces,
  type NariTeamRecord,
  type NariTeamRecords,
} from '@/entities/career/model/nariTeamRecord/types'

/** 마선수 번호 상한 — `0x1f824` · `0x1f84c` 가 0..4 로 자른다 */
const ACE_INDEX_MAXIMUM = 4

/** 마선수 번호를 `0x1f824` · `0x1f84c` 처럼 0..4 로 자른다 — −1 도 0 이 된다 */
function clampAceIndex(index: number): number {
  return Math.min(ACE_INDEX_MAXIMUM, Math.max(0, Math.trunc(index)))
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

/**
 * **CPU 끼리 경기가 넣은 마선수를 레코드에 남긴다** (A-05) — 준비 `0xc239c`(c24aa `0xb8870(A, x)` · c24b6 `0xb88c8(A, y)` ·
 * c24dc `0xb88c8(B, v)` · c24ee `0xb8870(B, w)`)의 팀 객체는 `0xb8680` 모드 3·4 → `0x1f989` 로 **나리 저장 레코드 자체**를 받는다
 * (b86c6~b86d0, 포스트시즌 0xc2760 도 같은 준비). 그래서 `0xb53f0` 0x40 갈래 · `0xb521c` 0x60 갈래가 레코드를 늘려(또는 덮어)
 * 9번 마타자 · 8번 마투수가 경기 뒤에도 남는다 — 레코드에서 빼는 `0xb512c` 는 시즌 0xdf · 0xe5 진입만 부른다(나리는 안 부른다).
 * `aces` 는 팀 번호 → 그 팀이 마지막으로 치른 CPU 경기가 넣은 번호 (`LeagueDayResult.recordAces` · `CpuPostseasonResult.recordAces`).
 * 같은 칸을 다음 CPU 경기 · 142 가 덮으므로(덮기 갈래와 새로 늘리기는 같은 배열 꼴) 간이 경기 결과와 굴림은 바뀌지 않는다 —
 * 레코드 줄만 남는다.
 */
export function withCpuGameRecordAces(
  records: NariTeamRecords,
  aces: Readonly<Record<number, { readonly batter: number; readonly pitcher: number }>>,
): NariTeamRecords {
  let next = records
  for (const [team, teamAces] of Object.entries(aces)) {
    const teamId = Number(team)
    if (teamId < 0 || teamId >= LEAGUE_TEAM_COUNT) continue
    const record = seatAcePitcher(seatAceBatter(nariTeamRecordOf(next, teamId), teamAces.batter), teamAces.pitcher)
    next = withNariTeamRecord(next, teamId, record)
  }
  return next
}

/**
 * 142 진입 0x1c46c 의 넣기 (1c62e~1c660) — `0xb88c8(내 팀, p)` · `0xb8870(내 팀, b)` · `0xb88c8(상대, …)` ·
 * `0xb8870(상대, …)`. 레코드에서 마선수를 빼는 코드가 없어 다음 장면의 142 가 같은 칸을 덮을 때까지 남는다.
 */
export function seatNariMatchAces(records: NariTeamRecords, myTeamId: number, opponentTeamId: number, aces: NariRecordAces): NariTeamRecords {
  const mine = seatAceBatter(seatAcePitcher(nariTeamRecordOf(records, myTeamId), aces.myPitcher), aces.myBatter)
  const withMine = withNariTeamRecord(records, myTeamId, mine)
  const theirs = seatAceBatter(seatAcePitcher(nariTeamRecordOf(withMine, opponentTeamId), aces.opponentPitcher), aces.opponentBatter)
  return withNariTeamRecord(withMine, opponentTeamId, theirs)
}

/** 레코드 9번 칸 마타자 번호 — 없으면 `NO_RECORD_ACE` */
export function recordAceBatterOf(record: NariTeamRecord): number {
  return record.batters[ACE_BATTER_INDEX]?.ace ?? NO_RECORD_ACE
}

/** 그 팀 레코드의 마선수 — 마타자 9번 칸 · 마투수 8번 칸 */
export function recordTeamAcesOf(record: NariTeamRecord): NariRecordTeamAces {
  return { batter: recordAceBatterOf(record), pitcher: record.acePitcher }
}

/** 레코드에 든 마선수 넷 — 142 경기정보 마투수·마타자 줄 · 곧장 경기가 읽는다. 아무도 없으면 null */
export function recordMatchAcesOf(records: NariTeamRecords, myTeamId: number, opponentTeamId: number): NariRecordAces | null {
  const mine = recordTeamAcesOf(nariTeamRecordOf(records, myTeamId))
  const theirs = recordTeamAcesOf(nariTeamRecordOf(records, opponentTeamId))
  const none = [mine.batter, mine.pitcher, theirs.batter, theirs.pitcher].every((index) => index === NO_RECORD_ACE)
  return none ? null : { myBatter: mine.batter, myPitcher: mine.pitcher, opponentPitcher: theirs.pitcher, opponentBatter: theirs.batter }
}
