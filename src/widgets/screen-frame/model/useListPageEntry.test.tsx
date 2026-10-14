// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { useEffect, useState } from 'react'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { useListPageEntry } from '@/widgets/screen-frame/model/useListPageEntry'
import type { ListPageGrid } from '@/widgets/screen-frame/model/useListPageEntry'

const ACE_GRID: ListPageGrid = { shape: { rows: 2, columns: 5, rowHeight: 40, rowGap: 18, shift: 1 }, isAnimated: true }

function KeyCounter({ slides, grid }: { readonly slides: boolean; readonly grid: ListPageGrid | null }) {
  const { keyLock, isBodyShown } = useListPageEntry({ slides, grid })
  const [count, setCount] = useState(0)
  useEffect(() => {
    const onKeyDown = () => {
      if (keyLock.current) return
      setCount((value) => value + 1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [keyLock])
  return <output data-testid="count" data-body={isBodyShown}>{count}</output>
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const advance = (draws: number) => act(() => {
  vi.advanceTimersByTime(millisecondsPerFrame() * draws + 20)
})

describe('공용 목록 0x63b14 — 머리띠 다섯 그림 + 격자 열림 애니 동안 키를 안 받는다 ([skin+0xe4])', () => {
  it('마선수 격자: 본문은 그림 5 부터, 키는 그림 9(본문 다섯째 그림의 0x7a571 이 1)부터', () => {
    vi.useFakeTimers()
    const { getByTestId } = render(<KeyCounter slides grid={ACE_GRID} />)
    expect(getByTestId('count').dataset.body).toBe('false')
    advance(5)
    expect(getByTestId('count').dataset.body).toBe('true')
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(getByTestId('count').textContent).toBe('0')
    advance(4)
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(getByTestId('count').textContent).toBe('1')
  })

  it('격자 없이 미끄러지지 않으면 처음부터 받는다', () => {
    const { getByTestId } = render(<KeyCounter slides={false} grid={null} />)
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(getByTestId('count').textContent).toBe('1')
  })
})
