// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { createCareer } from '@/entities/career/model/playerCareer'
import { createAtBat } from '@/entities/at-bat/model/atBatState'
import { DEFAULT_PITCHER_ABILITY } from '@/entities/pitching/model/pitch'
import { KOREA_TEAM_ID } from '@/entities/national-cup/model/nationalCup'
import { PLAYER_SIDE_FIRST_BAT } from '@/entities/game/model/gameState'
import { startGame } from '@/features/play-game/model/gameFlow'
import { HALF_INNING_SCOREBOARD_FROM_TICK } from '@/widgets/scoreboard-frame/lib/scoreboardFrameLayout'
import { gameStageWarmCastOf } from '@/pages/game/lib/gameStageWarmCast'
import { GameScreen } from '@/pages/game/ui/GameScreen'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

/** 시즌 팀(나리 저장 팀)은 LG(3)인데 국가대항전이라 경기의 내 팀은 대한민국(10) — 상대국은 11 */
const SEASON_TEAM_ID = 3
const CUP_OPPONENT_ID = 11
const career = { ...createCareer('테스트'), teamId: SEASON_TEAM_ID }
/** `beginCupGame` 이 세우는 꼴 — startMatch(matchup.myTeam = 10, …) · 선공 1번이라 1회초 판이 선다 */
const cupProgress = () => startGame(createSeededRandom(3), KOREA_TEAM_ID, 1, CUP_OPPONENT_ID, PLAYER_SIDE_FIRST_BAT)

const logoSourcesOf = (container: HTMLElement) =>
  [...container.querySelectorAll('img')].map((img) => img.getAttribute('src') ?? '').filter((src) => src.includes('team_logo/'))

describe('나만의 타자 국가대항전 — 우리 쪽 팀은 경기[0x28 + 측] = 대한민국(10)이다 (0x39fdc 3a148~3a22a · 적재 0x48920~0x48a74)', () => {
  it('1회초 판 점수판 틀(0x41440)의 우리 로고는 시즌 팀이 아니라 대한민국이다', () => {
    vi.useFakeTimers()
    const { container } = render(
      <GameScreen
        career={career}
        progress={cupProgress()}
        atBat={createAtBat()}
        pitcherAbility={DEFAULT_PITCHER_ABILITY}
        isPaused={false}
        bannerText=""
        random={createSeededRandom(1)}
        onPitchResolved={vi.fn()}
        onQuit={vi.fn()}
      />,
    )
    expect(screen.getByTestId('교대-판-1회초')).toBeTruthy()
    act(() => void vi.advanceTimersByTime(millisecondsPerFrame() * (HALF_INNING_SCOREBOARD_FROM_TICK + 2)))

    const logos = logoSourcesOf(container)
    expect(logos.some((src) => src.endsWith('/010.png'))).toBe(true)
    expect(logos.some((src) => src.endsWith('/011.png'))).toBe(true)
    expect(logos.some((src) => src.endsWith('/003.png'))).toBe(false)
  })

  it('타자 몸통 칠하기 팀(0x47d00 0xb6bf9 = 경기[0x28 + 공격 측])도 대한민국이다', () => {
    const warm = gameStageWarmCastOf(cupProgress(), career)
    expect(warm.batters[0]?.teamIndex).toBe(KOREA_TEAM_ID)
  })
})
