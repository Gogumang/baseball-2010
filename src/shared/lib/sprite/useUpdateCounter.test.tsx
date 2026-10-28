// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { resetAppTickClockForTest } from '@/shared/lib/frameClock/frameClock'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'

/** 그림 틀을 손으로 돌린다 — `frame(시각)` 이 걸린 콜백을 그 시각으로 부른다 */
function installFrames() {
  let pending: FrameRequestCallback[] = []
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    pending.push(callback)
    return pending.length
  })
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {
    pending = []
  })
  return (time: number) =>
    act(() => {
      const due = pending
      pending = []
      for (const callback of due) callback(time)
    })
}

describe('useUpdateCounter — 켜진 앱 틱부터 센다 (r355 ref 로 옮김, 값 · 틀 그대로)', () => {
  beforeEach(() => {
    resetAppTickClockForTest()
    vi.spyOn(performance, 'now').mockReturnValue(0)
  })
  afterEach(() => vi.restoreAllMocks())

  it('켜진 틱 0 에서 앱 틱마다 하나씩 오르고, 같은 틱 안의 틀은 그대로다', () => {
    const frame = installFrames()
    const length = millisecondsPerFrame()
    const { result } = renderHook(() => useUpdateCounter())
    expect(result.current).toBe(0)
    frame(length * 0.5)
    expect(result.current).toBe(0)
    frame(length * 1)
    expect(result.current).toBe(1)
    frame(length * 1.9)
    expect(result.current).toBe(1)
    frame(length * 5)
    expect(result.current).toBe(5)
  })

  it('늦게 켜지면 그 틱부터 다시 센다 · 꺼진 동안은 서 있다', () => {
    const frame = installFrames()
    const length = millisecondsPerFrame()
    vi.mocked(performance.now).mockReturnValue(length * 3)
    const { result, rerender } = renderHook(({ on }) => useUpdateCounter(on), { initialProps: { on: true } })
    frame(length * 4)
    expect(result.current).toBe(1)
    rerender({ on: false })
    frame(length * 9)
    expect(result.current).toBe(1)
    vi.mocked(performance.now).mockReturnValue(length * 10)
    rerender({ on: true })
    frame(length * 12)
    expect(result.current).toBe(2)
  })
})
