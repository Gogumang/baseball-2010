// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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
