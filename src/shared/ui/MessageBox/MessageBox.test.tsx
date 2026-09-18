// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { MessageBox } from '@/shared/ui/MessageBox/MessageBox'

/**
 * 메시지 상자는 화면을 덮는 창이다 — 열려 있는 동안 키는 상자가 가져가야 한다.
 * 뒤쪽 메뉴가 같은 Enter 를 같이 받으면 상자를 눌러 닫을 수 없다.
 */

afterEach(cleanup)

const pressKey = (key: string) => fireEvent.keyDown(window, { key })

describe('메시지 상자 키 조작', () => {
  it('Enter 는 고른 버튼을 누른다 — 처음 고른 것은 첫 버튼이다', () => {
    const onAnswer = vi.fn()
    render(<MessageBox text="!C물어봅니다" buttons={['예', '아니오']} onAnswer={onAnswer} />)

    pressKey('Enter')

    expect(onAnswer).toHaveBeenCalledWith(0)
  })

  it('좌우 키로 버튼을 옮긴다', () => {
    const onAnswer = vi.fn()
    render(<MessageBox text="!C물어봅니다" buttons={['예', '아니오']} onAnswer={onAnswer} />)

    pressKey('ArrowRight')
    pressKey('Enter')

    expect(onAnswer).toHaveBeenCalledWith(1)
  })

  it('Escape 는 마지막 버튼(아니오·확인)을 누른다', () => {
    const onAnswer = vi.fn()
    render(<MessageBox text="!C물어봅니다" buttons={['예', '아니오']} onAnswer={onAnswer} />)

    pressKey('Escape')

    expect(onAnswer).toHaveBeenCalledWith(1)
  })

  it('버튼이 하나면 Enter·Escape 모두 그 버튼이다', () => {
    const onAnswer = vi.fn()
    render(<MessageBox text="!C알립니다" buttons={['확인']} onAnswer={onAnswer} />)

    pressKey('Escape')

    expect(onAnswer).toHaveBeenCalledWith(0)
  })

  it('한 번 답하면 더 받지 않는다 — 키를 길게 눌러 두 번 답해지지 않게', () => {
    const onAnswer = vi.fn()
    render(<MessageBox text="!C물어봅니다" buttons={['예', '아니오']} onAnswer={onAnswer} />)

    pressKey('Enter')
    pressKey('Enter')

    expect(onAnswer, `불린 횟수: ${onAnswer.mock.calls.length}`).toHaveBeenCalledTimes(1)
  })
})
