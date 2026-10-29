import { entryCursorRectOf, entryPickedFillOf, entryRowYOf } from '@/widgets/entry-editor/lib/entryListWindow'
import type { EntryListGeometry, EntryRect } from '@/widgets/entry-editor/lib/entryListWindow'

/** 보이는 줄 수 — 창은 열 줄까지 */
const MAX_VISIBLE_ROWS = 10

export interface EntryListRectsInput {
  readonly geometry: EntryListGeometry
  readonly rowCount: number
  readonly cursor: number
  readonly top: number
  readonly subTab: number
  readonly picked: number
  readonly isCursorNameOnly: boolean
}

export interface EntryListRects {
  readonly visibleCount: number
  /** 커서 0x56234 — 커서 줄이 안 보이면 null */
  readonly cursorRect: EntryRect | null
  /** 고른 줄 0x563dc — 고른 줄이 없거나 안 보이면 null */
  readonly pickedRect: EntryRect | null
}

export function entryListRectsOf(input: EntryListRectsInput): EntryListRects {
  const { geometry, top, subTab } = input
  const visibleCount = Math.min(MAX_VISIBLE_ROWS, input.rowCount)
  const isVisible = (row: number) => row >= top && row < top + visibleCount
  const badgeX = geometry.scroll.find((placed) => placed.index === 0)?.x ?? geometry.clip.x
  const cursorRect = isVisible(input.cursor)
    ? entryCursorRectOf({ geometry, rowY: entryRowYOf(input.cursor, top), subTab, isNameOnly: input.isCursorNameOnly, badgeX })
    : null
  const pickedRect = isVisible(input.picked) ? entryPickedFillOf({ geometry, rowY: entryRowYOf(input.picked, top), subTab, badgeX }) : null
  return { visibleCount, cursorRect, pickedRect }
}
