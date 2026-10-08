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
  /**
   * 꼴 비트 0x100 — 0x10 으로 가로가 감기면 줄이 둘 이상일 때 세로로 부호(dx) 한 칸 더 옮긴다
   * (0x6bee8~0x6bf1c: 되부름 `vt+0xc(0, ±1, 깊이 + 1)` · 깊이 [sp] ≤ 1 일 때만 — 되부른 쪽은 더 넘기지 않는다).
   * 안 주면 없다.
   */
  readonly carriesRowOnColumnWrap?: boolean
  /** 꼴 비트 0x200 — 0x20 으로 세로가 감기면 열이 둘 이상일 때 가로로 부호(dy) 한 칸 더 옮긴다 (0x6bf66~0x6bf9a) */
  readonly carriesColumnOnRowWrap?: boolean
  /**
   * 막힌 칸(칸 번호) — 0x6c219 격자의 표 [+0x28] 에서 0 인 칸. vt+0x1c(0x6c4bd)가 모두 1 로 채운 뒤 진입이 몇 칸을 0 으로 지운다.
   * 옮기기 vt+0x8(0x6c445)은 막힌 칸을 같은 방향으로 건너뛴다 — `moveGridCursor` 머리글. 안 주면 없다.
   */
  readonly blockedCells?: readonly number[]
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
  const blocked = shape.blockedCells ?? []
  if (blocked.length === 0) return stepGridCursor(shape, index, direction)
  // 0x6c445: 열린 칸 수(0x6c3f4)가 — 지금 칸이 열렸으면 2 이상, 막혔으면 1 이상일 때만 옮긴다.
  // 한 칸씩(0x6be71) 옮기다 열린 칸에 서면 멈춘다. 한 걸음이 제자리면(끝에서 잘림) 처음 칸으로 되돌린다.
  const cellCount = shape.columns * shape.rows
  const isOpen = (cell: number) => !blocked.includes(cell)
  let openCount = 0
  for (let cell = 0; cell < cellCount; cell += 1) if (isOpen(cell)) openCount += 1
  if (isOpen(index) ? openCount <= 1 : openCount <= 0) return index
  let current = index
  for (let guard = 0; guard <= cellCount; guard += 1) {
    const next = stepGridCursor(shape, current, direction)
    current = next === current ? index : next
    if (isOpen(current) || current === index) return current
  }
  return current
}

/** 한 걸음 (0x6be71 → 0x6bead) */
function stepGridCursor(shape: AnnalsGridShape, index: number, direction: AnnalsDirection): number {
  const dx = direction === 'left' ? -1 : direction === 'right' ? 1 : 0
  const dy = direction === 'up' ? -1 : direction === 'down' ? 1 : 0
  const cell = { x: index % shape.columns, y: Math.floor(index / shape.columns) }
  moveCell(shape, cell, dx, dy, 0)
  return cell.y * shape.columns + cell.x
}

/**
 * 0x6bead(격자, dx, dy, 깊이) — 가로를 먼저(0x6bebc~0x6bf36), 세로를 뒤에(0x6bf38~) 옮긴다.
 * 감기는 쪽(0x10 · 0x20)은 넘칠 때만(0x6bdc4 · 0x6bde0) `(값 + d + 개수) % 개수`, 아니면 0 ~ 개수−1 로 자른다.
 */
function moveCell(shape: AnnalsGridShape, cell: { x: number; y: number }, dx: number, dy: number, depth: number) {
  const nextDepth = depth + 1
  if (dx !== 0) {
    const overflows = cell.x + dx < 0 || cell.x + dx >= shape.columns
    cell.x = stepOf(cell.x, dx, shape.columns, shape.wrapsColumns)
    if (overflows && shape.wrapsColumns && shape.carriesRowOnColumnWrap === true && shape.rows > 1 && nextDepth <= 1) {
      moveCell(shape, cell, 0, Math.sign(dx), nextDepth)
    }
  }
  if (dy !== 0) {
    const overflows = cell.y + dy < 0 || cell.y + dy >= shape.rows
    cell.y = stepOf(cell.y, dy, shape.rows, shape.wrapsRows)
    if (overflows && shape.wrapsRows && shape.carriesColumnOnRowWrap === true && shape.columns > 1 && nextDepth <= 1) {
      moveCell(shape, cell, Math.sign(dy), 0, nextDepth)
    }
  }
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

/**
 * 탭 0·4 목록 격자 [skin+0xe0] 의 줄 커서 깜박임 — 0x7a571 이 그릴 때마다 격자 +0x18 의 `% 8 ≤ 4` 를 보고
 * (0x7a62c~0x7a64a) 다 그린 뒤 +0x18 을 1 올린다(0x7b490). +0x18 은 격자를 다시 지을 때(0x7a005, [skin+0x80] = 0 인 그림 —
 * 탭 새로 시작 0x2b640 · 쪽 넘기기 0x2babe · 본문 CLR 0x2b964) 0 이 된다. 곧 지은 뒤 다섯 그림 켜짐 · 세 그림 꺼짐.
 * 커서를 보일지(+6)도 지을 때 `[skin+0xf6] == 0`(본문 초점)으로 정해진다(0x2e93c~0x2e948 · 0x2f9b2~0x2f9c4).
 * 흔들림(+0x6c · +0x70, 0x7a7f6~0x7a842)은 아래 `cursorShakeOf` 와 같은 표 0xd4080 · 0xd4050 이다.
 */
export const isListCursorBlinkOn = (drawsSinceBuilt: number) => drawsSinceBuilt % 8 <= 4

/**
 * 고른 칸 흔들림 (탭 1 0x2ec1a~0x2ec60 · 탭 2 0x2f0e2~0x2f128): 격자 커서가 옮겨 간 틱(격자 +0x25)에
 * [this+0xf8] = 0 · [this+0xfc] = 방향([skin+0x8c]). 본문에 초점이 있고 [this+0xfc] ≠ −1 이면 고른 칸을
 * `x += 표 0xce8bc[2·방향 + t]`, `y += 표 0xce88c[3·방향 + t]` 로 그리고 t 를 올린다 — t > 1 이면 [this+0xfc] = −1.
 * 곧 두 틱: ← (−2, 0)→(+2, 0) · → (+2, 0)→(−2, 0) · ↑ (0, −2)→(0, +2) · ↓ (0, +2)→(0, −2).
 */
const SHAKE_X = [-2, 2, 2, -2, 0, 0, 0, 0] as const
const SHAKE_Y = [0, 0, 0, 0, 0, 0, -2, 2, 0, 2, -2, 0] as const
export function cursorShakeOf(directionCode: number, tick: number): { readonly dx: number; readonly dy: number } {
  if (tick < 0 || tick > 1) return { dx: 0, dy: 0 }
  return { dx: SHAKE_X[2 * directionCode + tick] ?? 0, dy: SHAKE_Y[3 * directionCode + tick] ?? 0 }
}

/**
 * **판 열고 닫기** — 들어올 때 0x2407c: 높이 [skin+0x90] = 32 · 속도 [skin+0x94] = 1 · 끝남 [skin+0x98] = 0 ·
 * 여는 중 [skin+0x99] = 1. 그리기 꼬리 0x2fb94(0x2fb9a~0x2fc12)가 그린 **뒤에** 높이를 고친다:
 * ```
 * 여는 중: 끝났으면 높이 = 212, 아니면 속도 ×= 4 · 높이 += 속도 — 212 이상이면 212 · 끝남 = 1
 * 닫는 중: 끝났으면 높이 = 1,   아니면 속도 ×= 4 · 높이 −= 속도 — 10 이하면 10 · 끝남 = 1
 * ```
 * 그래서 그림마다 32 → 36 → 52 → 116 → 212 (넷째 그림 끝에 끝남). 탭 막대에서 CLR(0x2b946)은
 * 끝남 = 0 · 속도 = 1 · 여는 중 = 0 을 세워 212 → 208 → 192 → 128 → 10 으로 닫고, 다음 갱신 0x2bb0a 가
 * `!여는 중 && 끝남` 을 보고 스페셜 목록(하위 6)으로 간다.
 * 키(0x2b87c~0x2b8b6)는 `여는 중 && 끝남 && 높이 == 212` 일 때만 받는다(닫는 쪽 `높이 == 1` 갈래는 그 전에 나간다).
 * 판 안 그림은 높이 ≤ 211 동안 (24, 160 − 높이/2 + 5, 192, 높이 − 10) 으로 잘린다 (0x2e42e~0x2e452).
 */
export const PANEL_OPEN_START_HEIGHT = 0x20
export const PANEL_FULL_HEIGHT = 0xd4
const PANEL_CLOSED_HEIGHT = 0xa
/** 끝남이 서기까지의 그림 수 — 열기·닫기 모두 4 */
export const PANEL_ANIMATION_DRAWS = 4

/** 그림 n 번 뒤 여는 판 높이 (n = 0 이 첫 그림이 쓰는 32) */
export function openingPanelHeightOf(draws: number): number {
  let height = PANEL_OPEN_START_HEIGHT
  let speed = 1
  for (let draw = 0; draw < draws; draw += 1) {
    if (height >= PANEL_FULL_HEIGHT) return PANEL_FULL_HEIGHT
    speed *= 4
    height = Math.min(PANEL_FULL_HEIGHT, height + speed)
  }
  return height
}

/** CLR 뒤 그림 n 번 뒤 닫는 판 높이 (n = 0 이 CLR 틱의 그림이 쓰는 212) */
export function closingPanelHeightOf(draws: number): number {
  let height = PANEL_FULL_HEIGHT
  let speed = 1
  for (let draw = 0; draw < draws; draw += 1) {
    if (height <= PANEL_CLOSED_HEIGHT) return PANEL_CLOSED_HEIGHT
    speed *= 4
    height = Math.max(PANEL_CLOSED_HEIGHT, height - speed)
  }
  return height
}

/** 판 높이 h 일 때 판 윗변 — 가운데 (H/2 = 160) 에서 h/2 (버림) 위 */
export const panelTopOf = (height: number) => 160 - Math.trunc(height / 2)

/**
 * **탭 3 닉네임 = 쪽마다 흐르는 목록** (직접 떴다). 쪽 = 갈래 — 0 공통 32 · 1 타자편 16 · 2 투수편 16 (표 0xcedac),
 * 칸 i 의 이름은 StrNICKNAME[i + (0 · 0x20 · 0x30)] (0x2f764~0x2f7ec), 얻었는가는 0x61d90(mgr, 쪽, i).
 * 보이는 줄은 8 이고 위·아래 키로 한 줄씩 흐른다 — 스크롤 객체가 skin 안에 있다:
 * ```
 * 0x61c54(skin, 0x8e, 8, 개수)   ; 탭 3 새로 시작(0x2b740, 개수 0x20) · 탭 3 쪽 넘기기(0x2bac6, 쪽 0 ? 0x20 : 0x10)
 *   윗줄 [+0x108] = 0 · 막대 위치 [+0x11c] = 0 · 길 [+0x118] = 0x8e − 2 = 140 · 보임 [+0x110] = 8 · 개수 [+0x114]
 *   한 칸 [+0x10c] = 1 · 막대 길이 [+0x120] = 140
 *   개수 > 8: 한 칸 = 140 / 8 = 17, 막대 길이 = 140 − (개수 − 8) × 17 — 그것이 한 칸보다 작으면
 *             막대 길이 = 0x8e − 3 × (개수 − 8) − 2, 한 칸 = 3
 * 0x61ce4(skin, 날 키)            ; 본문 초점일 때 키마다 (0x2b876 — 격자 키 처리 뒤, 키 문 0x2b87c 앞)
 *   ↑(−1)·'2': 개수 > 보임 && 윗줄 > 0 → 윗줄 − 1, 막대 위치 −= 한 칸 (0 아래면 0)
 *   ↓(−2)·'8': 개수 > 보임 && 윗줄 + 보임 < 개수 → 윗줄 + 1, 막대 위치 += 한 칸 (길 − 10 위면 길 − 10)
 * ```
 */
export interface NicknameScroll {
  readonly top: number
  readonly total: number
  readonly thumb: number
  readonly step: number
  readonly thumbLength: number
}
export const NICKNAME_VISIBLE_ROWS = 8
export const NICKNAME_SCROLL_TRACK = 0x8e - 2
/** 쪽별 칸 수 (표 0xcedac) · 이름 첫 번호 · 쪽 제목 img_text (표 0xced88) */
export const NICKNAME_PAGE_TOTALS = [0x20, 0x10, 0x10] as const
export const NICKNAME_PAGE_FIRST_NAMES = [0, 0x20, 0x30] as const
export const NICKNAME_PAGE_TITLE_FRAMES = [281, 149, 150] as const

export function startNicknameScroll(total: number): NicknameScroll {
  const hidden = total - NICKNAME_VISIBLE_ROWS
  if (hidden <= 0) return { top: 0, total, thumb: 0, step: 0, thumbLength: NICKNAME_SCROLL_TRACK }
  const step = Math.trunc(NICKNAME_SCROLL_TRACK / NICKNAME_VISIBLE_ROWS)
  const thumbLength = NICKNAME_SCROLL_TRACK - hidden * step
  if (thumbLength >= step) return { top: 0, total, thumb: 0, step, thumbLength }
  return { top: 0, total, thumb: 0, step: 3, thumbLength: NICKNAME_SCROLL_TRACK + 2 - 3 * hidden - 2 }
}

export function scrollNicknames(scroll: NicknameScroll, direction: 'up' | 'down'): NicknameScroll {
  if (scroll.total <= NICKNAME_VISIBLE_ROWS) return scroll
  if (direction === 'up') {
    if (scroll.top <= 0) return scroll
    return { ...scroll, top: scroll.top - 1, thumb: Math.max(0, scroll.thumb - scroll.step) }
  }
  if (scroll.top + NICKNAME_VISIBLE_ROWS >= scroll.total) return scroll
  return { ...scroll, top: scroll.top + 1, thumb: Math.min(NICKNAME_SCROLL_TRACK - 10, scroll.thumb + scroll.step) }
}

/** 날 키 → 스크롤 방향 (0x61ce4 는 격자를 안 거친 키를 본다: −1 · '2' 위, −2 · '8' 아래) */
export function nicknameScrollDirectionOf(key: string): 'up' | 'down' | null {
  if (key === 'ArrowUp' || key === '2') return 'up'
  if (key === 'ArrowDown' || key === '8') return 'down'
  return null
}
