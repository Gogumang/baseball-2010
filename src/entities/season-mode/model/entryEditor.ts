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
 * ## 열 밀기 `+0x337` · `+0x331` · `+0x332` · `+0x335` (2026-10-15 r89 직접 떴다)
 * `0x557c0` 이 넘기는 열 수 > 보이는 열 `[+0x33c]`(3) 이면 `+0x337 = 1`(557c0~55854) — 넓은 표를 쓰는 시즌 선수 고르기 0xdf(0x5980) ·
 * 스페셜 에디트(0x2b2e0)가 그렇다. 그때 왼(559f8) · 오른(55a6e)은 **타자 탭 보기 전용 · 투수 탭**에서 끝 코드 대신
 * `+0x331 = 0`(단계) · `+0x332 = 1 / 0`(방향)을 세우고, 그림 `0x5c984` 가 한 번마다 단계를 올려 여섯째 뒤 첫 열 `+0x335` 를
 * ±1 한다(`widgets/entry-editor/lib/entryListWindow`). 미는 동안(`+0x331 ≠ −1`)은 키가 0x5587c 에서 통째로 빠진다.
 * 편집 가능한 타자 탭은 하위 탭 갈래가 먼저라 밀지 않는다.
 *
 * ## 위·아래 — 목록 객체 `[ed+0x41c]`
 * `0x55724` 가 목록을 vt+0x1c(1열, 줄 수, 1, 꼴 **0x20**)로 만들고 커서 (0, 0) · 윗줄 0 · 보이는 줄 [+0x38] = min(10, 줄 수) 로 둔다.
 * 위·아래는 vt+0x18 = 0x6c299 → 0x6c521 → 0x6c031 이 **세로로 감고**, vt+0x20 = 0x6c2bd 가 커서가 [윗줄, 윗줄 + 보이는 줄)
 * 밖으로 나갈 때만 윗줄을 고친다 (나리 기록실 124 가 같은 목록을 쓴다 — `pages/nari-record-room/lib/nariRecordRoom`).
 *
 * ## 키 셈 `+0x40c`
 * 0x55864 머리(55868)가 **불릴 때마다** +1 — ▲▼ · 옆 화살 깜빡과 커서 꼴이 이 값을 본다. 메인 메뉴(일반 23 · 에디트 29)는 틀마다
 * 0x32634 → 갱신이 [메뉴+0x40] 키로 0x55864 를 부르고(0x2a370 · 0x2b2e0), 시즌 장면 0xe9ac 는 키가 들어온 틀([this+0x34])에만
 * 부른다(0xec7e~0xec94) — 부르는 쪽이 `tickEntryEditor` 로 센다.
 *
 * ## '0' 상세 창 `+0x424`
 * 열림 표시는 여기서 들고, 그림 0x5b798 은 `widgets/entry-editor` 의 `EntryDetailOverlay`(→ `PlayerDetailWindow`)가 그린다.
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

/** 타자 레코드 +0x20~+0x2e — 엔트리 목록 창 기록 열(0x56ebd)이 읽는 칸 */
export interface EntryBatterLine {
  readonly atBats: number
  readonly hits: number
  readonly doubles: number
  readonly triples: number
  readonly homeRuns: number
  readonly runsBattedIn: number
  /** +0x2c */
  readonly steals: number
  /** +0x2e — 머리 글 212 "실책" */
  readonly errors: number
}

/** 투수 레코드 +0x20~+0x2f */
export interface EntryPitcherLine {
  readonly outs: number
  readonly runsAllowed: number
  readonly saves: number
  readonly strikeouts: number
  readonly pitches: number
  /** +0x2a — 머리 글 219 "사사구" */
  readonly walks: number
  /** s8 +0x2e */
  readonly wins: number
  /** s8 +0x2f */
  readonly losses: number
}

/**
 * **'0' 상세 창 0x5b798 이 레코드에서 읽는 칸** — 엔트리 목록 창 0x5c984 끝(0x5cfc8)이 커서 줄 레코드를 넘긴다
 * (`widgets/player-detail-window` 가 글로 바꾼다).
 */
export interface PlayerDetailSource {
  readonly isPitcher: boolean
  /** 도형 값 `0xb6414(rec, k, 1)` */
  readonly abilities: readonly number[]
  /** 마선수 순번 0~4 (0xb63a0), 아니면 −1 */
  readonly aceIndex: number
  /** +0xb — 타자 타입(>> 5) · 타자 손(비트 4, 0xb63c0). 모르면 0 */
  readonly profile: number
  /** +0x14 장착 스킬 비트 */
  readonly skillBits: number
  /** 타자 +0x18 고른 필살 번호 (0 없음) */
  readonly specialNumber?: number
  /** 투수 폼(+0xb >> 4) · 마구(+0x18) · 구질 마스크(+0x1c) */
  readonly repertoire?: { readonly form: number; readonly magicNumber: number; readonly pitchMask: number }
  /** +0x1b 등급 — 연봉 = ×1000. 모르면 null */
  readonly grade: number | null
  /**
   * 육성 선수(+0xa 비트 7, 0xb6388)의 연봉 칸 — 모드 3 · 4 면 +0x1b 대신 저장 0x1f8d5(모드) **+0x1c8 u16 × 100** 을 찍는다
   * (0x5b798 5c848~5c886). 나리 143 · 124 의 내 선수 줄만 든다(커리어 `salary` = S+0x1c8)
   */
  readonly nurturedSalary?: number
}

export const EMPTY_ENTRY_BATTER_LINE: EntryBatterLine = {
  atBats: 0,
  hits: 0,
  doubles: 0,
  triples: 0,
  homeRuns: 0,
  runsBattedIn: 0,
  steals: 0,
  errors: 0,
}
export const EMPTY_ENTRY_PITCHER_LINE: EntryPitcherLine = {
  outs: 0,
  runsAllowed: 0,
  saves: 0,
  strikeouts: 0,
  pitches: 0,
  walks: 0,
  wins: 0,
  losses: 0,
}

/**
 * Xls 행 바이트 32~43(+0x20~+0x2a) 시즌 줄 여섯 칸 → 레코드 줄 — 타자 [타수, 안타, 2루타, 3루타, 홈런, 타점] ·
 * 투수 [잡은 아웃, 실점, 세이브, 탈삼진, 투구 수, +0x2a]. 행 바이트 44~47 은 타자 0 · 투수 스태미나 10000 · 승패 0 이다
 * (XlsBATTER_DATA · XlsPITCHER_DATA 를 직접 읽었다).
 */
export function entryBatterLineOfRecord(recordLine: readonly number[]): EntryBatterLine {
  const at = (i: number) => recordLine[i] ?? 0
  return { atBats: at(0), hits: at(1), doubles: at(2), triples: at(3), homeRuns: at(4), runsBattedIn: at(5), steals: 0, errors: 0 }
}

export function entryPitcherLineOfRecord(recordLine: readonly number[]): EntryPitcherLine {
  const at = (i: number) => recordLine[i] ?? 0
  return { outs: at(0), runsAllowed: at(1), saves: at(2), strikeouts: at(3), pitches: at(4), walks: at(5), wins: 0, losses: 0 }
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

/** `0x55798(ed, 3, 10)` — 보이는 넘기는 열 · 보이는 줄 */
export const ENTRY_VISIBLE_SCROLL_COLUMNS = 3
export const ENTRY_VISIBLE_LIST_ROWS = 10
/** 그림 한 번에 한 단계 — 표 0xd1bbc 여섯 칸 */
export const ENTRY_SLIDE_STEPS = 6
/** 기본 표의 넘기는 열 수 (수비·보직 딱지 + 기록 둘) */
export const ENTRY_BASIC_SCROLL_COLUMNS = 3

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

/** 0x5ccea~0x5cd1e — 다음 열: 첫 열 + 보이는 열 < 열 수 · 앞 열: 첫 열 > 0 */
function canSlide(state: EntryEditorState, slide: EntryColumnSlide): boolean {
  return slide.direction === 'next' ? state.firstColumn + ENTRY_VISIBLE_SCROLL_COLUMNS < state.scrollColumnCount : state.firstColumn > 0
}

/**
 * 그림 한 번이 끝난 뒤의 밀기 (5cefa~5cf50) — 단계 + 1, 여섯이면 그만두고 첫 열 ± 1. 밀 수 없는 쪽이면 그 그림에서 곧장 그만둔다
 * (5cd20 `+0x331 = −1`).
 */
export function advanceEntrySlide(state: EntryEditorState): EntryEditorState {
  const { slide } = state
  if (slide === null) return state
  if (!canSlide(state, slide)) return { ...state, slide: null }
  const step = slide.step + 1
  if (step < ENTRY_SLIDE_STEPS) return { ...state, slide: { ...slide, step } }
  return { ...state, firstColumn: state.firstColumn + (slide.direction === 'next' ? 1 : -1), slide: null }
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
 * - **왼** (559f8): 타자 탭 — 보기 전용이면 `+0x337` ? 앞 열로 밀기 : 2 · 수비위치 탭이고 고른 줄이 없으면 타순 탭으로 ·
 *   그 밖은 2 (⚠️ 수비위치 탭에서 고른 줄이 있을 때도 2 다). 투수 탭은 `+0x337` ? 밀기 : 2.
 * - **오른** (55a6e): 타자 탭 — 보기 전용이면 `+0x337` ? 다음 열로 밀기 : 3 · 타순 탭이고 고른 줄이 없으면 수비위치 탭으로 ·
 *   수비위치 탭이면 3 · (⚠️ 타순 탭에서 고른 줄이 있으면 **아무 일도 없다**). 투수 탭은 `+0x337` ? 밀기 : 3.
 * - 머리(55868)에서 키 셈 `+0x40c` + 1, 미는 동안(`+0x331 ≠ −1`)은 0x5587c 가 나머지를 건너뛴다.
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
  const counted = { ...state, keyPresses: state.keyPresses + 1 }
  const same = (next: EntryEditorState, nextLists: EntryLists<B, P> = lists): EntryKeyOutcome<B, P> => ({
    state: next,
    lists: nextLists,
    isAceLocked: false,
  })
  // 5587c: 미는 동안은 셈만 하고 끝난다
  if (state.slide !== null) return same(counted)
  const isBatterTab = state.tab === ENTRY_TAB.타자
  const isViewOnly = state.subTab === ENTRY_SUB_TAB.보기전용
  const hasPick = state.first !== NO_ENTRY_PICK
  const slides = isEntryColumnScrollable(state)

  switch (key) {
    case '위':
      return same(movedEntryCursor(counted, rowCountOf(state, lists), -1))
    case '아래':
      return same(movedEntryCursor(counted, rowCountOf(state, lists), 1))
    case '별': {
      const tab = isBatterTab ? ENTRY_TAB.투수 : ENTRY_TAB.타자
      // 0x55724 가 목록을 다시 채운다 — 커서 (0, 0) · 윗줄 0 (첫 열 +0x335 는 그대로)
      // 559cc~559e8: 보기 전용(−1)이면 하위 탭·고른 줄을 건드리지 않고 끝난다
      if (isViewOnly) return same({ ...counted, tab, cursor: 0, top: 0 })
      return same({ ...counted, tab, cursor: 0, top: 0, subTab: ENTRY_SUB_TAB.타순, first: NO_ENTRY_PICK })
    }
    case '취소':
      if (hasPick) return same({ ...counted, first: NO_ENTRY_PICK })
      return same({ ...counted, result: ENTRY_RESULT.나가기 })
    case '왼':
      if (!isBatterTab || isViewOnly) {
        if (slides) return same({ ...counted, slide: { step: 0, direction: 'previous' } })
        return same({ ...counted, result: ENTRY_RESULT.왼쪽끝 })
      }
      if (state.subTab === ENTRY_SUB_TAB.수비위치 && !hasPick) {
        return same({ ...counted, subTab: ENTRY_SUB_TAB.타순 })
      }
      return same({ ...counted, result: ENTRY_RESULT.왼쪽끝 })
    case '오른':
      if (!isBatterTab || isViewOnly) {
        if (slides) return same({ ...counted, slide: { step: 0, direction: 'next' } })
        return same({ ...counted, result: ENTRY_RESULT.오른쪽끝 })
      }
      if (state.subTab === ENTRY_SUB_TAB.타순) {
        return hasPick ? same(counted) : same({ ...counted, subTab: ENTRY_SUB_TAB.수비위치 })
      }
      return same({ ...counted, result: ENTRY_RESULT.오른쪽끝 })
    case '영':
      return same({ ...counted, isDetailOpen: !state.isDetailOpen })
    case '확인':
      return confirmEntry(counted, lists)
  }
}

/** 위·아래 — 세로로 감고(꼴 0x20) 커서가 보이는 줄 밖으로 나갈 때만 윗줄을 고친다 (0x6c2bd) */
function movedEntryCursor(state: EntryEditorState, rowCount: number, dy: number): EntryEditorState {
  if (rowCount <= 0) return state
  const cursor = (state.cursor + dy + rowCount) % rowCount
  const visible = entryVisibleRowCountOf(rowCount)
  if (cursor >= state.top && cursor < state.top + visible) return { ...state, cursor }
  const top = cursor - state.top > 0 ? cursor - visible + 1 : cursor
  return { ...state, cursor, top }
}

function confirmEntry<B extends EntryBatterRow, P extends EntryPitcherRow>(state: EntryEditorState, lists: EntryLists<B, P>): EntryKeyOutcome<B, P> {
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
export const FIELD_POSITION_LABELS: readonly string[] = ['후보', '지명', '포수', '1루', '2루', '3루', '유격', '우익', '좌익', '중견']

export function fieldPositionLabelOf(position: number): string {
  return FIELD_POSITION_LABELS[position & 0xf] ?? '-'
}

/** 웹 전용 — 줄을 눌러 커서를 옮긴다 (원본은 위·아래 키뿐이다). 목록 밖이면 그대로 */
export function pointEntryCursor(state: EntryEditorState, lists: EntryLists<EntryBatterRow, EntryPitcherRow>, index: number): EntryEditorState {
  if (index < 0 || index >= rowCountOf(state, lists)) return state
  return { ...state, cursor: index }
}
