import type { EntryBatterRow, EntryPitcherRow } from '@/entities/season-mode/model/entryEditor/rows'

/**
 * 타자 맞바꾸기 `0xb5e99(팀, a, b, 0)` — 레코드를 통째로 바꾼 뒤 수비 위치를 정리한다:
 * ```
 * b5ec4  pa = rec[a].+0x1c & 0xf ; pb = rec[b].+0x1c & 0xf ; a ↔ b (0x30 바이트)
 * b5f10  pb == 0 || pa == 0 → set_pos(rec[a], pa) ; set_pos(rec[b], pb)   ; 자리에 남는다
 * b5f32  그 밖             → set_pos(rec[a], pb) ; set_pos(rec[b], pa)   ; 선수를 따라간다
 * ```
 * 곧 둘 다 선발이면 타순만 바뀌고, 벤치가 끼면 올라온 선수가 내려간 선수의 수비 위치를 받는다.
 */
export function swapEntryBatters<B extends EntryBatterRow>(rows: readonly B[], a: number, b: number): B[] {
  const next = [...rows]
  const rowA = rows[a]
  const rowB = rows[b]
  if (rowA === undefined || rowB === undefined) return next
  const positionA = rowA.position & 0xf
  const positionB = rowB.position & 0xf
  const staysAtSlot = positionA === 0 || positionB === 0
  next[a] = { ...rowB, position: staysAtSlot ? positionA : positionB }
  next[b] = { ...rowA, position: staysAtSlot ? positionB : positionA }
  return next
}

/** 투수 맞바꾸기 `0xb5e99(팀, a, b, 1)` — 레코드 통째로 (b5f5a~). 0번과 바꾸면 곧 **선발 변경**이다 */
export function swapEntryPitchers<P extends EntryPitcherRow>(rows: readonly P[], a: number, b: number): P[] {
  const next = [...rows]
  const rowA = rows[a]
  const rowB = rows[b]
  if (rowA === undefined || rowB === undefined) return next
  next[a] = rowB
  next[b] = rowA
  return next
}

/** 수비위치 맞바꾸기 `0xb5fe5(팀, a, b)` — 둘 다 위치 ≠ 0 일 때만 **위치 니블만** 바꾼다 (타순 그대로) */
export function swapFieldPositions<B extends EntryBatterRow>(rows: readonly B[], a: number, b: number): B[] {
  const next = [...rows]
  const rowA = rows[a]
  const rowB = rows[b]
  if (rowA === undefined || rowB === undefined) return next
  const positionA = rowA.position & 0xf
  const positionB = rowB.position & 0xf
  if (positionA === 0 || positionB === 0) return next
  next[a] = { ...rowA, position: positionB }
  next[b] = { ...rowB, position: positionA }
  return next
}
