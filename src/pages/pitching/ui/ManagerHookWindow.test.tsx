// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { ManagerHookWindow } from '@/pages/pitching/ui/ManagerHookWindow'
import { layoutDialogue } from '@/pages/story/lib/eventDialogue'
import { ORIGINAL_USER_EVENTS } from '@/shared/config/original/userEvents'

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
    fireEvent.click(screen.getByRole('button', { name: '대사 넘기기' }))
    act(() => void vi.advanceTimersByTime(millisecondsPerFrame()))
    fireEvent.click(screen.getByRole('button', { name: '대사 넘기기' }))
    act(() => void vi.advanceTimersByTime(millisecondsPerFrame()))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('상자는 공용 대사 창 0x7fbc4 — 다 올라온 그 그림부터 3 바이트씩 찍고, 머리글은 "[감독님] : " 이다 (r334)', () => {
    vi.useFakeTimers()
    render(<ManagerHookWindow userEventIndex={94} onConfirm={() => {}} />)
    const box = screen.getByTestId('대사-상자')
    expect(box.dataset.text).toBe(`[감독님] : ${ORIGINAL_USER_EVENTS[94]}`)
    // 진입 그림 15 → 30 → 45 → 55: 넷째 그림(틱 3)이 다 올라오며 곧바로 글을 찍는다 — 머리 "[" 와 마크업 8 바이트 안이라 아직 글자는 "[" 하나
    act(() => void vi.advanceTimersByTime(millisecondsPerFrame() * 2))
    expect(box.querySelectorAll('[data-part="글줄"]')).toHaveLength(0)
    act(() => void vi.advanceTimersByTime(millisecondsPerFrame()))
    expect(box.querySelector('[data-part="글줄"]')?.textContent).toBe('[')
  })

  it('감독 대사는 모두 한 쪽(3줄) 안이다 — 쪽 넘김(단계 3 → 0x7f7f4)은 안 나온다', () => {
    for (let index = 85; index <= 96; index += 1) {
      expect(layoutDialogue(`[!c00CC00감독님!cFFFFFF] : ${ORIGINAL_USER_EVENTS[index]}`).lines.length).toBeLessThanOrEqual(3)
    }
  })
})
