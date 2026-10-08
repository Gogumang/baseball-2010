import { teamBatters, teamPitchers } from '@/entities/team/model/teamRoster'
import {
  ENTRY_TAB, openEntryEditor, pressEntryKey,
} from '@/entities/season-mode/model/entryEditor'
import type {
  EntryBatterRow, EntryEditorState, EntryKey, EntryLists, EntryPitcherRow,
} from '@/entities/season-mode/model/entryEditor'
import { moveGridCursor } from '@/pages/record/lib/annalsGrid'
import type { AnnalsDirection, AnnalsGridShape } from '@/pages/record/lib/annalsGrid'

/**
 * **스페셜 에디트** — 메인 메뉴 하위 상태 29 (진입 0x24804 · 갱신 0x2b2e0 · 그리기 0x2e1e0, R11 1a 확정).
 *
 * 하위 단계 = skin+0xe6 (s8):
 * ```
 * 0 팀 고르기   목록 k 9 (팀 0~9, 5열 × 2줄)        OK → 1 · CLR → 스페셜 목록(상태 6)
 * 1 선수 고르기  엔트리 창 (보기 전용 ed+0x330 = −1)  편집기 키 0x55865 를 먼저 탄 뒤 CLR → 0 · OK → 2 + 입력 창
 * 2 이름 입력   팝업 0x741a1(…, 0x6e, 0x32b7d, 0x32b5d) 결과 −1 → 1 · 0 → 저장 0xaa4ad + 파일 저장 0x1f1b9 → 1
 * ```
 */
export const SPECIAL_EDIT_STEP = { 팀고르기: 0, 선수고르기: 1, 이름입력: 2 } as const
export type SpecialEditStep = (typeof SPECIAL_EDIT_STEP)[keyof typeof SPECIAL_EDIT_STEP]

/**
 * 진입 0x24804: 팀 격자 `vtable+0x1c(격자, 5, 2, 1, 0x10)` = **5열 × 2줄 = 10칸** → 팀 0~9 (기본 열 팀)만.
 * 국가대표(10~13)·외인구단(14)은 칸이 없다. (OK 의 `idx > 9` 히든 오픈 검사 0x2b35c~0x2b374 는 격자가 10칸이라 죽은 코드다.)
 */
export const EDIT_TEAM_COUNT = 10
export const EDIT_GRID_COLUMNS = 5

/**
 * 격자 꼴 — `vtable+0x1c(격자, 5, 2, 1, 0x10)` 의 꼴 **0x10** = 가로로 넘치면 같은 줄 반대쪽으로 감고,
 * 세로는 끝에서 멈춘다 (0x6bead — 기록연감 격자 [this+0x7c] 와 같은 객체 vtable 0xd2ea0).
 */
export const EDIT_GRID_SHAPE: AnnalsGridShape = {
  columns: EDIT_GRID_COLUMNS, rows: EDIT_TEAM_COUNT / EDIT_GRID_COLUMNS, wrapsColumns: true, wrapsRows: false,
}

export interface SpecialEditState {
  readonly step: SpecialEditStep
  /** 격자 커서 `[격자+0x10] × [+0x14] + [+0xc]` */
  readonly gridCursor: number
  /** 고른 팀 skin+0xbc */
  readonly team: number
  /** 엔트리 편집기 (ed = [0x1552cfc]) */
  readonly editor: EntryEditorState
}

export function createSpecialEditState(): SpecialEditState {
  return { step: SPECIAL_EDIT_STEP.팀고르기, gridCursor: 0, team: 0, editor: openEntryEditor(false) }
}

/** 격자 커서 한 칸 옮기기 — 꼴 0x10 (`EDIT_GRID_SHAPE`) */
export function moveEditGrid(state: SpecialEditState, direction: AnnalsDirection): SpecialEditState {
  return { ...state, gridCursor: moveGridCursor(EDIT_GRID_SHAPE, state.gridCursor, direction) }
}

/** 웹 전용 — 칸을 눌러 커서를 옮긴다 */
export function pointEditGrid(state: SpecialEditState, index: number): SpecialEditState {
  if (!Number.isInteger(index) || index < 0 || index >= EDIT_TEAM_COUNT) return state
  return { ...state, gridCursor: index }
}

/**
 * 하위 0 의 OK (0x2b34e~0x2b430): skin+0xbc = 팀 = 커서, 하위 1,
 * `0x5561d(ed, &팀레코드(0x1f8c1(save, 팀)), 0, 0, 1)` — 셋째 0 = **보기 전용**, 다섯째 1 = **투수 탭**으로 연다.
 */
export function chooseEditTeam(state: SpecialEditState): SpecialEditState {
  return { ...state, step: SPECIAL_EDIT_STEP.선수고르기, team: state.gridCursor, editor: openEntryEditor(false) }
}

/** 엔트리 창 한 줄 — 편집기 규칙이 보는 칸 + 화면에 쓸 이름·능력치 · 이름표가 거는 선수 id */
export interface EditEntryRow {
  readonly id: number
  readonly name: string
  readonly ability: readonly number[]
  readonly isAce: boolean
  readonly position: number
}

/**
 * 고른 팀의 **기본 명단** — 원본은 저장 속 팀 레코드(0x1f8c1) 의 투수 `+0x14` · 타자 `+0x18` 배열이다.
 * 웹은 그 팀 레코드를 따로 두지 않아 붙박이 표 차례(XlsPITCHER_DATA · XlsBATTER_DATA)로 세운다.
 * 이름은 `player.name` = 0xb62c0 (고친 이름이 있으면 그것).
 */
export function editEntryListsOf(team: number): EntryLists<EditEntryRow & EntryBatterRow, EditEntryRow & EntryPitcherRow> {
  return {
    pitchers: teamPitchers(team).map((player) => ({
      id: player.id, name: player.name, ability: player.ability, isAce: false, position: 0,
    })),
    batters: teamBatters(team).map((player) => ({
      id: player.id, name: player.name, ability: player.ability, isAce: false, position: player.position ?? 0,
    })),
  }
}

/**
 * 하위 1 의 키 (0x2b440~0x2b4f0): 키는 **먼저 편집기 0x55865 로** 넘어간다('*' 탭 · '0' 상세 · 위아래 커서 —
 * 보기 전용이라 OK 는 편집기에서 아무 일도 안 한다). 그 뒤
 * - **CLR(−16)** → 하위 0. 격자를 다시 깔고(`vtable+0x14`·`+0x1c(5, 2, 1, 0x10)`) 커서를 고른 팀 칸(팀 % 5, 팀 / 5)에 둔다.
 * - **OK(−5)** → 하위 2 + 이름 입력 창 (`0x741a1` · 입력기 켜기 `0x54145(skin, 3 한글, 8 바이트, 1, 1)` · this+0x181 = 1).
 * 왼·오른(끝 코드 2·3)은 이 갱신이 안 본다.
 */
export function pressEditEntryKey(state: SpecialEditState, key: EntryKey): SpecialEditState {
  const outcome = pressEntryKey(state.editor, editEntryListsOf(state.team), key)
  const next = { ...state, editor: outcome.state }
  if (key === '취소') return { ...next, step: SPECIAL_EDIT_STEP.팀고르기, gridCursor: state.team }
  if (key === '확인') return { ...next, step: SPECIAL_EDIT_STEP.이름입력 }
  return next
}

/**
 * 하위 2 확인(0x2b51e~0x2b5a4)이 이름을 거는 선수:
 * ```
 * 탭 = ed+0x33f (1 투수 · 0 타자) ; 줄 = 목록 커서 [ed+0x41c]
 * 명단 = 탭 ? rec+0x14 : rec+0x18 ; id = u8 명단[줄 × 0x30]    ; 레코드 +0 = 선수 id
 * 0xaa4ad(이름표, id, 입력버퍼, 탭)
 * ```
 */
export function editTargetOf(state: SpecialEditState): { readonly id: number; readonly isPitcher: boolean } | null {
  const isPitcher = state.editor.tab === ENTRY_TAB.투수
  const lists = editEntryListsOf(state.team)
  const row = isPitcher ? lists.pitchers[state.editor.cursor] : lists.batters[state.editor.cursor]
  return row === undefined ? null : { id: row.id, isPitcher }
}

/** 하위 2 의 끝 — 확인(저장 뒤)이든 취소(결과 −1)든 하위 1 로 돌아간다. 편집기 커서·탭은 그대로다 */
export function closeEditName(state: SpecialEditState): SpecialEditState {
  return { ...state, step: SPECIAL_EDIT_STEP.선수고르기 }
}
