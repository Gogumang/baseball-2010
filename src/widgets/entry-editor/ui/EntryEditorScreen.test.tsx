// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { EntryEditorScreen } from '@/widgets/entry-editor/ui/EntryEditorScreen'
import { ENTRY_SUB_TAB, ENTRY_TAB, openEntryEditor } from '@/entities/season-mode/model/entryEditor'
import type { EntryBatterRow, EntryLists, EntryPitcherRow } from '@/entities/season-mode/model/entryEditor'
import type { EntryFace } from '@/widgets/entry-editor/ui/EntryEditorScreen'

/** 엔트리 편집 화면 — 키를 편집기 키로 바꿔 넘기고 목록을 그린다 */

afterEach(cleanup)

const 목록: EntryLists<EntryBatterRow & EntryFace, EntryPitcherRow & EntryFace> = {
  batters: [
    {
      name: '김타자',
      isAce: false,
      position: 2,
      ability: [500, 400, 300, 200],
      profileLow: 1,
      batterLine: { atBats: 100, hits: 31, doubles: 0, triples: 0, homeRuns: 7, runsBattedIn: 20, steals: 0, errors: 0 },
    },
  ],
  pitchers: [
    { name: '박투수', isAce: false, ability: [600, 500, 400, 300], profileLow: 0 },
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
  it('투수 탭으로 열려 투수 명단을 원본 열(순서 · 이름 | 보직 · 방어 · 삼진)로 보여 준다 — 0x5c984', () => {
    띄우기()
    expect(screen.getByTestId('엔트리-칸-0-이름').getAttribute('aria-label')).toBe('박투수')
    expect(screen.getByTestId('엔트리-열-등판순서-8000000')).toBeTruthy()
    expect(screen.getByTestId('엔트리-열-딱지-20000000')).toBeTruthy()
    expect(screen.getByTestId('엔트리-열-기록-100')).toBeTruthy()
    expect(screen.getByTestId('엔트리-열-기록-4000')).toBeTruthy()
  })

  it('키를 편집기 키로 넘긴다 — 숫자 키패드와 화살표 둘 다', () => {
    const onKey = 띄우기()
    for (const key of ['5', 'Enter', '4', 'ArrowRight', '*', '0', 'Escape', 'ArrowDown']) {
      fireEvent.keyDown(window, { key })
    }
    expect(onKey.mock.calls.map(([key]) => key)).toEqual(['확인', '확인', '왼', '오른', '별', '영', '취소', '아래'])
  })

  it('타자 탭은 타순 · 이름 | 수비 딱지 · 타율 · 홈런 열 — 하위 탭은 글이 아니라 커서 꼴로 보인다', () => {
    띄우기({ editor: { ...openEntryEditor(true), tab: ENTRY_TAB.타자 } })
    expect(screen.getByTestId('엔트리-열-타순-1000000')).toBeTruthy()
    expect(screen.getByTestId('엔트리-열-딱지-10000000')).toBeTruthy()
    expect(screen.getByTestId('엔트리-열-기록-0')).toBeTruthy()
    // 하위 탭 0 — 이름 칸(48) + 딱지 칸(36) + 3 = 93 폭 커서 · 1 — 딱지 칸(105, 36)만. 키 셈 0 이라 안쪽 꼴(x + 1)
    const 커서 = () => [...screen.getByTestId('엔트리-커서').querySelectorAll('span')].map((node) => (node as HTMLElement).style.left)
    expect(커서()).toContain('49px')
    cleanup()
    띄우기({ editor: { ...openEntryEditor(true), tab: ENTRY_TAB.타자, subTab: ENTRY_SUB_TAB.수비위치 } })
    expect(커서()).toContain('106px')
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

  it("\"#\" 표시지만 탭은 '*' 로 바꾼다 — '#' 는 넘기지 않는다 (0x558c4 cmp 0x2a)", () => {
    const onKey = 띄우기()
    fireEvent.keyDown(window, { key: '#' })
    expect(onKey).not.toHaveBeenCalled()
  })

  it("'0' 상세 창은 원본 선수 정보 창 0x5b798 — 엔트리 '0' 0x55920 자리 (212, 64) 에서 열리고 레코드 칸을 글로 적는다", () => {
    const lists = {
      ...목록,
      pitchers: [
        {
          ...목록.pitchers[0]!,
          detailSource: {
            isPitcher: true,
            abilities: [600, 500, 400, 300],
            aceIndex: -1,
            profile: 0,
            skillBits: 0,
            grade: 5,
            repertoire: { form: 2, magicNumber: 0, pitchMask: 1 },
          },
        },
        목록.pitchers[1]!,
      ],
    }
    띄우기({ lists })
    expect(screen.queryByTestId('선수 정보 창')).toBeNull()
    cleanup()
    띄우기({ lists, editor: { ...openEntryEditor(true), isDetailOpen: true } })
    expect(screen.getByTestId('선수 정보 창')).toBeTruthy()
    expect(screen.getByTestId('선수 정보 줄 0').getAttribute('aria-label')).toBe('사이드암')
    expect(screen.getByTestId('선수 정보 줄 1').getAttribute('aria-label')).toBe('우완')
    expect(screen.getByTestId('선수 정보 줄 5').getAttribute('aria-label')).toBe('5000')
  })
})
