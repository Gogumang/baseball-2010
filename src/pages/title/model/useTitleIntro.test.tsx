// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, renderHook } from '@testing-library/react'
import { useTitleIntro } from '@/pages/title/model/useTitleIntro'
import { INTRO_FRAME_COUNT } from '@/pages/title/model/titleIntro'
import { millisecondsPerFrame } from '@/shared/config/frameRate'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })
})
afterEach(() => {
  vi.useRealTimers()
})

describe('타이틀 키 — 갱신 0x245f8 은 애니 끝 깃발이 서야 키를 본다', () => {
  it('인트로 중 키는 버려진다 — 건너뛰지도 않는다', () => {
    const onStart = vi.fn()
    const { result } = renderHook(() => useTitleIntro(onStart))
    act(() => {
      fireEvent.keyDown(window, { key: 'Enter' })
      vi.advanceTimersByTime(millisecondsPerFrame())
    })
    expect(onStart).not.toHaveBeenCalled()
    expect(result.current.pose.isSettled).toBe(false)
  })

  it('인트로가 끝난 뒤에는 아무 키나 처음 메뉴로', () => {
    const onStart = vi.fn()
    const { result } = renderHook(() => useTitleIntro(onStart))
    act(() => {
      vi.advanceTimersByTime(millisecondsPerFrame() * (INTRO_FRAME_COUNT + 1))
    })
    expect(result.current.pose.isSettled).toBe(true)
    act(() => {
      fireEvent.keyDown(window, { key: 'a' })
    })
    expect(onStart).toHaveBeenCalledTimes(1)
  })
})
