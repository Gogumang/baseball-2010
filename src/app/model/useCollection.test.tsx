// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { mergeOpenedHiddenIds, useCollection } from '@/app/model/useCollection'
import { normalizeCollection } from '@/entities/collection/model/collection'
import type { JsonStorePort } from '@/shared/api/save/jsonStorePort'

const 메모리저장 = (): JsonStorePort & { saved: unknown } => {
  const store = {
    saved: null as unknown,
    load: () => store.saved,
    save: (value: unknown) => {
      store.saved = value
    },
  }
  return store
}

describe('기록연감 히든 오픈 — 전역 표 app+0xc0 하나', () => {
  it('투수편이 연 컬렉터 id(20·24·28·32)도 모은다 (0xa5020 → 0x62368)', () => {
    const store = 메모리저장()
    const { result } = renderHook(() => useCollection(store, null, false, [20, 24]))

    expect(result.current.collection.openedHiddenIds).toEqual([20, 24])
    expect((store.saved as { openedHiddenIds: number[] }).openedHiddenIds).toEqual([20, 24])
  })

  it('이미 있는 id 는 두 번 넣지 않고, 다 있으면 같은 객체를 돌려준다', () => {
    const collection = { ...normalizeCollection(null), openedHiddenIds: [3, 20] }

    expect(mergeOpenedHiddenIds(collection, [20, 28, 28]).openedHiddenIds).toEqual([3, 20, 28])
    expect(mergeOpenedHiddenIds(collection, [20])).toBe(collection)
  })
})

describe('기록연감 통계 기록 [mgr+0xc8]', () => {
  it('한 건을 쌓고 곧바로 저장한다 (0x22c29 → 0x1f1e1)', () => {
    const store = 메모리저장()
    const { result } = renderHook(() => useCollection(store, null, false))

    act(() => result.current.recordStat({ kind: 'G사용', usage: 0, amount: 3000 }))

    expect(result.current.collection.stats.gamePointUsage[0]).toBe(3000)
    expect((store.saved as { stats: { gamePointUsage: number[] } }).stats.gamePointUsage[0]).toBe(3000)
  })
})
