// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { NariYearCoverScreen } from '@/pages/management/ui/NariYearCoverScreen'
import { millisecondsPerFrame } from '@/shared/config/frameRate'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const advance = (frames: number) => act(() => {
  vi.advanceTimersByTime(millisecondsPerFrame() * frames)
})

describe('NariYearCoverScreen — 137 "N년차" 표지', () => {
  it('기다리면 표지를 보이고 81 틀 뒤 어두워져 105 로 간다', () => {
    const onDone = vi.fn()
    const { container } = render(<NariYearCoverScreen yearIndex={1} onDone={onDone} />)
    expect(container.querySelector('[data-part="year-cover-left"]')).not.toBeNull()
    advance(10.5)
    const cover = container.querySelector('[data-part="year-cover"]')
    expect(cover?.getAttribute('data-counter')).toBe('0')
    expect([...container.querySelectorAll('[data-digit]')].map((node) => node.getAttribute('data-digit'))).toEqual(['1', '2'])
    advance(89)
    expect(onDone).not.toHaveBeenCalled()
    advance(2)
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('들어올 때 밝아지는 동안 든 키는 버려지고, 그 뒤 키는 곧바로 넘긴다', () => {
    const onDone = vi.fn()
    const { container } = render(<NariYearCoverScreen yearIndex={3} onDone={onDone} />)
    advance(12.5)
    fireEvent.keyDown(window, { key: '5' })
    advance(30)
    expect(onDone).not.toHaveBeenCalled()
    expect(Number(container.querySelector('[data-part="year-cover"]')?.getAttribute('data-counter'))).toBeLessThan(0x50)
    fireEvent.keyDown(window, { key: '5' })
    advance(1)
    expect(container.querySelector('[data-part="year-cover"]')?.getAttribute('data-counter')).toBe(String(0x51))
    advance(10)
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})
