// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { LOADING_STEPS_BATTER_CAREER, LOADING_STEPS_DEFAULT, LoadingTip } from '@/widgets/loading-tip/ui/LoadingTip'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { LOADING_TIPS } from '@/shared/config/loadingTips'

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

  it('팁 번호 n + 1 을 num 90 + 숫자로 · 막대 바탕과 채움 띠 넷을 그린다 (0x53e04)', () => {
    const { getAllByTestId } = render(
      <LoadingTip tip={LOADING_TIPS[16] ?? ''} onDone={vi.fn()} steps={LOADING_STEPS_DEFAULT} preloadScenes={NO_PRELOADS} />,
    )
    expect(getAllByTestId('로딩-팁-번호').map((element) => element.getAttribute('data-image'))).toEqual(['91', '97'])
    expect(getAllByTestId('로딩-막대')).toHaveLength(1)
    const stripes = getAllByTestId('로딩-채움')
    expect(stripes).toHaveLength(4)
    // 첫 그림은 1/끝 — 150 − 35 · 4
    expect(stripes[0]?.style.width).toBe('10px')
  })
})
