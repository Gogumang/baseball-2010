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

// 들어올 때 연출(머리띠 다섯 그림 · 격자 열림 애니 0x79fa8)과 그동안의 키 막음(`useListPageEntry`)은 따로 시험한다 — 여기서는 다 연 뒤로 본다
vi.mock('@/widgets/screen-frame/model/useListPageEntry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/widgets/screen-frame/model/useListPageEntry')>()
  return { ...actual, useListPageEntry: actual.settledListPageEntry }
})

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
    expect(screen.getByTestId('엔트리-줄-0').getAttribute('aria-label')).toContain(teamPitchers(1)[0].name)
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

  it('입력 창의 CLR — 글자가 있으면 한 글자 지우기, 마지막 글자를 지운 그 그림에 곧장 취소 (0x32b5d → 0x32b7c, U-91)', () => {
    const onRename = vi.fn()
    render(<SpecialEditScreen gamePoint={0} onRename={onRename} onBack={vi.fn()} />)
    key('Enter')
    key('Enter')
    fireEvent.change(screen.getByLabelText('이름'), { target: { value: 'AB' } })
    key('Escape')
    expect((screen.getByLabelText('이름') as HTMLInputElement).value).toBe('A')
    // 마지막 글자를 지운 CLR 하나로 닫힌다 — 빈 칸에서 CLR 을 한 번 더 누를 필요가 없다
    key('Escape')
    expect(screen.queryByRole('dialog', { name: '이름 입력' })).toBeNull()
    // 창이 닫혀도 명단(하위 1)에 남는다
    expect(screen.getByTestId('엔트리-줄-0')).toBeTruthy()
    expect(onRename).not.toHaveBeenCalled()
  })

  it('입력 창이 다 펼쳐지면 이름 칸에 초점이 간다 — 펼치는 동안 칸이 숨어 있어 autoFocus 가 못 잡는 브라우저에서도 (r157)', () => {
    vi.useFakeTimers()
    // 레이아웃이 있는 환경 — 펼침 연출(0x741a0 6 → 110)이 돈다
    const height = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(10)
    try {
      render(<SpecialEditScreen gamePoint={0} onRename={vi.fn()} onBack={vi.fn()} />)
      key('Enter')
      key('Enter')
      const field = screen.getByLabelText('이름') as HTMLInputElement
      expect(field.readOnly).toBe(true)
      // 브라우저는 visibility: hidden 칸에 초점을 주지 않는다 — 그 자리를 흉내 낸다
      field.blur()
      expect(document.activeElement).not.toBe(field)
      act(() => {
        vi.advanceTimersByTime(1000)
      })
      expect(field.readOnly).toBe(false)
      expect(document.activeElement).toBe(field)
    } finally {
      height.mockRestore()
      vi.useRealTimers()
    }
  })

  it('입력 창 오른쪽에 입력 방식 "가" 와 slt_frame 이미지 20 화살 둘 — (184, 176) · ◀ (175, 177) · ▶ 뒤집기 (194, 177) (0x541ed, U-91)', () => {
    render(<SpecialEditScreen gamePoint={0} onRename={vi.fn()} onBack={vi.fn()} />)
    key('Enter')
    key('Enter')
    const 방식 = screen.getByTestId('입력방식')
    expect([방식.style.left, 방식.style.top, 방식.textContent]).toEqual(['184px', '176px', '가'])
    const 왼쪽 = screen.getByTestId('입력방식-왼쪽')
    const 오른쪽 = screen.getByTestId('입력방식-오른쪽')
    expect([왼쪽.style.left, 왼쪽.style.top, 왼쪽.getAttribute('src')]).toEqual(['175px', '177px', './sprites/slt_frame/020.png'])
    expect([오른쪽.style.left, 오른쪽.style.transform]).toEqual(['194px', 'scaleX(-1)'])
  })

  it('입력 창이 떠 있는 동안 숫자·* 키는 뒤의 명단으로 안 간다', () => {
    render(<SpecialEditScreen gamePoint={0} onRename={vi.fn()} onBack={vi.fn()} />)
    key('Enter')
    key('Enter')
    key('*')
    key('Escape')
    expect(screen.getByTestId('엔트리-줄-0').getAttribute('aria-label')).toContain(teamPitchers(0)[0].name)
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
    expect(screen.getByTestId('엔트리-줄-0').getAttribute('aria-label')).toContain('Kim')
    expect(originalNameOf(teamBatters(0)[0])).not.toBe('Kim')
  })
})

describe('머리띠 미끄러짐 [skin+0x84] — 상태 29 는 처음 선 하위 0 에서만 (0x24804 · 0x2e1e0 의 0x63b14 첫 그림)', () => {
  const coinTop = () => (screen.getByTestId('머리띠-G').querySelector('[data-badge-coin]') as HTMLElement).style.top

  it('처음 하위 0 은 미끄러지고, 명단(하위 1)에서 돌아온 하위 0 은 다 내려온 자리다', async () => {
    const { ScreenFrame } = await import('@/widgets/screen-frame/ui/ScreenFrame')
    const settled = render(<ScreenFrame title="팀선택" gamePoint={0} onBack={null} slides={false} />)
    const settledTop = coinTop()
    settled.unmount()

    render(<SpecialEditScreen gamePoint={0} onRename={vi.fn()} onBack={vi.fn()} />)
    expect(coinTop()).not.toBe(settledTop)
    key('Enter')
    expect(coinTop()).toBe(settledTop)
    key('Escape')
    expect(screen.queryByTestId('엔트리-줄-0')).toBeNull()
    expect(coinTop()).toBe(settledTop)
  })
})
