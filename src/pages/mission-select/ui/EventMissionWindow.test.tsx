// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { EventMissionWindow } from '@/pages/mission-select/ui/EventMissionWindow'
import { resetTouchKeyOffersForTest, touchKeyOffersNow } from '@/shared/lib/touchKeyOffer/touchKeyOffer'

afterEach(() => {
  cleanup()
  resetTouchKeyOffersForTest()
  vi.useRealTimers()
})

const 취소버튼 = () => touchKeyOffersNow().find((offer) => offer.key === 'Escape')

describe('이벤트 미션 창 — 터치 CLR (r194)', () => {
  it("창 그림에 CLR 글자 자리가 없어 다 펼친 뒤 '취소' 상황 버튼(Escape)을 내고, 누르면 CLR 과 같이 취소로 닫는다", () => {
    vi.useFakeTimers()
    const onKey = vi.fn()
    const onClosed = vi.fn()
    render(<EventMissionWindow isRunSelected onToggle={vi.fn()} onKey={onKey} onClosed={onClosed} />)
    // 펼치는 동안은 키를 안 받는다(0x75556) — 버튼도 없다
    expect(취소버튼()).toBeUndefined()
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(취소버튼()).toEqual({ key: 'Escape', label: '취소' })

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onKey).toHaveBeenCalledWith('취소')
    // 줄이는 동안부터 걷는다
    expect(취소버튼()).toBeUndefined()
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(onClosed).toHaveBeenCalledTimes(1)
  })
})
