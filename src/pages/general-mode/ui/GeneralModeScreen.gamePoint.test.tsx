// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow'

/**
 * 일반모드 정산 판의 **보유 GP** — 정산 진입 0x4ea0c 가 기록 달성 G 를 전역 G(+0x64)에 더한 뒤(4ec5a) 판을 그리고,
 * 판은 `[0x1f1d9()+0x64]` 를 읽는다(0x4ae2e). 웹은 팀 경기 화면의 `gamePoint` 가 그 값이다 —
 * 부르는 쪽(App)이 `onSettlementEnter` 에서 지갑에 더하면 다시 그려진 판이 더한 값을 보인다.
 */
vi.mock('@/pages/team-game/ui/TeamGameScreen', () => ({
  TeamGameScreen: (props: { gamePoint?: number }) => <div data-testid="팀경기" data-game-point={props.gamePoint ?? ''} />,
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
    const { rerender } = render(<GeneralModeScreen {...base} isQuickStart gamePoint={500} />)
    fireEvent.click(screen.getByRole('button', { name: '경기 시작' }))
    expect(screen.getByTestId('팀경기').dataset.gamePoint).toBe('500')

    rerender(<GeneralModeScreen {...base} isQuickStart gamePoint={620} />)
    expect(screen.getByTestId('팀경기').dataset.gamePoint).toBe('620')
  })

  it('이어하기 경기도 같다', () => {
    const resumeGame = { options: { mode: 1 } } as unknown as TeamGameProgress
    render(<GeneralModeScreen {...base} resumeGame={resumeGame} gamePoint={77} />)
    expect(screen.getByTestId('팀경기').dataset.gamePoint).toBe('77')
  })
})
