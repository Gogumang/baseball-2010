// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SettlementBoard } from '@/pages/team-game/ui/SettlementBoard'
import { resetSkinTickerCounter } from '@/shared/lib/skinTicker/skinTicker'
import { createRef } from 'react'

afterEach(() => {
  cleanup()
  resetSkinTickerCounter()
})

const 기본 = {
  mode: 2, isWin: true, side0Score: 3, side1Score: 5, recordIds: [3, 3, 7], gamePoints: 120, heldGamePoints: 900,
  scoreboardSides: [{ team: 2, isComputer: false }, { team: 7, isComputer: true }],
} as const

describe('SettlementBoard — 정산 판 (0x4a384 · 키 0x407f0)', () => {
  it('기본 화면은 점수와 "0:INFO" 만 — \'0\' 으로 기록 판을 열고 OK 로 닫는다', () => {
    const onExit = vi.fn()
    render(<SettlementBoard {...기본} onExit={onExit} />)
    expect(screen.getByTestId('정산-점수-0').dataset.value).toBe('3')
    expect(screen.getByTestId('정산-점수-1').dataset.value).toBe('5')
    expect(screen.queryByTestId('정산-기록-3')).toBeNull()

    fireEvent.keyDown(window, { key: '0' })
    expect(screen.getByTestId('정산-기록-3').textContent).toContain('2회')
    expect(screen.getByTestId('정산-기록-7').textContent).toContain('1회')

    fireEvent.keyDown(window, { key: 'Enter' })
    expect(screen.queryByTestId('정산-기록-3')).toBeNull()
    expect(onExit).not.toHaveBeenCalled()

    // 닫힌 판에서 '0' 이 아닌 키 → 메시지 0x3f3
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it('정산 효과 층은 원본 0x4a384 차례 — 비는 진 판 덮개 바로 위(띠 아래), 파티클은 판 맨 위', () => {
    const layers = { rain: createRef<HTMLCanvasElement>(), particles: createRef<HTMLCanvasElement>() }
    render(<SettlementBoard {...기본} isWin={false} onExit={vi.fn()} effectLayers={layers} />)
    const children = Array.from(screen.getByTestId('정산-판').children)
    const rain = layers.rain.current
    const particles = layers.particles.current
    expect(rain).not.toBeNull()
    expect(particles).not.toBeNull()
    // 0 = 4a404 덮개, 1 = 효과 틱 0x4a452 의 비, 2 = 4a448 띠 …, 끝 = 프레임 끝 0x6dd69 파티클
    expect(children.indexOf(rain as HTMLCanvasElement)).toBe(1)
    expect(children[children.length - 1]).toBe(particles)
  })

  it('점수판 틀 0x41440 을 (W/2 − 120, H/2 − 80) = (0, 80) 에', () => {
    render(<SettlementBoard {...기본} onExit={vi.fn()} />)
    const frame = screen.getByTestId('점수판-틀')
    expect([frame.dataset.x, frame.dataset.y]).toEqual(['0', '80'])
    expect(screen.getByTestId('점수판-로고-1').getAttribute('src')).toBe('./sprites/team_logo/007.png')
  })

  it('G 숫자 0x54a61 — 기본 화면은 둥근 판 · "+" , 기록 판의 획득은 "+" · 보유는 숫자만', () => {
    render(<SettlementBoard {...기본} onExit={vi.fn()} />)
    const earned = screen.getByTestId('정산-번-G')
    expect(earned.querySelector('[data-badge-plate]')).not.toBeNull()
    expect(earned.querySelector('[data-badge-plus]')).not.toBeNull()

    fireEvent.keyDown(window, { key: '0' })
    expect(screen.getByTestId('정산-획득-G').querySelector('[data-badge-plus]')).not.toBeNull()
    const held = screen.getByTestId('정산-보유-G')
    expect(held.dataset.value).toBe('900')
    expect(held.querySelector('[data-badge-plus]')).toBeNull()
    expect(held.querySelector('[data-badge-plate]')).toBeNull()
  })

  it('기록이 없으면 "기록이 없습니다!"', () => {
    render(<SettlementBoard {...기본} recordIds={[]} onExit={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '0:INFO' }))
    expect(screen.getByText('기록이 없습니다!')).toBeTruthy()
  })

  it('흐르는 글 0x4aef0 은 대전모드(8·9)에서 이겼을 때만 — 자르기 (x + 2, y, w − 4, h)', () => {
    const { unmount } = render(<SettlementBoard {...기본} mode={8} versusWinBonus={100} onExit={vi.fn()} />)
    fireEvent.keyDown(window, { key: '0' })
    const clip = screen.getByTestId('정산-흐르는-글')
    expect(clip.style.left).toBe('41px')
    expect(clip.style.top).toBe('224px')
    expect(clip.style.width).toBe('158px')
    expect(clip.textContent).toBe('승리 추가 보상[100 G포인트]')
    unmount()

    render(<SettlementBoard {...기본} mode={2} versusWinBonus={100} onExit={vi.fn()} />)
    fireEvent.keyDown(window, { key: '0' })
    expect(screen.queryByTestId('정산-흐르는-글')).toBeNull()
  })
})

describe('대전 승리 팝업 — 0x4b100 4b1f8~4b2d4 (틱 0x14 · 기록 판 열림 · 이김)', () => {
  const renderWithWindow = async (props: Partial<Parameters<typeof SettlementBoard>[0]>) => {
    const { CommonWindowPushContext } = await import('@/shared/lib/commonWindow/commonWindow')
    const { millisecondsPerFrame } = await import('@/shared/config/frameRate')
    const push = vi.fn()
    render(
      <CommonWindowPushContext.Provider value={push}>
        <SettlementBoard {...기본} mode={8} onExit={vi.fn()} {...props} />
      </CommonWindowPushContext.Provider>,
    )
    const frames = (n: number) => act(() => { vi.advanceTimersByTime(millisecondsPerFrame() * n) })
    return { push, frames }
  }
  it('기록 판이 열린 채 틱 20 에 이겼으면 "!C추가 …GP 획득" 을 띄운다', async () => {
    vi.useFakeTimers()
    try {
      const { push, frames } = await renderWithWindow({ versusReward: { kind: 0, value: 300n } })
      fireEvent.keyDown(window, { key: '0' })
      frames(19)
      expect(push).not.toHaveBeenCalled()
      frames(1)
      expect(push).toHaveBeenCalledExactlyOnceWith('!C추가 300GP 획득')
      frames(30)
      expect(push).toHaveBeenCalledOnce()
    } finally {
      vi.useRealTimers()
    }
  })

  it('틱 20 에 기록 판이 닫혀 있거나 졌으면 띄우지 않는다', async () => {
    vi.useFakeTimers()
    try {
      const closed = await renderWithWindow({ versusReward: { kind: 0, value: 300n } })
      closed.frames(25)
      expect(closed.push).not.toHaveBeenCalled()
      cleanup()
      const lost = await renderWithWindow({ isWin: false, versusReward: { kind: 0, value: 300n } })
      fireEvent.keyDown(window, { key: '0' })
      lost.frames(25)
      expect(lost.push).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })
})

