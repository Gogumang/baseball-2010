// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import {
  LOADING_STEPS_BATTER_CAREER, LOADING_STEPS_DEFAULT, LoadingTip,
} from '@/widgets/loading-tip/ui/LoadingTip'
import { millisecondsPerFrame } from '@/shared/config/frameRate'

const NO_PRELOADS: readonly never[] = []

describe('LoadingTip — 진행 칸 0x54120 · 0x54128', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'setTimeout', 'clearTimeout'] })
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('끝 값은 0x39f88 의 0x24 · 모드 4 면 0x25', () => {
    expect(LOADING_STEPS_DEFAULT).toBe(36)
    expect(LOADING_STEPS_BATTER_CAREER).toBe(37)
  })

  it('칸 1 ~ 끝을 한 그림씩 그린 다음 그림에 닫는다', () => {
    const onDone = vi.fn()
    render(<LoadingTip tip="팁" onDone={onDone} steps={LOADING_STEPS_DEFAULT} preloadScenes={NO_PRELOADS} />)
    act(() => {
      vi.advanceTimersByTime((LOADING_STEPS_DEFAULT - 1) * millisecondsPerFrame())
    })
    expect(onDone).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(millisecondsPerFrame() + 20)
    })
    expect(onDone).toHaveBeenCalled()
  })
})
