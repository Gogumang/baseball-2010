/**
 * **엔트리 편집기** — 키 처리 `0x55864(ed, 키)` · 초기화 `0x5561c` · 목록 채우기 `0x55724` ·
 * 교환 `0xb5e99` / `0xb5fe5` (R4 2a·2c 를 다시 떠서 확인했다).
 *
 * 일반모드 상태 23(메인 메뉴 `0x2a370`)·시즌 0xe0(`0x7044`)·나만의리그 124·143·에디트가 **같은 편집기**를
 * 쓴다. 모드가 다른 것은 "어느 팀 레코드를 넘기는가" 와 "끝 코드를 받아 어디로 가는가" 뿐이라 여기에는
 * 편집기 자체만 둔다 — 시즌 쪽 명단 만들기는 `seasonEntry.ts`, 일반모드는 `pages/general-mode`.
 *
 * ## 편집 객체 필드 (쓰임새로 이름 붙임)
 * | 필드 | 뜻 |
 * |---|---|
 * | `+0x33f` | **탭: 0 타자 · 1 투수** — 초기화 `0x5561c` 의 다섯째 인자. 시즌 0x63dc·일반 0x2648c 모두 **1** 을
 * |          | 넘긴다 → **편집기는 투수 엔트리로 열린다** (55670 `strb [sp+4] → ed+0x33f`) |
 * | `+0x330` | 타자 탭 하위 탭: 0 타순 · 1 수비위치 · **−1 보기 전용** — 초기화 셋째 인자가 0 이면 −1 (55684) |
 * | `+0x418` | 첫 번째로 고른 줄 (−1 없음) |
 * | `+0x338` | 끝 코드 — 1 CLR · 2 왼쪽 끝 · 3 오른쪽 끝 (부른 쪽이 키마다 읽는다) |
 * | `+0x424` | '0' 상세 창 열림 |
 *
 * 셋째 인자(편집 가능)는 시즌 `this+0x120`, 일반 `메뉴+0xec` 이고 둘 다 **'4'/왼 키로 들어오면 1(유저 팀)**,
 * '6'/오른 키면 0(CPU 팀)이다 → **CPU 팀 엔트리는 보기 전용**이다(OK 가 안 먹는다).
 * R4 3b 의 "CPU 팀 엔트리도 고칠 수 있다(유력)" 는 이 인자를 못 본 것이다.
 *
 * ⚠️ 미해결
 *   - `+0x337` 이 켜진 판(왼·오른 끝에서 하위 창 `+0x331/+0x332` 를 여는 갈래)은 시즌·일반 어디서도 켜는 곳을
 *     못 찾았다 — 0 으로 본다.
 *   - 위·아래는 목록 객체(`[ed+0x41c]` vtable+0x18, `+0x439 == 0` 일 때)가 받는다. 끝에서 감기는지 멈추는지는
 *     목록 객체 안을 안 떠서 모른다 — 웹은 **멈춘다**.
 *   - '0' 상세 창(`+0x424`)의 그림은 미해독 — 열림 표시만 들고 화면이 최소로 그린다.
 */

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

/** 타자 한 줄 — 교환 규칙이 보는 칸만 */
export interface EntryBatterRow {
  /** 마선수인가 (`0xb633d`) */
  readonly isAce: boolean
  /** 수비 위치 = 레코드 `+0x1c & 0xf` — **0 은 벤치** */
  readonly position: number
}

/** 투수 한 줄 */
export interface EntryPitcherRow {
  readonly isAce: boolean
}

/** 편집기가 들고 있는 팀 레코드의 두 배열 — 타자 `[팀+0x18]` · 투수 `[팀+0x14]` 순서 그대로 */
export interface EntryLists<B extends EntryBatterRow, P extends EntryPitcherRow> {
  readonly batters: readonly B[]
  readonly pitchers: readonly P[]
}

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
export function openEntryEditor(isEditable: boolean): EntryEditorState {
  return {
    tab: ENTRY_TAB.투수,
    subTab: isEditable ? ENTRY_SUB_TAB.타순 : ENTRY_SUB_TAB.보기전용,
    first: NO_ENTRY_PICK,
    cursor: 0,
    result: ENTRY_RESULT.없음,
    isDetailOpen: false,
  }
}

/**
 * 타자 맞바꾸기 `0xb5e99(팀, a, b, 0)` — 레코드를 통째로 바꾼 뒤 수비 위치를 정리한다:
 * ```
 * b5ec4  pa = rec[a].+0x1c & 0xf ; pb = rec[b].+0x1c & 0xf ; a ↔ b (0x30 바이트)
 * b5f10  pb == 0 || pa == 0 → set_pos(rec[a], pa) ; set_pos(rec[b], pb)   ; 자리에 남는다
 * b5f32  그 밖             → set_pos(rec[a], pb) ; set_pos(rec[b], pa)   ; 선수를 따라간다
 * ```
 * 곧 둘 다 선발이면 타순만 바뀌고, 벤치가 끼면 올라온 선수가 내려간 선수의 수비 위치를 받는다.
 */
export function swapEntryBatters<B extends EntryBatterRow>(rows: readonly B[], a: number, b: number): B[] {
  const next = [...rows]
  const rowA = rows[a]
  const rowB = rows[b]
  if (rowA === undefined || rowB === undefined) return next
  const positionA = rowA.position & 0xf
  const positionB = rowB.position & 0xf
  const staysAtSlot = positionA === 0 || positionB === 0
  next[a] = { ...rowB, position: staysAtSlot ? positionA : positionB }
  next[b] = { ...rowA, position: staysAtSlot ? positionB : positionA }
  return next
}

/** 투수 맞바꾸기 `0xb5e99(팀, a, b, 1)` — 레코드 통째로 (b5f5a~). 0번과 바꾸면 곧 **선발 변경**이다 */
export function swapEntryPitchers<P extends EntryPitcherRow>(rows: readonly P[], a: number, b: number): P[] {
  const next = [...rows]
  const rowA = rows[a]
  const rowB = rows[b]
  if (rowA === undefined || rowB === undefined) return next
  next[a] = rowB
  next[b] = rowA
  return next
}

/** 수비위치 맞바꾸기 `0xb5fe5(팀, a, b)` — 둘 다 위치 ≠ 0 일 때만 **위치 니블만** 바꾼다 (타순 그대로) */
export function swapFieldPositions<B extends EntryBatterRow>(rows: readonly B[], a: number, b: number): B[] {
  const next = [...rows]
  const rowA = rows[a]
  const rowB = rows[b]
  if (rowA === undefined || rowB === undefined) return next
  const positionA = rowA.position & 0xf
  const positionB = rowB.position & 0xf
  if (positionA === 0 || positionB === 0) return next
  next[a] = { ...rowA, position: positionB }
  next[b] = { ...rowB, position: positionA }
  return next
}

/** 편집기 키 — 원본 키 코드: 위·아래(목록 객체) · −3/'4' · −4/'6' · −5/'5' · −16 · '*' · '0' */
export type EntryKey = '위' | '아래' | '왼' | '오른' | '확인' | '취소' | '별' | '영'

export interface EntryKeyOutcome<B extends EntryBatterRow, P extends EntryPitcherRow> {
  readonly state: EntryEditorState
  readonly lists: EntryLists<B, P>
  /** 마선수를 고르려 했다 — `ACE_ENTRY_LOCKED_TEXT` 팝업을 띄운다 */
  readonly isAceLocked: boolean
}

function rowCountOf(state: EntryEditorState, lists: EntryLists<EntryBatterRow, EntryPitcherRow>): number {
  return state.tab === ENTRY_TAB.투수 ? lists.pitchers.length : lists.batters.length
}

/**
 * 키 한 번 `0x55864`. `+0x331 ≠ −1`(하위 창)은 시즌·일반에서 안 서므로 빠졌다.
 *
 * - **'*'** (559b2): 탭 뒤집기 → 목록 다시 채우기(커서 0) · 보기 전용이 아니면 하위 탭 0 · 고른 줄 취소.
 * - **CLR** (55908): 고른 줄이 있으면 취소, 없으면 끝 코드 1.
 * - **왼** (559f8): 타자 탭 — 보기 전용이면 2 · 수비위치 탭이고 고른 줄이 없으면 타순 탭으로 · 그 밖은 2
 *   (⚠️ 수비위치 탭에서 고른 줄이 있을 때도 2 다). 투수 탭은 곧장 2.
 * - **오른** (55a6e): 타자 탭 — 보기 전용이면 3 · 타순 탭이고 고른 줄이 없으면 수비위치 탭으로 ·
 *   수비위치 탭이면 3 · (⚠️ 타순 탭에서 고른 줄이 있으면 **아무 일도 없다**). 투수 탭은 곧장 3.
 * - **'0'** (55920): 상세 창 열고 닫기.
 * - **OK** (55ae6, 보기 전용이면 무시): 커서 줄이 마선수면 팝업 → 끝. 아니면
 *   - 고른 줄이 없으면 고른다 (수비위치 탭은 커서 ≤ 8 만),
 *   - 같은 줄이면 취소,
 *   - 다른 줄이면 투수 탭 `0xb5e99(…,1)` · 타순 탭 `0xb5e99(…,0)` · 수비위치 탭은 둘째 ≤ 8 일 때만 `0xb5fe5`
 *     (둘째가 9 이상이면 아무 일도 없고 고른 줄도 남는다). 바꾼 뒤 고른 줄 취소.
 */
export function pressEntryKey<B extends EntryBatterRow, P extends EntryPitcherRow>(
  state: EntryEditorState,
  lists: EntryLists<B, P>,
  key: EntryKey,
): EntryKeyOutcome<B, P> {
  const same = (next: EntryEditorState, nextLists: EntryLists<B, P> = lists): EntryKeyOutcome<B, P> => ({
    state: next, lists: nextLists, isAceLocked: false,
  })
  const isBatterTab = state.tab === ENTRY_TAB.타자
  const isViewOnly = state.subTab === ENTRY_SUB_TAB.보기전용
  const hasPick = state.first !== NO_ENTRY_PICK

  switch (key) {
    case '위':
      return same({ ...state, cursor: Math.max(0, state.cursor - 1) })
    case '아래':
      return same({ ...state, cursor: Math.min(Math.max(0, rowCountOf(state, lists) - 1), state.cursor + 1) })
    case '별': {
      const tab = isBatterTab ? ENTRY_TAB.투수 : ENTRY_TAB.타자
      // 559cc~559e8: 보기 전용(−1)이면 하위 탭·고른 줄을 건드리지 않고 끝난다
      if (isViewOnly) return same({ ...state, tab, cursor: 0 })
      return same({ ...state, tab, cursor: 0, subTab: ENTRY_SUB_TAB.타순, first: NO_ENTRY_PICK })
    }
    case '취소':
      if (hasPick) return same({ ...state, first: NO_ENTRY_PICK })
      return same({ ...state, result: ENTRY_RESULT.나가기 })
    case '왼':
      if (!isBatterTab || isViewOnly) return same({ ...state, result: ENTRY_RESULT.왼쪽끝 })
      if (state.subTab === ENTRY_SUB_TAB.수비위치 && !hasPick) {
        return same({ ...state, subTab: ENTRY_SUB_TAB.타순 })
      }
      return same({ ...state, result: ENTRY_RESULT.왼쪽끝 })
    case '오른':
      if (!isBatterTab || isViewOnly) return same({ ...state, result: ENTRY_RESULT.오른쪽끝 })
      if (state.subTab === ENTRY_SUB_TAB.타순) {
        return hasPick ? same(state) : same({ ...state, subTab: ENTRY_SUB_TAB.수비위치 })
      }
      return same({ ...state, result: ENTRY_RESULT.오른쪽끝 })
    case '영':
      return same({ ...state, isDetailOpen: !state.isDetailOpen })
    case '확인':
      return confirmEntry(state, lists)
  }
}

function confirmEntry<B extends EntryBatterRow, P extends EntryPitcherRow>(
  state: EntryEditorState,
  lists: EntryLists<B, P>,
): EntryKeyOutcome<B, P> {
  const unchanged: EntryKeyOutcome<B, P> = { state, lists, isAceLocked: false }
  if (state.subTab === ENTRY_SUB_TAB.보기전용) return unchanged
  const { cursor, first } = state
  const isPitcherTab = state.tab === ENTRY_TAB.투수
  const row = isPitcherTab ? lists.pitchers[cursor] : lists.batters[cursor]
  if (row === undefined) return unchanged
  // 55b22 · 55be2: 커서 줄이 마선수면 팝업 0x74ef5 (팝업이 이미 떠 있으면 그것도 안 한다 — 웹은 팝업이 키를 막는다)
  if (row.isAce) return { state, lists, isAceLocked: true }

  if (first === NO_ENTRY_PICK) {
    // 55c1a: 수비위치 탭은 선발 아홉만 고를 수 있다
    if (!isPitcherTab && state.subTab === ENTRY_SUB_TAB.수비위치 && cursor > LINEUP_LAST_INDEX) return unchanged
    return { state: { ...state, first: cursor }, lists, isAceLocked: false }
  }
  if (first === cursor) return { state: { ...state, first: NO_ENTRY_PICK }, lists, isAceLocked: false }

  const cleared = { ...state, first: NO_ENTRY_PICK }
  if (isPitcherTab) {
    return { state: cleared, lists: { ...lists, pitchers: swapEntryPitchers(lists.pitchers, first, cursor) }, isAceLocked: false }
  }
  if (state.subTab === ENTRY_SUB_TAB.타순) {
    return { state: cleared, lists: { ...lists, batters: swapEntryBatters(lists.batters, first, cursor) }, isAceLocked: false }
  }
  // 55ca0: 둘째가 9 이상이면 아무 일도 없다 (고른 줄도 그대로)
  if (cursor > LINEUP_LAST_INDEX) return unchanged
  return { state: cleared, lists: { ...lists, batters: swapFieldPositions(lists.batters, first, cursor) }, isAceLocked: false }
}

/**
 * 끝 코드를 받아 경기정보로 돌아가는가 — 시즌 `0x7044` · 일반 `0x2a370` 이 같은 식이다.
 * 1 은 늘, 2(왼쪽 끝)는 **CPU 팀** 엔트리(오른쪽에서 들어온 판)에서만, 3(오른쪽 끝)은 **유저 팀**에서만.
 */
export function leavesEntryEditor(result: EntryResult, isUserTeam: boolean): boolean {
  if (result === ENTRY_RESULT.나가기) return true
  if (result === ENTRY_RESULT.왼쪽끝) return !isUserTeam
  if (result === ENTRY_RESULT.오른쪽끝) return isUserTeam
  return false
}

/** 수비 위치 코드 → 글자 (레코드 `+0x1c & 0xf`). 원본은 아이콘 `0x54591`(그림 번호 미해독)이라 웹은 글자로 적는다 */
export const FIELD_POSITION_LABELS: readonly string[] = [
  '후보', '지명', '포수', '1루', '2루', '3루', '유격', '우익', '좌익', '중견',
]

export function fieldPositionLabelOf(position: number): string {
  return FIELD_POSITION_LABELS[position & 0xf] ?? '-'
}

/** 웹 전용 — 줄을 눌러 커서를 옮긴다 (원본은 위·아래 키뿐이다). 목록 밖이면 그대로 */
export function pointEntryCursor(
  state: EntryEditorState,
  lists: EntryLists<EntryBatterRow, EntryPitcherRow>,
  index: number,
): EntryEditorState {
  if (index < 0 || index >= rowCountOf(state, lists)) return state
  return { ...state, cursor: index }
}
