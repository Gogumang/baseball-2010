import { describe, expect, it } from 'vitest'
import {
  POSTSEASON_OUTSIDE_RANK,
  SEASON_GOAL_REWARDS,
  SEASON_YEAR_GOALS,
  achievedSeasonGoalCount,
  battingAverageOf,
  earnedRunAverageOf,
  goalRankOf,
  teamBattingAverageOf,
  teamEarnedRunAverageOf,
  seasonGoalResultEventId,
  seasonGoalWindowNumbersOf,
  seasonGoalWindowRankOf,
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

describe('목표 ③ 팀 타율 0xa3700(SR, 1) · ④ 팀 방어율 0xa3764', () => {
  it('타율 0xb8e3c — 안타×1000/타수 버림, 1000 상한, 타수 0 이면 0', () => {
    expect(battingAverageOf({ atBats: 3, hits: 1 })).toBe(333)
    expect(battingAverageOf({ atBats: 0, hits: 0 })).toBe(0)
    expect(battingAverageOf({ atBats: 2, hits: 5 })).toBe(1000)
  })

  it('팀 타율은 타자 0~8번 아홉 명의 타율 합 ÷ 9 — 아홉 명이 안 되면 빈 칸은 0 이다', () => {
    const 줄 = Array.from({ length: 12 }, (_unused, index) => ({ atBats: 10, hits: index }))
    // 0,100,…,800 의 합 3600 ÷ 9 = 400 (벤치 9~11 은 안 센다)
    expect(teamBattingAverageOf(줄)).toBe(400)
    expect(teamBattingAverageOf([{ atBats: 4, hits: 3 }])).toBe(Math.trunc(750 / 9))
  })

  it('방어율 0xb6ce8 — 실점×2700/아웃, 9999 상한, 아웃 0 이면 실점 있으면 9999 · 없으면 0', () => {
    expect(earnedRunAverageOf({ outs: 27, runsAllowed: 3 })).toBe(300)
    expect(earnedRunAverageOf({ outs: 0, runsAllowed: 1 })).toBe(9999)
    expect(earnedRunAverageOf({ outs: 0, runsAllowed: 0 })).toBe(0)
  })

  it('팀 방어율은 투수 전원의 평균 — 안 던진 투수의 0 이 평균을 낮춘다 (원본 그대로)', () => {
    expect(teamEarnedRunAverageOf([{ outs: 27, runsAllowed: 3 }, { outs: 0, runsAllowed: 0 }])).toBe(150)
  })
})

describe('목표 ① 순위 0xb7aa0(L, 팀, 0)', () => {
  it('포스트시즌이 아니면 정규시즌 순위 그대로', () => {
    expect(goalRankOf(3, 5, null)).toBe(5)
  })

  it('포스트시즌 중이면 대진 칸 순위 — 1위 1 · 2위 2 · 3·4위 3 · 대진 밖 10', () => {
    const 대진 = { champion: null, pairs: [[1, null], [2, null], [3, 4]] }
    expect(goalRankOf(1, 0, 대진)).toBe(1)
    expect(goalRankOf(2, 1, 대진)).toBe(2)
    expect(goalRankOf(4, 3, 대진)).toBe(3)
    expect(goalRankOf(7, 6, 대진)).toBe(POSTSEASON_OUTSIDE_RANK)
    expect(goalRankOf(4, 3, { ...대진, champion: 4 })).toBe(0)
  })
})

describe('올해의 목표 창 시즌모드 갈래의 숫자 (0x8656c 모드 2)', () => {
  it('목표는 0xd4406 — 판정 표 0xd7cf6 과 같은 값을 그대로(순위는 0부터 센 문턱 그대로) 그린다', () => {
    expect(seasonGoalWindowNumbersOf(3, 다섯개달성, 1).goals).toEqual([3, 64, 280, 360, 80])
  })

  it('현재 ②~④ 는 판정 재료 그대로 · ⑤ 인기도 상승만 0 아래를 자른다', () => {
    const 입력 = { ...다섯개달성, wins: 25, losses: 20, popularityGain: -7 }
    expect(seasonGoalWindowNumbersOf(0, 입력, 2).current).toEqual([2, 55, 400, 100, 0])
  })

  it('현재 ① — 경기 수 0 · 포스트시즌 아님이면 0, 그 밖 정규시즌 순위 + 1 (0xb7aa0 셋째 인자 1)', () => {
    expect(seasonGoalWindowRankOf(4, 0, false)).toBe(0)
    expect(seasonGoalWindowRankOf(4, 3, false)).toBe(5)
    // 포스트시즌 첫날(392)은 경기 수가 0 이어도 정규시즌 순위를 그린다 — 판정의 대진 순위와 다를 수 있다
    expect(seasonGoalWindowRankOf(2, 0, true)).toBe(3)
  })
})
