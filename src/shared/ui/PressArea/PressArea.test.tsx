// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { inputTimeOf } from '@/shared/lib/sceneKeyLatch/shownSceneTicks'
import { PressArea } from '@/shared/ui/PressArea/PressArea'

/**
 * **누름 칸은 닿은 시각을 사건에 붙여 넘긴다** (r222). 누름(onPress)은 떼는 click 에 나가지만, 키패드 키가 누를 때 keydown 이듯 사람이
 * 누른 때는 손가락 · 마우스가 닿은 때(pointerdown)다. 받는 쪽은 키 사건과 같은 길(`inputTimeOf`)로 그 시각에 본 그림의 틱을 센다.
 */
afterEach(cleanup)

/** 사건 시각(`timeStamp`)을 정한 사건 — jsdom 은 사건 시각을 마음대로 못 준다 */
const 시각 = (time: number) => (event: Event) => Object.defineProperty(event, 'timeStamp', { value: time })

describe('PressArea — 누름 사건 시각', () => {
  it('닿은 뒤 뗀 click — 받는 쪽 inputTimeOf 는 닿은 시각', () => {
    const 받음 = vi.fn<(event: Event) => void>()
    render(<PressArea label="게이지" onPress={받음} />)
    const 칸 = screen.getByRole('button', { name: '게이지' })
    const 지금 = performance.now()
    const 닿음 = new Event('pointerdown', { bubbles: true })
    시각(지금 - 120)(닿음)
    fireEvent(칸, 닿음)
    fireEvent.click(칸, { detail: 1 })
    expect(받음).toHaveBeenCalledTimes(1)
    const event = 받음.mock.calls[0]?.[0]
    expect(event?.type).toBe('click')
    expect(inputTimeOf(event, 지금)).toBe(지금 - 120)
  })

  it('키보드로 누른 click(detail 0) · 닿음 없는 click — click 사건 자체의 시각(앞 닿음을 끌어오지 않는다)', () => {
    const 받음 = vi.fn<(event: Event) => void>()
    render(<PressArea label="확인" onPress={받음} />)
    const 칸 = screen.getByRole('button', { name: '확인' })
    const 지금 = performance.now()
    const 닿음 = new Event('pointerdown', { bubbles: true })
    시각(지금 - 500)(닿음)
    fireEvent(칸, 닿음)
    const 키클릭 = new MouseEvent('click', { bubbles: true, detail: 0 })
    시각(지금 - 3)(키클릭)
    fireEvent(칸, 키클릭)
    expect(inputTimeOf(받음.mock.calls[0]?.[0], 지금)).toBe(지금 - 3)
    // 닿은 시각은 한 번만 쓴다 — 다음 click 은 제 시각
    const 다음 = new MouseEvent('click', { bubbles: true, detail: 1 })
    시각(지금 - 1)(다음)
    fireEvent(칸, 다음)
    expect(inputTimeOf(받음.mock.calls[1]?.[0], 지금)).toBe(지금 - 1)
  })
})
