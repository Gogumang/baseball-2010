// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useEventEndFrame } from '@/app/model/useEventEndFrame'
import { millisecondsPerFrame } from '@/shared/config/frameRate'

afterEach(() => {
  vi.useRealTimers()
})

describe('이벤트 재생의 끝 틀 (114 갱신 0x1c014 의 끝 → 같은 틀 그리기 0x19e64 → 다음 틀에 다음 상태)', () => {
  it('끝을 받으면 한 틀 동안 isEnding 이 서고, 그 뒤 받은 값 그대로 넘긴다', () => {
    vi.useFakeTimers()
    const complete = vi.fn()
    const { result } = renderHook(() => useEventEndFrame(complete))

    act(() => result.current.end(['보상'], [7], null))
    expect(result.current.isEnding).toBe(true)
    expect(complete).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(millisecondsPerFrame() - 1)
    })
    expect(complete).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(complete).toHaveBeenCalledWith(['보상'], [7], null)
    expect(result.current.isEnding).toBe(false)
  })
})
