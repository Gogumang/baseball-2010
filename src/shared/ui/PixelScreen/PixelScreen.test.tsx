// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { PixelScreen } from '@/shared/ui/PixelScreen/PixelScreen'

afterEach(cleanup)

/** jsdom 은 실제 레이아웃을 하지 않아 스크롤 치수를 손으로 넣어 준다 */
function 본문치수(container: HTMLElement, clientHeight: number, scrollHeight: number) {
  // 감싸개(bodyWrapper)가 아니라 그 안의 스크롤되는 본문이다
  const wrapper = container.querySelector('[class*="bodyWrapper"]') as HTMLElement
  const body = wrapper.firstElementChild as HTMLElement
  Object.defineProperty(body, 'clientHeight', { value: clientHeight, configurable: true })
  Object.defineProperty(body, 'scrollHeight', { value: scrollHeight, configurable: true })
  return body
}

describe('PixelScreen — 잘린 글을 알려 주는 표시', () => {
  it('내용이 넘치면 아래 화살표가 뜬다 — 스크롤바를 숨겨 잘린 것처럼 보이던 문제', () => {
    const { container, rerender } = render(<PixelScreen title="경기 결과">긴 내용</PixelScreen>)
    본문치수(container, 100, 400)
    rerender(<PixelScreen title="경기 결과">긴 내용 </PixelScreen>)

    expect(screen.queryByLabelText('아래에 더 있습니다')).not.toBeNull()
  })

  it('내용이 다 보이면 화살표가 없다', () => {
    const { container, rerender } = render(<PixelScreen title="경기 결과">짧은 내용</PixelScreen>)
    본문치수(container, 400, 400)
    rerender(<PixelScreen title="경기 결과">짧은 내용 </PixelScreen>)

    expect(screen.queryByLabelText('아래에 더 있습니다')).toBeNull()
  })

  it('제목과 소프트키는 그대로 그린다', () => {
    render(
      <PixelScreen title="경기 결과" badge="1 / 2" leftKey={{ label: '확인', onPress: () => {} }}>
        내용
      </PixelScreen>,
    )

    expect(screen.getByText('경기 결과')).toBeTruthy()
    expect(screen.getByText('1 / 2')).toBeTruthy()
    expect(screen.getByRole('button', { name: '확인' })).toBeTruthy()
  })
})
