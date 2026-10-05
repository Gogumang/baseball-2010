import { describe, expect, it } from 'vitest'
import { createPitcherCareer, EMPTY_PITCHER_SEASON_STATS } from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherCareer, PitcherSeasonStats } from '@/entities/pitcher-career/model/pitcherCareer'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import {
  achievedPitcherGoalCount,
  pitcherYearGoalsOf,
} from '@/entities/pitcher-career/model/pitcherYearGoals'
import { PITCHER_YEAR_GOALS } from '@/shared/config/original/yearGoals'

const 투수 = (overrides: Partial<PitcherCareer> = {}): PitcherCareer => ({
  ...createPitcherCareer('테스트'),
  ...overrides,
})
const 성적 = (overrides: Partial<PitcherSeasonStats>): PitcherSeasonStats => ({
  ...EMPTY_PITCHER_SEASON_STATS,
  ...overrides,
})

describe('투수 올해의 목표 표 0xd7e9a (생성기 산출)', () => {
  it('선발 표 1년차는 [방어율 3.80, 실점 66, 5승, 40삼진, 인기도 +50] 이다', () => {
    expect(PITCHER_YEAR_GOALS[0][0]).toEqual([380, 66, 5, 40, 50])
    expect(PITCHER_YEAR_GOALS[0][12]).toEqual([200, 30, 17, 100, 130])
  })

  it('마무리 표는 +0x82 바이트(65칸) 뒤다', () => {
    expect(PITCHER_YEAR_GOALS[1][0]).toEqual([280, 50, 7, 30, 50])
    expect(PITCHER_YEAR_GOALS[1][12]).toEqual([100, 10, 24, 66, 130])
  })
})

describe('목표 판정 0xa3de8 — 투수 갈래', () => {
  it('보직이 마무리(2)면 둘째 표를 쓴다', () => {
    expect(pitcherYearGoalsOf(투수({ season: 3 }))).toEqual([350, 60, 7, 50, 70])
    expect(pitcherYearGoalsOf(투수({ season: 3, role: PITCHER_ROLE.relief }))).toEqual([250, 43, 10, 36, 70])
  })

  it('단계 1(중간)은 방어율을 빼고 넷을 >>1 한다', () => {
    expect(pitcherYearGoalsOf(투수(), '중간')).toEqual([380, 33, 2, 20, 25])
  })

  it('단계 2(MVP)는 방어율·실점을 10% 낮추고 나머지 셋을 10% 올린다 (버림)', () => {
    expect(pitcherYearGoalsOf(투수(), 'MVP')).toEqual([342, 60, 5, 44, 55])
  })

  it('단계 3(국가대표)·0(연말)은 표 그대로다', () => {
    expect(pitcherYearGoalsOf(투수(), '국가대표')).toEqual(pitcherYearGoalsOf(투수(), '연말'))
  })

  it('다섯 칸을 모두 채우면 5 — 방어율·실점은 이하, 나머지는 이상이다 (같아도 달성)', () => {
    // 아웃 216 · 실점 30 → 방어율 trunc(30·2700/216) = 375 ≤ 380
    const 다섯 = 투수({
      stats: 성적({ outs: 216, runsAllowed: 30, wins: 5, strikeouts: 40 }),
      popularity: 150,
      popularityAtSeasonStart: 100,
    })
    expect(achievedPitcherGoalCount(다섯)).toBe(5)
    expect(achievedPitcherGoalCount({ ...다섯, popularity: 149 })).toBe(4)
    expect(achievedPitcherGoalCount({ ...다섯, stats: { ...다섯.stats, runsAllowed: 67 } })).toBe(3)
  })

  it('마무리는 세이브 + 승으로 셋째 목표를 본다', () => {
    const 마무리 = 투수({ role: PITCHER_ROLE.relief, stats: 성적({ outs: 300, wins: 3, saves: 4 }) })
    const 선발 = { ...마무리, role: PITCHER_ROLE.starter }
    // 마무리 1년차 승 목표 7 = 3 + 4
    const 마무리셈 = achievedPitcherGoalCount(마무리)
    expect(achievedPitcherGoalCount({ ...마무리, stats: { ...마무리.stats, saves: 3 } })).toBe(마무리셈 - 1)
    // 선발이면 세이브를 안 센다 — 승 3 < 5
    expect(achievedPitcherGoalCount(선발)).toBe(achievedPitcherGoalCount({ ...선발, stats: { ...선발.stats, saves: 0 } }))
  })

  it('⚠️ 원본 그대로 — 한 번도 안 던졌으면 방어율 0·실점 0 이라 두 칸은 달성이다', () => {
    expect(achievedPitcherGoalCount(투수())).toBe(2)
  })
})
