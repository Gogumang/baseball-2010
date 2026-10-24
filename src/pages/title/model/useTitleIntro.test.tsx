// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, renderHook } from '@testing-library/react'
import { useTitleIntro } from '@/pages/title/model/useTitleIntro'
import { INTRO_FRAME_COUNT, TITLE_KEY_FRAMES_TO_MENU } from '@/pages/title/model/titleIntro'
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
    expect(result.current.scene.isSettled).toBe(false)
  })

  it('인트로가 끝난 뒤에는 아무 키나 처음 메뉴로 — 예약이라 두 틀 뒤에 넘어간다 (0x32fa0: 갱신 → 그리기, 다음 틀 0xbc9c9)', () => {
    const onStart = vi.fn()
    const { result } = renderHook(() => useTitleIntro(onStart))
    act(() => {
      vi.advanceTimersByTime(millisecondsPerFrame() * (INTRO_FRAME_COUNT + 0.5))
    })
    expect(result.current.scene.isSettled).toBe(true)
    act(() => {
      fireEvent.keyDown(window, { key: 'a' })
      fireEvent.keyDown(window, { key: 'b' })
    })
    // 받은 틀(d + 1)은 타이틀을 한 번 더 그린다
    expect(onStart).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(millisecondsPerFrame())
    })
    expect(onStart).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(millisecondsPerFrame() * (TITLE_KEY_FRAMES_TO_MENU - 1))
    })
    expect(onStart).toHaveBeenCalledTimes(1)
  })

  it('깃발을 세우는 그리기(19) 전에 누른 키는 버려진다 — 그 틀의 갱신은 깃발을 못 본다', () => {
    const onStart = vi.fn()
    renderHook(() => useTitleIntro(onStart))
    act(() => {
      vi.advanceTimersByTime(millisecondsPerFrame() * (INTRO_FRAME_COUNT - 0.5))
      fireEvent.keyDown(window, { key: 'a' })
      vi.advanceTimersByTime(millisecondsPerFrame() * 5)
    })
    expect(onStart).not.toHaveBeenCalled()
  })
})
