import { describe, expect, it } from 'vitest'
import {
  SEASON_GOAL_REWARDS,
  SEASON_YEAR_GOALS,
  achievedSeasonGoalCount,
  seasonGoalResultEventId,
  seasonGoalYearBonusOf,
  seasonGoalsOf,
  winRatePercentOf,
} from '@/entities/season-mode/model/seasonGoals'

const 다섯개달성 = {
  rank: 0,
  wins: 40,
  losses: 5,
  teamBattingAverage: 400,
  teamEarnedRunAverage: 100,
  popularityGain: 500,
}

describe('시즌 목표 표 0xd7cf6 (나리 표 0xd7f9e 와 다른 표다)', () => {
  it('10년치 다섯 칸이다', () => {
    expect(SEASON_YEAR_GOALS).toHaveLength(10)
    for (const row of SEASON_YEAR_GOALS) expect(row).toHaveLength(5)
  })

  it('1년차와 10년차 값이 표 그대로다', () => {
    expect(seasonGoalsOf(0)).toEqual([4, 55, 250, 390, 50])
    expect(seasonGoalsOf(9)).toEqual([1, 82, 340, 300, 140])
  })

  it('순위 목표는 "이하", 방어율은 "이하", 나머지는 "이상" 이다', () => {
    expect(achievedSeasonGoalCount(0, 다섯개달성)).toBe(5)
    expect(achievedSeasonGoalCount(0, { ...다섯개달성, rank: 5 })).toBe(4)
    expect(achievedSeasonGoalCount(0, { ...다섯개달성, teamEarnedRunAverage: 391 })).toBe(4)
    expect(achievedSeasonGoalCount(0, { ...다섯개달성, teamBattingAverage: 249 })).toBe(4)
    expect(achievedSeasonGoalCount(0, { ...다섯개달성, popularityGain: 49 })).toBe(4)
  })

  it('승률은 % 정수(버림)이고 경기가 없으면 0 이다', () => {
    expect(winRatePercentOf(0, 0)).toBe(0)
    expect(winRatePercentOf(25, 20)).toBe(55)
    expect(winRatePercentOf(24, 21)).toBe(53)
  })

  it('승률 목표는 경계값에서 걸린다 (1년차 55%)', () => {
    expect(achievedSeasonGoalCount(0, { ...다섯개달성, wins: 25, losses: 20 })).toBe(5)
    expect(achievedSeasonGoalCount(0, { ...다섯개달성, wins: 24, losses: 21 })).toBe(4)
  })
})

describe('목표 결과 이벤트 0x8d0e0', () => {
  it('5 → 393 · 4 → 394 · 3 → 395 · 그 밖 → 396', () => {
    expect(seasonGoalResultEventId(5)).toBe(393)
    expect(seasonGoalResultEventId(4)).toBe(394)
    expect(seasonGoalResultEventId(3)).toBe(395)
    expect(seasonGoalResultEventId(2)).toBe(396)
    expect(seasonGoalResultEventId(0)).toBe(396)
  })

  it('보상 표는 s_event 2a 절 그대로다', () => {
    expect(SEASON_GOAL_REWARDS[393]).toEqual({ popularity: 25, reputation: 30, money: 35 })
    expect(SEASON_GOAL_REWARDS[394]).toEqual({ popularity: 20, reputation: 0, money: 20 })
    expect(SEASON_GOAL_REWARDS[395]).toEqual({ popularity: 0, reputation: 0, money: 0 })
    expect(SEASON_GOAL_REWARDS[396]).toEqual({ popularity: -10, reputation: -5, money: 0 })
  })

  it('연차 보정 — 393·394 는 +5y, 396 은 인기도 −10y · 평판 −2y', () => {
    expect(seasonGoalYearBonusOf(393, 4)).toEqual({ popularity: 20, reputation: 20, money: 20 })
    // 394 에는 평판 보상이 없어 보정도 없다
    expect(seasonGoalYearBonusOf(394, 4)).toEqual({ popularity: 20, reputation: 0, money: 20 })
    expect(seasonGoalYearBonusOf(396, 4)).toEqual({ popularity: -40, reputation: -8, money: 0 })
    expect(seasonGoalYearBonusOf(395, 9)).toEqual({ popularity: 0, reputation: 0, money: 0 })
  })
})
