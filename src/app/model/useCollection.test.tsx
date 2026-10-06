// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { mergeOpenedHiddenIds, useCollection } from '@/app/model/useCollection'
import { normalizeCollection, mergeSeasonEndingIntoCollection, mergeTitlesIntoCollection } from '@/entities/collection/model/collection'
import { TITLE_NAMES } from '@/entities/career/model/titles'
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

describe('전부 수집 보상 0x28e98 → 0x292f8 (메인 메뉴 하위 4)', () => {
  const 지갑 = () => {
    const gains: number[] = []
    return { gains, gain: (amount: number) => { gains.push(amount) } }
  }

  it('줄 것이 없으면 null — 아무것도 안 바꾼다', () => {
    const rewards = 메모리저장()
    const wallet = 지갑()
    const { result } = renderHook(() => useCollection(메모리저장(), null, false))
    let text: string | null = 'x'
    act(() => { text = result.current.claimCollectionReward(rewards, false, wallet) })
    expect(text).toBeNull()
    expect(rewards.saved).toBeNull()
    expect(wallet.gains).toEqual([])
  })

  it('미션 두 편 올클리어 → 달성 표시 3 · 비트 3 저장 · G 30000 · 획득 GP 모드 6(미션 칸 5), 다시 부르면 null', () => {
    const rewards = 메모리저장()
    rewards.saved = { awardedBits: 0b1 }
    const wallet = 지갑()
    const { result } = renderHook(() => useCollection(메모리저장(), null, true))
    let text: string | null = null
    act(() => { text = result.current.claimCollectionReward(rewards, true, wallet) })

    expect(text).toBe('미션모드 모두 성공달성!N[!cFFFF0030000 G포인트!cFFFFFF] 지급')
    expect(rewards.saved).toEqual({ awardedBits: 0b1001 })
    expect(wallet.gains).toEqual([30000])
    expect(result.current.collection.stats.achievementMarks[3]).toBe(1)
    expect(result.current.collection.stats.gamePointEarned[5]).toBe(30000)

    act(() => { text = result.current.claimCollectionReward(rewards, true, wallet) })
    expect(text).toBeNull()
  })

  it('투수편 칭호·시즌 엔딩도 모은다 — 닉네임 64 가 차면 k 6, 획득 GP 는 모드 3(투수편 칸 2)', () => {
    const rewards = 메모리저장()
    const wallet = 지갑()
    const batter = TITLE_NAMES.slice(0, 48)
    const pitcher = [...TITLE_NAMES.slice(0, 32), ...TITLE_NAMES.slice(48)]
    const store = 메모리저장()
    store.saved = { ...normalizeCollection(null), titles: batter }
    const { result } = renderHook(() => useCollection(store, null, false, [], null, pitcher, 2))

    expect(result.current.collection.titles).toHaveLength(64)
    expect(result.current.collection.seasonEndings).toEqual([2])
    let text: string | null = null
    act(() => { text = result.current.claimCollectionReward(rewards, false, wallet) })
    expect(text).toBe('닉네임 모두 수집 달성!N[!cFFFF0060000 G포인트!cFFFFFF] 지급')
    expect(result.current.collection.stats.gamePointEarned[2]).toBe(60000)
  })

  it('시즌 엔딩·칭호 합치기는 다 있으면 같은 객체, 0~4 밖 시즌 엔딩은 버린다', () => {
    const collection = mergeSeasonEndingIntoCollection(normalizeCollection(null), 4)
    expect(mergeSeasonEndingIntoCollection(collection, 4)).toBe(collection)
    expect(mergeSeasonEndingIntoCollection(collection, 5)).toBe(collection)
    expect(mergeSeasonEndingIntoCollection(collection, null)).toBe(collection)
    const titled = mergeTitlesIntoCollection(collection, ['a', 'a'])
    expect(titled.titles).toEqual(['a'])
    expect(mergeTitlesIntoCollection(titled, ['a'])).toBe(titled)
    expect(normalizeCollection({ titles: [], skills: [], endings: [] }).seasonEndings).toEqual([])
  })
})
