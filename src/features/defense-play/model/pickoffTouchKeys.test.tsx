// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { pickoffCommandOf } from '@/entities/defense-controls/model/defenseKeys'
import { PICKOFF_KEY_OF_BASE, pickoffTouchOffersOf, usePickoffTouchKeys } from '@/features/defense-play/model/pickoffTouchKeys'
import { resetTouchKeyOffersForTest, touchKeyOffersNow } from '@/shared/lib/touchKeyOffer/touchKeyOffer'

afterEach(() => {
  cleanup()
  act(() => resetTouchKeyOffersForTest())
})

function Probe({ isAccepting, bases }: { readonly isAccepting: boolean; readonly bases: { first: boolean; second: boolean; third: boolean } }) {
  usePickoffTouchKeys(isAccepting, bases)
  return null
}

describe('견제 상황 버튼', () => {
  it('키는 원본 견제 표(0x53548)와 같다 — 버튼 키를 견제 해석기에 넣으면 그 루가 나온다', () => {
    for (const base of [1, 2, 3] as const) {
      expect(pickoffCommandOf(PICKOFF_KEY_OF_BASE[base])).toEqual({ kind: '견제', base })
    }
  })

  it('주자가 있는 루만, 1루 · 2루 · 3루 차례', () => {
    expect(pickoffTouchOffersOf({ first: true, second: false, third: true })).toEqual([
      { key: '3', label: '1루 견제' },
      { key: '7', label: '3루 견제' },
    ])
    expect(pickoffTouchOffersOf({ first: false, second: false, third: false })).toEqual([])
  })

  it('견제를 받는 동안만 알리고, 주자가 바뀌면 따라간다', () => {
    const { rerender } = render(<Probe isAccepting={false} bases={{ first: true, second: true, third: true }} />)
    expect(touchKeyOffersNow()).toEqual([])
    rerender(<Probe isAccepting bases={{ first: false, second: true, third: true }} />)
    expect(touchKeyOffersNow().map((offer) => offer.label)).toEqual(['2루 견제', '3루 견제'])
    rerender(<Probe isAccepting bases={{ first: true, second: false, third: false }} />)
    expect(touchKeyOffersNow().map((offer) => offer.label)).toEqual(['1루 견제'])
    rerender(<Probe isAccepting={false} bases={{ first: true, second: false, third: false }} />)
    expect(touchKeyOffersNow()).toEqual([])
  })
})
