// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MessageBox } from '@/shared/ui/MessageBox/MessageBox'
import { millisecondsPerFrame } from '@/shared/config/frameRate'

/**
 * 메시지 상자 (0x74ef4 배치 · F-1).
 * 버튼은 글자가 아니라 `ui/popup.pzx` 프레임 그림이다 — 알림 0 "OK", 예/아니오 1·2, 고르면 6·7.
 */

afterEach(cleanup)

const 그림 = (name: string) => screen.getByRole('button', { name }).querySelector('img')

describe('메시지 상자 버튼 — popup.pzx 프레임', () => {
  it('알림은 프레임 0 "OK" 한 장뿐이다 — "확인" 글자가 아니다', () => {
    render(<MessageBox text="알림" buttons={['확인']} onAnswer={vi.fn()} />)

    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(그림('확인')?.getAttribute('src')).toContain('popup/frames/000.png')
  })

  it('예/아니오는 비선택 1·2 이고, 고른 칸만 주황 그림 6·7 로 바뀐다', () => {
    render(<MessageBox text="질문" buttons={['예', '아니오']} onAnswer={vi.fn()} />)

    // 처음 고른 칸은 [예]
    expect(그림('예')?.getAttribute('src')).toContain('popup/frames/006.png')
    expect(그림('아니오')?.getAttribute('src')).toContain('popup/frames/002.png')

    fireEvent.keyDown(window, { key: 'ArrowRight' })

    expect(그림('예')?.getAttribute('src')).toContain('popup/frames/001.png')
    expect(그림('아니오')?.getAttribute('src')).toContain('popup/frames/007.png')
  })

  it('고른 그림은 원점이 (−4,−4) 라 사방 4px 넘쳐 그려진다', () => {
    render(<MessageBox text="질문" buttons={['예', '아니오']} onAnswer={vi.fn()} />)

    expect(그림('예')?.getAttribute('style')).toContain('-4px')
  })

  it('Enter 는 고른 칸, Escape 는 마지막 칸을 답으로 준다', () => {
    const onAnswer = vi.fn()
    render(<MessageBox text="질문" buttons={['예', '아니오']} onAnswer={onAnswer} />)

    fireEvent.keyDown(window, { key: 'Enter' })
    expect(onAnswer).toHaveBeenCalledWith(0)
  })

  it('Escape 는 마지막 칸이다 — 예/아니오면 [아니오]', () => {
    const onAnswer = vi.fn()
    render(<MessageBox text="질문" buttons={['예', '아니오']} onAnswer={onAnswer} />)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onAnswer).toHaveBeenCalledWith(1)
  })
})

/**
 * 열림·닫힘 애니메이션 (F-1 1-4 확정).
 * jsdom 은 레이아웃이 없어 `offsetHeight` 가 0 이다 — 그때는 애니메이션을 건너뛰고
 * 답을 그 자리에서 넘긴다(기존 호출 계약). 아래 두 묶음은 높이를 흉내 내 애니메이션을 켠다.
 */
const 상자 = () => document.querySelector('[role="dialog"] > div') as HTMLElement
/** 펼치는 동안에는 visibility 가 hidden 이라 byRole 로 못 찾는다 — DOM 으로 직접 본다 */
const 버튼줄 = () => 상자().lastElementChild as HTMLElement

function 높이를_잴_수_있게(height: number) {
  const 원래 = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => height })
  return () => {
    if (원래 === undefined) Reflect.deleteProperty(HTMLElement.prototype, 'offsetHeight')
    else Object.defineProperty(HTMLElement.prototype, 'offsetHeight', 원래)
  }
}

describe('메시지 상자 애니메이션', () => {
  it('레이아웃이 없으면 애니메이션 없이 곧바로 답한다 — 기존 호출이 안 깨진다', () => {
    const onAnswer = vi.fn()
    render(<MessageBox text="알림" buttons={['확인']} onAnswer={onAnswer} />)

    expect(상자().style.height).toBe('')
    fireEvent.click(screen.getByRole('button', { name: '확인' }))
    expect(onAnswer).toHaveBeenCalledWith(0)
  })

  it('글만 바뀌면 새 상자라 [OK] 가 다시 먹힌다 (안내가 잇달아 뜨는 화면들)', () => {
    const onAnswer = vi.fn()
    const { rerender } = render(<MessageBox text="첫 안내" buttons={['확인']} onAnswer={onAnswer} />)

    fireEvent.click(screen.getByRole('button', { name: '확인' }))
    rerender(<MessageBox text="둘째 안내" buttons={['확인']} onAnswer={onAnswer} />)
    fireEvent.click(screen.getByRole('button', { name: '확인' }))

    expect(onAnswer).toHaveBeenCalledTimes(2)
  })

  it('한 상자에는 한 번만 답한다 — 두 번 눌러도 한 번이다', () => {
    const onAnswer = vi.fn()
    render(<MessageBox text="알림" buttons={['확인']} onAnswer={onAnswer} />)

    fireEvent.click(screen.getByRole('button', { name: '확인' }))
    fireEvent.click(screen.getByRole('button', { name: '확인' }))

    expect(onAnswer).toHaveBeenCalledTimes(1)
  })

  it('열림은 높이 10 에서 시작해 매 틱 ×2 로 펼쳐지고, 펼치는 동안 글·버튼을 안 그린다', () => {
    const 되돌리기 = 높이를_잴_수_있게(79)
    vi.useFakeTimers()
    try {
      render(<MessageBox text="질문" buttons={['예', '아니오']} onAnswer={vi.fn()} />)

      expect(상자().style.height).toBe('10px')
      expect(버튼줄().style.visibility).toBe('hidden')

      act(() => void vi.advanceTimersByTime(millisecondsPerFrame()))
      expect(상자().style.height).toBe('20px')
      act(() => void vi.advanceTimersByTime(millisecondsPerFrame()))
      expect(상자().style.height).toBe('40px')

      // 40×2 = 80 ≥ 79 라 목표 높이로 맞추고 애니메이션이 끝난다
      act(() => void vi.advanceTimersByTime(millisecondsPerFrame()))
      expect(상자().style.height).toBe('')
      expect(버튼줄().style.visibility).toBe('')
    } finally {
      vi.useRealTimers()
      되돌리기()
    }
  })

  it('닫힘은 폭을 매 틱 ÷2 하고 99 이하가 되면 그때 답을 넘긴다 (240→120→60)', () => {
    const 되돌리기 = 높이를_잴_수_있게(79)
    vi.useFakeTimers()
    const onAnswer = vi.fn()
    try {
      render(<MessageBox text="질문" buttons={['예', '아니오']} onAnswer={onAnswer} />)
      // 먼저 다 펼친다
      act(() => void vi.advanceTimersByTime(millisecondsPerFrame() * 3))

      fireEvent.keyDown(window, { key: 'Enter' })
      expect(onAnswer).not.toHaveBeenCalled()
      expect(상자().style.width).toBe('240px')

      act(() => void vi.advanceTimersByTime(millisecondsPerFrame()))
      expect(상자().style.width).toBe('120px')
      expect(onAnswer).not.toHaveBeenCalled()

      act(() => void vi.advanceTimersByTime(millisecondsPerFrame()))
      expect(상자().style.width).toBe('60px')
      expect(onAnswer).toHaveBeenCalledWith(0)

      // 한 번 넘긴 뒤에는 더 부르지 않는다
      act(() => void vi.advanceTimersByTime(millisecondsPerFrame() * 3))
      expect(onAnswer).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
      되돌리기()
    }
  })
})
