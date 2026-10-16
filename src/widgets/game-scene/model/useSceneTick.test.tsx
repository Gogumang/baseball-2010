// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { markCommonWindowShown, markGameSceneUp, resetCommonWindowShownForTest } from '@/shared/lib/commonWindow/commonWindow'
import { useSceneTick } from '@/widgets/game-scene/model/useSceneTick'

describe('useSceneTick — 경기 장면 틱 [+0x2c] 와 공용 창 게이트 52cc6', () => {
  afterEach(() => {
    cleanup()
    resetCommonWindowShownForTest()
    vi.useRealTimers()
  })

  it('경기 장면 위에 창이 떠 있는 동안 틱이 안 오르고, 닫히면 따라잡지 않고 이어 오른다', () => {
    vi.useFakeTimers()
    const 장면 = markGameSceneUp()
    const { result } = renderHook(() => useSceneTick())
    act(() => void vi.advanceTimersByTime(3 * millisecondsPerFrame()))
    expect(result.current).toBe(3)
    const 창 = markCommonWindowShown()
    act(() => void vi.advanceTimersByTime(50 * millisecondsPerFrame()))
    expect(result.current).toBe(3)
    창()
    act(() => void vi.advanceTimersByTime(2 * millisecondsPerFrame()))
    expect(result.current).toBe(5)
    장면()
  })

  it('경기 장면이 아니면 창이 떠도 오른다 — 다른 장면 프레임에는 이 게이트가 없다', () => {
    vi.useFakeTimers()
    const 창 = markCommonWindowShown()
    const { result } = renderHook(() => useSceneTick())
    act(() => void vi.advanceTimersByTime(4 * millisecondsPerFrame()))
    expect(result.current).toBe(4)
    창()
  })

  it('게이트 밖 그림(53064 의 기록 달성 알림 0x4e35c)은 창이 떠 있어도 돈다', () => {
    vi.useFakeTimers()
    const 장면 = markGameSceneUp()
    const 창 = markCommonWindowShown()
    const { result } = renderHook(() => useSceneTick(undefined, true, true))
    act(() => void vi.advanceTimersByTime(4 * millisecondsPerFrame()))
    expect(result.current).toBe(4)
    창()
    장면()
  })
})
