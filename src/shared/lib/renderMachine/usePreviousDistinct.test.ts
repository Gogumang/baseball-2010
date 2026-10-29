// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { usePreviousDistinct } from '@/shared/lib/renderMachine/usePreviousDistinct'
import { useRenderMachine } from '@/shared/lib/renderMachine/useRenderMachine'
import { useLastRenderValue } from '@/shared/lib/renderMachine/useLastRenderValue'
import { useOnRenderChange } from '@/shared/lib/renderMachine/useOnRenderChange'
import { useHeldWhileSame } from '@/shared/lib/renderMachine/useHeldWhileSame'

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

  it('값이 바뀐 그림에서만 곁일 — 첫 그림 · 같은 값 다시 그리기는 안 부른다', () => {
    const calls: [string, string][] = []
    const { rerender } = renderHook(({ value }) => useOnRenderChange(value, (next, previous) => calls.push([next, previous])), {
      initialProps: { value: 'a' },
    })
    for (const value of ['a', 'b', 'b', 'a']) rerender({ value })
    expect(calls).toEqual([
      ['b', 'a'],
      ['a', 'b'],
    ])
  })

  it('열쇠가 바뀐 그림의 값을 든다 — 열쇠가 같으면 새 값을 줘도 앞 값 그대로', () => {
    const { result, rerender } = renderHook(({ value, key }) => useHeldWhileSame(value, [key]), { initialProps: { value: 1, key: 'x' } })
    const seen = [result.current]
    for (const [value, key] of [
      [2, 'x'],
      [3, 'y'],
      [4, 'y'],
    ] as const) {
      rerender({ value, key })
      seen.push(result.current)
    }
    expect(seen).toEqual([1, 1, 3, 3])
  })
})
