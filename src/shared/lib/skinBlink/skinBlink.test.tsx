// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { resetSkinBlinkCounter, skinBlinkCounterValue, useSkinBlinkCounter } from '@/shared/lib/skinBlink/skinBlink'

afterEach(cleanup)

function 판({ tick, perDraw = 1 }: { readonly tick: number; readonly perDraw?: number }) {
  return <span data-counter={useSkinBlinkCounter(tick, perDraw)} />
}
const counterOf = (container: HTMLElement) => Number(container.querySelector('span')?.dataset.counter)

describe('깜빡임 카운터 [skin+0x410] (U-90)', () => {
  it('앱을 켜면 0 — 첫 그림은 올린 뒤의 값 1 을 본다 (0x593ce~0x593dc)', () => {
    resetSkinBlinkCounter()
    const 화면 = render(<판 tick={0} />)
    expect(counterOf(화면.container)).toBe(1)
    expect(skinBlinkCounterValue()).toBe(1)
    화면.rerender(<판 tick={3} />)
    expect(counterOf(화면.container)).toBe(4)
  })

  it('화면을 건너 이어진다 — 다음 화면은 앞 화면이 남긴 값에서 센다', () => {
    resetSkinBlinkCounter()
    const 기록연감 = render(<판 tick={0} />)
    기록연감.rerender(<판 tick={4} />)
    cleanup()
    const 환경설정 = render(<판 tick={0} />)
    expect(counterOf(환경설정.container)).toBe(6)
  })

  it('바닥비트 0x40 이 없는 머리띠(perDraw 0)는 올리지 않는다 (0x553ec tst)', () => {
    resetSkinBlinkCounter()
    const 머리띠 = render(<판 tick={0} perDraw={0} />)
    머리띠.rerender(<판 tick={5} perDraw={0} />)
    expect(skinBlinkCounterValue()).toBe(0)
    머리띠.rerender(<판 tick={6} perDraw={1} />)
    expect(skinBlinkCounterValue()).toBe(1)
  })
})
