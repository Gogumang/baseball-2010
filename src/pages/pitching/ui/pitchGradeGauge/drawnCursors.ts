import { GAUGE_LAST_CELL } from '@/entities/pitcher-career/model/pitchGauge'

/** 칸 g 를 정했나 — 1~9 일 때만 등급 t 가 선다 (0x50e08) */
export const isDecidedCell = (cell: number) => cell >= 1 && cell <= GAUGE_LAST_CELL

/** 그린 커서 기록 한 칸 — (장면 틱, 그 그림의 커서 `+0x17bc`) */
export interface DrawnCursor {
  readonly tick: number
  readonly cursor: number
}

/** 기록을 몇 그림까지 들고 있는가 — 키 · 그리기가 밀려도 이만큼 앞이면 넉넉하다 */
const DRAWN_CURSOR_MEMORY = 32

/** 그림 하나의 커서를 적는다 — 오래된 것은 버린다 */
export function rememberDrawnCursor(drawn: DrawnCursor[], tick: number, cursor: number): void {
  drawn.push({ tick, cursor })
  if (drawn.length > DRAWN_CURSOR_MEMORY) drawn.splice(0, drawn.length - DRAWN_CURSOR_MEMORY)
}

/** 키를 받은 틱(`seenTick`) 이하로 마지막에 그린 그림의 차례 — 없으면 −1 */
export function seenDrawIndexOf(drawn: readonly DrawnCursor[], seenTick: number): number {
  for (let index = drawn.length - 1; index >= 0; index -= 1) {
    if ((drawn[index]?.tick ?? Number.POSITIVE_INFINITY) <= seenTick) return index
  }
  return -1
}

/** 사람이 본 그림의 커서 — 본 그림이 기록에 없으면 아직 안 그렸을 때 지금 커서, 기록보다 앞이면 0 */
export function seenCursorOf(drawn: readonly DrawnCursor[], seenIndex: number, currentCursor: number): number {
  if (seenIndex >= 0) return drawn[seenIndex]?.cursor ?? currentCursor
  return drawn.length === 0 ? currentCursor : 0
}
