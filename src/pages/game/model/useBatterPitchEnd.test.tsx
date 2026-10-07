// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { useBatterPitchEnd } from '@/pages/game/model/useBatterPitchEnd'
import { millisecondsPerFrame } from '@/shared/config/frameRate'

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const tick = (count = 1) => act(() => {
  vi.advanceTimersByTime(millisecondsPerFrame() * count)
})

interface Props {
  readonly isPlayShown: boolean
  readonly isFrozen: boolean
}

const mount = (initial: Props = { isPlayShown: false, isFrozen: false }) =>
  renderHook((props: Props) => useBatterPitchEnd(props), { initialProps: initial })

describe('useBatterPitchEnd — 타자편 공 끝 0x4e600 의 때', () => {
  it('맞히지 못한 공(0x12)은 대기 틱이 다 찬 갱신에서 부른다 — 그때까지 들고 있다 (0x4e6d4 → 0x4e796)', () => {
    const { result } = mount()
    act(() => result.current.notePitchResolved({ isHit: false, waitTicks: 15 }))
    expect(result.current.serial).toBe(0)
    expect(result.current.isHolding).toBe(true)
    tick(14)
    expect(result.current.serial).toBe(0)
    tick()
    expect(result.current.serial).toBe(1)
    expect(result.current.isHolding).toBe(false)
  })

  it('팝업이 떠 있으면 0x12 상태 틱이 안 오른다 (0x52cc6)', () => {
    const { result, rerender } = mount()
    act(() => result.current.notePitchResolved({ isHit: false, waitTicks: 31 }))
    tick(10)
    rerender({ isPlayShown: false, isFrozen: true })
    tick(40)
    expect(result.current.serial).toBe(0)
    rerender({ isPlayShown: false, isFrozen: false })
    tick(20)
    expect(result.current.serial).toBe(0)
    tick()
    expect(result.current.serial).toBe(1)
  })

  it('판이 서는 공(인플레이 · 홈런 비행 · 도루 판)은 0x12 대기 없이 판이 끝날 때 부른다 (0x52a60)', () => {
    const { result, rerender } = mount()
    // 진행기가 판을 세우는 그림과 판정이 한 그림에 든다(같은 처리기의 상태 갱신이 묶인다)
    act(() => {
      result.current.notePitchResolved({ isHit: true, waitTicks: 15 })
      rerender({ isPlayShown: true, isFrozen: false })
    })
    tick(40)
    expect(result.current.serial).toBe(0)
    expect(result.current.isHolding).toBe(true)
    rerender({ isPlayShown: false, isFrozen: false })
    expect(result.current.serial).toBe(1)
    expect(result.current.isHolding).toBe(false)
    tick(40)
    expect(result.current.serial).toBe(1)
  })

  it('판 없이 끝난 맞은 공(파울)은 판정 그림에서 곧바로 부른다 (⚠️ 근사)', () => {
    const { result } = mount()
    act(() => result.current.notePitchResolved({ isHit: true, waitTicks: 15 }))
    expect(result.current.serial).toBe(1)
    expect(result.current.isHolding).toBe(false)
  })

  it('공이 아닌 판(견제)도 0x17 이라 끝나면 부르고, 판이 서는 순간에는 안 부른다', () => {
    const { result, rerender } = mount()
    rerender({ isPlayShown: true, isFrozen: false })
    expect(result.current.serial).toBe(0)
    rerender({ isPlayShown: false, isFrozen: false })
    expect(result.current.serial).toBe(1)
  })
})
