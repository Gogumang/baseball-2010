// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { gameSceneTickNow } from '@/shared/lib/commonWindow/commonWindow'
import { gameSceneShownTicks } from '@/shared/lib/sceneKeyLatch/shownSceneTicks'
import { PitchGradeGauge } from '@/pages/pitching/ui/PitchGradeGauge'
import { AimCursor } from '@/pages/pitching/ui/AimCursor'
import { ZONE_CENTERS } from '@/entities/pitching/model/pitchCurve'

/**
 * **게이지 · 조준 누름 칸도 키와 같은 길로 센다** (r222 — r217 `PitchInput.keyTick.test` 의 누름 칸 판).
 *
 * 마우스 · 손가락 누름은 떼는 click 에 나간다. 그 사이 장면은 한두 그림 더 그린다. 예전 누름 칸은 사건 시각을 안 넘겨 click 손잡이가 돈
 * 때의 지금 틱으로 셌다 — 닿은 때 본 칸보다 늦게 누른 것이 됐다. 이제 `PressArea` 가 닿은 시각을 click 사건에 붙이고, 게이지 · 조준이
 * 키 사건처럼 `inputTimeOf(event)` 로 그때 본 그림의 틱을 센다.
 */
beforeEach(() => {
  vi.useFakeTimers()
  gameSceneShownTicks.clear()
})
afterEach(() => {
  cleanup()
  gameSceneShownTicks.clear()
  vi.useRealTimers()
})

const 한틱 = millisecondsPerFrame()
const 흘림 = (ms: number) => act(() => void vi.advanceTimersByTime(ms))
const 그림 = () => gameSceneShownTicks.mark(gameSceneTickNow(), performance.now())
const 틀 = (n: number) => {
  for (let index = 0; index < n; index += 1) {
    흘림(한틱)
    그림()
  }
}
/** 칸에 닿는다 — 사건 시각은 지금(+1: 마지막 그림 뒤) */
const 닿기 = (element: HTMLElement) => {
  const event = new Event('pointerdown', { bubbles: true })
  Object.defineProperty(event, 'timeStamp', { value: performance.now() + 1 })
  act(() => void fireEvent(element, event))
}
const 떼기 = (element: HTMLElement) => act(() => void fireEvent.click(element, { detail: 1 }))
const 칸 = () => Number(/투구 게이지 (\d+)칸/.exec(screen.getByRole('button').getAttribute('aria-label') ?? '')?.[1])

describe('게이지 누름 칸 — 닿을 때 본 그림의 커서로 정한다 (r222)', () => {
  it('닿고 두 그림 뒤에 떼도 — 정한 칸은 닿을 때 화면에 있던 커서', () => {
    const onRelease = vi.fn()
    render(<PitchGradeGauge onRelease={onRelease} />)
    틀(3)
    const 본칸 = 칸()
    expect(본칸).toBeGreaterThan(0)
    닿기(screen.getByRole('button'))
    // 손가락을 떼기까지 두 그림이 더 섰다 — 커서는 두 칸 더 올랐다
    틀(2)
    expect(칸()).toBe(본칸 + 2)
    떼기(screen.getByRole('button'))
    틀(1)
    expect(칸()).toBe(본칸)
    틀(10)
    expect(onRelease.mock.calls).toEqual([[본칸]])
  })

  it('닿자마자 떼면 키와 같다', () => {
    const onRelease = vi.fn()
    render(<PitchGradeGauge onRelease={onRelease} />)
    틀(4)
    const 본칸 = 칸()
    닿기(screen.getByRole('button'))
    떼기(screen.getByRole('button'))
    틀(1)
    틀(10)
    expect(onRelease.mock.calls).toEqual([[본칸]])
  })
})

describe('조준 확정 누름 칸 — 닿을 때 본 그림의 조준점으로 확정한다 (r222)', () => {
  const C = ZONE_CENTERS[1]

  it('방향으로 흐르는 중 닿고 한 그림 뒤에 떼도 — 닿을 때 본 자리', () => {
    const onConfirm = vi.fn()
    render(<AimCursor side={1} onConfirm={onConfirm} />)
    act(() => void window.dispatchEvent(new KeyboardEvent('keydown', { key: '6' })))
    // 조준점이 오른쪽으로 두 번 흘렀다(x + 40) — 그 그림을 보고 닿는다
    틀(2)
    const 확정 = screen.getByRole('button', { name: '조준 확정' })
    닿기(확정)
    틀(1)
    떼기(확정)
    틀(1)
    expect(onConfirm.mock.calls).toEqual([[{ x: C.x + 40, y: C.y, z: C.z }]])
  })
})
