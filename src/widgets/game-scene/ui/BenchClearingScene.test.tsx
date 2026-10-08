// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
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

  it('그대로 두면 틱 100 에 전환을 걸고 1500 뒤 나간다', () => {
    setActiveSound(소리)
    vi.useFakeTimers()
    const onDone = vi.fn()
    render(<BenchClearingScene onDone={onDone} />)
    act(() => vi.advanceTimersByTime(millisecondsPerFrame() * 100))
    expect(onDone).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1500))
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(onDone).toHaveBeenCalledWith(true)
  })
})
