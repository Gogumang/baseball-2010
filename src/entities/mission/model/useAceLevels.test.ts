// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useAceLevels } from '@/entities/mission/model/useAceLevels'
import type { JsonStorePort } from '@/shared/api/save/jsonStorePort'

const 저장소 = (initial: unknown) => {
  let value = initial
  const store: JsonStorePort = { load: () => value, save: (next) => { value = next } }
  return { store, read: () => value }
}

describe('마선수 레벨 전역 저장 mgr[0x13a..0x143]', () => {
  it('옛 저장(칸 없음)은 모두 0 으로 읽고 바로 적는다', () => {
    const { store, read } = 저장소(null)
    const { result } = renderHook(() => useAceLevels(store))

    expect(result.current.levels[7]).toBe(0)
    expect(read()).toEqual({ levels: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] })
  })

  it('레벨업은 그 칸만 +1 하고 저장한다', () => {
    const { store, read } = 저장소({ levels: [0, 0, 0, 0, 0, 0, 0, 2] })
    const { result } = renderHook(() => useAceLevels(store))

    act(() => result.current.levelUp(7))

    expect(result.current.levels[7]).toBe(3)
    expect(read()).toEqual({ levels: [0, 0, 0, 0, 0, 0, 0, 3, 0, 0] })
  })
})
