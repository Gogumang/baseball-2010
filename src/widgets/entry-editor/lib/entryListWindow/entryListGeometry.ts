import {
  ENTRY_COLUMN_GAP,
  ENTRY_VISIBLE_COLUMNS,
  type EntryColumn,
  type EntryColumnTable,
  entryColumnOf,
} from '@/widgets/entry-editor/lib/entryListWindow/entryColumns'
import { ENTRY_LIST_LAYOUT, entryArrowBlinkOf } from '@/widgets/entry-editor/lib/entryListWindow/entryListLayout'

/** 놓인 열 */
export interface PlacedEntryColumn {
  readonly column: EntryColumn
  /** 넘기는 열의 첨자 (고정 열은 −1) */
  readonly index: number
  readonly x: number
}

export interface EntryListGeometry {
  readonly fixed: readonly PlacedEntryColumn[]
  /** 넘기는 열 가운데 이번 그림에 그리는 것 (자르기 안) */
  readonly scroll: readonly PlacedEntryColumn[]
  /** 자르기 0xbae25 (x0, 58, 폭, 221) */
  readonly clip: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
  /** 옆 화살 — [ed+0x337] 일 때만 */
  readonly leftArrow: { readonly x: number; readonly y: number } | null
  readonly rightArrow: { readonly x: number; readonly y: number } | null
  /** 이름 열 · 첫 넘기는 열(수비·보직 딱지)의 x — 커서 · 고른 줄 칸(+0x3ec · +0x3f4) */
  readonly nameColumn: PlacedEntryColumn | null
}

export interface EntryListGeometryInput {
  readonly table: EntryColumnTable
  /** [ed+0x335] */
  readonly firstColumn: number
  /** 이번 그림의 밀림(px) — 0x5cd60~0x5cd84 */
  readonly slideOffset: number
  readonly keyPresses: number
  /** s8 [ed+0x33e] — 0x5561c 가 0 으로 둔다 (나리 124 만 15) */
  readonly scrollOffsetX?: number
}

export function entryListGeometryOf(input: EntryListGeometryInput): EntryListGeometry {
  const { fixed, endX } = placeFixedColumns(input.table.fixed)
  const columns = input.table.scroll.map(entryColumnOf)
  const first = input.firstColumn
  const width = visibleScrollWidthOf(columns, first)
  const clipX = endX + (input.scrollOffsetX ?? 0)
  const clip = { x: clipX, y: ENTRY_LIST_LAYOUT.headerY, width, height: ENTRY_LIST_LAYOUT.clipHeight }
  return {
    fixed,
    scroll: placeScrollColumns(columns, first, clipX + input.slideOffset),
    clip,
    ...sideArrowsOf(clip, first, columns.length, entryArrowBlinkOf(input.keyPresses)),
    nameColumn: fixed.find((placed) => placed.column.kind === '이름') ?? null,
  }
}

/** 고정 열을 x = W/2 − 100 부터 차례로 — 열마다 x += 폭 + 3. 돌려주는 끝 x 가 넘기는 열의 x0 다 */
function placeFixedColumns(words: readonly number[]): { readonly fixed: PlacedEntryColumn[]; readonly endX: number } {
  let x: number = ENTRY_LIST_LAYOUT.originX
  const fixed = words.map((word) => {
    const column = entryColumnOf(word)
    const placed = { column, index: -1, x }
    x += column.width + ENTRY_COLUMN_GAP
    return placed
  })
  return { fixed, endX: x }
}

/** 0x55d6c — 보이는 열들의 폭 + 3 의 합 */
function visibleScrollWidthOf(columns: readonly EntryColumn[], first: number): number {
  let width = 0
  for (let i = first; i < first + ENTRY_VISIBLE_COLUMNS && i < columns.length; i += 1) width += (columns[i]?.width ?? 0) + ENTRY_COLUMN_GAP
  return width
}

/** 비어 있는 열 칸의 폭 (36 + 3) — 첫 열 − 1 이 음수일 때 자리만 넘긴다 */
const EMPTY_COLUMN_STEP = 36 + ENTRY_COLUMN_GAP

/** 5cd8e: x = x0 + 밀림 − (36 + 3) 에서 첫 열 − 1 부터 첫 열 + 보이는 열까지(열 수 안). 음수 첨자는 자리만 넘긴다 */
function placeScrollColumns(columns: readonly EntryColumn[], first: number, slidX: number): PlacedEntryColumn[] {
  const scroll: PlacedEntryColumn[] = []
  let columnX = slidX - EMPTY_COLUMN_STEP
  for (let index = first - 1; index < first + ENTRY_VISIBLE_COLUMNS + 1 && index < columns.length; index += 1) {
    const column = columns[index]
    if (index < 0 || column === undefined) {
      columnX += EMPTY_COLUMN_STEP
      continue
    }
    scroll.push({ column, index, x: columnX })
    columnX += column.width + ENTRY_COLUMN_GAP
  }
  return scroll
}

/** 옆 화살 — 넘기는 열이 보이는 열보다 많을 때([ed+0x337])만, 첫 열이 0 이 아니면 왼쪽 · 끝 열이 안 보이면 오른쪽 */
function sideArrowsOf(
  clip: { readonly x: number; readonly width: number },
  first: number,
  columnCount: number,
  blink: number,
): Pick<EntryListGeometry, 'leftArrow' | 'rightArrow'> {
  const L = ENTRY_LIST_LAYOUT
  const isScrollable = ENTRY_VISIBLE_COLUMNS < columnCount
  return {
    leftArrow: isScrollable && first !== 0 ? { x: clip.x - blink - L.sideArrowWidth, y: L.sideArrowY } : null,
    rightArrow:
      isScrollable && first + ENTRY_VISIBLE_COLUMNS !== columnCount ? { x: clip.x + clip.width + blink - L.sideArrowWidth, y: L.sideArrowY } : null,
  }
}
