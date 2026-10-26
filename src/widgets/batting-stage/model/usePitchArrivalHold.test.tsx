// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { PITCH_ARRIVAL_PLAY_TICKS, usePitchArrivalHold } from '@/widgets/batting-stage/model/usePitchArrivalHold'

const 틱 = (n: number) => act(() => void vi.advanceTimersByTime(millisecondsPerFrame() * n))

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('공 도착 판(도루 · 폭투)은 0x12 진입 다음 그림에 선다 (0x3dfac 3e09a 0xbcb49(…, 0x17))', () => {
  it('판은 0x12 진입 틀에 서고(진행기가 그 틀에 0x3dfac 을 돌린다) 0x17 은 다음 그림', () => {
    expect(PITCH_ARRIVAL_PLAY_TICKS).toBe(1)
  })

  it('판을 받은 그림부터 그 틱 수만큼 붙들고, 팝업 동안은 세지 않는다', () => {
    const 판 = { kind: 'arrival' }
    const { result, rerender } = renderHook(
      ({ play, isFrozen }: { play: object | null; isFrozen: boolean }) =>
        usePitchArrivalHold({ play, isFrozen }),
      { initialProps: { play: null as object | null, isFrozen: false } },
    )
    expect(result.current).toBe(false)
    rerender({ play: 판, isFrozen: false })
    expect(result.current).toBe(true)
    rerender({ play: 판, isFrozen: true })
    틱(10)
    expect(result.current).toBe(true)
    rerender({ play: 판, isFrozen: false })
    expect(result.current).toBe(true)
    틱(PITCH_ARRIVAL_PLAY_TICKS)
    expect(result.current).toBe(false)
  })

  it('화면이 설 때 이미 있던 판은 붙들지 않는다', () => {
    const { result } = renderHook(() => usePitchArrivalHold({ play: { kind: 'arrival' } }))
    expect(result.current).toBe(false)
  })
})
