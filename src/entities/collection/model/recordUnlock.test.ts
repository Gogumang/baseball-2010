import { describe, expect, it } from 'vitest'
import { EMPTY_ANNALS_STATS } from '@/entities/collection/model/annalsStats'
import { aceCellOfUnlock, recordUnlockIdOf } from '@/entities/collection/model/recordUnlock'

const statsWith = (recordId: number, count: number) => ({
  ...EMPTY_ANNALS_STATS,
  recordCounts: EMPTY_ANNALS_STATS.recordCounts.map((value, at) => (at === recordId ? count : value)),
})

describe('0x62234 기록달성 누계 해금', () => {
  it('통계 누계(지난 경기까지)가 문턱 이상이면 표의 id — 0x62298 `cmp; blt`', () => {
    expect(recordUnlockIdOf(statsWith(15, 1), 15)).toBeNull()
    expect(recordUnlockIdOf(statsWith(15, 2), 15)).toBe(6)
    expect(recordUnlockIdOf(statsWith(31, 3), 31)).toBe(2)
    expect(recordUnlockIdOf(statsWith(16, 100), 16)).toBe(23)
    expect(recordUnlockIdOf(statsWith(18, 13), 18)).toBeNull()
    expect(recordUnlockIdOf(statsWith(18, 14), 18)).toBe(0)
  })

  it('표에 없는 기록은 아무것도 안 연다', () => {
    expect(recordUnlockIdOf(statsWith(2, 255), 2)).toBeNull()
  })

  it('마선수 id 0~3 → 칸 1~4 · 4~7 → 칸 6~9 (0x620b8 +0x31 · +0x32)', () => {
    expect(aceCellOfUnlock(0)).toBe(1)
    expect(aceCellOfUnlock(3)).toBe(4)
    expect(aceCellOfUnlock(4)).toBe(6)
    expect(aceCellOfUnlock(7)).toBe(9)
    expect(aceCellOfUnlock(23)).toBeNull()
  })

  it('드래고나(해금 id 3)를 여는 기록은 없다 — 원본은 온라인 선물함 0x2bb48 전용(R7 · U-05 원본처럼 잠금)', () => {
    for (let recordId = 0; recordId <= 40; recordId += 1) {
      expect(recordUnlockIdOf(statsWith(recordId, 255), recordId)).not.toBe(3)
    }
  })
})
