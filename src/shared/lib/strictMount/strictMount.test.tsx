// @vitest-environment jsdom
import { StrictMode, useState } from 'react'
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { mountOnce } from '@/shared/lib/strictMount/strictMount'

/** 초기화 함수가 불린 횟수를 세는 컴포넌트 — 칸 둘 */
function makeCounter() {
  const calls: string[] = []
  function Counter({ id }: { readonly id: string }) {
    const [first] = useState(() =>
      mountOnce('시험.첫칸', () => {
        calls.push(`${id}:첫칸`)
        return calls.length
      }),
    )
    const [second] = useState(() =>
      mountOnce('시험.둘째칸', () => {
        calls.push(`${id}:둘째칸`)
        return calls.length
      }),
    )
    return <span data-testid={id}>{`${first},${second}`}</span>
  }
  return { calls, Counter }
}

describe('mountOnce — 마운트 초기화를 한 번만 부른다 (r231)', () => {
  it('StrictMode 의 두 번째 마운트 그림은 첫 그림의 값을 받는다', () => {
    const { calls, Counter } = makeCounter()
    const view = render(
      <StrictMode>
        <Counter id="가" />
      </StrictMode>,
    )
    expect(calls).toEqual(['가:첫칸', '가:둘째칸'])
    expect(view.getByTestId('가').textContent).toBe('1,2')
  })

  it('StrictMode 가 아니어도 한 번이다', () => {
    const { calls, Counter } = makeCounter()
    render(<Counter id="가" />)
    expect(calls).toEqual(['가:첫칸', '가:둘째칸'])
  })

  it('같은 컴포넌트 둘 · 다시 마운트는 저마다 새로 부른다', () => {
    const { calls, Counter } = makeCounter()
    const view = render(
      <StrictMode>
        <Counter id="가" />
        <Counter id="나" />
      </StrictMode>,
    )
    expect(calls).toEqual(['가:첫칸', '가:둘째칸', '나:첫칸', '나:둘째칸'])
    view.rerender(
      <StrictMode>
        <Counter id="가" key="다시" />
      </StrictMode>,
    )
    expect(calls).toEqual(['가:첫칸', '가:둘째칸', '나:첫칸', '나:둘째칸', '가:첫칸', '가:둘째칸'])
  })
})
