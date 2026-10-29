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
 *
 * 공개 이름 모음 — 하위 폴더 (`entryEditor/`): `codes`(편집 객체 칸 값 · 표 크기) · `rows`(줄 · 기록 줄 · 상세 창 재료) ·
 * `state`(편집 객체 · 초기화 0x5561c) · `slide`(열 밀기 0x5cefa) · `swaps`(0xb5e99 · 0xb5fe5) ·
 * `keys/`(키 0x55864 — 커서 · 명단 안 건드리는 키 · OK 55ae6) · `leave`(끝 코드) · `labels`(수비 위치 글자)
 */
export {
  ACE_ENTRY_LOCKED_TEXT,
  ENTRY_BASIC_SCROLL_COLUMNS,
  ENTRY_RESULT,
  ENTRY_SLIDE_STEPS,
  ENTRY_SUB_TAB,
  ENTRY_TAB,
  ENTRY_VISIBLE_LIST_ROWS,
  ENTRY_VISIBLE_SCROLL_COLUMNS,
  LINEUP_LAST_INDEX,
  NO_ENTRY_PICK,
  type EntryTab,
} from '@/entities/season-mode/model/entryEditor/codes'
export {
  entryBatterLineOfRecord,
  entryPitcherLineOfRecord,
  type EntryBatterLine,
  type EntryBatterRow,
  type EntryLists,
  type EntryPitcherLine,
  type EntryPitcherRow,
  type PlayerDetailSource,
} from '@/entities/season-mode/model/entryEditor/rows'
export {
  entryVisibleRowCountOf,
  isEntryColumnScrollable,
  openEntryEditor,
  tickEntryEditor,
  type EntryEditorState,
} from '@/entities/season-mode/model/entryEditor/state'
export { advanceEntrySlide } from '@/entities/season-mode/model/entryEditor/slide'
export { swapEntryBatters, swapEntryPitchers, swapFieldPositions } from '@/entities/season-mode/model/entryEditor/swaps'
export type { EntryKey } from '@/entities/season-mode/model/entryEditor/keys/outcome'
export { pressEntryKey } from '@/entities/season-mode/model/entryEditor/keys/pressEntryKey'
export { pointEntryCursor } from '@/entities/season-mode/model/entryEditor/keys/cursor'
export { leavesEntryEditor } from '@/entities/season-mode/model/entryEditor/leave'
export { FIELD_POSITION_LABELS, fieldPositionLabelOf } from '@/entities/season-mode/model/entryEditor/labels'
