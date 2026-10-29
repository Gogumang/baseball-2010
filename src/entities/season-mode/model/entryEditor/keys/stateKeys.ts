import { ENTRY_RESULT, ENTRY_SUB_TAB, ENTRY_TAB, NO_ENTRY_PICK } from '@/entities/season-mode/model/entryEditor/codes'
import { movedEntryCursor } from '@/entities/season-mode/model/entryEditor/keys/cursor'
import type { EntryKey } from '@/entities/season-mode/model/entryEditor/keys/outcome'
import { isEntryColumnScrollable } from '@/entities/season-mode/model/entryEditor/state'
import type { EntryEditorState } from '@/entities/season-mode/model/entryEditor/state'

const isBatterTab = (state: EntryEditorState) => state.tab === ENTRY_TAB.타자
const isViewOnly = (state: EntryEditorState) => state.subTab === ENTRY_SUB_TAB.보기전용
const hasPick = (state: EntryEditorState) => state.first !== NO_ENTRY_PICK
/** 옆 키가 하위 탭 대신 열을 밀거나 끝 코드를 내는 판 — 투수 탭 · 타자 탭 보기 전용 */
const usesSideKeysForColumns = (state: EntryEditorState) => !isBatterTab(state) || isViewOnly(state)

/** 투수 탭 · 보기 전용의 옆 키 — `+0x337` 이면 열 밀기, 아니면 끝 코드 */
function slideOrEnd(state: EntryEditorState, direction: 'next' | 'previous', result: EntryEditorState['result']): EntryEditorState {
  if (isEntryColumnScrollable(state)) return { ...state, slide: { step: 0, direction } }
  return { ...state, result }
}

/** '*' (559b2) — 탭 뒤집기 → 0x55724 가 목록을 다시 채운다(커서 (0, 0) · 윗줄 0, 첫 열 +0x335 는 그대로) */
function pressStar(state: EntryEditorState): EntryEditorState {
  const tab = isBatterTab(state) ? ENTRY_TAB.투수 : ENTRY_TAB.타자
  // 559cc~559e8: 보기 전용(−1)이면 하위 탭·고른 줄을 건드리지 않고 끝난다
  if (isViewOnly(state)) return { ...state, tab, cursor: 0, top: 0 }
  return { ...state, tab, cursor: 0, top: 0, subTab: ENTRY_SUB_TAB.타순, first: NO_ENTRY_PICK }
}

/** 왼 (559f8) — 수비위치 탭이고 고른 줄이 없으면 타순 탭으로, 그 밖은 2 (⚠️ 수비위치 탭에서 고른 줄이 있을 때도 2 다) */
function pressLeft(state: EntryEditorState): EntryEditorState {
  if (usesSideKeysForColumns(state)) return slideOrEnd(state, 'previous', ENTRY_RESULT.왼쪽끝)
  if (state.subTab === ENTRY_SUB_TAB.수비위치 && !hasPick(state)) return { ...state, subTab: ENTRY_SUB_TAB.타순 }
  return { ...state, result: ENTRY_RESULT.왼쪽끝 }
}

/** 오른 (55a6e) — 타순 탭이고 고른 줄이 없으면 수비위치 탭으로 · 수비위치 탭이면 3 (⚠️ 타순 탭에서 고른 줄이 있으면 **아무 일도 없다**) */
function pressRight(state: EntryEditorState): EntryEditorState {
  if (usesSideKeysForColumns(state)) return slideOrEnd(state, 'next', ENTRY_RESULT.오른쪽끝)
  if (state.subTab !== ENTRY_SUB_TAB.타순) return { ...state, result: ENTRY_RESULT.오른쪽끝 }
  return hasPick(state) ? state : { ...state, subTab: ENTRY_SUB_TAB.수비위치 }
}

/** CLR (55908) — 고른 줄이 있으면 취소, 없으면 끝 코드 1 */
function pressCancel(state: EntryEditorState): EntryEditorState {
  if (hasPick(state)) return { ...state, first: NO_ENTRY_PICK }
  return { ...state, result: ENTRY_RESULT.나가기 }
}

/** 명단을 건드리지 않는 키 — 키 셈을 마친 상태와 지금 탭 목록의 줄 수를 받는다 */
export const STATE_KEYS: Readonly<Record<Exclude<EntryKey, '확인'>, (state: EntryEditorState, rowCount: number) => EntryEditorState>> = {
  위: (state, rowCount) => movedEntryCursor(state, rowCount, -1),
  아래: (state, rowCount) => movedEntryCursor(state, rowCount, 1),
  별: pressStar,
  취소: pressCancel,
  왼: pressLeft,
  오른: pressRight,
  // '0' (55920) — 상세 창 열고 닫기
  영: (state) => ({ ...state, isDetailOpen: !state.isDetailOpen }),
}
