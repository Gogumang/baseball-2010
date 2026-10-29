import type { EntryEditorState, EntryKey } from '@/entities/season-mode/model/entryEditor'
import { entrySlideOffsetOf } from '@/widgets/entry-editor/lib/entryListWindow'
import type { EntryColumnTable } from '@/widgets/entry-editor/lib/entryListWindow'
import { EntryListWindow } from '@/widgets/entry-editor/ui/EntryListWindow'
import type { EntryListRow } from '@/widgets/entry-editor/ui/EntryListWindow'

/** 엔트리 목록 창 `0x5cfec` 자리 — 편집기 칸을 창 props 로 옮기고, 웹 누름(줄 · 화살)을 편집기 키로 넘긴다 */
export function EntryListPanel({
  editor,
  rows,
  table,
  teamName,
  isAceLocked,
  showsNameBars = true,
  isCursorNameOnly = false,
  onKey,
  onMoveCursor,
}: {
  readonly editor: EntryEditorState
  readonly rows: readonly EntryListRow[]
  readonly table: EntryColumnTable
  readonly teamName: string
  readonly isAceLocked: boolean
  readonly showsNameBars?: boolean
  readonly isCursorNameOnly?: boolean
  readonly onKey: (key: EntryKey) => void
  readonly onMoveCursor: (index: number) => void
}) {
  return (
    <div aria-label={teamName}>
      <EntryListWindow
        rows={rows}
        table={table}
        cursor={editor.cursor}
        top={editor.top}
        firstColumn={editor.firstColumn}
        slideOffset={entrySlideOffsetOf(editor.slide, editor.firstColumn, table.scroll.length)}
        keyPresses={editor.keyPresses}
        subTab={editor.subTab}
        picked={editor.first}
        showsNameBars={showsNameBars}
        isCursorNameOnly={isCursorNameOnly}
        onPressRow={isAceLocked ? undefined : (index) => pressEntryRow(index, editor.cursor, onKey, onMoveCursor)}
        onPressArrow={isAceLocked ? undefined : onKey}
      />
    </div>
  )
}

/** 웹 전용: 처음 누르면 커서만 옮기고, 커서 줄을 다시 누르면 확인 — 원본은 위·아래 키뿐이다 */
function pressEntryRow(index: number, cursor: number, onKey: (key: EntryKey) => void, onMoveCursor: (index: number) => void): void {
  if (index === cursor) onKey('확인')
  else onMoveCursor(index)
}
