// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Pitch } from '@/entities/pitching/model/pitch'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { pitchArrivalPlayTicksOf, usePitchArrivalHold } from '@/widgets/batting-stage/model/usePitchArrivalHold'
import { pitchResultEntryDelayTicksOf } from '@/widgets/batting-stage/lib/pitcherSideStage'

const 틱 = (n: number) => act(() => void vi.advanceTimersByTime(millisecondsPerFrame() * n))

const 공: Pitch = {
  type: '직구',
  plate: { x: 0, y: 0 },
  breakOffset: { x: 0, y: 0 },
  flightDurationMilliseconds: 600,
  frameCount: 20,
  controlTier: -1,
  worldPath: null,
  stageSide: 0,
}

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('공 도착 판(도루 · 폭투)은 0x12 진입 다음 그림에 선다 (0x3dfac 3e09a 0xbcb49(…, 0x17))', () => {
  it('놓은 틱에서 0x12 틱 0 + 1 그림', () => {
    expect(pitchArrivalPlayTicksOf(20)).toBe(pitchResultEntryDelayTicksOf(20) + 1)
  })

  it('판을 받은 그림부터 그 틱 수만큼 붙들고, 팝업 동안은 세지 않는다', () => {
    const 판 = { kind: 'arrival' }
    const { result, rerender } = renderHook(
      ({ play, isFrozen }: { play: object | null; isFrozen: boolean }) =>
        usePitchArrivalHold({ play, pitch: play === null ? null : 공, isFrozen }),
      { initialProps: { play: null as object | null, isFrozen: false } },
    )
    expect(result.current).toBe(false)
    rerender({ play: 판, isFrozen: false })
    expect(result.current).toBe(true)
    const 붙듦 = pitchArrivalPlayTicksOf(공.frameCount)
    틱(붙듦 - 2)
    rerender({ play: 판, isFrozen: true })
    틱(10)
    expect(result.current).toBe(true)
    rerender({ play: 판, isFrozen: false })
    틱(1)
    expect(result.current).toBe(true)
    틱(1)
    expect(result.current).toBe(false)
  })

  it('화면이 설 때 이미 있던 판은 붙들지 않는다', () => {
    const { result } = renderHook(() => usePitchArrivalHold({ play: { kind: 'arrival' }, pitch: 공 }))
    expect(result.current).toBe(false)
  })
})
