import { createConstantRandom } from '@/shared/api/random/fractionRandom'
import { afterEach, describe, expect, it } from 'vitest'
import { bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
import { createCareer, startNextSeason } from '@/entities/career/model/playerCareer'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { EMPTY_SEASON_STATS } from '@/entities/career/model/seasonStats'
import { effectiveAbilityOf, equippedAbilityOf } from '@/entities/career/model/condition'
import {
  nariRecordSalaryGradeOfCareer,
  achievedGoalCount,
  applyEndingBonus,
  canContinueAfterEnding,
  continueAfterEnding,
  endingBonusOf,
  romanceEndingIndexOf,
  romanceEventsSeenOf,
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

describe('연애 엔딩 10~14 — 0x87c7c (0x87f4c~0x87fd6)', () => {
  it('c = 1 + 본 연애 이벤트(300~303) 수, 엔딩은 9 + c', () => {
    expect(romanceEndingIndexOf(2, [])).toBe(10)
    expect(romanceEndingIndexOf(5, ['300'])).toBe(11)
    expect(romanceEndingIndexOf(9, ['301', '303'])).toBe(12)
    expect(romanceEndingIndexOf(3, ['300', '301', '302'])).toBe(13)
    expect(romanceEndingIndexOf(8, ['303', '302', '301', '300', '128'])).toBe(14)
  })

  it('부상(0)·방출(1) 엔딩에는 붙지 않는다', () => {
    expect(romanceEndingIndexOf(0, ['300'])).toBeNull()
    expect(romanceEndingIndexOf(1, [])).toBeNull()
  })

  it('본 연애 이벤트는 이벤트 번호 순서로 센다', () => {
    expect(romanceEventsSeenOf(['303', '300', '12'])).toEqual([300, 303])
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

  it('연봉 칸 +0x1c8 은 u16 — 0xa4fd8 strh 로 65536 을 넘으면 감긴다(상한에 붙지 않는다)', () => {
    // base = 1 + 60000 · +30% → 60001 + 18000 = 78001 → 78001 − 65536
    expect(applySalaryChange(선수({ popularity: 0, popularityAtSeasonStart: 0, salary: 60000 }), 0).salary).toBe(78001 - 65536)
  })

  it('레코드 +0x1b 는 감기기 전 v 로 센다 — 0xa4fd8 a4ff6~a5006 min(v / 10, 255), v 는 0x8cac0 의 32비트 정수 (r244)', () => {
    const wrapped = applySalaryChange(선수({ popularity: 0, popularityAtSeasonStart: 0, salary: 60000 }), 0)
    // 감긴 연봉 12465 의 1/10 = 1246 → 255 가 아니라, v = 78001 의 1/10 → 255
    expect(wrapped.salaryRecordGrade).toBe(255)
    expect(nariRecordSalaryGradeOfCareer(wrapped)).toBe(255)
    // 감김 경계 바로 뒤 — 감긴 값은 작아도 레코드는 255
    const edge = applySalaryChange(선수({ popularity: 0, popularityAtSeasonStart: 0, salary: 65535 }), 8)
    expect(edge.salary).toBe(0)
    expect(nariRecordSalaryGradeOfCareer(edge)).toBe(255)
    // 보상 20 을 안 탄 선수(등록 0x10fb4 의 v = 0x32)는 지금 연봉에서 센다
    expect(nariRecordSalaryGradeOfCareer(선수({ salary: 50 }))).toBe(5)
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

  it('판정 없음(−1)은 이어하기도 보너스도 없다 — 키 0x1220c 의 `cmp e,#1 ; bhi` 는 부호 없음, 보너스 팝업 갈래는 부호 있는 `ble` 로 막힌다', () => {
    expect(canContinueAfterEnding(선수({ gamePoint: 9000 }), -1)).toBe(false)
    expect(endingBonusOf(-1)).toBe(0)
  })

  it('방출 엔딩을 이어하면 5000 G포인트를 쓰고 다음 연차로 간다 (0x1bd36, 점검 9차)', () => {
    const continued = continueAfterEnding(선수({ gamePoint: 6000, endingIndex: 1, season: 3, morale: 10 }), createConstantRandom(0))

    expect(continued.gamePoint).toBe(1000)
    expect(continued.endingIndex).toBeNull()
    expect(continued.season).toBe(4)
    expect(continued.morale).toBe(100)
  })

  describe('방출 이어하기의 +0x6b 사본 · +0x1c2 — 연말 132 꼬리 10d08~10d28 을 안 지났다 (B-128)', () => {
    afterEach(() => setBugfixConfigForTests(null))
    const 방출 = () => 선수({
      gamePoint: 6000, endingIndex: 1, season: 7,
      trainingCounts: { '0': 30, '1': 12 }, seasonStartTrainingCounts: { '0': 20, '1': 4 }, seasonPopularityGain: 9,
    })

    it('원본: 사본은 앞 해 132 것 · 인기도 합은 그 해 합 그대로 다음 해로 넘어간다', () => {
      const continued = continueAfterEnding(방출(), createConstantRandom(0))

      expect(continued.season).toBe(8)
      expect(continued.seasonStartTrainingCounts).toEqual({ '0': 20, '1': 4 })
      expect(continued.seasonPopularityGain).toBe(9)
    })

    it('고친 길: 다른 새 시즌처럼 사본을 새로 뜨고 인기도 합을 0 으로', () => {
      setBugfixConfigForTests(bugfixConfigWith(['B-128']))
      const continued = continueAfterEnding(방출(), createConstantRandom(0))

      expect(continued.seasonStartTrainingCounts).toEqual({ '0': 30, '1': 12 })
      expect(continued.seasonPopularityGain).toBe(0)
    })

    it('132 를 거친 새 시즌(연봉 · 대회 뒤)은 원본에서도 새로 뜬다 — 132 와 0x1b768 사이엔 훈련 · 평가가 없다', () => {
      const next = startNextSeason(방출(), createConstantRandom(0))

      expect(next.seasonStartTrainingCounts).toEqual({ '0': 30, '1': 12 })
      expect(next.seasonPopularityGain).toBe(0)
    })
  })

  it('부상 엔딩을 이어하면 같은 시즌 그 자리에서 부상만 풀고 계속한다', () => {
    const continued = continueAfterEnding(선수({ gamePoint: 5000, endingIndex: 0, season: 3, gamesPlayed: 20, isInjured: true }), createConstantRandom(0))

    expect([continued.season, continued.gamesPlayed, continued.isInjured]).toEqual([3, 20, false])
  })

  it('부상 엔딩 이어하기는 남은 부상 기간(+0x1b5)·부상 경기 수(+0x1b6)도 0 으로 지운다 (0x1bddc~0x1bdfa)', () => {
    const injured = 선수({ gamePoint: 5000, endingIndex: 0, isInjured: true, injuryRemaining: 2, injuredGamesPlayed: 20 })
    const continued = continueAfterEnding(injured, createConstantRandom(0))

    expect([continued.isInjured, continued.injuryRemaining, continued.injuredGamesPlayed]).toEqual([false, 0, 0])
    // 부상 −60%(0xb57b4) 는 풀린 뒤 남지 않는다
    expect(effectiveAbilityOf(continued)).toEqual(equippedAbilityOf(continued))
  })
})

describe('올해의 목표 창 값 — 0x8656c 타자 갈래', () => {
  it('현재 = 타율(0xb8e3d) · 안타 · 홈런 · 타점 · max(0, 인기도 − 시즌 시작 인기도), 목표 = 표 그대로', async () => {
    const { yearGoalWindowValuesOf, yearGoalsOf } = await import('@/entities/career/model/seasonFlow')
    const career = {
      ...createCareer('창'),
      stats: { ...EMPTY_SEASON_STATS, atBats: 3, hits: 1, homeRuns: 2, runsBattedIn: 4 },
      popularity: 90,
      popularityAtSeasonStart: 100,
    }
    expect(yearGoalWindowValuesOf(career)).toEqual({ labelSet: 0, current: [333, 1, 2, 4, 0], goals: yearGoalsOf(career) })
    expect(yearGoalWindowValuesOf({ ...career, stats: EMPTY_SEASON_STATS }).current[0]).toBe(0)
  })
})
