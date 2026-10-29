import { isBugFixed } from '@/shared/config/bugfixes'
import { nariTeamRecordOf, nariTeamsOf, withNariTeamRecord } from '@/entities/career/model/nariTeamRecord/records'
import {
  MY_RECORD_SLOT,
  type NariBattingOrderFields,
  type NariRecordBatter,
  type NariTeamRecord,
  type NariTeamRecords,
} from '@/entities/career/model/nariTeamRecord/types'

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
 * ⚠️ 원본 버그(B-71): i == b 면(떠난 칸의 원래 주인이 새 칸에 서 있으면) 쓰는 차례 때문에 내 선수가 레코드에서 사라진다. b == a 면
 * 내 선수가 벤치로 내려간다. 못 찾으면 i = 0 으로 첫 칸을 덮는다. **고침(`bugfixes.json` B-71, 기본 켬)** — 이 세 갈래만 막는다(아래). 마스터 행의 +0 이 마선수 레코드의 +0 과 겹칠 수 있는지는 안 읽었다 — 표 칸으로만 견준다.
 */
export function moveMyBatter(record: NariTeamRecord, newIndex: number): NariTeamRecord {
  const move = myBatterMoveOf(record, newIndex)
  if (move === null) return record
  const fixed = isBugFixed('B-71') ? fixedMyBatterMoveOf(record, move) : null
  return fixed ?? rotatedMyBatterOf(record, move)
}

/** 0xb5d09 가 읽는 것 — 내 칸 a · 새 칸 b 의 두 줄과 자리 니블, 떠난 칸의 원래 주인 i(못 찾으면 −1) */
interface MyBatterMove {
  readonly a: number
  readonly b: number
  readonly rowA: NariRecordBatter
  readonly rowB: NariRecordBatter
  readonly positionA: number
  readonly positionB: number
  readonly found: number
}

/** 내 줄이나 새 칸 줄이 없으면 null(레코드 그대로) */
function myBatterMoveOf(record: NariTeamRecord, newIndex: number): MyBatterMove | null {
  const a = myBatterIndexOf(record)
  const b = newIndex
  const rowA = record.batters[a]
  const rowB = record.batters[b]
  if (a < 0 || rowA === undefined || rowB === undefined) return null
  const found = record.batters.findIndex((row) => row.ace === undefined && row.slot === a)
  return { a, b, rowA, rowB, positionA: rowA.position & 0xf, positionB: rowB.position & 0xf, found }
}

/**
 * 고침(bugfixes.json B-71, 기본 켬): 셋이 도는 것은 의도(떠난 칸에 원래 주인을 되돌림)라 두고, 망가지는 갈래만 막는다 —
 * 같은 칸이면 그대로 · 원래 주인을 못 찾거나 그가 새 칸에 서 있으면(i == b) 내 선수와 새 칸 선수 둘만 맞바꾼다. 굴림 없음.
 * 망가지지 않는 갈래면 null(원본 길로)
 */
function fixedMyBatterMoveOf(record: NariTeamRecord, move: MyBatterMove): NariTeamRecord | null {
  const { a, b, rowA, rowB, positionA, positionB, found } = move
  if (b === a) return record
  if (found >= 0 && found !== b) return null
  const swapped = [...record.batters]
  swapped[b] = { ...rowA, position: positionB }
  swapped[a] = { ...rowB, position: positionA }
  return { ...record, batters: swapped }
}

/** 원본 길 — rec[b] = A(posB) · rec[i] = B(0) · rec[a] = C(posA) 차례대로 쓴다 */
function rotatedMyBatterOf(record: NariTeamRecord, move: MyBatterMove): NariTeamRecord {
  const { a, b, rowA, rowB, positionA, positionB, found } = move
  const i = found < 0 ? 0 : found
  // 못 찾으면 C 는 빈 레코드(0xb8de5) — 웹은 표 칸 a 로 둔다
  const rowC = (found < 0 ? undefined : record.batters[i]) ?? { slot: a, position: 0 }
  const batters = [...record.batters]
  batters[b] = { ...rowA, position: positionB }
  batters[i] = { ...rowB, position: 0 }
  batters[a] = { ...rowC, position: positionA }
  return { ...record, batters }
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
    battingOrder: index < 0 ? (values[values.length - 1] ?? before.battingOrder) : index + 1,
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
