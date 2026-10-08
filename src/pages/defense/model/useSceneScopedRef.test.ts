// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useSceneScopedRef } from '@/pages/defense/model/useSceneScopedRef'

describe('경기 장면 0x104 수명의 칸 — useSceneScopedRef', () => {
  it('같은 장면 동안은 다시 그려도 남고, 장면이 새로 서면(값이 바뀌면) 처음 값으로', () => {
    const 첫장면 = {}
    const { result, rerender } = renderHook(({ scene }) => useSceneScopedRef(0, scene), {
      initialProps: { scene: 첫장면 as object },
    })
    result.current.current = 3
    rerender({ scene: 첫장면 })
    expect(result.current.current).toBe(3)
    rerender({ scene: {} })
    expect(result.current.current).toBe(0)
  })
})
