// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { useEffect, useState } from 'react'
import { NariScreenPush } from '@/pages/management/ui/NariScreenPush'

afterEach(cleanup)

/** 자식 화면의 키 처리기 — 원본 142 키 0x13c30 자리 */
function KeyCount({ label }: { readonly label: string }) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    const onKeyDown = () => setCount((value) => value + 1)
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
  return (
    <p data-testid="키">
      {label}
      {count}
    </p>
  )
}

describe('NariScreenPush — 142 ↔ 143 화면 밀기', () => {
  it('밀기 동안은 새 화면도 키를 못 받는다 — 키 받기 0x10758 이 [eff+4] · [eff+0x10] 이 서 있으면 버린다', () => {
    const { rerender, getByTestId, getAllByTestId } = render(
      <NariScreenPush view="142">
        <KeyCount key="142" label="142:" />
      </NariScreenPush>,
    )
    fireEvent.keyDown(window, { key: '5' })
    expect(getByTestId('키').textContent).toBe('142:1')
    rerender(
      <NariScreenPush view="143:내팀">
        <KeyCount key="143" label="143:" />
      </NariScreenPush>,
    )
    fireEvent.keyDown(window, { key: '5' })
    // 떠 둔 앞 화면(복제)이 아니라 살아 있는 새 화면
    expect(getAllByTestId('키')[0].textContent).toBe('143:0')
  })

  it('화면이 바뀌면 앞 화면 복제를 겹쳐 밀고, 같은 화면이면 아무것도 안 건다', () => {
    const { container, rerender } = render(
      <NariScreenPush view="142">
        <p>경기 준비</p>
      </NariScreenPush>,
    )
    const host = container.querySelector('[aria-hidden]') as HTMLElement
    expect(host.childElementCount).toBe(0)
    rerender(
      <NariScreenPush view="143:내팀">
        <p>엔트리</p>
      </NariScreenPush>,
    )
    // 첫 프레임 — 옛 화면(142)의 복제가 겹친다. 방향 4 는 새 화면이 왼쪽 밖(−240)에서 들어온다
    expect(host.textContent).toBe('경기 준비')
    expect(host.style.transform).toContain('0px')
    expect((host.previousElementSibling as HTMLElement).style.transform).toContain('-240px')
  })
})
