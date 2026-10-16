// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import {
  SKIN_TICKER_STEP, resetSkinTickerCounter, skinTickerCounterValue, skinTickerTextXOf, useSkinTickerCounter,
} from '@/shared/lib/skinTicker/skinTicker'

afterEach(cleanup)

function 글({ tick }: { readonly tick: number }) {
  return <span data-counter={useSkinTickerCounter(tick)} />
}

describe('흐르는 글 0x5a8c8 · [skin+0x284]', () => {
  it('글 왼쪽 = x + w − c % (글폭 + w) — 오른쪽 끝에서 흘러 들어온다', () => {
    expect(skinTickerTextXOf(34, 170, 0, 30)).toBe(204)
    expect(skinTickerTextXOf(34, 170, 9, 30)).toBe(195)
    expect(skinTickerTextXOf(34, 170, 200, 30)).toBe(204)
  })

  it('그린 뒤 3 오르고, 다른 화면이 그려도 같은 칸을 잇는다 (앱에 하나)', () => {
    resetSkinTickerCounter()
    const 첫화면 = render(<글 tick={0} />)
    expect(첫화면.container.querySelector('span')?.dataset.counter).toBe('0')
    expect(skinTickerCounterValue()).toBe(SKIN_TICKER_STEP)
    첫화면.rerender(<글 tick={2} />)
    expect(skinTickerCounterValue()).toBe(SKIN_TICKER_STEP * 3)
    cleanup()
    const 둘째화면 = render(<글 tick={0} />)
    expect(둘째화면.container.querySelector('span')?.dataset.counter).toBe(String(SKIN_TICKER_STEP * 3))
  })

  it('한 그림에 글이 여럿이면(0x5b798 다섯 곳) 그림마다 3 × 개수만큼 오르고, 안 그린 그림(개수 0)은 안 오른다', () => {
    resetSkinTickerCounter()
    function 여러글({ tick, count }: { readonly tick: number; readonly count: number }) {
      return <span data-counter={useSkinTickerCounter(tick, count)} />
    }
    const 화면 = render(<여러글 tick={0} count={0} />)
    expect(skinTickerCounterValue()).toBe(0)
    화면.rerender(<여러글 tick={1} count={5} />)
    expect(화면.container.querySelector('span')?.dataset.counter).toBe('0')
    expect(skinTickerCounterValue()).toBe(SKIN_TICKER_STEP * 5)
    화면.rerender(<여러글 tick={2} count={5} />)
    expect(화면.container.querySelector('span')?.dataset.counter).toBe(String(SKIN_TICKER_STEP * 5))
    expect(skinTickerCounterValue()).toBe(SKIN_TICKER_STEP * 10)
  })
})
