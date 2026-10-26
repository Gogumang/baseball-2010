// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { BenchClearingScene } from '@/widgets/game-scene/ui/BenchClearingScene'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { setActiveSound } from '@/shared/api/audio/soundPort'
import type { SoundPort } from '@/shared/api/audio/soundPort'
import { emitParticles } from '@/entities/particle/model/particleScene'
import {
  isSceneParticleTickHeld, resetSceneParticleManagerForTest, sceneParticleScene,
} from '@/entities/particle/model/sceneParticleManager'

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
  it('진입에 소리 44, 틱 9 에 받은 OK 는 틱 10 의 키 자리(갱신 앞)에서 처리되어 목표 굴림 전에 나간다', () => {
    setActiveSound(소리)
    vi.useFakeTimers()
    const onDone = vi.fn()
    render(<BenchClearingScene onDone={onDone} />)
    expect(녹음.played).toEqual([44])

    act(() => vi.advanceTimersByTime(millisecondsPerFrame() * 9))
    fireEvent.keyDown(window, { key: '5' })
    // 받은 틀에는 아무 일 없다 — 다음 틀 52de8 0x40628
    expect(onDone).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(millisecondsPerFrame()))
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
    act(() => vi.advanceTimersByTime(millisecondsPerFrame()))
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
    act(() => vi.advanceTimersByTime(millisecondsPerFrame()))
    expect(onDone).toHaveBeenCalledWith(false)
  })

  it('앞 상태가 남긴 이미터는 이 장면이 제 갱신 바로 뒤에 굴린다 — 틱 10 이면 목표 굴림 8 번 다음 (52e14 → 53048, r284)', () => {
    setActiveSound(소리)
    vi.useFakeTimers()
    resetSceneParticleManagerForTest()
    const calls: string[] = []
    const random = {
      rand: (lo: number) => {
        calls.push('목표')
        return lo
      },
      rand9d: () => {
        calls.push('입자')
        return 0
      },
    }
    // 오래 사는 이미터 하나 — 해마다 한 알씩 50 알, 알마다 40 틱
    emitParticles(
      sceneParticleScene(),
      {
        ang: 0, spread: 0, spd: 0, spdR: 0, emit: 1, emitR: 0, life: 40, lifeR: 0, a0: 0, a0R: 0, a1: 0, a1R: 0,
        ax: 0, ay: 0, w: 0, h: 0, total: 50, mode: 2,
      },
      0, 0, 0,
    )
    const entryRolls = Array.from({ length: 9 }, () => ({ scatterX: 0, scatterZ: 100, speed: 200, targetX: 0, targetZ: 0 }))
    render(
      <BenchClearingScene
        field={{ entryRolls, offenseSide: 1, isLeftBatter: true, occupiedBases: [true, false, false], defenseTeam: 2, offenseTeam: 3 }}
        random={random}
        onDone={() => {}}
      />,
    )
    // 관리자 틱은 이 장면이 맡는다 — 앱 층은 그리기만
    expect(isSceneParticleTickHeld()).toBe(true)
    act(() => vi.advanceTimersByTime(millisecondsPerFrame() * 9))
    expect(calls.length).toBeGreaterThan(0)
    expect(calls.every((call) => call === '입자')).toBe(true)
    calls.length = 0
    act(() => vi.advanceTimersByTime(millisecondsPerFrame()))
    // 틱 10 의 틀 — 목표 굴림 8 번이 먼저, 그 뒤 같은 틀의 관리자 틱
    expect(calls.slice(0, 8)).toEqual(Array.from({ length: 8 }, () => '목표'))
    expect(calls.length).toBeGreaterThan(8)
    expect(calls.slice(8).every((call) => call === '입자')).toBe(true)
    cleanup()
    expect(isSceneParticleTickHeld()).toBe(false)
    resetSceneParticleManagerForTest()
  })
})
