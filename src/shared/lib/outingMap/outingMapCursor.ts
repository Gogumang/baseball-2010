/**
 * 외출 지도 방향 이동 `0x7f3e4(gfx, 칸, 키)` (직접 떴다) — 표 **0xd491c** `[칸 × 4 + 방향]` (s8):
 * ```
 * 키 −1 · '2' → 0 (위) · −2 · '8' → 1 (아래) · −3 · '4' → 2 (왼쪽) · −4 · '6' → 3 (오른쪽) · 그 밖 → 그대로
 * ```
 * 나리 외출 지도 키 0x13ba4(그 밖 키 → `[this+0xac] = 0x7f3e4(gfx, [this+0xac], 키)`, 0x13c08~0x13c1a)와
 * 시즌 외출 지도 키 0xbf50 이 같은 함수 · 같은 표를 쓴다. 칸 차례는 `OUTING_PLACES` 와 같다.
 */
export const OUTING_MAP_MOVES: readonly (readonly [number, number, number, number])[] = [
  [1, 4, 2, 3],
  [4, 0, 2, 3],
  [1, 4, 3, 0],
  [1, 4, 0, 2],
  [0, 1, 2, 3],
]

/** 웹 키 → 0x7f3e4 의 방향 칸 (위 0 · 아래 1 · 왼쪽 2 · 오른쪽 3) — 화살표와 숫자 키 '2' · '8' · '4' · '6' */
const OUTING_MAP_DIRECTION_OF_KEY: ReadonlyMap<string, number> = new Map([
  ['ArrowUp', 0],
  ['2', 0],
  ['ArrowDown', 1],
  ['8', 1],
  ['ArrowLeft', 2],
  ['4', 2],
  ['ArrowRight', 3],
  ['6', 3],
])

/** 웹 키 → 방향 칸. 방향 키가 아니면 null */
export function outingMapDirectionOf(key: string): number | null {
  return OUTING_MAP_DIRECTION_OF_KEY.get(key) ?? null
}

/** 0x7f3e4 — 지금 칸에서 방향으로 옮긴 칸 */
export function moveOutingMapCursor(cursor: number, direction: number): number {
  return OUTING_MAP_MOVES[cursor]?.[direction] ?? cursor
}
