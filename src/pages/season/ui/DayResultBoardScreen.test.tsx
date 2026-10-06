// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { DayResultBoardScreen } from '@/pages/season/ui/DayResultBoardScreen'
import { TEAMS } from '@/shared/config/original/teams'

/** 경기 뒤 마무리 0xf1 — 그림 0xb400 · 키 0x49a4 (확인만) */

afterEach(cleanup)

const 표 = {
  teamsA: [1, 3, 5, 7, 9],
  teamsB: [0, 2, 4, 6, 8],
  scoresA: [3, -1, 2, 0, 7],
  scoresB: [2, -1, 2, 1, 4],
}

describe('경기 뒤 마무리 0xf1', () => {
  it('내 경기를 뺀 네 경기를 그린다 — 로고 둘 · 점수', () => {
    render(<DayResultBoardScreen board={표} onConfirm={vi.fn()} gamePoint={0} />)

    const rows = screen.getByRole('group', { name: '오늘의 경기 결과' })
    expect(rows.querySelectorAll('[role="group"]')).toHaveLength(4)
    expect(screen.getByRole('group', { name: `${TEAMS[1].name} 3 : 2 ${TEAMS[0].name}` })).toBeDefined()
    expect(screen.queryByRole('group', { name: new RegExp(`^${TEAMS[3].name} `) })).toBeNull()
  })

  it('WIN 은 더 낸 쪽에만 — 동점 줄은 LOSE 둘', () => {
    render(<DayResultBoardScreen board={표} onConfirm={vi.fn()} gamePoint={0} />)

    expect(screen.getAllByAltText('WIN')).toHaveLength(3)
    expect(screen.getAllByAltText('LOSE')).toHaveLength(5)
  })

  it("확인(Enter · '5' · 단추)만 받는다", () => {
    const onConfirm = vi.fn()
    render(<DayResultBoardScreen board={표} onConfirm={onConfirm} gamePoint={0} />)

    fireEvent.keyDown(window, { key: '5' })
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: '확인' }))

    expect(onConfirm).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('button', { name: '되돌아가기' })).toBeNull()
  })
})
