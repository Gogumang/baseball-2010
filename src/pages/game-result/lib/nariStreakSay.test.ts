import { describe, expect, it } from 'vitest'
import { hasHitlessStreak, nariStreakSayOf } from '@/pages/game-result/lib/nariStreakSay'

const 글 = Array.from({ length: 120 }, (_unused, index) => `[${index}]`)

describe('타자편 연속 기록 say 글 (0x8a6fc 모드 4)', () => {
  it('좋은 칸은 " / " 로 잇고 그 뒤 !N 글 108', () => {
    const notices = [
      { labelIndex: 100, count: 5, commentIndex: 108, reputationChange: 10 },
      { labelIndex: 101, count: 10, commentIndex: 108, reputationChange: 15 },
    ]
    expect(nariStreakSayOf(notices, 글)).toBe('5[100] / 10[101]!N[108]')
    expect(hasHitlessStreak(notices)).toBe(false)
  })
  it('무안타 칸은 사이 글 없이 붙고 !N 110~112', () => {
    const notices = [
      { labelIndex: 100, count: 5, commentIndex: 108, reputationChange: 10 },
      { labelIndex: 102, count: 4, commentIndex: 111, reputationChange: -10 },
    ]
    expect(nariStreakSayOf(notices, 글)).toBe('5[100]4[102]!N[108]!N[111]')
    expect(hasHitlessStreak(notices)).toBe(true)
  })
  it('알림이 없으면 빈 글', () => {
    expect(nariStreakSayOf([], 글)).toBe('')
  })
})
