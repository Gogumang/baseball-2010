import { leavesEntryEditor, openEntryEditor, pointEntryCursor, pressEntryKey } from '@/entities/season-mode/model/entryEditor'
import type { EntryKey } from '@/entities/season-mode/model/entryEditor'
import type { NariEntryLists, NariEntryView } from './types'

/** 진입 0x16af8 — 보기 전용 편집기(셋째 인자 0), 투수 탭 · 커서 0 */
export function openNariEntryView(isMyTeam: boolean, teamId: number, lists: NariEntryLists): NariEntryView {
  return { isMyTeam, teamId, editor: openEntryEditor(false), lists }
}

/** 키 0x1457c — 편집기 0x55864 를 돌리고 끝 코드로 142 로 나가는지 본다 */
export function pressNariEntryKey(view: NariEntryView, key: EntryKey): { readonly view: NariEntryView; readonly leaves: boolean } {
  const outcome = pressEntryKey(view.editor, view.lists, key)
  const next = { ...view, editor: outcome.state, lists: outcome.lists }
  return { view: next, leaves: leavesEntryEditor(outcome.state.result, view.isMyTeam) }
}

/** 웹 전용 — 줄을 눌러 커서를 옮긴다 */
export function pointNariEntryCursor(view: NariEntryView, index: number): NariEntryView {
  return { ...view, editor: pointEntryCursor(view.editor, view.lists, index) }
}
