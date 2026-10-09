import { describe, expect, it } from 'vitest'
import { aceBatterProfileOf, batterHandOf } from '@/widgets/matchup-cards/lib/matchupRecord'

describe('마타자 레코드 +0xb — XlsACE_BAT_DATA', () => {
  it('폼 4~8 · 피부 0, 손은 폼이 아니라 표 0xd88b0', () => {
    expect([0, 1, 2, 3, 4].map((index) => aceBatterProfileOf(index) >> 4)).toEqual([4, 5, 6, 7, 8])
    expect([0, 1, 2, 3, 4].map((index) => (aceBatterProfileOf(index) >> 2) & 3)).toEqual([0, 0, 0, 0, 0])
    expect([0, 1, 2, 3, 4].map((index) => batterHandOf(aceBatterProfileOf(index), index))).toEqual([1, 0, 0, 0, 1])
  })
})
