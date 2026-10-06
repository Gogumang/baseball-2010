// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import type { JsonStorePort } from '@/shared/api/save/jsonStorePort'
import { teamBatters, teamPitchers } from '@/entities/team/model/teamRoster'
import { EMPTY_EDITED_NAMES } from '@/entities/player-name/model/editedNames'
import { originalNameOf, setActiveEditedNames } from '@/entities/player-name/model/playerName'
import { useEditedNames } from '@/entities/player-name/model/useEditedNames'
import { rosterEntryBattersOf, rosterEntryPitchersOf } from '@/features/play-team-game/model/teamGameRoster'
import { SpecialEditScreen } from '@/pages/special-edit/ui/SpecialEditScreen'

afterEach(() => {
  cleanup()
  setActiveEditedNames(EMPTY_EDITED_NAMES)
})

const key = (name: string) => fireEvent.keyDown(window, { key: name })

describe('스페셜 에디트 화면', () => {
  it('팀 고르기(제목 팀선택) — CLR 은 스페셜 목록으로', () => {
    const onBack = vi.fn()
    render(<SpecialEditScreen gamePoint={0} onRename={vi.fn()} onBack={onBack} />)
    expect(screen.getAllByRole('button', { pressed: false }).length + 1).toBe(10)
    key('Escape')
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('팀 → 투수 명단 → OK 로 입력 창(StrMAINMENU[108]) → 이름 저장 뒤 명단으로', () => {
    const onRename = vi.fn()
    render(<SpecialEditScreen gamePoint={0} onRename={onRename} onBack={vi.fn()} />)
    key('ArrowRight')
    key('Enter')
    expect(screen.getByTestId('엔트리-줄-0').textContent).toContain(teamPitchers(1)[0].name)
    key('ArrowDown')
    key('Enter')
    expect(screen.getByRole('dialog', { name: '이름 입력' })).toBeTruthy()
    expect(screen.getByText('이름을 입력해 주세요')).toBeTruthy()

    // 빈 이름은 확인이 안 된다 (0x32d14)
    key('Enter')
    expect(onRename).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText('이름'), { target: { value: '가나다라마' } })
    expect((screen.getByLabelText('이름') as HTMLInputElement).value).toBe('')
    fireEvent.change(screen.getByLabelText('이름'), { target: { value: '새투수' } })
    key('Enter')
    expect(onRename).toHaveBeenCalledWith(teamPitchers(1)[1].id, true, '새투수')
    expect(screen.queryByRole('dialog', { name: '이름 입력' })).toBeNull()
  })

  it('입력 창의 CLR — 글자가 있으면 한 글자 지우기, 비었으면 취소', () => {
    const onRename = vi.fn()
    render(<SpecialEditScreen gamePoint={0} onRename={onRename} onBack={vi.fn()} />)
    key('Enter')
    key('Enter')
    fireEvent.change(screen.getByLabelText('이름'), { target: { value: 'AB' } })
    key('Escape')
    expect((screen.getByLabelText('이름') as HTMLInputElement).value).toBe('A')
    key('Escape')
    key('Escape')
    expect(screen.queryByRole('dialog', { name: '이름 입력' })).toBeNull()
    // 창이 닫혀도 명단(하위 1)에 남는다
    expect(screen.getByTestId('엔트리-줄-0')).toBeTruthy()
    expect(onRename).not.toHaveBeenCalled()
  })

  it('입력 창이 떠 있는 동안 숫자·* 키는 뒤의 명단으로 안 간다', () => {
    render(<SpecialEditScreen gamePoint={0} onRename={vi.fn()} onBack={vi.fn()} />)
    key('Enter')
    key('Enter')
    key('*')
    key('Escape')
    expect(screen.getByTestId('엔트리-줄-0').textContent).toContain(teamPitchers(0)[0].name)
  })

  it('고친 이름이 경기 명단(공용 이름 0xb62c0)에 그대로 쓰인다', () => {
    let saved: unknown = null
    const store: JsonStorePort = { load: () => saved, save: (value) => { saved = value } }
    const { result } = renderHook(() => useEditedNames(store))
    render(<SpecialEditScreen gamePoint={0} onRename={(...args) => result.current.rename(...args)} onBack={vi.fn()} />)
    key('Enter')
    key('*')
    key('Enter')
    fireEvent.change(screen.getByLabelText('이름'), { target: { value: 'Kim' } })
    act(() => key('Enter'))

    expect(rosterEntryBattersOf(0)[0].name).toBe('Kim')
    expect(rosterEntryPitchersOf(0)[0].name).toBe(originalNameOf(teamPitchers(0)[0]))
    expect(screen.getByTestId('엔트리-줄-0').textContent).toContain('Kim')
    expect(originalNameOf(teamBatters(0)[0])).not.toBe('Kim')
  })
})
