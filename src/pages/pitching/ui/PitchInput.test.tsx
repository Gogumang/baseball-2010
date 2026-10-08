// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { PitchGradeGauge } from '@/pages/pitching/ui/PitchGradeGauge'

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const 틱 = (n: number) => act(() => void vi.advanceTimersByTime(millisecondsPerFrame() * n))
const 키 = (key: string, repeat = false) => fireEvent.keyDown(window, { key, repeat })

describe('게이지 0x11 — 누름은 칸만 정하고 틱 10 에 놓는다', () => {
  it('안 누르면 틱 10 에 칸 0 으로 놓는다', () => {
    const onRelease = vi.fn()
    render(<PitchGradeGauge onRelease={onRelease} />)
    틱(9)
    expect(onRelease).not.toHaveBeenCalled()
    틱(1)
    expect(onRelease.mock.calls).toEqual([[0]])
  })

  it('커서 0 에서 누른 것은 무시되고 다시 누를 수 있다 — 정한 칸은 틱 10 에 넘어간다', () => {
    const onRelease = vi.fn()
    render(<PitchGradeGauge onRelease={onRelease} />)
    키('Enter')
    틱(6)
    키('5')
    // 정한 뒤 누름은 같은 칸을 다시 적을 뿐이다
    틱(2)
    키('Enter')
    expect(screen.getByLabelText('투구 게이지 6칸')).toBeTruthy()
    expect(onRelease).not.toHaveBeenCalled()
    틱(2)
    expect(onRelease.mock.calls).toEqual([[6]])
  })
})
