import { act, fireEvent as rawFireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import { millisecondsPerFrame } from '@/shared/config/frameRate'

/**
 * **시험 전용** — 커맨드 줄 칸이 펼쳐지는 동안(나리 105 · 106 · 107 · 110 [gfx+0x99] · [+0x9a], 시즌 0xc9 [+0x99]) 원본은 키 · 누름을
 * 버린다(t < 7, A-50). 화면 흐름 시험은 칸이 다 선 뒤의 조작을 보므로, 누르기 전에 앱 틱을 펼침 틀 수만큼 돌린다.
 * 앱 틱은 `requestAnimationFrame` · `performance` 를 가짜 시계로 돌려야 넘어간다(`useSlideSettledClock`).
 */
export const SLIDE_SETTLE_FRAMES = 8

/** 앱 틱을 펼침이 끝날 만큼 넘긴다 */
export function settleSlide(frames = SLIDE_SETTLE_FRAMES): void {
  act(() => {
    vi.advanceTimersByTime(millisecondsPerFrame() * frames)
  })
}

/** 앱 틱 시계(rAF · performance)만 가짜로 — setTimeout · setInterval 은 그대로라 다른 기다림은 안 바뀐다 */
export function fakeAppTickClock(): void {
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })
}

/** 누르기 · 키 전에 펼침을 끝내는 `fireEvent` — 나머지 사건은 그대로 */
export const settledFireEvent: typeof rawFireEvent = Object.assign(
  ((element: Document | Element | Window | Node, event: Event) => rawFireEvent(element, event)) as typeof rawFireEvent,
  rawFireEvent,
  {
    click: (...args: Parameters<typeof rawFireEvent.click>) => {
      settleSlide()
      return rawFireEvent.click(...args)
    },
    keyDown: (...args: Parameters<typeof rawFireEvent.keyDown>) => {
      settleSlide()
      return rawFireEvent.keyDown(...args)
    },
  },
)
