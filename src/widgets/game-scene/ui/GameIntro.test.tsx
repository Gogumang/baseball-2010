// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { GameIntro } from '@/widgets/game-scene/ui/GameIntro'
import { millisecondsPerFrame } from '@/shared/config/frameRate'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('경기 시작 인트로 그리기 (0x417ac)', () => {
  it('띠는 (0, 55) 240×30 · 알파 (255 − 0x55)/255 — 띠 전체를 따로 흐리지 않는다', () => {
    render(<GameIntro stadiumNameFrame={0x41 + 2} onDone={() => {}} />)
    const band = screen.getByTestId('인트로-띠')
    expect(band.style.top).toBe('55px')
    expect(band.style.height).toBe('30px')
    expect(band.style.width).toBe('240px')
    expect(band.style.background).toBe('rgba(48, 78, 162, 0.667)')
    expect(band.style.opacity).toBe('')
    expect(screen.getByTestId('인트로-팀이름').dataset.frame).toBe(String(0x41 + 2))
  })

  it('배경을 주면 구장을 카운터(진입 틀도 갱신이 돌아 270 − 5(t + 1))만큼 내려 그린다 (0x40ff0)', () => {
    vi.useFakeTimers()
    render(
      <GameIntro
        stadiumNameFrame={0x41}
        backdrop={{ skyRow: 0, skyColumn: 0, stadium: 3, ourTeamId: 0, opponentTeamId: 1 }}
        onDone={() => {}}
      />,
    )
    expect(screen.getByTestId('구장-배경').dataset.offsetY).toBe('265')
    act(() => vi.advanceTimersByTime(millisecondsPerFrame() * 2))
    expect(screen.getByTestId('구장-배경').dataset.offsetY).toBe('255')
  })

  it('라이벌전이면 그림 1 부터 맨 위에 라이벌전 띠 0x3b80c 를 단계 min(n, 9) 로 그린다 — 아니면 없다', () => {
    vi.useFakeTimers()
    const { rerender } = render(<GameIntro stadiumNameFrame={0x41} isRivalry onDone={() => {}} />)
    // 그림 0 은 +0x194c = 0 이라 아무것도 안 그린다
    expect(screen.queryByTestId('라이벌전-띠')).toBeNull()
    act(() => vi.advanceTimersByTime(millisecondsPerFrame() * 3))
    expect(screen.getByTestId('라이벌전-띠').dataset.step).toBe('3')
    act(() => vi.advanceTimersByTime(millisecondsPerFrame() * 20))
    expect(screen.getByTestId('라이벌전-띠').dataset.step).toBe('9')
    rerender(<GameIntro stadiumNameFrame={0x41} onDone={() => {}} />)
    expect(screen.queryByTestId('라이벌전-띠')).toBeNull()
  })
})
