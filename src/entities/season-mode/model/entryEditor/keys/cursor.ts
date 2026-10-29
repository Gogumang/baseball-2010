import type { EntryBatterRow, EntryLists, EntryPitcherRow } from '@/entities/season-mode/model/entryEditor/rows'
import { ENTRY_TAB } from '@/entities/season-mode/model/entryEditor/codes'
import { entryVisibleRowCountOf } from '@/entities/season-mode/model/entryEditor/state'
import type { EntryEditorState } from '@/entities/season-mode/model/entryEditor/state'

/** 지금 탭 목록의 줄 수 */
export function rowCountOf(state: EntryEditorState, lists: EntryLists<EntryBatterRow, EntryPitcherRow>): number {
  return state.tab === ENTRY_TAB.투수 ? lists.pitchers.length : lists.batters.length
}

/** 위·아래 — 세로로 감고(꼴 0x20) 커서가 보이는 줄 밖으로 나갈 때만 윗줄을 고친다 (0x6c2bd) */
export function movedEntryCursor(state: EntryEditorState, rowCount: number, dy: number): EntryEditorState {
  if (rowCount <= 0) return state
  const cursor = (state.cursor + dy + rowCount) % rowCount
  const visible = entryVisibleRowCountOf(rowCount)
  if (cursor >= state.top && cursor < state.top + visible) return { ...state, cursor }
  const top = cursor - state.top > 0 ? cursor - visible + 1 : cursor
  return { ...state, cursor, top }
}

/** 웹 전용 — 줄을 눌러 커서를 옮긴다 (원본은 위·아래 키뿐이다). 목록 밖이면 그대로 */
export function pointEntryCursor(state: EntryEditorState, lists: EntryLists<EntryBatterRow, EntryPitcherRow>, index: number): EntryEditorState {
  if (index < 0 || index >= rowCountOf(state, lists)) return state
  return { ...state, cursor: index }
}
