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
    // 키는 받은 다음 틀의 상태 키 자리(52e10)에서 — 글을 다 보이고
    act(() => void vi.advanceTimersByTime(millisecondsPerFrame()))
    expect(onConfirm).not.toHaveBeenCalled()
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(onConfirm).not.toHaveBeenCalled()
    act(() => void vi.advanceTimersByTime(millisecondsPerFrame()))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('한 틀에 OK 가 둘 오면 받은 칸 [+0x20] 에는 하나만 남는다 — 글을 다 보이기만 한다', () => {
    vi.useFakeTimers()
    const onConfirm = vi.fn()
    render(<ManagerHookWindow userEventIndex={94} onConfirm={onConfirm} />)
    act(() => void vi.advanceTimersByTime(millisecondsPerFrame() * 5))
    fireEvent.keyDown(window, { key: '5' })
    fireEvent.keyDown(window, { key: '5' })
    act(() => void vi.advanceTimersByTime(millisecondsPerFrame() * 2))
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('마우스는 창 자리 투명 누름 칸으로 같은 OK 를 보낸다', () => {
    vi.useFakeTimers()
    const onConfirm = vi.fn()
    render(<ManagerHookWindow userEventIndex={94} onConfirm={onConfirm} />)
    act(() => void vi.advanceTimersByTime(millisecondsPerFrame() * 5))
    fireEvent.click(screen.getByRole('button', { name: '확인' }))
    act(() => void vi.advanceTimersByTime(millisecondsPerFrame()))
    fireEvent.click(screen.getByRole('button', { name: '확인' }))
    act(() => void vi.advanceTimersByTime(millisecondsPerFrame()))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })
})
