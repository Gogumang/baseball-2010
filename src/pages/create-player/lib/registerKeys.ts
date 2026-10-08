/**
 * 선수 등록 줄 고르기 키 (나만의리그 상태 0x66 갱신 **0x16f28** — 0x171ce~0x17314 직접 떴다, 타자·투수 공용).
 *
 * 줄 목록 [this+0x74] 는 0x17360 이 `vtable+0x10(목록, 1, 5, 1, 꼴 0, 0)` (0x174e4~0x174f6, = 0x6bfe1)로 짓는다.
 * 꼴 0 이라 가로·세로 모두 감지 않고 **끝에서 멈춘다**(0x6bead 의 0x10 · 0x20 비트가 없다).
 * ```
 * 이름 줄(0):
 *   CLR   strlen == 0 → 0x65(팀 고르기) · 아니면 0x66fd5 로 한 글자 지움 → 키를 ↑ 로 바꿔 목록에 (맨 위라 그대로)
 *   OK · ↓ strlen == 0 → 무시 · 아니면 입력기 0x67655 를 거쳐 아래로
 *   '2' · '8' 은 입력기 몫 — 목록에 안 넘긴다 (0x17324~0x1732c)
 * 다른 줄: ← → '4' '6' 은 값 바꾸기, CLR 은 ↑ 로 바뀌어 한 줄 위로
 * OK 는 ↓ 로 바뀐다. 다만 바꾸기 전 줄이 마지막(피부)이면 타자는 StrMODE[2] 확인, 투수는 0x67(변화구) (0x17284~0x17308)
 * ```
 * 이름 길이는 strlen(0x14003f8) 만 본다 — 공백도 글자다.
 * ⚠️ 미해결: OK 가 이름 줄에서 `[this+0x33] ≠ 0` 이면 무시되는 갈래(0x17274~0x1727c) — 그 바이트의 뜻(입력기 상태로 보인다)을 못 읽어 웹은 늘 0 으로 둔다.
 */

export type RegisterKey = 'up' | 'down' | 'ok' | 'clr'

export type RegisterKeyOutcome =
  | { readonly kind: 'move'; readonly row: number }
  | { readonly kind: 'cancel' }
  | { readonly kind: 'deleteChar' }
  | { readonly kind: 'finish' }
  | { readonly kind: 'none' }

/** 줄 수 — 이름 · 타입 · 포지션/보직 · 손 · 피부 */
export const REGISTER_ROW_COUNT = 5
const NAME_ROW = 0
const LAST_ROW = REGISTER_ROW_COUNT - 1

/** 목록 [0x74] 한 칸 옮기기 — 꼴 0 이라 끝에서 멈춘다 */
const clampRow = (row: number) => Math.min(Math.max(row, 0), LAST_ROW)

export function registerKeyOutcomeOf(row: number, key: RegisterKey, nameLength: number): RegisterKeyOutcome {
  const isEmptyName = row === NAME_ROW && nameLength === 0
  if (key === 'clr') {
    if (row !== NAME_ROW) return { kind: 'move', row: clampRow(row - 1) }
    return isEmptyName ? { kind: 'cancel' } : { kind: 'deleteChar' }
  }
  if (key === 'up') return { kind: 'move', row: clampRow(row - 1) }
  if (isEmptyName) return { kind: 'none' }
  if (key === 'ok' && row === LAST_ROW) return { kind: 'finish' }
  return { kind: 'move', row: clampRow(row + 1) }
}

/**
 * 웹 키 → 원본 키. CLR = Esc · Backspace, OK = Enter.
 * '2' · '8' 은 이름 줄이 아닐 때만 목록 키(표 0xd2e7c — ↑ · ↓)다. 이름 줄에서는 글자다.
 */
export function registerKeyOf(key: string, isNameRow: boolean): RegisterKey | null {
  if (key === 'ArrowUp' || (key === '2' && !isNameRow)) return 'up'
  if (key === 'ArrowDown' || (key === '8' && !isNameRow)) return 'down'
  if (key === 'Enter') return 'ok'
  if (key === 'Escape' || key === 'Backspace') return 'clr'
  return null
}

/** 한 글자 지우기 (0x66fd5) — 웹은 코드 포인트 하나를 뗀다 */
export const nameWithoutLastChar = (name: string) => Array.from(name).slice(0, -1).join('')
