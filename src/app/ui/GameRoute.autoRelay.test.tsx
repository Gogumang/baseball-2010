// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { createCareer } from '@/entities/career/model/playerCareer'
import { createAtBat } from '@/entities/at-bat/model/atBatState'
import { startGame } from '@/features/play-game/model/gameFlow'
import { millisecondsPerFrame } from '@/shared/config/frameRate'

/** 경기 화면 대신 — 섰는지만 본다 */
vi.mock('@/pages/game/ui/GameScreen', () => ({
  GameScreen: () => <div data-testid="타석화면" />,
}))

const { GameRoute } = await import('@/app/ui/GameRoute')

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('나리 타자편 자동진행 중계 (상태 0x21 — 모드 4: 매 틱 한 칸, 키 · 속도 · 배경음 없음)', () => {
  it('경기 시작에 내 앞 타석 · 상대 반 이닝이 돌았으면 인트로 뒤 중계를 틱마다 한 칸씩 틀고, 다 돈 다음 틱에 타석 화면', () => {
    const progress = startGame(createSeededRandom(20100901))
    const relay = progress.autoRelay
    expect(relay?.ticks.length ?? 0).toBeGreaterThan(0)
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
    // 경기 시작 인트로(상태 0xc)를 OK 로 건너뛴다
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(screen.queryByTestId('타석화면')).toBeNull()

    const ticks = relay?.ticks.length ?? 0
    // 인트로가 내려가고 중계 화면이 선 뒤 첫 틱에 첫 칸
    for (let frame = 0; frame < 60 && screen.queryByTestId('중계-공격팀') === null; frame += 1) {
      act(() => void vi.advanceTimersByTime(millisecondsPerFrame()))
    }
    expect(screen.getByTestId('중계-공격팀')).toBeTruthy()
    // 틱 n 에 n 번째 칸 — 마지막 칸까지는 중계가 서 있다
    act(() => void vi.advanceTimersByTime(millisecondsPerFrame() * (ticks - 1)))
    expect(screen.getByTestId('중계-공격팀')).toBeTruthy()
    expect(screen.queryByTestId('타석화면')).toBeNull()
    // 마지막 칸 다음 틱 — 0xc2198 거짓 → 0x18 → 내 타석
    act(() => void vi.advanceTimersByTime(millisecondsPerFrame()))
    expect(screen.getByTestId('타석화면')).toBeTruthy()
  })
})
