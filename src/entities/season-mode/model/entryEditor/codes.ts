/** `+0x33f` */
export const ENTRY_TAB = { 타자: 0, 투수: 1 } as const
export type EntryTab = (typeof ENTRY_TAB)[keyof typeof ENTRY_TAB]

/** `+0x330` */
export const ENTRY_SUB_TAB = { 보기전용: -1, 타순: 0, 수비위치: 1 } as const
export type EntrySubTab = (typeof ENTRY_SUB_TAB)[keyof typeof ENTRY_SUB_TAB]

/** `+0x338` */
export const ENTRY_RESULT = { 없음: 0, 나가기: 1, 왼쪽끝: 2, 오른쪽끝: 3 } as const
export type EntryResult = (typeof ENTRY_RESULT)[keyof typeof ENTRY_RESULT]

/** 고른 줄 없음 (`+0x418 = −1`) */
export const NO_ENTRY_PICK = -1

/** 수비위치 탭은 **선발 아홉(0~8)** 만 고를 수 있다 (55c32 `cmp 커서, #8`) */
export const LINEUP_LAST_INDEX = 8

/** 마선수를 고르면 뜨는 팝업 — StrTEXT `0xd200c` (`0x74ef5(…, 글, 1, 0, 0, 0)`) */
export const ACE_ENTRY_LOCKED_TEXT = '!C!cffffff마선수는 엔트리를!N바꿀수 없습니다'

/** `0x55798(ed, 3, 10)` — 보이는 넘기는 열 · 보이는 줄 */
export const ENTRY_VISIBLE_SCROLL_COLUMNS = 3
export const ENTRY_VISIBLE_LIST_ROWS = 10
/** 그림 한 번에 한 단계 — 표 0xd1bbc 여섯 칸 */
export const ENTRY_SLIDE_STEPS = 6
/** 기본 표의 넘기는 열 수 (수비·보직 딱지 + 기록 둘) */
export const ENTRY_BASIC_SCROLL_COLUMNS = 3
