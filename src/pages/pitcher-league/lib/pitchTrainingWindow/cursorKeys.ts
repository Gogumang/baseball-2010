/** 구질 훈련 창의 두 격자 커서와 키 (키 0x17828 → 창 키 0x80268) */
import { HIDDEN_PITCH_COLUMN, moveGridCursor } from './otherSlices'
import type { AnnalsDirection, AnnalsGridShape } from './otherSlices'

/** 칸 커서 → 열 (0x810c0~0x810d0 `min(칸, 4)`) */
export const cellColumnOf = (cellIndex: number) => Math.min(cellIndex, HIDDEN_PITCH_COLUMN)

/** 깜빡임 — 0xca911(틱, 10) ≠ 0 (상태 틱 [장면+0x2c]) */
export const isPitchTrainingBlinkOn = (tick: number) => tick % 10 !== 0

/**
 * 격자 둘 — 창 생성 0x7b5e0~0x7b63c: 탭 [gfx+0x190] = new(0x28) 0x6bd7d vt+0x10(4, 1, 1, 0x330),
 * 칸 [gfx+0x194] = new(0x3c) 0x6c219 vt+0x1c(2, 3, 1, 0x30). 칸 번호 = 줄 × 2 + 칸 — 4 · 5 는 아래 가운데 칸 하나(min 4).
 */
export const PITCH_TRAINING_TAB_GRID: AnnalsGridShape = {
  columns: 4,
  rows: 1,
  wrapsColumns: true,
  wrapsRows: true,
  carriesRowOnColumnWrap: true,
  carriesColumnOnRowWrap: true,
}
export const PITCH_TRAINING_CELL_GRID: AnnalsGridShape = { columns: 2, rows: 3, wrapsColumns: true, wrapsRows: true }

export interface PitchTrainingCursor {
  /** [gfx+0x18c] — 0 탭 줄 · 1 칸 */
  readonly isCellFocus: boolean
  /** 탭 격자 칸 = 표 0xcc390 의 행(계열) */
  readonly tab: number
  /** 칸 격자 칸 0~5 */
  readonly cell: number
}

/** 진입 0x17730 — 0x80234 가 두 격자를 (0, 0) 으로, 초점 0 (탭 2 는 커서를 더 건드리지 않는다) */
export const PITCH_TRAINING_START: PitchTrainingCursor = { isCellFocus: false, tab: 0, cell: 0 }

export type PitchTrainingKey = AnnalsDirection | 'ok' | 'clr'

/** 웹 키 → 원본 키. 숫자 '2' '4' '6' '8' 은 격자(숫자키 꼴 1)가 ↑ ← → ↓ 로 읽고, '5' 는 OK 다 */
const PITCH_TRAINING_KEYS = new Map<string, PitchTrainingKey>([
  ['ArrowUp', 'up'],
  ['2', 'up'],
  ['ArrowDown', 'down'],
  ['8', 'down'],
  ['ArrowLeft', 'left'],
  ['4', 'left'],
  ['ArrowRight', 'right'],
  ['6', 'right'],
  ['Enter', 'ok'],
  ['5', 'ok'],
  ['Escape', 'clr'],
  ['Backspace', 'clr'],
])

export function pitchTrainingKeyOf(key: string): PitchTrainingKey | null {
  return PITCH_TRAINING_KEYS.get(key) ?? null
}

export type PitchTrainingKeyOutcome =
  | { readonly kind: 'move'; readonly cursor: PitchTrainingCursor }
  /** 0x17912 칸 가드 — (행, 열) 을 고른다 */
  | { readonly kind: 'confirm'; readonly row: number; readonly column: number }
  /** 취소 → 107 (17a76 `0xbcb49(0x6b)`) */
  | { readonly kind: 'close' }

/**
 * 키 0x17828 (탭 2) → 창 키 0x80268:
 * ```
 * OK(−5 · '5')  초점 0 이면 초점 = 1 (칸 커서는 그대로, 17918~17922) · 1 이면 칸 가드(행, min(칸, 4))
 * CLR(−16)      초점 1 이면 초점 = 0 (17a64~17a74) · 0 이면 → 107
 * 그 밖 초점 0   '8' · ↓ → 초점 = 1 · 칸 격자 vt+0x14(0, 0) · 아니면 탭 격자 키 (↑ · '2' 는 0x330 감기로 왼쪽 탭)
 * 그 밖 초점 1   칸 줄 == 0 이고 '2' · ↑ → 초점 = 0 · 아니면 칸 격자 키
 * ```
 */
export function pitchTrainingKeyOutcomeOf(cursor: PitchTrainingCursor, key: PitchTrainingKey): PitchTrainingKeyOutcome {
  if (key === 'ok') {
    if (!cursor.isCellFocus) return { kind: 'move', cursor: { ...cursor, isCellFocus: true } }
    return { kind: 'confirm', row: cursor.tab, column: cellColumnOf(cursor.cell) }
  }
  if (key === 'clr') return cursor.isCellFocus ? { kind: 'move', cursor: { ...cursor, isCellFocus: false } } : { kind: 'close' }
  return { kind: 'move', cursor: cursor.isCellFocus ? cellFocusMoveOf(cursor, key) : tabFocusMoveOf(cursor, key) }
}

/** 초점 0(탭 줄) — ↓ · '8' 은 칸으로 내려가 칸 격자를 (0, 0) 으로, 그 밖은 탭 격자 키 */
function tabFocusMoveOf(cursor: PitchTrainingCursor, key: AnnalsDirection): PitchTrainingCursor {
  if (key === 'down') return { ...cursor, isCellFocus: true, cell: 0 }
  return { ...cursor, tab: moveGridCursor(PITCH_TRAINING_TAB_GRID, cursor.tab, key) }
}

/** 초점 1(칸) — 첫 줄에서 ↑ · '2' 는 탭 줄로, 그 밖은 칸 격자 키 */
function cellFocusMoveOf(cursor: PitchTrainingCursor, key: AnnalsDirection): PitchTrainingCursor {
  if (key === 'up' && cursor.cell < PITCH_TRAINING_CELL_GRID.columns) return { ...cursor, isCellFocus: false }
  return { ...cursor, cell: moveGridCursor(PITCH_TRAINING_CELL_GRID, cursor.cell, key) }
}
