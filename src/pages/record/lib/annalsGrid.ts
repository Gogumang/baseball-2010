/**
 * 기록연감 키 처리 (메인 메뉴 상태 30 갱신 0x2b7a0 — 직접 떴다).
 *
 * ```
 * 들어올 때 0x2407c: [skin+0xf6] = 1 (탭 막대에 초점) · 탭 [skin+0xf8] = 0 · 쪽 [skin+0xfc] = 0
 * [skin+0xf6] ≠ 0 (탭 막대):
 *   ← / '4' → 탭 − 1 (0 이면 4) · → / '6' → 탭 + 1 (4 면 0)            ; 둘 다 0x2b640 (탭 새로 시작)
 *   OK(−5) / '5' / ↓(−2) → 0x2b640 + [skin+0xf6] = 0 (본문으로)         ; '8' 은 ↓ 가 아니다 — 아무것도 안 함
 *   ↑ · '2' → 아무것도 안 함 · CLR → 기록연감을 닫는다 ([skin+0x94] = 1 …)
 * [skin+0xf6] = 0 (본문): 먼저 격자 객체 [this+0x7c] 의 키 처리(vt+0x18 = 0x6c299)가 커서를 옮기고
 *   숫자 2·4·5·6·8 을 ↑ ← OK → ↓ 로 바꿔 돌려준다(표 0xd2e7c). 그 값으로:
 *   ← → → 쪽 넘기기(0x2ba10 · 0x2ba5a) · ↑ ↓ → 탭 1·2 의 보이는 줄 창 옮기기 · OK → 아무것도 · CLR → [skin+0xf6] = 1
 *   0x5550d(skin, 키) 가 마지막 방향을 [skin+0x8c] 에 적는다 — ← 0 · → 1 · ↑ 2 · ↓ 3 (흔들림이 쓴다)
 * ```
 * 0x2b640(탭 새로 시작): 쪽 = 0, 격자 커서 (0, 0), 격자 모양을 탭마다 다시 짓고, 탭 1·2 는 칸을 채우며
 * 보이는 줄 창 [skin+0x1f4] = 0 · [skin+0x1f8] = 3 (0x58b5c · 0x58a3d 끝).
 */

/** 격자 모양 — 0x2b640 의 vt+0x1c(열, 줄, 1, 꼴) (0x6c4bd → 0x6bfe1) */
export interface AnnalsGridShape {
  readonly columns: number
  readonly rows: number
  /** 꼴 비트 0x10 — 가로로 넘치면 같은 줄 반대쪽으로 감는다 (0x6bead, 0xca911 = 나머지) */
  readonly wrapsColumns: boolean
  /** 꼴 비트 0x20 — 세로로 넘치면 감는다. 아니면 끝에서 멈춘다 */
  readonly wrapsRows: boolean
}

/**
 * 탭별 격자 (0x2b640 점프표 0xcec78):
 * 탭 0 (1, 8, 꼴 0x20) · 1 (4, 5, 0x10) · 2 (4, 10, 0x10) · 3 (1, 8, 0x20) · 4 (1, 8, 0x20)
 */
export const ANNALS_GRID_SHAPES: readonly AnnalsGridShape[] = [
  { columns: 1, rows: 8, wrapsColumns: false, wrapsRows: true },
  { columns: 4, rows: 5, wrapsColumns: true, wrapsRows: false },
  { columns: 4, rows: 10, wrapsColumns: true, wrapsRows: false },
  { columns: 1, rows: 8, wrapsColumns: false, wrapsRows: true },
  { columns: 1, rows: 8, wrapsColumns: false, wrapsRows: true },
]

export type AnnalsDirection = 'left' | 'right' | 'up' | 'down'

/** [skin+0x8c] 방향 번호 (0x5550d) */
export const DIRECTION_CODES: Record<AnnalsDirection, number> = { left: 0, right: 1, up: 2, down: 3 }

/**
 * 격자 커서 한 칸 옮기기 (0x6c445 → 0x6be71 → 0x6bead). 칸 번호 = 줄 × 열 + 칸.
 * 가로: 꼴 0x10 이면 `(x + dx + 열) % 열`, 아니면 0 ~ 열−1 로 자른다. 세로도 꼴 0x20 으로 같다.
 * 막힌 칸 표 [+0x28] 은 0x6c4bd 가 모두 1 로 채워 건너뛸 칸이 없다.
 */
export function moveGridCursor(shape: AnnalsGridShape, index: number, direction: AnnalsDirection): number {
  const dx = direction === 'left' ? -1 : direction === 'right' ? 1 : 0
  const dy = direction === 'up' ? -1 : direction === 'down' ? 1 : 0
  const x = index % shape.columns
  const y = Math.floor(index / shape.columns)
  const nextX = stepOf(x, dx, shape.columns, shape.wrapsColumns)
  const nextY = stepOf(y, dy, shape.rows, shape.wrapsRows)
  return nextY * shape.columns + nextX
}

function stepOf(value: number, delta: number, count: number, wraps: boolean): number {
  const next = value + delta
  if (next >= 0 && next < count) return next
  if (wraps) return (next + count) % count
  return Math.min(Math.max(next, 0), count - 1)
}

/** 보이는 줄 수 — 창 [skin+0x1f4] ~ [skin+0x1f8] = 0 ~ 3 에서 시작해 둘이 함께 움직인다 */
export const VISIBLE_GRID_ROWS = 3

/**
 * 창을 내리는 칸 번호 한도 — ↓ 갈래 0x2b9aa: 탭 1 은 `칸 ≤ 20`(0x14), 탭 2 는 `칸 ≤ 40`(0x28).
 * (커서는 칸 수 안에서만 움직여 한도에 닿지 않는다 — 원본 값 그대로)
 */
const SCROLL_DOWN_LIMITS: Readonly<Record<number, number>> = { 1: 0x14, 2: 0x28 }

/**
 * 커서가 옮겨 간 뒤 창 윗줄 (0x2b968 · 0x2b9aa). 탭 1·2 만 창이 있다.
 * ↑: `칸 < 윗줄 × 4` 이고 `칸 ≥ 0` 이면 윗줄 − 1 · ↓: `칸 ≥ (윗줄 + 3) × 4` 이고 `칸 ≤ 한도` 면 윗줄 + 1.
 */
export function scrollTopAfter(tab: number, top: number, index: number, direction: AnnalsDirection): number {
  const limit = SCROLL_DOWN_LIMITS[tab]
  if (limit === undefined) return top
  const columns = ANNALS_GRID_SHAPES[tab].columns
  if (direction === 'up' && index < top * columns && index >= 0) return top - 1
  if (direction === 'down' && index >= (top + VISIBLE_GRID_ROWS) * columns && index <= limit) return top + 1
  return top
}

/**
 * ▼ 표시 — 탭 1 은 `윗줄 ≤ 1`(0x2eb7e), 탭 2 는 `윗줄 ≤ 6`(0x2f046) 일 때 그린다. ▲ 은 두 탭 다 `윗줄 > 0`.
 */
const DOWN_MARK_MAX_TOP: Readonly<Record<number, number>> = { 1: 1, 2: 6 }
export const hasDownMark = (tab: number, top: number) => top <= (DOWN_MARK_MAX_TOP[tab] ?? -1)

/**
 * 깜박임 (0x2e2dc~0x2e2f4): 그릴 때마다 [skin+0x410] 을 1 올리고 `값 % 8 ≤ 3` 이면 켜진다.
 * 켜지면 ▲ 은 y0 + 20(꺼지면 21), ▼ 은 y0 + 116(꺼지면 115), 고른 칸 테두리 21 은 켜졌을 때만,
 * 탭 커서 9 는 탭 막대에 초점이 있을 때만 깜박인다(본문에 있으면 늘 그린다, 0x2e5be).
 * ⚠️ [skin+0x410] 은 다른 화면과 함께 쓰는 셈이라 들어올 때의 위상은 알 수 없다 — 웹은 화면 갱신 수로 센다.
 */
export const isBlinkOn = (tick: number) => tick % 8 <= 3
