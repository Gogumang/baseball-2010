import { ENTRY_SUB_TAB, ENTRY_TAB, LINEUP_LAST_INDEX, NO_ENTRY_PICK } from '@/entities/season-mode/model/entryEditor/codes'
import { unlockedOutcome } from '@/entities/season-mode/model/entryEditor/keys/outcome'
import type { EntryKeyOutcome } from '@/entities/season-mode/model/entryEditor/keys/outcome'
import type { EntryBatterRow, EntryLists, EntryPitcherRow } from '@/entities/season-mode/model/entryEditor/rows'
import type { EntryEditorState } from '@/entities/season-mode/model/entryEditor/state'
import { swapEntryBatters, swapEntryPitchers, swapFieldPositions } from '@/entities/season-mode/model/entryEditor/swaps'

/** 수비위치 탭에서 선발 아홉 밖(커서 9 이상) 줄 — 고르지도 바꾸지도 못한다 (55c32 · 55ca0) */
const isBenchInFieldTab = (state: EntryEditorState, isPitcherTab: boolean) =>
  !isPitcherTab && state.subTab === ENTRY_SUB_TAB.수비위치 && state.cursor > LINEUP_LAST_INDEX

/** 고른 줄과 커서 줄을 맞바꾼다 — 투수 탭 0xb5e99(…,1) · 타순 탭 0xb5e99(…,0) · 수비위치 탭 0xb5fe5 */
function swappedLists<B extends EntryBatterRow, P extends EntryPitcherRow>(
  state: EntryEditorState,
  lists: EntryLists<B, P>,
  isPitcherTab: boolean,
): EntryLists<B, P> {
  const { first, cursor } = state
  if (isPitcherTab) return { ...lists, pitchers: swapEntryPitchers(lists.pitchers, first, cursor) }
  if (state.subTab === ENTRY_SUB_TAB.타순) return { ...lists, batters: swapEntryBatters(lists.batters, first, cursor) }
  return { ...lists, batters: swapFieldPositions(lists.batters, first, cursor) }
}

/** 고른 줄이 없을 때 — 고른다 (수비위치 탭은 선발 아홉만, 55c1a) */
function pickEntryRow<B extends EntryBatterRow, P extends EntryPitcherRow>(
  state: EntryEditorState,
  lists: EntryLists<B, P>,
  isPitcherTab: boolean,
): EntryKeyOutcome<B, P> {
  if (isBenchInFieldTab(state, isPitcherTab)) return unlockedOutcome(state, lists)
  return unlockedOutcome({ ...state, first: state.cursor }, lists)
}

/**
 * OK (55ae6, 보기 전용이면 무시): 커서 줄이 마선수면 팝업 → 끝. 아니면 고른 줄이 없으면 고르고 · 같은 줄이면 취소 ·
 * 다른 줄이면 맞바꾼 뒤 고른 줄 취소. 수비위치 탭은 둘째가 9 이상이면 아무 일도 없고 고른 줄도 남는다
 */
export function confirmEntry<B extends EntryBatterRow, P extends EntryPitcherRow>(
  state: EntryEditorState,
  lists: EntryLists<B, P>,
): EntryKeyOutcome<B, P> {
  if (state.subTab === ENTRY_SUB_TAB.보기전용) return unlockedOutcome(state, lists)
  const isPitcherTab = state.tab === ENTRY_TAB.투수
  const row = isPitcherTab ? lists.pitchers[state.cursor] : lists.batters[state.cursor]
  if (row === undefined) return unlockedOutcome(state, lists)
  // 55b22 · 55be2: 커서 줄이 마선수면 팝업 0x74ef5 (팝업이 이미 떠 있으면 그것도 안 한다 — 웹은 팝업이 키를 막는다)
  if (row.isAce) return { state, lists, isAceLocked: true }
  if (state.first === NO_ENTRY_PICK) return pickEntryRow(state, lists, isPitcherTab)
  if (state.first === state.cursor) return unlockedOutcome({ ...state, first: NO_ENTRY_PICK }, lists)
  if (isBenchInFieldTab(state, isPitcherTab)) return unlockedOutcome(state, lists)
  return unlockedOutcome({ ...state, first: NO_ENTRY_PICK }, swappedLists(state, lists, isPitcherTab))
}
