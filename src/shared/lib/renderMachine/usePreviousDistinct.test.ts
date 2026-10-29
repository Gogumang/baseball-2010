// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { usePreviousDistinct } from '@/shared/lib/renderMachine/usePreviousDistinct'
import { useRenderMachine } from '@/shared/lib/renderMachine/useRenderMachine'
import { useLastRenderValue } from '@/shared/lib/renderMachine/useLastRenderValue'

describe('그림 차례 상태 기계', () => {
  it('앞 상태는 처음 null, 그 뒤로는 앞 그림이 낸 값 — 같은 그림 안에서 곧바로 본다', () => {
    const seen: (number | null)[] = []
    const { result, rerender } = renderHook(
      ({ step }) =>
        useRenderMachine((previous: number | null, add: number) => {
          seen.push(previous)
          return (previous ?? 0) + add
        }, step),
      { initialProps: { step: 1 } },
    )
    expect(result.current).toBe(1)
    rerender({ step: 2 })
    expect(result.current).toBe(3)
    expect(seen).toEqual([null, 1])
  })

  it('바로 앞의 다른 값 — 같은 값으로 다시 그려도 그대로 (옛 화면 이력 ref 와 같은 차례)', () => {
    const { result, rerender } = renderHook(({ value }) => usePreviousDistinct(value), { initialProps: { value: 'a' } })
    const trail: (string | null)[] = [result.current]
    for (const value of ['a', 'b', 'b', 'c', 'a']) {
      rerender({ value })
      trail.push(result.current)
    }
    expect(trail).toEqual([null, null, 'a', 'a', 'b', 'c'])
  })

  it('지난 그림의 값 — 첫 그림은 처음 값, 그 뒤는 바로 앞 그림의 값(같은 값이어도)', () => {
    const { result, rerender } = renderHook(({ value }) => useLastRenderValue(value, false), { initialProps: { value: true } })
    const seen: boolean[] = [result.current]
    for (const value of [true, false, false, true]) {
      rerender({ value })
      seen.push(result.current)
    }
    expect(seen).toEqual([false, true, true, false, false])
  })
})
