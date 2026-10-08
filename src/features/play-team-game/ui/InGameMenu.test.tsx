// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createSilentSound, setActiveSound } from '@/shared/api/audio/soundPort'
import { InGameMenu } from '@/features/play-team-game/ui/InGameMenu'

afterEach(cleanup)

describe('경기 중 메뉴 — 다시하기 (표 0xcfcfc 행 1, 0x3c706)', () => {
  it('미션·홈런더비 행에는 자동진행 대신 다시하기가 있다', () => {
    render(<InGameMenu mode={6} onContinue={vi.fn()} onRestart={vi.fn()} />)

    expect(screen.getByText('다시하기')).toBeTruthy()
    expect(screen.queryByText('자동진행')).toBeNull()
  })

  it('StrGAME[7] 문구로 한 번 묻고, 예를 고르면 다시 시작한다', () => {
    const onRestart = vi.fn()
    render(<InGameMenu mode={6} onContinue={vi.fn()} onRestart={onRestart} />)

    fireEvent.click(screen.getByText('다시하기'))
    expect(screen.getByText(/다시 플레이하시겠습니까/)).toBeTruthy()

    fireEvent.click(screen.getByText('예'))
    expect(onRestart).toHaveBeenCalledTimes(1)
  })

  it('아니오면 아무 일도 없다', () => {
    const onRestart = vi.fn()
    render(<InGameMenu mode={6} onContinue={vi.fn()} onRestart={onRestart} />)

    fireEvent.click(screen.getByText('다시하기'))
    fireEvent.click(screen.getByText('아니오'))

    expect(onRestart).not.toHaveBeenCalled()
    expect(screen.getByText('경기 중 메뉴')).toBeTruthy()
  })

  it('손잡이를 안 넘긴 칸은 잠긴다', () => {
    render(<InGameMenu mode={6} onContinue={vi.fn()} />)

    expect(screen.getByText('다시하기').closest('button')?.disabled).toBe(true)
    expect(screen.getByText('나가기').closest('button')?.disabled).toBe(true)
    expect(screen.getByText('계속').closest('button')?.disabled).toBe(false)
  })
})

describe('경기 중 메뉴 커서 — 메뉴 객체(+0xf30)를 0 으로 되돌리는 곳은 \'*\' 로 여는 0x3c02c 뿐이다', () => {
  const 고른칸 = () => screen.getAllByRole('option').find((option) => option.getAttribute('aria-selected') === 'true')

  it('넘겨받은 커서 칸에서 시작한다 — [조작방법]·[설정]에서 돌아올 때 (0x3ca36 · 0x3cb0e)', () => {
    render(<InGameMenu mode={3} cursor={2} onContinue={vi.fn()} />)
    expect(고른칸()?.textContent).toContain('설정')
  })

  it('커서가 옮겨지면 알려 준다', () => {
    const onCursorChange = vi.fn()
    render(<InGameMenu mode={3} onContinue={vi.fn()} onCursorChange={onCursorChange} />)
    fireEvent.keyDown(window, { key: 'ArrowDown' })
    expect(onCursorChange).toHaveBeenLastCalledWith(1)
  })

  it('질문 창에서 아니오로 돌아와도 커서가 남는다', () => {
    render(<InGameMenu mode={6} onContinue={vi.fn()} onRestart={vi.fn()} />)
    fireEvent.keyDown(window, { key: 'ArrowDown' })
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(screen.getByText(/다시 플레이하시겠습니까/)).toBeTruthy()
    fireEvent.click(screen.getByText('아니오'))
    expect(고른칸()?.textContent).toContain('다시하기')
  })
})

describe('경기 중 메뉴 — 나가기 (동작 3 0x3c504 → 하위 1 0x3c77c → 상태 0x22)', () => {
  const 고른칸 = () => screen.getAllByRole('option').find((option) => option.getAttribute('aria-selected') === 'true')

  it('모드 1~4·8·9 는 StrGAME[0], 미션·홈런더비는 StrGAME[1] 로 묻고 처음 커서는 [예]다 (0x749d5 없음)', () => {
    render(<InGameMenu mode={3} onContinue={vi.fn()} onQuit={vi.fn()} />)
    fireEvent.click(screen.getByText('나가기'))
    expect(screen.getByText(/G포인트가 사라집니다/)).toBeTruthy()
    expect(고른칸()?.textContent).toContain('예')
    cleanup()

    render(<InGameMenu mode={6} onContinue={vi.fn()} onQuit={vi.fn()} />)
    fireEvent.click(screen.getByText('나가기'))
    expect(screen.getByText(/진행 중인 게임을 그만하고/)).toBeTruthy()
    expect(고른칸()?.textContent).toContain('예')
  })

  it('[예] 면 나간다 · [아니오] 면 메뉴로 돌아온다', () => {
    const onQuit = vi.fn()
    render(<InGameMenu mode={7} onContinue={vi.fn()} onQuit={onQuit} />)
    fireEvent.click(screen.getByText('나가기'))
    fireEvent.click(screen.getByText('아니오'))
    expect(onQuit).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('나가기'))
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(onQuit).toHaveBeenCalledTimes(1)
  })
})

describe('경기 중 메뉴 — 자동진행 알림 문구는 StrGAME 원문이다', () => {
  it('[2] 대전 6회 제한 · [5] G포인트 부족', () => {
    render(<InGameMenu mode={8} onContinue={vi.fn()} onAutoProgress={vi.fn()} gamePoint={999} canAutoProgress={false} />)
    fireEvent.click(screen.getByText('자동진행'))
    expect(screen.getByText(/자동진행 가능합니다/)).toBeTruthy()
    cleanup()

    render(<InGameMenu mode={1} onContinue={vi.fn()} onAutoProgress={vi.fn()} autoProgressCost={100} gamePoint={0} />)
    fireEvent.click(screen.getByText('자동진행'))
    fireEvent.click(screen.getByText('예'))
    expect(screen.getByText(/자동진행을 할 수 없습니다/)).toBeTruthy()
    expect(screen.getByText(/에서 충전할 수 있습니다/)).toBeTruthy()
  })
})

describe('경기 중 메뉴 — [조작방법] · [설정] 은 울리던 소리를 끊는다 (0x3c2f8 · 0x3c45c 의 0x6e418)', () => {
  const 통로 = () => {
    const port = { ...createSilentSound(), stop: vi.fn() }
    setActiveSound(port)
    return port
  }
  afterEach(() => setActiveSound(null))

  it('[조작방법] 을 고르면 끊고 뷰어를 연다', () => {
    const port = 통로()
    const onOpenHelp = vi.fn()
    render(<InGameMenu mode={3} onContinue={vi.fn()} onOpenHelp={onOpenHelp} />)

    fireEvent.click(screen.getByText('조작방법'))

    expect(port.stop).toHaveBeenCalledTimes(1)
    expect(onOpenHelp).toHaveBeenCalledTimes(1)
  })

  it('[설정] 을 고르면 끊고 설정을 연다', () => {
    const port = 통로()
    const onOpenSettings = vi.fn()
    render(<InGameMenu mode={3} onContinue={vi.fn()} onOpenSettings={onOpenSettings} />)

    fireEvent.click(screen.getByText('설정'))

    expect(port.stop).toHaveBeenCalledTimes(1)
    expect(onOpenSettings).toHaveBeenCalledTimes(1)
  })

  it('[계속] 은 끊지 않는다', () => {
    const port = 통로()
    render(<InGameMenu mode={3} onContinue={vi.fn()} />)

    fireEvent.click(screen.getByText('계속'))

    expect(port.stop).not.toHaveBeenCalled()
  })
})

describe('경기 중 메뉴 숫자키 — 목록 0x6bfe1(1열, 4|5줄, 숫자키 꼴 2, 0x230) (0x3c08e · 0x6c100)', () => {
  it('숫자 n 은 n 번째 칸을 바로 고르고 OK 다 — 1 = 계속', () => {
    const onContinue = vi.fn()
    render(<InGameMenu mode={6} onContinue={onContinue} />)
    fireEvent.keyDown(window, { key: '1' })
    expect(onContinue).toHaveBeenCalledTimes(1)
  })

  it('칸이 있으면 커서를 옮기고 묻는 칸이면 질문으로 간다 — 칸 수를 넘는 숫자는 아무 일도 없다', () => {
    const onCursorChange = vi.fn()
    render(<InGameMenu mode={6} onContinue={vi.fn()} onRestart={vi.fn()} onCursorChange={onCursorChange} />)
    fireEvent.keyDown(window, { key: '9' })
    expect(onCursorChange).not.toHaveBeenCalledWith(8)

    const restartIndex = screen.getAllByRole('option').findIndex((option) => option.textContent?.includes('다시하기'))
    fireEvent.keyDown(window, { key: String(restartIndex + 1) })
    expect(screen.getByText(/다시 플레이하시겠습니까/)).toBeTruthy()
  })
})
