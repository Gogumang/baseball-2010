import { describe, expect, it } from 'vitest'
import { createPitcherCareer, EMPTY_PITCHER_SEASON_STATS } from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import {
  enterPitcherYearEndEvent,
  finishPitcherYearEndEvent,
  nextPitcherYearEndStep,
  pitcherYearEndEventIdOf,
  pitcherYearEndRewardsOf,
} from '@/entities/pitcher-career/model/pitcherYearEnd'
import { salaryOfferOf } from '@/entities/career/model/seasonFlow'

const 투수 = (overrides: Partial<PitcherCareer> = {}): PitcherCareer => ({
  ...createPitcherCareer('테스트'),
  ...overrides,
})

/** 규정 이닝을 넘겨 리그 표가 빈 채로 세 타이틀을 다 먹는 성적 */
const 좋은성적 = {
  ...EMPTY_PITCHER_SEASON_STATS,
  games: 12,
  outs: 405,
  runsAllowed: 10,
  strikeouts: 200,
  wins: 20,
  losses: 1,
}

describe('투수편 연말 사슬 (상태 136 → 130 → 131 → 132)', () => {
  it('처음은 392 올해의 목표다', () => {
    expect(nextPitcherYearEndStep(투수(), [])).toEqual({ kind: '이벤트', eventId: 392 })
  })

  it('392 뒤 목표 달성 수로 393~396 — 투수 표로 센다', () => {
    // 안 던진 신인은 방어율·실점 두 칸만 달성 → 396
    expect(nextPitcherYearEndStep(투수(), [392])).toEqual({ kind: '이벤트', eventId: 396 })
    // 좋은 성적 + 인기도 +50 → 다섯 개 → 393
    const 잘함 = 투수({ stats: 좋은성적, popularity: 150, popularityAtSeasonStart: 100 })
    expect(nextPitcherYearEndStep(잘함, [392])).toEqual({ kind: '이벤트', eventId: 393 })
  })

  it('목표 결과 → 370 타이틀 → 371 + 수상 수 → 375 MVP → 377/376', () => {
    const 잘함 = 투수({ stats: 좋은성적 })
    expect(nextPitcherYearEndStep(잘함, [392, 393])).toEqual({ kind: '이벤트', eventId: 370 })
    expect(nextPitcherYearEndStep(잘함, [392, 393, 370])).toEqual({ kind: '이벤트', eventId: 374 })
    expect(nextPitcherYearEndStep(투수(), [392, 396, 370])).toEqual({ kind: '이벤트', eventId: 371 })
    expect(nextPitcherYearEndStep(잘함, [392, 393, 370, 374])).toEqual({ kind: '이벤트', eventId: 375 })
    expect(nextPitcherYearEndStep(잘함, [392, 393, 370, 374, 375])).toEqual({ kind: '이벤트', eventId: 377 })
    expect(nextPitcherYearEndStep(투수(), [392, 396, 370, 371, 375])).toEqual({ kind: '이벤트', eventId: 376 })
  })

  it('MVP 결과 뒤 연말 분기 0x10c54 — 380 · 502 · 501 · 504', () => {
    const 본것 = [392, 396, 370, 371, 375, 376]
    expect(nextPitcherYearEndStep(투수({ season: 3 }), 본것)).toEqual({ kind: '이벤트', eventId: 380 })
    expect(nextPitcherYearEndStep(투수({ season: 8, popularity: 100 }), 본것)).toEqual({ kind: '이벤트', eventId: 502 })
    expect(nextPitcherYearEndStep(투수({ season: 7, popularity: 100 }), 본것)).toEqual({ kind: '이벤트', eventId: 501 })
    expect(pitcherYearEndEventIdOf(투수({ season: 13, popularity: 1200 }))).toBe(504)
  })

  it('강경 381 / 정중 382 → 등급 k 로 결과가 정해진다 (확률이 아니다)', () => {
    const 앞 = [392, 396, 370, 371, 375, 376, 380]
    // k = 0 → 387 / 391
    expect(nextPitcherYearEndStep(투수(), [...앞, 381])).toEqual({ kind: '이벤트', eventId: 387 })
    expect(nextPitcherYearEndStep(투수(), [...앞, 382])).toEqual({ kind: '이벤트', eventId: 391 })
    // 타이틀 3 + MVP 비트 2 = 5 → 384 / 388 — 비트는 375 에 들어갈 때 남는다
    const 잘함 = enterPitcherYearEndEvent(투수({ stats: 좋은성적 }), 375)
    expect(nextPitcherYearEndStep(잘함, [...앞, 381])).toEqual({ kind: '이벤트', eventId: 384 })
    expect(nextPitcherYearEndStep(잘함, [...앞, 382])).toEqual({ kind: '이벤트', eventId: 388 })
    // 비트가 없으면 타이틀 3 → k 3 → 385
    expect(nextPitcherYearEndStep(투수({ stats: 좋은성적 }), [...앞, 381])).toEqual({ kind: '이벤트', eventId: 385 })
  })

  it('연봉 결과·수락 뒤는 새 시즌, 엔딩 이벤트 뒤는 엔딩이다', () => {
    expect(nextPitcherYearEndStep(투수(), [380, 383])).toEqual({ kind: '새시즌' })
    expect(nextPitcherYearEndStep(투수(), [380, 381, 387])).toEqual({ kind: '새시즌' })
    expect(nextPitcherYearEndStep(투수({ season: 7, popularity: 100 }), [501])).toEqual({ kind: '엔딩', endingIndex: 1 })
    expect(nextPitcherYearEndStep(투수({ season: 9, popularity: 1600 }), [502, 496, 503])).toEqual({
      kind: '엔딩',
      endingIndex: 5,
    })
  })
})

describe('연말 이벤트 보상 (명령 7, 점프표 0xd4e50)', () => {
  it('보상은 r_event 데이터에서 읽는다', () => {
    expect(pitcherYearEndRewardsOf(377)).toEqual([
      { kind: 0, value: 20 },
      { kind: 1, value: 30 },
      { kind: 3, value: 10 },
    ])
    expect(pitcherYearEndRewardsOf(371)).toEqual([])
  })

  it('타이틀 372~374 는 소지금 +3/+6/+10 (100만 단위)', () => {
    const 앞 = 투수({ money: 1000 })
    expect(finishPitcherYearEndEvent(앞, 372).money).toBe(1300)
    expect(finishPitcherYearEndEvent(앞, 373).money).toBe(1600)
    expect(finishPitcherYearEndEvent(앞, 374).money).toBe(2000)
  })

  it('MVP 377 은 인기도 +20 · 평판 +30 · 소지금 +10', () => {
    const 앞 = 투수({ popularity: 100, reputation: 100, money: 0 })
    const 뒤 = finishPitcherYearEndEvent(앞, 377)
    expect([뒤.popularity, 뒤.reputation, 뒤.money]).toEqual([120, 130, 1000])
  })

  it('393~396 은 연차 보정이 붙는다 (0x8d508) — 3년차 393: 인기도 30+6 · 평판 44−4 · 소지금 20+2', () => {
    const 앞 = 투수({ season: 3, popularity: 100, reputation: 100, money: 0 })
    const 뒤 = finishPitcherYearEndEvent(앞, 393)
    expect([뒤.popularity, 뒤.reputation, 뒤.money]).toEqual([136, 140, 2200])
    // 1년차는 보정이 없다
    const 신인 = finishPitcherYearEndEvent(투수({ popularity: 100, reputation: 100, money: 0 }), 396)
    expect([신인.popularity, 신인.reputation]).toEqual([95, 96])
  })

  it('연봉 보상 20 — 380 제시액이 base 이고 강경 384 는 +30% 다 (0x8cac0)', () => {
    const 앞 = 투수({ salary: 50, popularity: 300, popularityAtSeasonStart: 100 })
    // 상승분 = max(1, trunc(200/4)) = 50 → 제시 100
    expect(salaryOfferOf(앞)).toEqual({ raise: 50, salary: 100 })
    expect(finishPitcherYearEndEvent(앞, 384).salary).toBe(130)
    // 수락 383 = +0% 평판 +20
    const 수락 = finishPitcherYearEndEvent({ ...앞, reputation: 100 }, 383)
    expect([수락.salary, 수락.reputation]).toEqual([100, 120])
    // 강경 실패 387 = −20% 평판 −30
    const 삭감 = finishPitcherYearEndEvent({ ...앞, reputation: 100 }, 387)
    expect([삭감.salary, 삭감.reputation]).toEqual([80, 70])
  })

  it('375 에 들어갈 때만 MVP 비트를 남긴다 (상태 131)', () => {
    const 잘함 = 투수({ season: 2, stats: 좋은성적 })
    expect(enterPitcherYearEndEvent(잘함, 375).mvpSeasonBits).toBe(1 << 1)
    expect(enterPitcherYearEndEvent(잘함, 370)).toBe(잘함)
  })
})
