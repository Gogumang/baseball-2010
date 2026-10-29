// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow'

/**
 * 일반모드 정산 판의 **보유 GP** — 정산 진입 0x4ea0c 가 기록 달성 G 를 전역 G(+0x64)에 더한 뒤(4ec5a) 판을 그리고,
 * 판은 `[0x1f1d9()+0x64]` 를 읽는다(0x4ae2e). 웹은 팀 경기 화면의 `gamePoint` 가 그 값이다 —
 * 부르는 쪽(App)이 `onSettlementEnter` 에서 지갑에 더하면 다시 그려진 판이 더한 값을 보인다.
 */
vi.mock('@/pages/team-game/ui/TeamGameScreen', () => ({
  TeamGameScreen: (props: { gamePoint?: number; onSpendGamePoint?: (cost: number) => void }) => (
    <div data-testid="팀경기" data-game-point={props.gamePoint ?? ''}>
      {props.onSpendGamePoint !== undefined && (
        <button type="button" onClick={() => props.onSpendGamePoint?.(30)}>
          자동진행
        </button>
      )}
    </div>
  ),
}))

const { GeneralModeScreen } = await import('@/pages/general-mode/ui/GeneralModeScreen')

afterEach(cleanup)

const base = {
  random: createSeededRandom(20100901),
  openedAcePitcherIds: [0, 1, 2, 3, 4],
  openedAceBatterIds: [0, 1, 2, 3, 4],
  onFinish: vi.fn(),
  onExit: vi.fn(),
}

describe('일반모드 → 팀 경기 화면의 보유 G', () => {
  it('새 경기 — 경기정보 OK 뒤 팀 경기 화면에 지금 G 를 넘기고, 정산에서 더한 값으로 다시 그린다', () => {
    vi.useFakeTimers()
    const { rerender } = render(<GeneralModeScreen {...base} isQuickStart gamePoint={500} />)
    // 경기정보는 들어올 때 연출(17 그림)이 끝나야 키(누름 칸이 보내는 OK)를 받는다
    act(() => {
      vi.advanceTimersByTime(millisecondsPerFrame() * 17)
    })
    fireEvent.click(screen.getByRole('button', { name: '경기 시작' }))
    vi.useRealTimers()
    expect(screen.getByTestId('팀경기').dataset.gamePoint).toBe('500')

    rerender(<GeneralModeScreen {...base} isQuickStart gamePoint={620} />)
    expect(screen.getByTestId('팀경기').dataset.gamePoint).toBe('620')
  })

  it('이어하기 경기도 같다', () => {
    const resumeGame = { options: { mode: 1 } } as unknown as TeamGameProgress
    render(<GeneralModeScreen {...base} resumeGame={resumeGame} gamePoint={77} />)
    expect(screen.getByTestId('팀경기').dataset.gamePoint).toBe('77')
  })

  it('자동진행 G 소비(0x3c83a~0x3c84e) — 받은 손잡이를 팀 경기 화면에 그대로 넘긴다, 없으면 넘기지 않아 칸이 잠긴다', () => {
    const resumeGame = { options: { mode: 1 } } as unknown as TeamGameProgress
    const onSpendGamePoint = vi.fn()
    const { unmount } = render(<GeneralModeScreen {...base} resumeGame={resumeGame} gamePoint={77} onSpendGamePoint={onSpendGamePoint} />)
    fireEvent.click(screen.getByRole('button', { name: '자동진행' }))
    expect(onSpendGamePoint).toHaveBeenCalledWith(30)
    unmount()
    render(<GeneralModeScreen {...base} resumeGame={resumeGame} gamePoint={77} />)
    expect(screen.queryByRole('button', { name: '자동진행' })).toBeNull()
  })
})
