// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { createCareer } from '@/entities/career/model/playerCareer'
import { createAtBat } from '@/entities/at-bat/model/atBatState'
import { startGame } from '@/features/play-game/model/gameFlow'
import { SCOREBOARD_AT } from '@/widgets/scoreboard-frame/lib/scoreboardFrameLayout'

vi.mock('@/pages/game/ui/GameScreen', () => ({ GameScreen: () => null }))

const { GameRoute } = await import('@/app/ui/GameRoute')

afterEach(cleanup)

describe('나리 타자편 경기 시작 인트로(0xc) — 점수판 틀 0x41440 (0x419f4)', () => {
  it('(W/2 − 120, H/2 − 70) 에 내 팀 PLAYER · 상대 COM 두 측으로 그린다', () => {
    const progress = startGame(createSeededRandom(20100901))
    const noop = () => {}
    render(
      <GameRoute
        session={{
          loadingTip: null,
          handlePitchResolved: noop,
          actions: { finishLoading: noop, finishDefensePlay: noop, closeBurstResult: noop },
        } as never}
        progress={progress}
        runner={{ atBat: createAtBat(), isPaused: false, bannerText: '' } as never}
        random={createSeededRandom(1)}
        career={createCareer('테스트')}
        gameSettings={{ settings: {}, setSettings: noop } as never}
      />,
    )
    const frame = screen.getByTestId('점수판-틀')
    expect(Number(frame.dataset.x)).toBe(SCOREBOARD_AT.intro.x)
    expect(Number(frame.dataset.y)).toBe(SCOREBOARD_AT.intro.y)
    const ourIndex = progress.game.playerSide
    // img_text 157 "PLAYER" · 158 "COM" — 내 팀 측이 PLAYER
    const labels = [0, 1].map((index) => screen.queryByTestId(`점수판-측글자-${index}`)?.dataset.frame)
    expect(labels[ourIndex]).toBe('157')
    expect(labels[1 - ourIndex]).toBe('158')
  })
})
