import { describe, expect, it } from 'vitest'
import { createCareer } from '@/entities/career/model/playerCareer'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { EMPTY_SEASON_STATS } from '@/entities/career/model/seasonStats'
import {
  achievedGoalCount,
  applyEndingBonus,
  canContinueAfterEnding,
  continueAfterEnding,
  endingBonusOf,
  applySalaryChange,
  goalResultEventId,
  judgeEnding,
  midSeasonTitlesOf,
  midSeasonEventId,
  salaryResultEventId,
  yearEndEventId,
  yearGoalsOf,
} from '@/entities/career/model/seasonFlow'

const 선수 = (overrides: Partial<PlayerCareer> = {}, stats: Partial<typeof EMPTY_SEASON_STATS> = {}): PlayerCareer => ({
  ...createCareer('테스트'),
  ...overrides,
  stats: { ...EMPTY_SEASON_STATS, ...stats },
})

describe('올해의 목표 — binary.mod 0xd7f9e', () => {
  it('1년차 목표는 타율 .260 · 44안타 · 3홈런 · 22타점 · 인기도 +50', () => {
    expect(yearGoalsOf(선수())).toEqual([260, 44, 3, 22, 50])
  })

  it('13년차 뒤에도 마지막 줄을 쓴다', () => {
    expect(yearGoalsOf(선수({ season: 15 }))).toEqual([440, 80, 22, 48, 130])
  })

  it('타율은 버림으로 잰다 — .2596 은 .260 미달 (b8e3d)', () => {
    const 선수기록 = 선수({ popularity: 55, popularityAtSeasonStart: 5 }, { atBats: 10000, hits: 2596, homeRuns: 3, runsBattedIn: 22 })

    expect(achievedGoalCount(선수기록, '연말')).toBe(4)
  })

  it('연말에는 다섯 목표를 전부 센다', () => {
    const 선수기록 = 선수({ popularity: 60, popularityAtSeasonStart: 5 }, { atBats: 100, hits: 44, homeRuns: 3, runsBattedIn: 21 })

    expect(achievedGoalCount(선수기록, '연말')).toBe(4)
  })

  it('중간평가는 타율 외 네 목표를 절반 기준으로 센다 (0xa3de8 단계 1)', () => {
    const 중간 = 선수({ popularity: 29, popularityAtSeasonStart: 5 }, { atBats: 50, hits: 22, homeRuns: 1, runsBattedIn: 11 })

    // 타율 .440 ≥ .260 · 22 ≥ 22 · 1 ≥ 1 · 11 ≥ 11 · 인기도 +24 < 25
    expect(achievedGoalCount(중간, '중간')).toBe(4)
  })
})

describe('평가 이벤트 선택', () => {
  it('중간평가 4~5개 452 · 2~3개 453 · 0~1개 454', () => {
    expect([5, 4, 3, 2, 1, 0].map(midSeasonEventId)).toEqual([452, 452, 453, 453, 454, 454])
  })

  it('연말 목표 5개 393 · 4개 394 · 3개 395 · 그 밖 396', () => {
    expect([5, 4, 3, 2, 0].map(goalResultEventId)).toEqual([393, 394, 395, 396, 396])
  })
})

describe('엔딩 판정 — 0xa3a84 (P 인기도 · R 평판 · M 소지금 100만원 단위)', () => {
  it('7년차 전에는 엔딩이 없다', () => {
    expect(judgeEnding(선수({ season: 6, popularity: 0 }))).toBeNull()
  })

  it('7년차에 인기도 499 이하면 방출(1)', () => {
    expect(judgeEnding(선수({ season: 7, popularity: 499 }))).toBe(1)
  })

  it('13년차 상위 엔딩 — 총장(8)·국가대표 감독(7)·명예의 전당(6)', () => {
    expect(judgeEnding(선수({ season: 13, popularity: 3001, reputation: 700, money: 40_000 }))).toBe(8)
    expect(judgeEnding(선수({ season: 13, popularity: 2501, reputation: 500 }))).toBe(7)
    expect(judgeEnding(선수({ season: 13, popularity: 2001, reputation: 300 }))).toBe(6)
  })

  it('13년차 인기도 3500 초과에 전설 스킬(7)이 있으면 전설(9)', () => {
    expect(judgeEnding(선수({ season: 13, popularity: 3501, skillIds: [7] }))).toBe(9)
    expect(judgeEnding(선수({ season: 13, popularity: 3501, reputation: 0 }))).toBe(5)
  })

  it('인기도가 정확히 1000 이면 판정이 없다 (원본 −1)', () => {
    expect(judgeEnding(선수({ season: 8, popularity: 1000 }))).toBeNull()
  })

  it('7년차 이상 공통 — 영구결번(5)·구단주(4)·코치(3)·은퇴식(2)', () => {
    expect(judgeEnding(선수({ season: 8, popularity: 1501 }))).toBe(5)
    expect(judgeEnding(선수({ season: 8, popularity: 1001, money: 20_000 }))).toBe(4)
    expect(judgeEnding(선수({ season: 8, popularity: 1001 }))).toBe(3)
    expect(judgeEnding(선수({ season: 8, popularity: 999 }))).toBe(2)
  })
})

describe('연말 이벤트 (0x10c54)', () => {
  it('방출이면 501, 13년차면 504, 7년차 이상이면 은퇴 선택 502, 그 밖엔 연봉협상 380', () => {
    expect(yearEndEventId(선수({ season: 7, popularity: 100 }))).toBe(501)
    expect(yearEndEventId(선수({ season: 13, popularity: 5000 }))).toBe(504)
    expect(yearEndEventId(선수({ season: 7, popularity: 800 }))).toBe(502)
    expect(yearEndEventId(선수({ season: 3 }))).toBe(380)
  })
})

describe('연봉 협상 (0x8d05a, 0x8cac0)', () => {
  it('타이틀 등급 0 이면 강경 387 · 정중 391', () => {
    expect(salaryResultEventId(381, 0)).toBe(387)
    expect(salaryResultEventId(382, 0)).toBe(391)
    expect(salaryResultEventId(381, 5)).toBe(384)
  })

  it('연봉 = (인기도 상승/4 와 1 중 큰 값 + 이전 연봉) × 변동률', () => {
    const career = 선수({ popularity: 45, popularityAtSeasonStart: 5, salary: 100 })

    expect(applySalaryChange(career, 0).salary).toBe(143)
    // 원본은 base − trunc(base × 20 / 100) = 110 − 22
    expect(applySalaryChange(career, 3).salary).toBe(88)
    expect(applySalaryChange(선수({ popularity: 1000, popularityAtSeasonStart: 0, salary: 848 }), 3).salary).toBe(879)
    expect(applySalaryChange(career, 8).salary).toBe(110)
  })
})

describe('중간평가 칭호 — 0x11e84', () => {
  it('1년차에 다섯 개를 모두 달성하면 칭호 1 "떠오르는 샛별"', () => {
    expect(midSeasonTitlesOf(선수({ season: 1 }), 5)).toEqual(['떠오르는 샛별'])
    expect(midSeasonTitlesOf(선수({ season: 1 }), 4)).toEqual([])
  })

  it('2년차부터는 지난 중간평가가 1개 이하였다가 5개면 칭호 9 "제 2의 전성기"', () => {
    expect(midSeasonTitlesOf(선수({ season: 3, lastMidSeasonGoalCount: 1 }), 5)).toEqual(['제 2의 전성기'])
    expect(midSeasonTitlesOf(선수({ season: 3, lastMidSeasonGoalCount: 2 }), 5)).toEqual([])
  })
})

describe('엔딩 뒤 — 0x1220c', () => {
  it('엔딩 보너스는 표 0xcc40c × 1000 G포인트이고 부상·방출(0·1)은 0', () => {
    expect([0, 1, 2, 5, 9].map(endingBonusOf)).toEqual([0, 0, 4000, 12_000, 20_000])
  })

  it('보너스를 G포인트에 더한다', () => {
    expect(applyEndingBonus(선수({ gamePoint: 100 }), 3).gamePoint).toBe(8100)
  })

  it('부상·방출 엔딩만 5000 G포인트로 이어할 수 있고, 모자라면 못 한다', () => {
    expect(canContinueAfterEnding(선수({ gamePoint: 5000 }), 1)).toBe(true)
    expect(canContinueAfterEnding(선수({ gamePoint: 4999 }), 1)).toBe(false)
    expect(canContinueAfterEnding(선수({ gamePoint: 9000 }), 2)).toBe(false)
  })

  it('방출 엔딩을 이어하면 5000 G포인트를 쓰고 다음 연차로 간다 (0x1bd36, 점검 9차)', () => {
    const continued = continueAfterEnding(선수({ gamePoint: 6000, endingIndex: 1, season: 3, morale: 10 }))

    expect(continued.gamePoint).toBe(1000)
    expect(continued.endingIndex).toBeNull()
    expect(continued.season).toBe(4)
    expect(continued.morale).toBe(100)
  })

  it('부상 엔딩을 이어하면 같은 시즌 그 자리에서 부상만 풀고 계속한다', () => {
    const continued = continueAfterEnding(선수({ gamePoint: 5000, endingIndex: 0, season: 3, gamesPlayed: 20, isInjured: true }))

    expect([continued.season, continued.gamesPlayed, continued.isInjured]).toEqual([3, 20, false])
  })
})
