import { describe, expect, it } from 'vitest'
import {
  ENTRY_RESULT, ENTRY_SUB_TAB, ENTRY_TAB, NO_ENTRY_PICK, leavesEntryEditor, openEntryEditor, pressEntryKey,
  swapEntryBatters, swapEntryPitchers, swapFieldPositions,
} from '@/entities/season-mode/model/entryEditor'
import type { EntryEditorState, EntryKey, EntryLists } from '@/entities/season-mode/model/entryEditor'

/** 엔트리 편집기 0x55864 — R4 2a 를 다시 떠서 옮겼다 */

interface 타자 { readonly name: string; readonly isAce: boolean; readonly position: number }
interface 투수 { readonly name: string; readonly isAce: boolean }

const 타자들: readonly 타자[] = [
  ...[8, 9, 5, 1, 7, 3, 4, 2, 6].map((position, i) => ({ name: `선발${i}`, isAce: false, position })),
  { name: '마타자', isAce: true, position: 0 },
  { name: '후보10', isAce: false, position: 0 },
  { name: '후보11', isAce: false, position: 0 },
]
const 투수들: readonly 투수[] = Array.from({ length: 9 }, (_v, i) => ({ name: i === 8 ? '마투수' : `투수${i}`, isAce: i === 8 }))
const 목록: EntryLists<타자, 투수> = { batters: 타자들, pitchers: 투수들 }

function 누르기(state: EntryEditorState, keys: readonly EntryKey[], lists = 목록) {
  let current = { state, lists, isAceLocked: false }
  for (const key of keys) current = pressEntryKey(current.state, current.lists, key)
  return current
}

describe('엔트리 편집기 0x55864', () => {
  it('초기화 0x5561c 는 **투수 탭**으로 연다 — 유저 팀은 타순 하위 탭, CPU 팀은 보기 전용(−1)', () => {
    expect(openEntryEditor(true)).toMatchObject({ tab: ENTRY_TAB.투수, subTab: ENTRY_SUB_TAB.타순, first: NO_ENTRY_PICK })
    expect(openEntryEditor(false).subTab).toBe(ENTRY_SUB_TAB.보기전용)
  })

  it('투수 탭에서 두 줄을 차례로 고르면 레코드째 맞바꾼다 — 0번과 바꾸면 선발 변경', () => {
    const { state, lists } = 누르기(openEntryEditor(true), ['아래', '아래', '확인', '위', '위', '확인'])
    expect(lists.pitchers.map((p) => p.name).slice(0, 3)).toEqual(['투수2', '투수1', '투수0'])
    expect(state.first).toBe(NO_ENTRY_PICK)
  })

  it('같은 줄을 다시 누르면 고른 것이 풀린다 · CLR 도 먼저 고른 것만 푼다', () => {
    const 고름 = 누르기(openEntryEditor(true), ['확인'])
    expect(고름.state.first).toBe(0)
    expect(누르기(고름.state, ['확인']).state.first).toBe(NO_ENTRY_PICK)
    const 취소 = 누르기(고름.state, ['취소'])
    expect(취소.state.first).toBe(NO_ENTRY_PICK)
    expect(취소.state.result).toBe(ENTRY_RESULT.없음)
    expect(누르기(취소.state, ['취소']).state.result).toBe(ENTRY_RESULT.나가기)
  })

  it('마선수 줄에서 OK 하면 팝업만 뜬다 (StrTEXT 0xd200c) — 첫 선택이든 둘째 선택이든', () => {
    const 마투수 = 누르기(openEntryEditor(true), Array<EntryKey>(8).fill('아래').concat('확인'))
    expect(마투수.isAceLocked).toBe(true)
    expect(마투수.state.first).toBe(NO_ENTRY_PICK)
    const 둘째 = 누르기(openEntryEditor(true), ['확인', ...Array<EntryKey>(8).fill('아래'), '확인'])
    expect(둘째.isAceLocked).toBe(true)
    expect(둘째.lists).toBe(목록)
    expect(둘째.state.first).toBe(0)
  })

  it('보기 전용은 OK 가 안 먹고 마선수 팝업도 없다 (55ae6 이 먼저 거른다)', () => {
    const 결과 = 누르기(openEntryEditor(false), Array<EntryKey>(8).fill('아래').concat('확인'))
    expect(결과.isAceLocked).toBe(false)
    expect(결과.state.first).toBe(NO_ENTRY_PICK)
  })

  it("'*' 는 탭을 뒤집고 커서를 0 으로 · 하위 탭은 타순으로 돌린다", () => {
    const 결과 = 누르기(openEntryEditor(true), ['아래', '확인', '별'])
    expect(결과.state).toMatchObject({ tab: ENTRY_TAB.타자, cursor: 0, subTab: ENTRY_SUB_TAB.타순, first: NO_ENTRY_PICK })
  })

  it('타순 맞바꾸기 — 둘 다 선발이면 수비 위치가 선수를 따라가고, 벤치가 끼면 자리에 남는다 (0xb5e99)', () => {
    const 선발끼리 = swapEntryBatters(타자들, 0, 1)
    expect(선발끼리[0]).toMatchObject({ name: '선발1', position: 9 })
    expect(선발끼리[1]).toMatchObject({ name: '선발0', position: 8 })
    const 벤치와 = swapEntryBatters(타자들, 0, 10)
    expect(벤치와[0]).toMatchObject({ name: '후보10', position: 8 })
    expect(벤치와[10]).toMatchObject({ name: '선발0', position: 0 })
  })

  it('수비위치 맞바꾸기는 둘 다 선발일 때만 위치 니블만 바꾼다 (0xb5fe5)', () => {
    const 결과 = swapFieldPositions(타자들, 0, 1)
    expect(결과[0]).toMatchObject({ name: '선발0', position: 9 })
    expect(결과[1]).toMatchObject({ name: '선발1', position: 8 })
    expect(swapFieldPositions(타자들, 0, 10)).toEqual(타자들)
    expect(swapEntryPitchers(투수들, 0, 99)).toEqual(투수들)
  })

  it('타자 탭 좌·우 — 타순 → 오른 → 수비위치 → 오른 → 끝 코드 3 · 수비위치 → 왼 → 타순 → 왼 → 끝 코드 2', () => {
    const 타자탭 = 누르기(openEntryEditor(true), ['별']).state
    const 수비 = 누르기(타자탭, ['오른']).state
    expect(수비.subTab).toBe(ENTRY_SUB_TAB.수비위치)
    expect(누르기(수비, ['오른']).state.result).toBe(ENTRY_RESULT.오른쪽끝)
    const 타순 = 누르기(수비, ['왼']).state
    expect(타순.subTab).toBe(ENTRY_SUB_TAB.타순)
    expect(누르기(타순, ['왼']).state.result).toBe(ENTRY_RESULT.왼쪽끝)
  })

  it('⚠️ 원본 그대로 — 타순 탭에서 고른 줄이 있으면 오른 키는 아무 일도 없고, 수비위치 탭에서 고른 줄이 있으면 왼 키는 끝 코드 2', () => {
    const 타순고름 = 누르기(openEntryEditor(true), ['별', '확인']).state
    expect(누르기(타순고름, ['오른']).state).toEqual(타순고름)
    const 수비고름 = 누르기(openEntryEditor(true), ['별', '오른', '확인']).state
    expect(누르기(수비고름, ['왼']).state.result).toBe(ENTRY_RESULT.왼쪽끝)
  })

  it('수비위치 탭은 선발 아홉(0~8)만 — 9번 이상은 첫 선택도, 둘째 선택도 안 된다', () => {
    const 수비 = 누르기(openEntryEditor(true), ['별', '오른']).state
    const 열번째 = 누르기(수비, Array<EntryKey>(10).fill('아래').concat('확인'))
    expect(열번째.state.first).toBe(NO_ENTRY_PICK)
    const 둘째 = 누르기(수비, ['확인', ...Array<EntryKey>(10).fill('아래'), '확인'])
    expect(둘째.state.first).toBe(0)
    expect(둘째.lists).toBe(목록)
    const 바꿈 = 누르기(수비, ['확인', '아래', '아래', '확인'])
    expect(바꿈.lists.batters[0]).toMatchObject({ name: '선발0', position: 5 })
    expect(바꿈.lists.batters[2]).toMatchObject({ name: '선발2', position: 8 })
  })

  it('투수 탭·보기 전용은 좌·우가 곧장 끝 코드다', () => {
    expect(누르기(openEntryEditor(true), ['왼']).state.result).toBe(ENTRY_RESULT.왼쪽끝)
    expect(누르기(openEntryEditor(false), ['별', '오른']).state.result).toBe(ENTRY_RESULT.오른쪽끝)
  })

  it('끝 코드 — 1 은 늘, 2 는 CPU 팀, 3 은 유저 팀일 때만 경기정보로 (0x7044 · 0x2a370)', () => {
    expect(leavesEntryEditor(ENTRY_RESULT.나가기, true)).toBe(true)
    expect(leavesEntryEditor(ENTRY_RESULT.왼쪽끝, true)).toBe(false)
    expect(leavesEntryEditor(ENTRY_RESULT.왼쪽끝, false)).toBe(true)
    expect(leavesEntryEditor(ENTRY_RESULT.오른쪽끝, true)).toBe(true)
    expect(leavesEntryEditor(ENTRY_RESULT.오른쪽끝, false)).toBe(false)
  })

  it("'0' 은 상세 창을 열고 닫는다", () => {
    expect(누르기(openEntryEditor(true), ['영']).state.isDetailOpen).toBe(true)
    expect(누르기(openEntryEditor(true), ['영', '영']).state.isDetailOpen).toBe(false)
  })
})
