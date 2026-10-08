import { describe, expect, it } from 'vitest'
import { startNewSeason } from '@/entities/season-mode/model/seasonRecord'
import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import {
  SEASON_EVALUATION_GAUGE_DIVISOR, seasonGameEvaluationExpressionOf, seasonGameEvaluationLineOf,
} from '@/entities/season-mode/model/seasonGameEvaluation'

const 레코드 = (덮어쓰기: Partial<SeasonRecord> = {}): SeasonRecord => ({
  ...startNewSeason(0, '테스터').record,
  ...덮어쓰기,
})

/** S[2] 피안타 · S[3] 에러 · S[7] 안타 · S[8] 2루타 · S[9] 3루타 */
const 평판칸 = (값: Readonly<Record<number, number>>) => Array.from({ length: 16 }, (_unused, index) => 값[index] ?? 0)

describe('0xe9 기록 줄 (0xdef6~0xe060)', () => {
  it('세 줄 그대로 — 득점·실점·승패 / 안타·피안타·에러 / 관중·수입', () => {
    expect(seasonGameEvaluationLineOf(레코드({
      lastGameScore: 6, lastGameConceded: 2, gameRecord: 평판칸({ 2: 8, 3: 1, 7: 9, 8: 2, 9: 1 }),
      lastAttendance: 18160, lastIncome: 13,
    }))).toBe('득점: 6 / 실점: 2 / 경기승리!!N안타: 12 / 피안타: 8 / 에러: 1!N관중: 18160명 / 수입: 1300만')
  })

  it('원본 그대로 — 동점은 "경기패배!", 구내매점 "(+200)" 은 "만" 앞', () => {
    const 줄 = seasonGameEvaluationLineOf(레코드({ lastGameScore: 3, lastGameConceded: 3, lastIncome: 15, storeGames: 45 }))
    expect(줄).toContain('/ 경기패배!!N')
    expect(줄.endsWith('수입: 1500(+200)만')).toBe(true)
  })

  it('수입이 1억 이상이면 0x55cf4 의 "억" 서식 ("만" 은 그대로 붙는다)', () => {
    expect(seasonGameEvaluationLineOf(레코드({ lastIncome: 123 })).endsWith('수입: 1억2300만')).toBe(true)
  })
})

describe('0x8a6fc 시즌 갈래', () => {
  it('표정 8 → S+0x4a < 0 이면 3 · 0~1 이면 0 · 2 이상이면 1', () => {
    expect([-3, -1, 0, 1, 2, 5].map(seasonGameEvaluationExpressionOf)).toEqual([3, 3, 0, 0, 1, 1])
  })

  it('인기도 막대 d = 12', () => {
    expect(SEASON_EVALUATION_GAUGE_DIVISOR).toBe(12)
  })
})
