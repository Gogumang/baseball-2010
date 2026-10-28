// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { koreanHourOf, modeBackPaletteOf, timeSlotOfHour, useSceneEntryHour } from '@/shared/lib/phoneClock/phoneClock'

const HOUR = 60 * 60 * 1000

describe('휴대폰 시계 0x6f390 · 시간대 0xb8fbc · 팔레트 줄 0x7b934', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('밀리초 시계를 시로 내려 9 를 더하고 24 로 나눈다 — 기기 시간대를 보지 않는 한국 시각', () => {
    expect(koreanHourOf(0)).toBe(9)
    expect(koreanHourOf(15 * HOUR - 1)).toBe(23)
    expect(koreanHourOf(15 * HOUR)).toBe(0)
    expect(koreanHourOf(Date.UTC(2026, 9, 14, 7, 59, 59))).toBe(16)
  })

  it('6~15 → 0 낮 · 16~19 → 1 저녁 · 그 밖 → 2 밤', () => {
    expect([5, 6, 15, 16, 19, 20, 0].map(timeSlotOfHour)).toEqual([2, 0, 0, 1, 1, 2, 2])
  })

  it('시간대 0 은 mpl 줄 −1(기본 팔레트), 그 밖은 t − 1', () => {
    expect(modeBackPaletteOf(0)).toBeNull()
    expect(modeBackPaletteOf(1)).toBe(0)
    expect(modeBackPaletteOf(2)).toBe(1)
  })

  it('장면에 들어설 때 잡은 시각을 장면이 서 있는 동안 남기고, 다시 들어서면 새로 잡는다', () => {
    vi.useFakeTimers()
    vi.setSystemTime(Date.UTC(2026, 9, 14, 3, 0)) // 한국 12시
    const { result, rerender } = renderHook(({ isInScene }) => useSceneEntryHour(isInScene), { initialProps: { isInScene: true } })
    expect(result.current).toBe(12)

    vi.setSystemTime(Date.UTC(2026, 9, 14, 12, 0)) // 한국 21시 — 장면 안에서는 그대로
    rerender({ isInScene: true })
    expect(result.current).toBe(12)

    // 경기 장면으로 나갔다 — 앞 값을 둔다
    act(() => rerender({ isInScene: false }))
    expect(result.current).toBe(12)

    // 다시 들어선다 — 상태 100 진입이 새로 잡는다
    act(() => rerender({ isInScene: true }))
    expect(result.current).toBe(21)
  })
})
