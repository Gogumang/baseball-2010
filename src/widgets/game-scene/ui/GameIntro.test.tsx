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

  it('배경을 주면 구장을 카운터(270 − 5t)만큼 내려 그린다 (0x40ff0)', () => {
    vi.useFakeTimers()
    render(
      <GameIntro
        stadiumNameFrame={0x41}
        backdrop={{ skyRow: 0, skyColumn: 0, stadium: 3, ourTeamId: 0, opponentTeamId: 1 }}
        onDone={() => {}}
      />,
    )
    expect(screen.getByTestId('구장-배경').dataset.offsetY).toBe('270')
    act(() => vi.advanceTimersByTime(millisecondsPerFrame() * 2))
    expect(screen.getByTestId('구장-배경').dataset.offsetY).toBe('260')
  })
})
