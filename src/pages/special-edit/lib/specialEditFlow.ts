import { teamBatters, teamPitchers } from '@/entities/team/model/teamRoster'
import { tableDetailSourceOf } from '@/entities/season-mode/model/seasonEntry'
import type { PlayerDetailSource } from '@/entities/season-mode/model/entryEditor'
import {
  ENTRY_TAB, advanceEntrySlide, entryBatterLineOfRecord, entryPitcherLineOfRecord, openEntryEditor, pressEntryKey, tickEntryEditor,
} from '@/entities/season-mode/model/entryEditor'
import type {
  EntryBatterLine, EntryBatterRow, EntryEditorState, EntryKey, EntryLists, EntryPitcherLine, EntryPitcherRow,
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

/**
 * 0x2b2e0 의 열 표 — 0x557c1(skin, 탭, 고정 0xceb3c · 0xceb50 둘, 넘기는 0xcec28 · 0xcec50 열 개). 넘기는 열이 보이는 열 셋보다
 * 많아 [ed+0x337] = 1 — 보기 전용이라 좌·우가 열을 민다. 이어 2b424 가 [skin+0x438] = 1(커서가 이름 칸만)을 세운다.
 */
export const EDIT_SCROLL_COLUMN_COUNT = 10

export function createSpecialEditState(): SpecialEditState {
  return { step: SPECIAL_EDIT_STEP.팀고르기, gridCursor: 0, team: 0, editor: openEntryEditor(false, EDIT_SCROLL_COLUMN_COUNT) }
}

/**
 * 메인 메뉴의 한 틀 — 갱신 0x2b2e0 이 하위 1 에서 틀마다 0x55865(skin, [메뉴+0x40]) 를 불러 키 셈 [ed+0x40c] 이 오르고,
 * 그림 0x5c984 가 열 밀기를 한 단계 나아간다
 */
export function frameEditEntry(state: SpecialEditState): SpecialEditState {
  if (state.step !== SPECIAL_EDIT_STEP.선수고르기) return state
  return { ...state, editor: advanceEntrySlide(tickEntryEditor(state.editor)) }
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
  return {
    ...state, step: SPECIAL_EDIT_STEP.선수고르기, team: state.gridCursor, editor: openEntryEditor(false, EDIT_SCROLL_COLUMN_COUNT),
  }
}

/** 엔트리 창 한 줄 — 편집기 규칙이 보는 칸 + 화면에 쓸 이름·능력치 · 이름표가 거는 선수 id */
export interface EditEntryRow {
  readonly id: number
  readonly name: string
  readonly ability: readonly number[]
  readonly isAce: boolean
  readonly position: number
  /** +0xb & 3 — 투수 보직 딱지 */
  readonly profileLow: number
  /** '0' 상세 창 0x5b798 레코드 칸 — 붙박이 표 행 */
  readonly detailSource?: PlayerDetailSource
  readonly batterLine?: EntryBatterLine
  readonly pitcherLine?: EntryPitcherLine
}

/**
 * 고른 팀의 **기본 명단** — 원본은 저장 속 팀 레코드(0x1f8c1) 의 투수 `+0x14` · 타자 `+0x18` 배열이다.
 * 웹은 그 팀 레코드를 따로 두지 않아 붙박이 표 차례(XlsPITCHER_DATA · XlsBATTER_DATA)로 세운다.
 * 목록 창 기록 열은 그 행의 시즌 줄(행 바이트 32~43)이다 — 확정: 0x1f8c1 = [저장+0xac]+0xac0 + 팀 × 0x1c 의 마스터 팀은 적재 0x1ff98 이
 * Xls 행을 투수 8 × 0x30 · 타자 12 × 0x30 통째로 memcpy 해 채운다(2001a · 2004e — CORRECTIONS 510 · J 329) → 레코드 +0x20~+0x2b = 행 바이트 32~43.
 * 이름은 `player.name` = 0xb62c0 (고친 이름이 있으면 그것).
 */
export function editEntryListsOf(team: number): EntryLists<EditEntryRow & EntryBatterRow, EditEntryRow & EntryPitcherRow> {
  return {
    pitchers: teamPitchers(team).map((player) => ({
      id: player.id, name: player.name, ability: player.ability, isAce: false, position: 0, profileLow: player.profile & 3,
      pitcherLine: entryPitcherLineOfRecord(player.recordLine), detailSource: tableDetailSourceOf(player, true, player.ability),
    })),
    batters: teamBatters(team).map((player) => ({
      id: player.id, name: player.name, ability: player.ability, isAce: false, position: player.position ?? 0,
      profileLow: player.profile & 3, batterLine: entryBatterLineOfRecord(player.recordLine),
      detailSource: tableDetailSourceOf(player, false, player.ability),
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
