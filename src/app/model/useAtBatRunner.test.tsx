// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AT_BAT_END_AFTER_RESULT_WAIT_FRAMES, atBatEndFramesOf, useAtBatRunner } from '@/app/model/useAtBatRunner'
import { DEFAULT_SPEED_LEVEL, millisecondsPerFrame, setGameSpeedLevel } from '@/shared/config/frameRate'

describe('타석 끝에서 0xd 까지 — 0x12 대기 0x4e6d4 · 판정 A/B', () => {
  it('삼진 · 볼넷 · 사구는 0x12 대기(문턱 0x1f)의 32 그림, 도루 · 폭투 판이 열렸거나 그 밖 결과면 0 그림', () => {
    expect(AT_BAT_END_AFTER_RESULT_WAIT_FRAMES).toBe(32)
    expect(atBatEndFramesOf({ kind: '삼진' }, null)).toBe(32)
    expect(atBatEndFramesOf({ kind: '볼넷' }, null)).toBe(32)
    expect(atBatEndFramesOf({ kind: '사구' }, { kind: 2 })).toBe(32)
    // 0x12 진입 0x3e096 · 0x3e114 가 곧장 0x17 — 판 끝에서 0xd
    expect(atBatEndFramesOf({ kind: '삼진' }, { kind: 5 })).toBe(0)
    expect(atBatEndFramesOf({ kind: '삼진' }, { kind: 9 })).toBe(0)
    expect(atBatEndFramesOf({ kind: '홈런' }, null)).toBe(0)
  })

  it('도루 출발 중 볼넷 · 사구의 밀어내기 판은 3e0e4 → 3e114 가 곧장 0x17 — 0 그림 (A-24)', () => {
    expect(atBatEndFramesOf({ kind: '볼넷' }, { kind: 2, result: { opensAtArrival: true } })).toBe(0)
    expect(atBatEndFramesOf({ kind: '사구' }, { kind: 2, result: { opensAtArrival: true } })).toBe(0)
    expect(atBatEndFramesOf({ kind: '사구' }, { kind: 2, result: {} })).toBe(32)
  })

  describe('pauseWithBanner', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })
    afterEach(() => {
      vi.useRealTimers()
      setGameSpeedLevel(DEFAULT_SPEED_LEVEL)
    })

    it('넘긴 그림 수 × 지금 속도의 한 그림만큼 붙든다', () => {
      setGameSpeedLevel(1)
      const onElapsed = vi.fn()
      const rendered = renderHook(() => useAtBatRunner())
      act(() => rendered.result.current.pauseWithBanner('삼진…', 32, onElapsed))
      expect(rendered.result.current.bannerText).toBe('삼진…')
      act(() => {
        vi.advanceTimersByTime(32 * millisecondsPerFrame() - 1)
      })
      expect(onElapsed).not.toHaveBeenCalled()
      act(() => {
        vi.advanceTimersByTime(1)
      })
      expect(onElapsed).toHaveBeenCalledTimes(1)
      expect(rendered.result.current.bannerText).toBe('')
      rendered.unmount()
    })
  })
})
