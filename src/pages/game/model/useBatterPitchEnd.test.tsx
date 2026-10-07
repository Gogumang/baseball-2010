// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { useBatterPitchEnd } from '@/pages/game/model/useBatterPitchEnd'

afterEach(cleanup)

interface Props {
  readonly isPlayShown: boolean
}

const mount = (initial: Props = { isPlayShown: false }) =>
  renderHook((props: Props) => useBatterPitchEnd(props), { initialProps: initial })

describe('useBatterPitchEnd — 타자편 공 끝 0x4e600 의 때', () => {
  it('판 없이 끝난 공은 판정 그림에서 부른다', () => {
    const { result } = mount()
    act(() => result.current.notePitchResolved())
    expect(result.current.serial).toBe(1)
    expect(result.current.isHolding).toBe(false)
  })

  it('판이 서는 공(인플레이 · 홈런 비행 · 도루 판)은 판이 끝날 때 부른다 (0x52a60)', () => {
    const { result, rerender } = mount()
    // 진행기가 판을 세우는 그림과 판정이 한 그림에 든다(같은 처리기의 상태 갱신이 묶인다)
    act(() => {
      result.current.notePitchResolved()
      rerender({ isPlayShown: true })
    })
    expect(result.current.serial).toBe(0)
    expect(result.current.isHolding).toBe(true)
    rerender({ isPlayShown: false })
    expect(result.current.serial).toBe(1)
    expect(result.current.isHolding).toBe(false)
  })

  it('공이 아닌 판(견제)도 0x17 이라 끝나면 부르고, 판이 서는 순간에는 안 부른다', () => {
    const { result, rerender } = mount()
    rerender({ isPlayShown: true })
    expect(result.current.serial).toBe(0)
    rerender({ isPlayShown: false })
    expect(result.current.serial).toBe(1)
  })
})
