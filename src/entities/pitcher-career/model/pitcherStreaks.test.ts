import { describe, expect, it } from 'vitest'
import {
  advancePitcherStreaks,
  EMPTY_PITCHER_STREAKS,
  pitcherStreakEventOf,
  pitcherStreakMarkupOf,
} from '@/entities/pitcher-career/model/pitcherStreaks'
import type { PitcherStreakEventInput } from '@/entities/pitcher-career/model/pitcherStreaks'
import { ORIGINAL_USER_EVENTS } from '@/shared/config/original/userEvents'

const 선발경기 = { role: 0 as const, dayCounter: 4, endedInningIndex: 8, decisionCode: 1, strikeouts: 5 }
const 구원경기 = { role: 2 as const, dayCounter: 3, endedInningIndex: 8, decisionCode: 3, strikeouts: 2 }

describe('advancePitcherStreaks — 0xa719c 모드 3 갈래', () => {
  it('선발: 승 · 5탈삼진 이상 · 패를 잇고 아니면 0', () => {
    const once = advancePitcherStreaks(EMPTY_PITCHER_STREAKS, 선발경기)
    expect(once).toEqual({ win: 1, strikeout: 1, loss: 0 })
    expect(advancePitcherStreaks(once, { ...선발경기, decisionCode: 2, strikeouts: 4 })).toEqual({ win: 0, strikeout: 0, loss: 1 })
  })

  it('선발: 날짜 카운터가 홀수인 날(선발 아닌 날)은 건너뛴다', () => {
    const streaks = { win: 2, strikeout: 2, loss: 0 }
    expect(advancePitcherStreaks(streaks, { ...선발경기, dayCounter: 5, decisionCode: 0 })).toBe(streaks)
  })

  it('구원: 세이브나 승이면 [0], 2탈삼진 이상이면 [1] — state+0x6b ≤ 6 이면 건너뛴다', () => {
    expect(advancePitcherStreaks(EMPTY_PITCHER_STREAKS, 구원경기)).toEqual({ win: 1, strikeout: 1, loss: 0 })
    expect(advancePitcherStreaks(EMPTY_PITCHER_STREAKS, { ...구원경기, decisionCode: 1, strikeouts: 1 }))
      .toEqual({ win: 1, strikeout: 0, loss: 0 })
    expect(advancePitcherStreaks(EMPTY_PITCHER_STREAKS, { ...구원경기, endedInningIndex: 6 })).toBe(EMPTY_PITCHER_STREAKS)
  })

  it('u8 칸이라 255 다음은 0', () => {
    expect(advancePitcherStreaks({ win: 255, strikeout: 0, loss: 0 }, 선발경기).win).toBe(0)
  })
})

const 입력 = (over: Partial<PitcherStreakEventInput>): PitcherStreakEventInput => ({
  role: 0,
  streaks: EMPTY_PITCHER_STREAKS,
  season: 1,
  skillIds: [],
  managerCommentIndex: 5,
  walksAndHitByPitch: 0,
  hitsAllowed: 0,
  ...over,
})

describe('pitcherStreakEventOf — 0x8a6fc 모드 3 갈래', () => {
  it('선발 3연승 · 5경기 연속 5탈삼진 → 글 106 · 103 · 평판 5 + 10 · 코멘트 109', () => {
    const event = pitcherStreakEventOf(입력({ streaks: { win: 3, strikeout: 5, loss: 0 } }))
    expect(event.good).toEqual([{ count: 3, labelIndex: 106 }, { count: 5, labelIndex: 103 }])
    expect(event.goodCommentIndex).toBe(109)
    expect(event.rewards).toEqual([{ kind: 1, value: 15 }])
    expect(pitcherStreakMarkupOf(event, ORIGINAL_USER_EVENTS)).toBe(
      `3${ORIGINAL_USER_EVENTS[106]} /5${ORIGINAL_USER_EVENTS[103]}!N${ORIGINAL_USER_EVENTS[109]}`,
    )
  })

  it('구원: [0] 은 세이브 글 104 · [1] 은 표 0xd4dfc(5,10,…) 의 2탈삼진 글 105', () => {
    expect(pitcherStreakEventOf(입력({ role: 2, streaks: { win: 3, strikeout: 3, loss: 0 } })).good)
      .toEqual([{ count: 3, labelIndex: 104 }])
    expect(pitcherStreakEventOf(입력({ role: 2, streaks: { win: 0, strikeout: 10, loss: 0 } })).rewards)
      .toEqual([{ kind: 1, value: 10 }])
  })

  it('연패: 선발은 평판 두 배, 4연패 글 111', () => {
    const starter = pitcherStreakEventOf(입력({ streaks: { win: 0, strikeout: 0, loss: 4 } }))
    expect(starter.bad).toEqual({ count: 4, labelIndex: 107 })
    expect(starter.badCommentIndex).toBe(111)
    expect(starter.rewards).toEqual([{ kind: 1, value: -20 }])
    expect(pitcherStreakEventOf(입력({ role: 2, streaks: { win: 0, strikeout: 0, loss: 5 } })).rewards)
      .toEqual([{ kind: 1, value: -20 }])
  })

  it('스킬 — 집중 15 · 새가슴 17 · 더티볼 20 (보상 값 = 비트 + 1)', () => {
    expect(pitcherStreakEventOf(입력({ streaks: { win: 0, strikeout: 12, loss: 0 } })).rewards)
      .toEqual([{ kind: 4, value: 16 }])
    expect(pitcherStreakEventOf(입력({ role: 2, streaks: { win: 0, strikeout: 24, loss: 0 } })).rewards)
      .toEqual([{ kind: 4, value: 16 }])
    // 새가슴은 연차idx > 1 (3년차부터)
    expect(pitcherStreakEventOf(입력({ season: 2, hitsAllowed: 15 })).rewards).toEqual([])
    expect(pitcherStreakEventOf(입력({ season: 3, hitsAllowed: 15 })).rewards).toEqual([{ kind: 4, value: 18 }])
    expect(pitcherStreakEventOf(입력({ role: 2, season: 3, hitsAllowed: 6 })).rewards).toEqual([{ kind: 4, value: 18 }])
    // 가졌으면 [0] 이 선발 5 · 구원 7 일 때 푼다
    expect(pitcherStreakEventOf(입력({ skillIds: [17], streaks: { win: 5, strikeout: 0, loss: 0 } })).rewards)
      .toEqual([{ kind: 1, value: 10 }, { kind: 4, value: -18 }])
    expect(pitcherStreakEventOf(입력({ walksAndHitByPitch: 4 })).rewards).toEqual([{ kind: 4, value: 21 }])
    expect(pitcherStreakEventOf(입력({ skillIds: [20], walksAndHitByPitch: 4 })).rewards).toEqual([])
  })

  it('감독 글 38(등판 없음)이면 통째로 건너뛴다', () => {
    expect(pitcherStreakEventOf(입력({ managerCommentIndex: 38, streaks: { win: 3, strikeout: 0, loss: 0 }, walksAndHitByPitch: 9 })))
      .toEqual({ good: [], bad: null, goodCommentIndex: null, badCommentIndex: null, rewards: [] })
  })
})
