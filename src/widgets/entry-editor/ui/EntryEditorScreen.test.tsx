// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { EntryEditorScreen } from '@/widgets/entry-editor/ui/EntryEditorScreen'
import { ENTRY_TAB, openEntryEditor } from '@/entities/season-mode/model/entryEditor'

/** 엔트리 편집 화면 — 키를 편집기 키로 바꿔 넘기고 목록을 그린다 */

afterEach(cleanup)

const 목록 = {
  batters: [{ name: '김타자', isAce: false, position: 2, ability: [500, 400, 300, 200] }],
  pitchers: [
    { name: '박투수', isAce: false, ability: [600, 500, 400, 300] },
    { name: '마투수', isAce: true, ability: [] },
  ],
}

const 띄우기 = (overrides: Partial<Parameters<typeof EntryEditorScreen>[0]> = {}) => {
  const onKey = vi.fn()
  render(
    <EntryEditorScreen
      editor={openEntryEditor(true)}
      lists={목록}
      teamName="테스트"
      isAceLocked={false}
      onKey={onKey}
      onMoveCursor={vi.fn()}
      onCloseAceLocked={vi.fn()}
      {...overrides}
    />,
  )
  return onKey
}

describe('엔트리 편집 화면', () => {
  it('투수 탭으로 열려 투수 명단을 보여 준다', () => {
    띄우기()
    expect(screen.getByTestId('엔트리-줄-0').textContent).toContain('박투수')
    expect(screen.queryByTestId('엔트리-하위탭')).toBeNull()
  })

  it('키를 편집기 키로 넘긴다 — 숫자 키패드와 화살표 둘 다', () => {
    const onKey = 띄우기()
    for (const key of ['5', 'Enter', '4', 'ArrowRight', '*', '0', 'Escape', 'ArrowDown']) {
      fireEvent.keyDown(window, { key })
    }
    expect(onKey.mock.calls.map(([key]) => key)).toEqual(['확인', '확인', '왼', '오른', '별', '영', '취소', '아래'])
  })

  it('타자 탭은 수비 위치 글자와 하위 탭을 보여 준다', () => {
    띄우기({ editor: { ...openEntryEditor(true), tab: ENTRY_TAB.타자 } })
    expect(screen.getByTestId('엔트리-줄-0').textContent).toContain('포수')
    expect(screen.getByTestId('엔트리-하위탭').textContent).toBe('타순 / 수비위치')
  })

  it('마선수 잠금 팝업이 뜨면 키를 넘기지 않는다', () => {
    const onKey = 띄우기({ isAceLocked: true })
    fireEvent.keyDown(window, { key: '5' })
    expect(onKey).not.toHaveBeenCalled()
    expect(screen.getByText(/바꿀수 없습니다/)).toBeTruthy()
  })

  it('바닥은 투수 탭 0xf("#타자"·상세정보·되돌아가기) · 타자 탭 0x17("#투수"·…) — 0x2e098 · 0xb074', () => {
    const marks = () => [...document.querySelectorAll('img[data-footer-mark]')].map((node) => Number((node as HTMLElement).dataset.footerMark))
    띄우기()
    expect(marks()).toEqual([3, 1])
    expect(screen.getByRole('button', { name: '되돌아가기' })).toBeTruthy()
    cleanup()
    띄우기({ editor: { ...openEntryEditor(true), tab: ENTRY_TAB.타자 } })
    expect(marks()).toEqual([2, 1])
  })

  it('"#" 표시지만 탭은 \'*\' 로 바꾼다 — \'#\' 는 넘기지 않는다 (0x558c4 cmp 0x2a)', () => {
    const onKey = 띄우기()
    fireEvent.keyDown(window, { key: '#' })
    expect(onKey).not.toHaveBeenCalled()
  })
})
