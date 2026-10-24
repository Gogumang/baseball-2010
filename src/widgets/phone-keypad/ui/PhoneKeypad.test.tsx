// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PhoneKeypad } from '@/widgets/phone-keypad/ui/PhoneKeypad'
import { KEY_REPEAT_DELAY, KEY_REPEAT_INTERVAL } from '@/widgets/phone-keypad/lib/phoneKeys'

/** jsdom 에는 PointerEvent 가 없다 — 단추(button) · pointerId 를 싣게 MouseEvent 로 흉내 낸다 */
if (typeof window.PointerEvent === 'undefined') {
  class TestPointerEvent extends MouseEvent {
    readonly pointerId: number
    readonly pointerType: string
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init)
      this.pointerId = init.pointerId ?? 0
      this.pointerType = init.pointerType ?? ''
    }
  }
  Object.assign(window, { PointerEvent: TestPointerEvent })
}

interface Seen { readonly type: string; readonly key: string; readonly repeat: boolean; readonly target: EventTarget | null }

let seen: Seen[] = []
const record = (event: KeyboardEvent) => {
  seen.push({ type: event.type, key: event.key, repeat: event.repeat, target: event.target })
}

beforeEach(() => {
  seen = []
  vi.useFakeTimers()
  window.addEventListener('keydown', record)
  window.addEventListener('keyup', record)
})

afterEach(() => {
  window.removeEventListener('keydown', record)
  window.removeEventListener('keyup', record)
  cleanup()
  vi.useRealTimers()
})

describe('PhoneKeypad — 키보드와 같은 길', () => {
  it('누르면 keydown, 떼면 keyup — window 에서 받는다', () => {
    render(<PhoneKeypad />)
    const ok = screen.getByRole('button', { name: '확인' })
    fireEvent.pointerDown(ok, { pointerId: 1, pointerType: 'touch' })
    expect(seen).toEqual([{ type: 'keydown', key: 'Enter', repeat: false, target: document.body }])
    fireEvent.pointerUp(ok, { pointerId: 1, pointerType: 'touch' })
    expect(seen.map((event) => `${event.type}:${event.key}`)).toEqual(['keydown:Enter', 'keyup:Enter'])
  })

  it('번트 키 8 은 누르고 있는 동안 keyup 이 없다 — 길게 누르면 키보드처럼 repeat keydown', () => {
    render(<PhoneKeypad />)
    const eight = screen.getByRole('button', { name: '8' })
    fireEvent.pointerDown(eight, { pointerId: 3, pointerType: 'touch' })
    vi.advanceTimersByTime(KEY_REPEAT_DELAY + 2 * KEY_REPEAT_INTERVAL)
    expect(seen.every((event) => event.type === 'keydown' && event.key === '8')).toBe(true)
    expect(seen[0]?.repeat).toBe(false)
    expect(seen.slice(1).length).toBe(2)
    expect(seen.slice(1).every((event) => event.repeat)).toBe(true)
    fireEvent.pointerCancel(eight, { pointerId: 3, pointerType: 'touch' })
    expect(seen.at(-1)).toMatchObject({ type: 'keyup', key: '8' })
    // 뗀 뒤로는 되풀이가 멈춘다 · keyup 은 한 번
    vi.advanceTimersByTime(1000)
    expect(seen.filter((event) => event.type === 'keyup')).toHaveLength(1)
    fireEvent.lostPointerCapture(eight, { pointerId: 3, pointerType: 'touch' })
    expect(seen.filter((event) => event.type === 'keyup')).toHaveLength(1)
  })

  it('키 이름 — 방향 · CLR(Escape) · * · # · 숫자', () => {
    render(<PhoneKeypad />)
    for (const name of ['위', '아래', '왼쪽', '오른쪽', '취소', '별표', '샵', '0', '5']) {
      const button = screen.getByRole('button', { name })
      fireEvent.pointerDown(button, { pointerId: 9, pointerType: 'touch' })
      fireEvent.pointerUp(button, { pointerId: 9, pointerType: 'touch' })
    }
    expect(seen.filter((event) => event.type === 'keydown').map((event) => event.key))
      .toEqual(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Escape', '*', '#', '0', '5'])
  })

  it('입력칸에 초점이 있으면 키 사건도 그 칸으로 — 초점을 빼앗지 않는다', () => {
    render(<><input aria-label="이름" /><PhoneKeypad /></>)
    const input = screen.getByRole('textbox', { name: '이름' })
    input.focus()
    const clear = screen.getByRole('button', { name: '취소' })
    const notPrevented = fireEvent.pointerDown(clear, { pointerId: 2, pointerType: 'touch' })
    expect(notPrevented).toBe(false)
    expect(document.activeElement).toBe(input)
    expect(seen[0]).toMatchObject({ type: 'keydown', key: 'Escape', target: input })
    fireEvent.pointerUp(clear, { pointerId: 2, pointerType: 'touch' })
  })

  it('마우스 오른쪽 단추 · hover 로는 아무 키도 안 간다', () => {
    render(<PhoneKeypad />)
    const ok = screen.getByRole('button', { name: '확인' })
    fireEvent.pointerEnter(ok, { pointerType: 'mouse' })
    fireEvent.mouseEnter(ok)
    fireEvent.pointerDown(ok, { pointerId: 1, pointerType: 'mouse', button: 2 })
    expect(seen).toEqual([])
  })
})
