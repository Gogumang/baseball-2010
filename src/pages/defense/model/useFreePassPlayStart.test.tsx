// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { useFreePassPlayStart } from '@/pages/defense/model/useFreePassPlayStart'
import { runWalkPlay, WALK_PLAY_WAIT_TICKS } from '@/features/defense-play/model/walkPlay'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { resetSceneParticleManagerForTest } from '@/entities/particle/model/sceneParticleManager'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  resetSceneParticleManagerForTest()
})

describe('밀어내기 판(종류 2)을 세우는 때 — 0x12 대기 0x1f 뒤 · 도루 출발 중이면 곧장 (A-24)', () => {
  it('붙들지 않은 밀어내기 판은 0x1f 장면 틱을 기다린다', () => {
    vi.useFakeTimers()
    const play = runWalkPlay({ bases: { first: true, second: false, third: false }, outs: 0, pitchJudgement: 3 })
    const rendered = renderHook(() => useFreePassPlayStart(play, false))
    expect(rendered.result.current).toBe(false)
    act(() => vi.advanceTimersByTime(millisecondsPerFrame() * (WALK_PLAY_WAIT_TICKS - 1)))
    expect(rendered.result.current).toBe(false)
    act(() => vi.advanceTimersByTime(millisecondsPerFrame()))
    expect(rendered.result.current).toBe(true)
  })

  it('도루 출발 중 볼넷 · 사구의 판은 3e0e4 → 3e114 가 곧장 0x17 — 기다리지 않는다', () => {
    const play = runWalkPlay({ bases: { first: true, second: false, third: false }, outs: 0, pitchJudgement: 4, stealingFrom: [1] })
    const rendered = renderHook(() => useFreePassPlayStart(play, false))
    expect(rendered.result.current).toBe(true)
  })
})
