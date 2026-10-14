// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { BenchClearingScene } from '@/widgets/game-scene/ui/BenchClearingScene'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { setActiveSound } from '@/shared/api/audio/soundPort'
import type { SoundPort } from '@/shared/api/audio/soundPort'

const 녹음 = { played: [] as number[], stopped: 0 }
const 소리: SoundPort = {
  play: (id: number) => {
    녹음.played.push(id)
  },
  playBgm: () => {},
  stopBgm: () => {},
  stop: () => {
    녹음.stopped += 1
  },
  resumeBgm: () => {},
  currentBgm: () => null,
} as unknown as SoundPort

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  녹음.played.length = 0
  녹음.stopped = 0
})

describe('벤치 클리어링 연출 (상태 0x1e)', () => {
  it('진입에 소리 44, 틱 10 전에 OK 면 목표 굴림 전에 나간다', () => {
    setActiveSound(소리)
    vi.useFakeTimers()
    const onDone = vi.fn()
    render(<BenchClearingScene onDone={onDone} />)
    expect(녹음.played).toEqual([44])

    act(() => vi.advanceTimersByTime(millisecondsPerFrame() * 9))
    fireEvent.keyDown(window, { key: '5' })
    expect(onDone).toHaveBeenCalledWith(false)
    expect(녹음.stopped).toBe(1)
  })

  it('틱 10 이 지난 뒤 OK 면 굴림이 나간 것으로 알린다', () => {
    setActiveSound(소리)
    vi.useFakeTimers()
    const onDone = vi.fn()
    render(<BenchClearingScene onDone={onDone} />)
    act(() => vi.advanceTimersByTime(millisecondsPerFrame() * 10))
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(onDone).toHaveBeenCalledWith(true)
  })

  it('그대로 두면 틱 100 에 원 닫기(종류 7)를 걸고 단계 32 를 그린 다음 틱 133 의 갱신에서 나간다', () => {
    setActiveSound(소리)
    vi.useFakeTimers()
    const onDone = vi.fn()
    render(<BenchClearingScene onDone={onDone} />)
    act(() => vi.advanceTimersByTime(millisecondsPerFrame() * 100))
    // 틱 100 의 그림은 단계 0 — 아무것도 안 덮는다
    expect(screen.queryByTestId('벤치-원닫기')).toBeNull()
    act(() => vi.advanceTimersByTime(millisecondsPerFrame()))
    expect(screen.getByTestId('벤치-원닫기').dataset.size).toBe('240')
    act(() => vi.advanceTimersByTime(millisecondsPerFrame() * 31))
    expect(screen.getByTestId('벤치-원닫기').dataset.size).toBe(String(Math.trunc(240 / 32)))
    expect(onDone).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(millisecondsPerFrame()))
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(onDone).toHaveBeenCalledWith(true)
  })

  it('난수를 주면 틱 10 에 화면이 수비 목표 굴림 8 번을 내고, 끝에서는 굴릴 몫이 없다고 알린다', () => {
    setActiveSound(소리)
    vi.useFakeTimers()
    const onDone = vi.fn()
    const asked: [number, number][] = []
    const random = {
      rand: (lo: number, hi: number) => {
        asked.push([lo, hi])
        return lo
      },
      rand9d: () => 0,
    }
    const entryRolls = Array.from({ length: 9 }, () => ({ scatterX: 0, scatterZ: 100, speed: 200, targetX: 0, targetZ: 0 }))
    render(
      <BenchClearingScene
        field={{ entryRolls, offenseSide: 1, isLeftBatter: true, occupiedBases: [true, false, false], defenseTeam: 2, offenseTeam: 3 }}
        random={random}
        onDone={onDone}
      />,
    )
    expect(screen.getAllByTestId(/^운동장-선수-/)).toHaveLength(18)
    act(() => vi.advanceTimersByTime(millisecondsPerFrame() * 9))
    expect(asked).toHaveLength(0)
    act(() => vi.advanceTimersByTime(millisecondsPerFrame()))
    expect(asked).toEqual([[1000, 2000], [2000, 3000], [1000, 1500], [2500, 3000], [1000, 1500], [2500, 3000], [0, 2000], [0, 2000]])
    fireEvent.keyDown(window, { key: '5' })
    expect(onDone).toHaveBeenCalledWith(false)
  })
})
