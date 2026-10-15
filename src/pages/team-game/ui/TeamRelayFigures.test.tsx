// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { TeamRelayFigures } from '@/pages/team-game/ui/TeamRelayFigures'
import type { TeamRelayFigures as TeamRelayFiguresValue } from '@/pages/team-game/lib/teamAutoRelay'

const 그림: TeamRelayFiguresValue = {
  offenseTeam: 1,
  defenseTeam: 0,
  bases: [true, true, false],
  pitcherAce: null,
  catcherAce: -1,
  batter: null,
  aceRunners: [false, true, false],
  loadedRunnerAce: 3,
}

afterEach(cleanup)

// 0x79d10 — 주자 +0x9c ≠ −1 이면 그림판 +0x1c(실린 마선수 그림 한 장, 팔레트 없음), 아니면 defender(+0xc, 팀 팔레트)
describe('TeamRelayFigures — 마선수 주자', () => {
  it('마선수 주자는 실린 마선수 그림, 보통 주자는 defender', () => {
    render(<TeamRelayFigures figures={그림} />)
    expect(screen.getByTestId('중계-주자-1').dataset.folder).toBe('./sprites/defender/frames')
    expect(screen.getByTestId('중계-주자-2').dataset.folder).toBe('./sprites/defender_death/frames')
  })

  it('실린 그림이 없으면 보통 그림으로 둔다', () => {
    render(<TeamRelayFigures figures={{ ...그림, loadedRunnerAce: null }} />)
    expect(screen.getByTestId('중계-주자-2').dataset.folder).toBe('./sprites/defender/frames')
  })
})
