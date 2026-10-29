import {
  ENTRY_BASIC_SCROLL_COLUMNS,
  ENTRY_RESULT,
  ENTRY_SUB_TAB,
  ENTRY_TAB,
  ENTRY_VISIBLE_LIST_ROWS,
  ENTRY_VISIBLE_SCROLL_COLUMNS,
  NO_ENTRY_PICK,
} from '@/entities/season-mode/model/entryEditor/codes'
import type { EntryResult, EntrySubTab, EntryTab } from '@/entities/season-mode/model/entryEditor/codes'

export interface EntryEditorState {
  readonly tab: EntryTab
  readonly subTab: EntrySubTab
  /** `+0x418` */
  readonly first: number
  /** 목록 커서 `[+0x10]×[+0x14]+[+0xc]` — 한 열 목록이라 곧 줄 번호다 */
  readonly cursor: number
  /** `+0x338` — 원본처럼 한 번 서면 다음에 다른 값이 설 때까지 남는다 */
  readonly result: EntryResult
  /** `+0x424` */
  readonly isDetailOpen: boolean
  /** 목록 윗줄 `[목록+0x30]` */
  readonly top: number
  /** 보이는 첫 넘기는 열 `+0x335` */
  readonly firstColumn: number
  /** 열 밀기 `+0x331`(단계) · `+0x332`(방향) — 없으면 −1 */
  readonly slide: EntryColumnSlide | null
  /** 키 셈 `+0x40c` */
  readonly keyPresses: number
  /** 넘기는 열 수 — `+0x337` = 이 값 > 보이는 열 3 */
  readonly scrollColumnCount: number
}

/** 열 밀기 — 단계 0~5 · 방향 'next'(오른 키, `+0x332 = 0`) · 'previous'(왼 키, 1) */
export interface EntryColumnSlide {
  readonly step: number
  readonly direction: 'next' | 'previous'
}

/**
 * 초기화 `0x5561c(ed, &팀, 편집가능, 넷째, 다섯째=1)`:
 * ```
 * 5563c  ed+0x420 = 팀 · ed+0x340 = 넷째
 * 5564a  ed+0x331 = −1 · ed+0x335 = 0 · ed+0x338 = 0 · ed+0x33e = 0 · ed+0x439 = 0
 * 5568a  ed+0x330 = 편집가능 ? 0 : −1
 * 55690  ed+0x418 = −1
 * 5569a  ed+0x33f = 다섯째 (= 1 → 투수 탭)
 * 556d6  ed+0x424 = 0 (상세 창 닫힘)
 * ```
 * 이어 `0x55798(ed, 3, 10)` 이 `0x55724(ed, +0x33f)` 로 목록을 채우며 커서를 (0,0) 에 둔다.
 */
export function openEntryEditor(isEditable: boolean, scrollColumnCount: number = ENTRY_BASIC_SCROLL_COLUMNS): EntryEditorState {
  return {
    tab: ENTRY_TAB.투수,
    subTab: isEditable ? ENTRY_SUB_TAB.타순 : ENTRY_SUB_TAB.보기전용,
    first: NO_ENTRY_PICK,
    cursor: 0,
    result: ENTRY_RESULT.없음,
    isDetailOpen: false,
    top: 0,
    firstColumn: 0,
    slide: null,
    keyPresses: 0,
    scrollColumnCount,
  }
}

/** `+0x337` — 넘기는 열이 보이는 열보다 많다 */
export const isEntryColumnScrollable = (state: EntryEditorState) => state.scrollColumnCount > ENTRY_VISIBLE_SCROLL_COLUMNS

/** 보이는 줄 [목록+0x38] = min(10, 줄 수) (0x55784~0x5578e) */
export const entryVisibleRowCountOf = (rowCount: number) => Math.min(ENTRY_VISIBLE_LIST_ROWS, rowCount)

/** 0x55864 를 키 없이 부른 틀 — 메인 메뉴의 틀마다 셈 (+0x40c 만 +1, 55868~55874) */
export function tickEntryEditor(state: EntryEditorState): EntryEditorState {
  return { ...state, keyPresses: state.keyPresses + 1 }
}
