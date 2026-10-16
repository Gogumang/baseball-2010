// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import {
  InputMethodText, inputBufferTextOf, resetCursorBlinkCountForTest,
} from '@/shared/ui/InputMethodText/InputMethodText'
import { millisecondsPerFrame } from '@/shared/config/frameRate'

afterEach(cleanup)

describe('inputBufferTextOf — 0x677d4 의 커서 덧붙이기', () => {
  it('커서가 켜져 있으면 (셈 / 5) & 1 일 때만 \'|\' 를 붙인다 (0x672f4)', () => {
    expect([0, 4, 5, 9, 10, 15].map((counter) => inputBufferTextOf('Kim', true, counter)))
      .toEqual(['Kim', 'Kim', 'Kim|', 'Kim|', 'Kim', 'Kim|'])
  })

  it('커서 인자가 꺼져 있으면 붙이지 않는다', () => {
    expect(inputBufferTextOf('Kim', false, 5)).toBe('Kim')
  })
})

describe('InputMethodText', () => {
  it('글은 원본 글꼴(PixelText)로 (x, y) 왼쪽 위에 찍고 영문은 6px 마다 전진한다', () => {
    render(<InputMethodText value="Kim" x={62} y={204} color="rgb(255, 255, 0)" isCursorOn={false}
      inputRect={{ x: 60, y: 201, width: 81, height: 15 }} aria-label="이름" onChange={() => {}} />)
    const text = screen.getByRole('img', { name: 'Kim' })
    expect(text.style.left).toBe('62px')
    expect(text.style.top).toBe('204px')
    const lefts = Array.from(text.querySelectorAll('span')).map((piece) => piece.style.left)
    expect(lefts).toEqual(['0px', '6px', '12px'])
  })

  it('입력 칸은 값을 들고 있되 글은 그리지 않는다 (투명)', () => {
    render(<InputMethodText value="Kim" x={62} y={204} color="rgb(255, 255, 0)" isCursorOn={false}
      inputRect={{ x: 60, y: 201, width: 81, height: 15 }} aria-label="이름" onChange={() => {}} />)
    const input = screen.getByLabelText<HTMLInputElement>('이름')
    expect(input.value).toBe('Kim')
    expect(input.style.left).toBe('60px')
    expect(input.style.width).toBe('81px')
  })

  describe('깜빡임 셈 [0x1552d80] — 앱 전체에 하나, 먼저 올리고 나눈다 (0x672f4)', () => {
    afterEach(() => {
      vi.useRealTimers()
      resetCursorBlinkCountForTest()
    })

    it('처음 그림이 셈 1 — 다섯째 그림(셈 5)에 \'|\' 가 붙고, 다음 칸은 앞 칸의 셈을 이어 받는다', () => {
      vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })
      resetCursorBlinkCountForTest()
      const props = { x: 62, y: 204, color: 'rgb(255, 255, 0)', inputRect: { x: 60, y: 201, width: 81, height: 15 } }
      const first = render(<InputMethodText value="Kim" {...props} isCursorOn aria-label="이름" onChange={() => {}} />)
      const frame = millisecondsPerFrame()
      // 그림 0 ~ 3 = 셈 1 ~ 4
      act(() => {
        vi.advanceTimersByTime(3 * frame + 20)
      })
      expect(screen.queryByRole('img', { name: 'Kim|' })).toBeNull()
      // 그림 4 = 셈 5
      act(() => {
        vi.advanceTimersByTime(frame)
      })
      expect(screen.getByRole('img', { name: 'Kim|' })).toBeTruthy()
      first.unmount()
      // 새 칸 — 셈 6 부터라 첫 그림부터 '|' 다
      render(<InputMethodText value="Lee" {...props} isCursorOn aria-label="이름" onChange={() => {}} />)
      act(() => {
        vi.advanceTimersByTime(20)
      })
      expect(screen.getByRole('img', { name: 'Lee|' })).toBeTruthy()
    })
  })
})
