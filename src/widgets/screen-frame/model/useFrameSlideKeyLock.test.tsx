// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { useEffect, useState } from 'react'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { useFrameSlideKeyLock } from '@/widgets/screen-frame/model/useFrameSlideKeyLock'

function KeyCounter({ slides }: { readonly slides: boolean }) {
  const keyLock = useFrameSlideKeyLock(slides)
  const [count, setCount] = useState(0)
  useEffect(() => {
    const onKeyDown = () => {
      if (keyLock.current) return
      setCount((value) => value + 1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [keyLock])
  return <output data-testid="count">{count}</output>
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('공용 목록 0x63b14 화면 — 머리띠가 미끄러지는 동안 키를 안 받는다 ([skin+0xe4])', () => {
  it('그림 0 ~ 4 는 버리고 그림 5 부터 받는다', () => {
    vi.useFakeTimers()
    const { getByTestId } = render(<KeyCounter slides />)
    fireEvent.keyDown(window, { key: 'Enter' })
    act(() => {
      vi.advanceTimersByTime(millisecondsPerFrame() * 4 + 1)
    })
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(getByTestId('count').textContent).toBe('0')
    act(() => {
      // requestAnimationFrame 은 16ms 걸음이라 넉넉히 넘긴다
      vi.advanceTimersByTime(millisecondsPerFrame() + 20)
    })
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(getByTestId('count').textContent).toBe('1')
  })

  it('미끄러지지 않으면 처음부터 받는다', () => {
    const { getByTestId } = render(<KeyCounter slides={false} />)
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(getByTestId('count').textContent).toBe('1')
  })
})
