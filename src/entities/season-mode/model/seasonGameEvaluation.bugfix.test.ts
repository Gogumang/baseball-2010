import { afterEach, describe, expect, it } from 'vitest'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
import { startNewSeason, type SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import { seasonGameEvaluationLineOf } from '@/entities/season-mode/model/seasonGameEvaluation'

afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

/** 안타 9(홈런 1 포함 — S[7]) 중 2루타 2 · 3루타 1, 구내매점 남음 */
const 레코드: SeasonRecord = {
  ...startNewSeason(0, '테스터').record,
  lastGameScore: 6,
  lastGameConceded: 2,
  gameRecord: Array.from({ length: 16 }, (_unused, index) => ({ 7: 9, 8: 2, 9: 1, 10: 1 })[index] ?? 0),
  lastAttendance: 18160,
  lastIncome: 15,
  storeGames: 45,
}

describe('B-67 시즌 경기 평가 글', () => {
  it('원본: 안타 = S[7] + S[8] + S[9] · "(+200)" 이 "만" 앞', () => {
    const 줄 = seasonGameEvaluationLineOf(레코드)
    expect(줄).toContain('안타: 12 /')
    expect(줄.endsWith('수입: 1500(+200)만')).toBe(true)
  })

  it('고침: 안타 = S[7](홈런 포함) · "(+200)" 은 "만" 뒤', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-67']))
    const 줄 = seasonGameEvaluationLineOf(레코드)
    expect(줄).toContain('안타: 9 /')
    expect(줄.endsWith('수입: 1500만(+200)')).toBe(true)
  })
})
