// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { ManagerHookWindow } from '@/pages/pitching/ui/ManagerHookWindow'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('감독 강판 대사 창 키 0x50794', () => {
  it('상자가 올라오는 중엔 OK 를 버리고, 글을 찍는 중엔 다 보이고, 다 찍힌 뒤 OK 로 닫는다', () => {
    vi.useFakeTimers()
    const onConfirm = vi.fn()
    render(<ManagerHookWindow userEventIndex={94} onConfirm={onConfirm} />)
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(onConfirm).not.toHaveBeenCalled()
    // 0 → 55 는 15 씩 네 틱, 그다음 글 세 자
    act(() => void vi.advanceTimersByTime(millisecondsPerFrame() * 5))
    fireEvent.keyDown(window, { key: '5' })
    expect(onConfirm).not.toHaveBeenCalled()
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('마우스는 창 자리 투명 누름 칸으로 같은 OK 를 보낸다', () => {
    vi.useFakeTimers()
    const onConfirm = vi.fn()
    render(<ManagerHookWindow userEventIndex={94} onConfirm={onConfirm} />)
    act(() => void vi.advanceTimersByTime(millisecondsPerFrame() * 5))
    fireEvent.click(screen.getByRole('button', { name: '확인' }))
    fireEvent.click(screen.getByRole('button', { name: '확인' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })
})
