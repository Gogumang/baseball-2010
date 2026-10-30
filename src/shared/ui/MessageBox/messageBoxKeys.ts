/** 상자가 받는 키 — 펼치는 동안 · 닫히는 동안에도 기본 동작(스크롤 따위)은 막는다 */
const HANDLED_KEYS: ReadonlySet<string> = new Set([
  'ArrowRight',
  'ArrowLeft',
  'ArrowDown',
  'ArrowUp',
  'Enter',
  ' ',
  'Escape',
  'Backspace',
  '2',
  '4',
  '5',
  '6',
  '8',
])

/**
 * 격자 커서 옮기기 — 격자 객체 키 0x6be70(−3 ←/−4 →/−1 ↑/−2 ↓) → 옮기기 vtbl+0xc 0x6bead.
 * 상자 격자는 모두 플래그 0x330(0x750f4 · 0x75414)이라 가로·세로 둘 다 **감기고**(0x10·0x20), 감기면 다른 축으로
 * 한 칸 **넘어간다**(0x100·0x200 — 다른 축 칸이 둘 이상이고 한 단계 깊이까지, 0x6bef2~0x6bf1c · 0x6bf70~).
 * 곧 한 줄 상자(예/아니오)는 ↑↓ 도 칸을 바꾸고, 한 열 상자(일반모드 [13])는 ←→ 도 칸을 바꾼다.
 */
export function moveGridCursor(index: number, columns: number, count: number, dx: number, dy: number): number {
  const rows = Math.max(1, Math.ceil(count / columns))
  const cursor = { x: index % columns, y: Math.floor(index / columns) }
  const wrap = (value: number, size: number) => ((value % size) + size) % size
  function move(stepX: number, stepY: number, depth: number): void {
    if (stepX !== 0) moveColumn(stepX, depth)
    if (stepY !== 0) moveRow(stepY, depth)
  }
  /** 가로 — 감기면(0x10) 줄이 둘 이상일 때 한 단계 깊이까지 세로로 한 칸 넘어간다(0x100) */
  function moveColumn(step: number, depth: number): void {
    const isWrapped = cursor.x + step < 0 || cursor.x + step >= columns
    cursor.x = wrap(cursor.x + step, columns)
    if (isWrapped && rows > 1 && depth <= 1) move(0, Math.sign(step), depth + 1)
  }
  /** 세로 — 감기면(0x20) 열이 둘 이상일 때 한 단계 깊이까지 가로로 한 칸 넘어간다(0x200) */
  function moveRow(step: number, depth: number): void {
    const isWrapped = cursor.y + step < 0 || cursor.y + step >= rows
    cursor.y = wrap(cursor.y + step, rows)
    if (isWrapped && columns > 1 && depth <= 1) move(Math.sign(step), 0, depth + 1)
  }
  move(dx, dy, 1)
  return Math.min(cursor.y * columns + cursor.x, count - 1)
}

/** 격자 옮기기 — 화살표와 숫자키 꼴 1(표 0xd2e7c)의 '2' '4' '6' '8' */
const MOVE_KEYS: Readonly<Record<string, readonly [dx: number, dy: number]>> = {
  ArrowRight: [1, 0],
  '6': [1, 0],
  ArrowLeft: [-1, 0],
  '4': [-1, 0],
  ArrowDown: [0, 1],
  '8': [0, 1],
  ArrowUp: [0, -1],
  '2': [0, -1],
}
/** OK — 75634~7563e `키 + 5 == 0 || 키 == 0x35` (웹은 Enter · 스페이스 · '5') */
const OK_KEYS: ReadonlySet<string> = new Set(['Enter', ' ', '5'])
/** 취소(CLR) — Escape · Backspace */
const CANCEL_KEYS: ReadonlySet<string> = new Set(['Escape', 'Backspace'])

export type MessageBoxKeyAction =
  | { readonly kind: '옮김'; readonly dx: number; readonly dy: number }
  | { readonly kind: '확인' }
  | { readonly kind: '취소' }

/** 키 하나가 상자에서 하는 일 — 상자 몫이 아니면 null */
export function messageBoxKeyActionOf(key: string): MessageBoxKeyAction | null {
  const move = Object.hasOwn(MOVE_KEYS, key) ? MOVE_KEYS[key] : undefined
  if (move !== undefined) return { kind: '옮김', dx: move[0], dy: move[1] }
  if (OK_KEYS.has(key)) return { kind: '확인' }
  if (CANCEL_KEYS.has(key)) return { kind: '취소' }
  return null
}

/** 펼치는 동안 · 닫히는 동안에도 상자 몫 키의 기본 동작(스크롤 따위)은 막는다 */
export function swallowHandledKey(event: KeyboardEvent): void {
  if (HANDLED_KEYS.has(event.key)) event.preventDefault()
}
