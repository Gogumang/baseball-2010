// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { SeasonScreenFade } from '@/pages/season/ui/SeasonScreenFade'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('시즌 화면 효과기 0xbdae8 — 키 문 0x4b18 ([eff+4] == 0 || [eff+0x10] == 0)', () => {
  it('끝(+0x10 = 2)을 세운 마지막 칠하기 틀 뒤에도 막고, 비우는 틀 뒤부터 받는다', () => {
    vi.useFakeTimers()
    const keys = vi.fn()
    const listener = (event: KeyboardEvent) => keys(event.key)
    window.addEventListener('keydown', listener)
    try {
      render(<SeasonScreenFade kind="검정에서밝아짐" />)
      const press = () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
      const isPainted = () => screen.queryByTestId('화면-효과기') !== null
      // 칠하는 틀마다 키는 버려진다 — 마지막 칠하기(끝을 세운 틀)까지
      let paintedFrames = 0
      while (isPainted() && paintedFrames < 20) {
        press()
        paintedFrames += 1
        act(() => {
          vi.advanceTimersByTime(millisecondsPerFrame())
        })
      }
      expect(keys).not.toHaveBeenCalled()
      expect(isPainted()).toBe(false)
      press()
      expect(keys).toHaveBeenCalledTimes(1)
    } finally {
      window.removeEventListener('keydown', listener)
    }
  })
})
