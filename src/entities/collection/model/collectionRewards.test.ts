import { describe, expect, it } from 'vitest'
import {
  EMPTY_COLLECTION_REWARD_RECORD, isRewardAwarded, normalizeCollectionRewardRecord, withAwardedBit,
  collectionRewardGamePointOf, collectionRewardStatModeOf, collectionRewardTextOf, judgeCollectionReward,
  withStoredAwardedBits,
} from '@/entities/collection/model/collectionRewards'
import type { CollectionRewardJudgeInput } from '@/entities/collection/model/collectionRewards'
import { addRecordCounts, EMPTY_ANNALS_STATS } from '@/entities/collection/model/annalsStats'
import { TITLE_NAMES } from '@/entities/career/model/titles'

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

const 빈판정: CollectionRewardJudgeInput = {
  record: EMPTY_COLLECTION_REWARD_RECORD,
  isEveryMissionCleared: false,
  stats: EMPTY_ANNALS_STATS,
  titles: [],
  endings: [],
  seasonEndings: [],
}
const 마흔기록 = addRecordCounts(EMPTY_ANNALS_STATS, Array.from({ length: 40 }, (_, n) => n))
/** 비트 0~23 이 다 선 스킬 비트 */
const 스킬다 = { ...EMPTY_ANNALS_STATS, batterEquippedSkillBits: 0xffffff, pitcherEquippedSkillBits: 0xffff00 }
const 엔딩다 = { endings: Array.from({ length: 15 }, (_, e) => e), seasonEndings: [0, 1, 2, 3, 4] }

describe('전부 수집 보상 판정 0x28e98 — k 3 → 7 차례, 받은 비트는 건너뛰고 처음 맞는 하나', () => {
  it('아무것도 없으면 −1', () => {
    expect(judgeCollectionReward(빈판정)).toBe(-1)
  })

  it('k 3 미션 두 편 올클리어 → 받았으면 다음 k 로 넘어간다', () => {
    const 미션 = { ...빈판정, isEveryMissionCleared: true, stats: 마흔기록 }
    expect(judgeCollectionReward(미션)).toBe(3)
    expect(judgeCollectionReward({ ...미션, record: withAwardedBit(EMPTY_COLLECTION_REWARD_RECORD, 3) })).toBe(4)
  })

  it('k 4 기록달성 40칸이 모두 ≠ 0 — 하나라도 0 이면(u8 이 넘쳐 0 이 된 칸도) 아니다', () => {
    expect(judgeCollectionReward({ ...빈판정, stats: 마흔기록 })).toBe(4)
    const 하나빠짐 = addRecordCounts(EMPTY_ANNALS_STATS, Array.from({ length: 39 }, (_, n) => n))
    expect(judgeCollectionReward({ ...빈판정, stats: 하나빠짐 })).toBe(-1)
    const 넘침 = addRecordCounts(마흔기록, Array.from({ length: 255 }, () => 0))
    expect(judgeCollectionReward({ ...빈판정, stats: 넘침 })).toBe(-1)
  })

  it('k 5 스킬 — 비트 0~7 은 어느 편이든 8 · 8~23 은 타자 16 · 투수 16', () => {
    expect(judgeCollectionReward({ ...빈판정, stats: 스킬다 })).toBe(5)
    // 공통 비트를 두 편이 나눠 켜도 된다
    const 나눠 = { ...EMPTY_ANNALS_STATS, batterEquippedSkillBits: 0xffff0f, pitcherEquippedSkillBits: 0xfffff0 }
    expect(judgeCollectionReward({ ...빈판정, stats: 나눠 })).toBe(5)
    // 투수 편 비트 8 하나가 빠지면 아니다
    const 빠짐 = { ...스킬다, pitcherEquippedSkillBits: 0xfffe00 }
    expect(judgeCollectionReward({ ...빈판정, stats: 빠짐 })).toBe(-1)
  })

  it('k 6 닉네임 — 공통 32 + 타자 32~47 + 투수 48~63', () => {
    expect(judgeCollectionReward({ ...빈판정, titles: TITLE_NAMES })).toBe(6)
    expect(judgeCollectionReward({ ...빈판정, titles: TITLE_NAMES.slice(0, 63) })).toBe(-1)
  })

  it('k 7 엔딩 — 나리 +0xa8..+0xb6 15칸 + 시즌 +0xa0..+0xa4 5칸 = 20', () => {
    expect(judgeCollectionReward({ ...빈판정, ...엔딩다 })).toBe(7)
    expect(judgeCollectionReward({ ...빈판정, ...엔딩다, seasonEndings: [0, 1, 2, 3] })).toBe(-1)
    // 칸 밖 번호는 세지 않는다
    expect(judgeCollectionReward({ ...빈판정, ...엔딩다, seasonEndings: [0, 1, 2, 3, 5] })).toBe(-1)
  })

  it('다 맞으면 3 부터, 받을 때마다 하나씩 뒤로', () => {
    let record = EMPTY_COLLECTION_REWARD_RECORD
    const 전부 = { ...빈판정, isEveryMissionCleared: true, stats: { ...마흔기록, batterEquippedSkillBits: 0xffffff, pitcherEquippedSkillBits: 0xffff00 }, titles: TITLE_NAMES, ...엔딩다 }
    const order: number[] = []
    for (let k = judgeCollectionReward({ ...전부, record }); k >= 0; k = judgeCollectionReward({ ...전부, record })) {
      order.push(k)
      record = withAwardedBit(record, k)
    }
    expect(order).toEqual([3, 4, 5, 6, 7])
  })
})

describe('지급 팝업 0x292f8', () => {
  it('액수표 0xcebd4 × 1000', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map(collectionRewardGamePointOf)).toEqual([3000, 10000, 20000, 30000, 40000, 50000, 60000, 90000])
  })

  it('글 = StrMAINMENU[180+k] 에 [188] 을 사이 없이 붙인다 (끝 공백 그대로)', () => {
    expect(collectionRewardTextOf(3)).toBe('미션모드 모두 성공달성!N[!cFFFF0030000 G포인트!cFFFFFF] 지급')
    expect(collectionRewardTextOf(7)).toBe('엔딩 모두 수집 달성!N[!cFFFF0090000 G포인트!cFFFFFF] 지급')
  })

  it('획득 GP 통계 모드 — k ≤ 2 → 2 · 3·4·7 → 6 · 5·6 → 3 (0x293c0~0x293e4)', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map(collectionRewardStatModeOf)).toEqual([2, 2, 2, 6, 6, 3, 3, 6])
  })
})

describe('두 주인이 같은 바이트를 쓴다 — 저장된 비트를 합친다', () => {
  it('저장에 있는 비트를 OR 하고, 바뀐 게 없으면 같은 객체', () => {
    const season = withAwardedBit(EMPTY_COLLECTION_REWARD_RECORD, 0)
    expect(withStoredAwardedBits(season, { awardedBits: 0b1000 }).awardedBits).toBe(0b1001)
    expect(withStoredAwardedBits(season, null)).toBe(season)
  })
})
