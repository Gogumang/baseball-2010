import { useState } from 'react'

/** 목록 창이 한 번에 보이는 줄 수 */
const VISIBLE_ROWS = 10

/** 0x6c2bd — 커서가 [윗줄, 윗줄 + 보이는 줄) 밖이면 아래로 나갔을 때 커서 − 보이는 줄 + 1, 위로 나갔을 때 커서 */
function listTopOf(heldTop: number, cursor: number, count: number): number {
  const visible = Math.min(VISIBLE_ROWS, count)
  const top = Math.min(heldTop, Math.max(0, count - visible))
  if (cursor < top) return Math.max(0, cursor)
  if (cursor >= top + visible) return Math.max(0, cursor - visible + 1)
  return Math.max(0, top)
}

/** 목록 윗줄 [목록+0x30] — 커서가 보이는 10 줄 밖으로 나갈 때만 옮긴다 (0x6c2bd) */
export function useListTop(cursor: number, count: number): number {
  const [heldTop, setHeldTop] = useState(0)
  const nextTop = listTopOf(heldTop, cursor, count)
  // 윗줄은 지난 렌더의 것에서 이어진다 — 바뀌면 렌더 중에 맞춘다(그림은 이번 값 그대로)
  if (nextTop !== heldTop) setHeldTop(nextTop)
  return nextTop
}
