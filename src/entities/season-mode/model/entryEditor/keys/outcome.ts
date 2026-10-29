import type { EntryBatterRow, EntryLists, EntryPitcherRow } from '@/entities/season-mode/model/entryEditor/rows'
import type { EntryEditorState } from '@/entities/season-mode/model/entryEditor/state'

/** 편집기 키 — 원본 키 코드: 위·아래(목록 객체) · −3/'4' · −4/'6' · −5/'5' · −16 · '*' · '0' */
export type EntryKey = '위' | '아래' | '왼' | '오른' | '확인' | '취소' | '별' | '영'

export interface EntryKeyOutcome<B extends EntryBatterRow, P extends EntryPitcherRow> {
  readonly state: EntryEditorState
  readonly lists: EntryLists<B, P>
  /** 마선수를 고르려 했다 — `ACE_ENTRY_LOCKED_TEXT` 팝업을 띄운다 */
  readonly isAceLocked: boolean
}

/** 팝업 없이 끝난 키 */
export function unlockedOutcome<B extends EntryBatterRow, P extends EntryPitcherRow>(
  state: EntryEditorState,
  lists: EntryLists<B, P>,
): EntryKeyOutcome<B, P> {
  return { state, lists, isAceLocked: false }
}
