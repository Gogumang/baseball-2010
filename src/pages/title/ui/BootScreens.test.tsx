// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { UsageNoticeScreen } from '@/pages/title/ui/UsageNoticeScreen'
import { LogoScreen } from '@/pages/title/ui/LogoScreen'
import { millisecondsPerFrame } from '@/shared/config/frameRate'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('켤 때 <이용안내> (하위 0x2a)', () => {
  it('원문 0xce904 를 흰 바탕에 그리고 아무 키나 누르면 다음(하위 2)으로', () => {
    const onNext = vi.fn()
    render(<UsageNoticeScreen onNext={onNext} />)
    expect(screen.getByText('<이용안내>', { exact: false })).toBeTruthy()
    expect(screen.getByText('않는 단독형 게임입니다.', { exact: false })).toBeTruthy()
    fireEvent.keyDown(window, { key: 'x' })
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it('"아무키나 누르세요!!" 는 틱 % 5 가 0 이면 안 그린다 (0x2cb3c)', () => {
    render(<UsageNoticeScreen onNext={vi.fn()} />)
    expect(screen.queryByText('아무키나 누르세요!!', { exact: false })).toBeNull()
    act(() => {
      vi.advanceTimersByTime(millisecondsPerFrame() * 2 + 20)
    })
    expect(screen.getByText('아무키나 누르세요!!', { exact: false })).toBeTruthy()
  })
})

describe('켤 때 로고 (하위 2)', () => {
  it('키는 안 받고, 음성 0 을 한 번 낸 뒤 답 1 로 끝난다', () => {
    const onDone = vi.fn()
    const onVoice = vi.fn()
    render(<LogoScreen onDone={onDone} onVoice={onVoice} />)
    fireEvent.keyDown(window, { key: 'Enter' })
    act(() => {
      vi.advanceTimersByTime(millisecondsPerFrame() * 61)
    })
    expect(onVoice).toHaveBeenCalledTimes(1)
    expect(onDone).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(millisecondsPerFrame() * 40)
    })
    expect(onVoice).toHaveBeenCalledTimes(1)
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})
