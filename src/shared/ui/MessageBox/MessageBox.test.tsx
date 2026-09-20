// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MessageBox } from '@/shared/ui/MessageBox/MessageBox'

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
