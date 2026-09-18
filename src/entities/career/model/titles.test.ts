import { describe, expect, it } from 'vitest'
import {
  awardTitles,
  conditionTextOf,
  currentTitleOf,
  evaluateNewTitles,
  TITLE_NAMES,
} from '@/entities/career/model/titles'
import { createCareer, GAMES_PER_SEASON } from '@/entities/career/model/playerCareer'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { EMPTY_SEASON_STATS } from '@/entities/career/model/seasonStats'
import { ORIGINAL_TITLES } from '@/shared/config/original/titles'

function 선수(overrides: Partial<PlayerCareer> = {}, careerStats: Partial<typeof EMPTY_SEASON_STATS> = {}): PlayerCareer {
  return {
    ...createCareer('테스트'),
    ...overrides,
    careerStats: { ...EMPTY_SEASON_STATS, ...careerStats },
  }
}

describe('원본 칭호 데이터 — StrNICKNAME 은 이름 64개 + 조건 원문 64개', () => {
  it('128개를 이름과 조건으로 나눈다', () => {
    expect(ORIGINAL_TITLES).toHaveLength(128)
    expect(TITLE_NAMES).toHaveLength(64)
    expect(TITLE_NAMES[35]).toBe('안타제조기')
    expect(conditionTextOf('안타제조기')).toBe('통산 500안타 달성')
  })
})

describe('evaluateNewTitles — 원문 조건', () => {
  it('새 선수는 "이름 없는 신인" 만 얻는다', () => {
    expect(evaluateNewTitles(선수())).toEqual(['이름 없는 신인'])
  })

  it('통산 500안타면 안타제조기, 100홈런이면 떠오르는 홈런 타자', () => {
    const titles = evaluateNewTitles(선수({}, { hits: 500, homeRuns: 100 }))

    expect(titles).toContain('안타제조기')
    expect(titles).toContain('떠오르는 홈런 타자')
    expect(titles).not.toContain('넘버원 슬러거')
  })

  it('기록의 사나이는 700안타·400타점·250홈런을 모두 채워야 한다', () => {
    expect(evaluateNewTitles(선수({}, { hits: 700, runsBattedIn: 400, homeRuns: 249 }))).not.toContain('기록의 사나이')
    expect(evaluateNewTitles(선수({}, { hits: 700, runsBattedIn: 400, homeRuns: 250 }))).toContain('기록의 사나이')
  })

  it('훈련 100회면 야구 머신, 200회면 꽃보다 야구', () => {
    const titles = evaluateNewTitles(선수({ trainingCounts: { 히트: 60, 파워: 50 } }))

    expect(titles).toContain('야구 머신')
    expect(titles).not.toContain('꽃보다 야구')
  })

  it('1년간 외출 조건은 시즌이 끝났을 때만 본다', () => {
    const 시즌중 = 선수({ outingsThisSeason: 0, gamesPlayed: 10 })
    const 시즌끝 = 선수({ outingsThisSeason: 0, gamesPlayed: GAMES_PER_SEASON })

    expect(evaluateNewTitles(시즌중)).not.toContain('은둔형 외톨이')
    expect(evaluateNewTitles(시즌끝)).toContain('은둔형 외톨이')
    expect(evaluateNewTitles(선수({ outingsThisSeason: 20, gamesPlayed: GAMES_PER_SEASON }))).toContain('자유로운 영혼')
  })

  it('평판 700·999, 인기도 2000·4000', () => {
    const titles = evaluateNewTitles(선수({ reputation: 999, popularity: 2500 }))

    expect(titles).toEqual(expect.arrayContaining(['성스러운 영혼', '바른생활 사나이', '슈퍼 스타']))
    expect(titles).not.toContain('월드클래스 슈퍼스타')
  })

  it('9년차 조건은 연차도 본다', () => {
    expect(evaluateNewTitles(선수({ popularity: 2000, season: 8 }))).not.toContain('카리스마 캡틴')
    expect(evaluateNewTitles(선수({ popularity: 2000, season: 9 }))).toContain('카리스마 캡틴')
  })

  it('한 경기 4홈런, 사이클링 히트 2회', () => {
    const titles = evaluateNewTitles(선수({ bestHomeRunsInGame: 4, cycleHitGames: 2 }))

    expect(titles).toContain('다이너마이트 배트')
    expect(titles).toContain('사이클링 히터')
  })

  it('6년차 통산 타율 4할', () => {
    const 타율4할 = { atBats: 100, hits: 40 }

    expect(evaluateNewTitles(선수({ season: 5 }, 타율4할))).not.toContain('공포의 4할 타자')
    expect(evaluateNewTitles(선수({ season: 6 }, 타율4할))).toContain('공포의 4할 타자')
  })

  it('이미 가진 칭호는 다시 주지 않는다', () => {
    const career = awardTitles(선수(), evaluateNewTitles(선수()))

    expect(evaluateNewTitles(career)).toEqual([])
  })
})

describe('currentTitleOf', () => {
  it('칭호가 없으면 첫 칭호, 있으면 가장 최근에 얻은 칭호다', () => {
    expect(currentTitleOf(선수())).toBe('이름 없는 신인')
    expect(currentTitleOf(선수({ titleIds: ['이름 없는 신인', '안타제조기'] }))).toBe('안타제조기')
  })
})

describe('awardTitles', () => {
  it('줄 칭호가 없으면 같은 객체를 돌려준다', () => {
    const career = 선수()

    expect(awardTitles(career, [])).toBe(career)
  })

  it('또또복권 1등 5번은 "행운의 사나이", 100번 구매는 "도박묵시록" (StrNICKNAME[85]·[86])', () => {
    expect(evaluateNewTitles(선수({ titleIds: ['이름 없는 신인'], lotteryFirstPrizes: 5 }))).toContain('행운의 사나이')
    expect(evaluateNewTitles(선수({ titleIds: ['이름 없는 신인'], lotteryPurchases: 100 }))).toContain('도박묵시록')
    expect(evaluateNewTitles(선수({ titleIds: ['이름 없는 신인'], lotteryPurchases: 99 }))).not.toContain('도박묵시록')
  })
})
