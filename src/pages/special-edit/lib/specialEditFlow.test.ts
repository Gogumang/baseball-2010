import { describe, expect, it } from 'vitest'
import { teamBatters, teamPitchers } from '@/entities/team/model/teamRoster'
import { ENTRY_SUB_TAB, ENTRY_TAB } from '@/entities/season-mode/model/entryEditor'
import {
  EDIT_TEAM_COUNT, SPECIAL_EDIT_STEP, chooseEditTeam, closeEditName, createSpecialEditState,
  editEntryListsOf, editTargetOf, moveEditGrid, pointEditGrid, pressEditEntryKey,
} from '@/pages/special-edit/lib/specialEditFlow'

describe('스페셜 에디트 흐름 (상태 29, 0x2b2e0)', () => {
  it('팀 격자는 5열 × 2줄 10칸 — 가로는 같은 줄 안에서 감고 세로는 끝에서 멈춘다 (꼴 0x10)', () => {
    const start = createSpecialEditState()
    expect(start.step).toBe(SPECIAL_EDIT_STEP.팀고르기)
    expect(moveEditGrid(start, 'left').gridCursor).toBe(4)
    expect(moveEditGrid(pointEditGrid(start, 4), 'right').gridCursor).toBe(0)
    expect(moveEditGrid(pointEditGrid(start, 9), 'right').gridCursor).toBe(5)
    expect(moveEditGrid(start, 'up').gridCursor).toBe(0)
    expect(moveEditGrid(pointEditGrid(start, 7), 'down').gridCursor).toBe(7)
    expect(moveEditGrid(pointEditGrid(start, 2), 'down').gridCursor).toBe(7)
    expect(pointEditGrid(start, 10).gridCursor).toBe(0)
    expect(EDIT_TEAM_COUNT).toBe(10)
  })

  it('OK → 하위 1, 엔트리 편집기는 보기 전용 · 투수 탭으로 연다 (0x5561d(ed, 팀, 0, 0, 1))', () => {
    const state = chooseEditTeam(pointEditGrid(createSpecialEditState(), 3))
    expect(state.step).toBe(SPECIAL_EDIT_STEP.선수고르기)
    expect(state.team).toBe(3)
    expect(state.editor.tab).toBe(ENTRY_TAB.투수)
    expect(state.editor.subTab).toBe(ENTRY_SUB_TAB.보기전용)
  })

  it('기본 명단 = 그 팀 투수 8 · 타자 12', () => {
    const lists = editEntryListsOf(4)
    expect(lists.pitchers.map((row) => row.id)).toEqual(teamPitchers(4).map((player) => player.id))
    expect(lists.batters.map((row) => row.id)).toEqual(teamBatters(4).map((player) => player.id))
  })

  it("하위 1: 키는 편집기를 먼저 탄다 — '*' 탭 · 아래 커서, CLR 은 하위 0 에 고른 팀 칸 커서", () => {
    let state = chooseEditTeam(pointEditGrid(createSpecialEditState(), 6))
    state = pressEditEntryKey(state, '별')
    expect(state.editor.tab).toBe(ENTRY_TAB.타자)
    state = pressEditEntryKey(state, '아래')
    expect(state.editor.cursor).toBe(1)
    const back = pressEditEntryKey(moveEditGrid(state, 'left'), '취소')
    expect(back.step).toBe(SPECIAL_EDIT_STEP.팀고르기)
    expect(back.gridCursor).toBe(6)
  })

  it('하위 1 OK → 하위 2, 이름을 거는 선수는 탭·커서의 선수 id (0x2b51e~)', () => {
    let state = chooseEditTeam(pointEditGrid(createSpecialEditState(), 2))
    state = pressEditEntryKey(pressEditEntryKey(state, '아래'), '아래')
    state = pressEditEntryKey(state, '확인')
    expect(state.step).toBe(SPECIAL_EDIT_STEP.이름입력)
    expect(editTargetOf(state)).toEqual({ id: teamPitchers(2)[2].id, isPitcher: true })
    const batterSide = pressEditEntryKey(closeEditName(pressEditEntryKey(closeEditName(state), '별')), '확인')
    expect(editTargetOf(batterSide)).toEqual({ id: teamBatters(2)[0].id, isPitcher: false })
    expect(closeEditName(state).step).toBe(SPECIAL_EDIT_STEP.선수고르기)
  })
})
