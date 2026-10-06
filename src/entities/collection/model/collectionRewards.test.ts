import { describe, expect, it } from 'vitest'
import {
  EMPTY_COLLECTION_REWARD_RECORD, isRewardAwarded, normalizeCollectionRewardRecord, withAwardedBit,
} from '@/entities/collection/model/collectionRewards'

describe('전역기록 +0x145 지급 비트 (0x9f709 · 0x9f71d)', () => {
  it('비트 k 를 켜고 읽는다 — 이미 서 있으면 같은 객체', () => {
    const once = withAwardedBit(EMPTY_COLLECTION_REWARD_RECORD, 1)
    expect(once.awardedBits).toBe(0b10)
    expect(isRewardAwarded(once, 1)).toBe(true)
    expect(isRewardAwarded(once, 0)).toBe(false)
    expect(withAwardedBit(once, 1)).toBe(once)
  })

  it('옛 저장(칸 없음)·깨진 값은 0 에서 시작하고, 한 바이트로 자른다', () => {
    expect(normalizeCollectionRewardRecord(null)).toEqual({ awardedBits: 0 })
    expect(normalizeCollectionRewardRecord({})).toEqual({ awardedBits: 0 })
    expect(normalizeCollectionRewardRecord({ awardedBits: '3' })).toEqual({ awardedBits: 0 })
    expect(normalizeCollectionRewardRecord({ awardedBits: 1.5 })).toEqual({ awardedBits: 0 })
    expect(normalizeCollectionRewardRecord({ awardedBits: 0b101 })).toEqual({ awardedBits: 0b101 })
    expect(normalizeCollectionRewardRecord({ awardedBits: 0x1ff })).toEqual({ awardedBits: 0xff })
  })
})
