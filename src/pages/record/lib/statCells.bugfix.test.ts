import { afterEach, describe, expect, it } from 'vitest'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
import { EMPTY_ANNALS_STATS, type AnnalsStats } from '@/entities/collection/model/annalsStats'
import { statTotalTextOf } from '@/pages/record/lib/statCells'

afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

const 기록: AnnalsStats = {
  ...EMPTY_ANNALS_STATS,
  gamePointEarned: [100, 200, 0, 0, 50, 0, 5],
  gamePointUsage: [10, 0, 20, 0, 0, 0, 0, 3],
}

describe('B-66 통계 6·7 쪽 합계', () => {
  it('원본: 늘 "0G"', () => {
    expect(statTotalTextOf(6, 기록)).toBe('0G')
    expect(statTotalTextOf(7, 기록)).toBe('0G')
  })

  it('고침: 6 쪽은 획득 GP 합, 7 쪽은 소모 GP 합', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-66']))
    expect(statTotalTextOf(6, 기록)).toBe('355G')
    expect(statTotalTextOf(7, 기록)).toBe('33G')
    expect(statTotalTextOf(5, 기록)).toBeNull()
  })
})
