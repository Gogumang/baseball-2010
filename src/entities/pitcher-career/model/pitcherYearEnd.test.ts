import { describe, expect, it } from 'vitest'
import { createPitcherCareer, EMPTY_PITCHER_SEASON_STATS } from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import {
  enterPitcherYearEndEvent,
  finishPitcherYearEndEvent,
  nextPitcherYearEndStep,
  PITCHER_POSTSEASON_STEP_ID,
  pitcherResumePointOf,
  pitcherYearEndEventIdOf,
  pitcherYearEndRewardsOf,
} from '@/entities/pitcher-career/model/pitcherYearEnd'
import { salaryOfferOf } from '@/entities/career/model/seasonFlow'
import { startPostseason } from '@/entities/league/model/league'
import { ORIGINAL_EVENTS } from '@/shared/config/original/events'

/** 이벤트 한 편을 그 이벤트의 보상 명령으로 끝낸다 — 세션은 재생기가 지나온 보상을 넘긴다 */
const 끝내기 = (career: Parameters<typeof finishPitcherYearEndEvent>[0], eventId: number) =>
  finishPitcherYearEndEvent(career, eventId, pitcherYearEndRewardsOf(eventId, ORIGINAL_EVENTS))

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

  it('연봉 결과·수락 뒤는 새 시즌, 엔딩 요청([0x1552adc] — 첫 종류 21) 뒤는 엔딩이다', () => {
    expect(nextPitcherYearEndStep(투수(), [380, 383])).toEqual({ kind: '새시즌' })
    expect(nextPitcherYearEndStep(투수(), [380, 381, 387])).toEqual({ kind: '새시즌' })
    expect(nextPitcherYearEndStep(투수({ season: 7, popularity: 100 }), [501], true)).toEqual({ kind: '엔딩', endingIndex: 1 })
    expect(nextPitcherYearEndStep(투수({ season: 9, popularity: 1600 }), [502, 496, 503], true)).toEqual({
      kind: '엔딩',
      endingIndex: 5,
    })
    // 엔딩은 본 번호가 아니라 그 칸으로 간다
    expect(nextPitcherYearEndStep(투수({ season: 9, popularity: 1600 }), [502, 496, 503]).kind).not.toBe('엔딩')
  })

  it('엔딩 번호는 본 번호가 아니라 141 진입 0x12300 의 0xa3a85(S) 하나로 판정한다 (모드 갈림 없음)', () => {
    // 본 번호가 501 이어도 판정이 부상(누적 > 19)이면 0, 13년차 504 는 판정값 그대로
    expect(nextPitcherYearEndStep(투수({ season: 7, popularity: 100, injuredGamesPlayed: 20 }), [501], true))
      .toEqual({ kind: '엔딩', endingIndex: 0 })
    expect(nextPitcherYearEndStep(투수({ season: 13, popularity: 2600, reputation: 500 }), [504], true))
      .toEqual({ kind: '엔딩', endingIndex: 7 })
    // 본 번호와 상관없다 — 같은 커리어면 같은 번호
    expect(nextPitcherYearEndStep(투수({ season: 9, popularity: 1600 }), [500], true))
      .toEqual(nextPitcherYearEndStep(투수({ season: 9, popularity: 1600 }), [503], true))
    // 판정 없음(인기도가 정확히 1000)은 −1 그대로
    expect(nextPitcherYearEndStep(투수({ season: 9, popularity: 1000 }), [503], true)).toEqual({ kind: '엔딩', endingIndex: -1 })
  })
})

describe('연말 이벤트 보상 (명령 7, 점프표 0xd4e50)', () => {
  it('보상은 r_event 데이터에서 읽는다', () => {
    expect(pitcherYearEndRewardsOf(377, ORIGINAL_EVENTS)).toEqual([
      { kind: 0, value: 20 },
      { kind: 1, value: 30 },
      { kind: 3, value: 10 },
    ])
    expect(pitcherYearEndRewardsOf(371, ORIGINAL_EVENTS)).toEqual([])
  })

  it('타이틀 372~374 는 소지금 +3/+6/+10 (100만 단위)', () => {
    const 앞 = 투수({ money: 1000 })
    expect(끝내기(앞, 372).money).toBe(1300)
    expect(끝내기(앞, 373).money).toBe(1600)
    expect(끝내기(앞, 374).money).toBe(2000)
  })

  it('MVP 377 은 인기도 +20 · 평판 +30 · 소지금 +10', () => {
    const 앞 = 투수({ popularity: 100, reputation: 100, money: 0 })
    const 뒤 = 끝내기(앞, 377)
    expect([뒤.popularity, 뒤.reputation, 뒤.money]).toEqual([120, 130, 1000])
  })

  it('393~396 은 연차 보정이 붙는다 (0x8d508) — 3년차 393: 인기도 30+6 · 평판 44−4 · 소지금 20+2', () => {
    const 앞 = 투수({ season: 3, popularity: 100, reputation: 100, money: 0 })
    const 뒤 = 끝내기(앞, 393)
    expect([뒤.popularity, 뒤.reputation, 뒤.money]).toEqual([136, 140, 2200])
    // 1년차는 보정이 없다
    const 신인 = 끝내기(투수({ popularity: 100, reputation: 100, money: 0 }), 396)
    expect([신인.popularity, 신인.reputation]).toEqual([95, 96])
  })

  it('연봉 보상 20 — 380 제시액이 base 이고 강경 384 는 +30% 다 (0x8cac0)', () => {
    const 앞 = 투수({ salary: 50, popularity: 300, popularityAtSeasonStart: 100 })
    // 상승분 = max(1, trunc(200/4)) = 50 → 제시 100
    expect(salaryOfferOf(앞)).toEqual({ raise: 50, salary: 100 })
    expect(끝내기(앞, 384).salary).toBe(130)
    // 수락 383 = +0% 평판 +20
    const 수락 = 끝내기({ ...앞, reputation: 100 }, 383)
    expect([수락.salary, 수락.reputation]).toEqual([100, 120])
    // 강경 실패 387 = −20% 평판 −30
    const 삭감 = 끝내기({ ...앞, reputation: 100 }, 387)
    expect([삭감.salary, 삭감.reputation]).toEqual([80, 70])
  })

  it('375 에 들어갈 때만 MVP 비트를 남긴다 (상태 131)', () => {
    const 잘함 = 투수({ season: 2, stats: 좋은성적 })
    expect(enterPitcherYearEndEvent(잘함, 375).mvpSeasonBits).toBe(1 << 1)
    expect(enterPitcherYearEndEvent(잘함, 370).mvpSeasonBits).toBe(잘함.mvpSeasonBits)
  })

  it('상태 진입이 S+0x50 을 적는다 — 392 → 136 · 370 → 130 · 375 → 131 · 132 의 501/504/502/380 → 132', () => {
    const 연말 = 투수({ season: 2 })
    expect(enterPitcherYearEndEvent(연말, 392).seasonEndState).toBe(136)
    expect(enterPitcherYearEndEvent(연말, 370).seasonEndState).toBe(130)
    expect(enterPitcherYearEndEvent(연말, 375).seasonEndState).toBe(131)
    for (const id of [501, 504, 502, 380]) expect(enterPitcherYearEndEvent(연말, id).seasonEndState).toBe(132)
    // 결과 이벤트(393·371·376·384…)와 국가대표(461~464)는 상태를 안 바꾼다
    const 들어감 = { ...연말, seasonEndState: 131 as const }
    expect(enterPitcherYearEndEvent(들어감, 376)).toBe(들어감)
    expect(enterPitcherYearEndEvent({ ...연말, seasonEndState: 132 }, 461).seasonEndState).toBe(132)
  })
})

describe('이어하기 0x1c154 (모드 3·4 공용) — pitcherResumePointOf', () => {
  it('136·130·131·132 는 그 상태가 진입에서 트는 이벤트로', () => {
    expect(pitcherResumePointOf(투수({ seasonEndState: 136 }))).toEqual({ kind: '이벤트', eventId: 392 })
    expect(pitcherResumePointOf(투수({ seasonEndState: 130 }))).toEqual({ kind: '이벤트', eventId: 370 })
    expect(pitcherResumePointOf(투수({ seasonEndState: 131 }))).toEqual({ kind: '이벤트', eventId: 375 })
    expect(pitcherResumePointOf(투수({ season: 2, seasonEndState: 132 }))).toEqual({ kind: '이벤트', eventId: 380 })
  })

  it('128(0xf)이면 대진으로, 경기 뒤(116)면 g 로 — 0 이면 시즌 끝(136 자리), 아니면 128', () => {
    const 대진 = startPostseason([0, 1, 2, 3, 4, 5, 6, 7])
    expect(pitcherResumePointOf(투수({ postseason: 대진, seasonEndState: 128 }))).toEqual({ kind: '포스트시즌' })
    // 45번째 경기 뒤 — 대진이 막 열려 g = 0
    expect(pitcherResumePointOf(투수({ gamesPlayed: 45, postseason: 대진 }))).toEqual({ kind: '시즌종료' })
    // 포스트시즌 경기 뒤 시리즈가 이어지면 g ≠ 0
    expect(pitcherResumePointOf(투수({ gamesPlayed: 46, postseason: { ...대진, wins: [1, 0] } }))).toEqual({
      kind: '포스트시즌',
    })
  })

  it('연봉 보상 뒤(S+0x50 = 0xa — 웹 133) 1c2a2: 판정 1 → 501 · 연차idx 12 → 504 · 짝수 → 133 · 홀수 → 새 시즌', () => {
    expect(pitcherResumePointOf(투수({ seasonEndState: 133, season: 7, popularity: 10 }))).toEqual({ kind: '이벤트', eventId: 501 })
    expect(pitcherResumePointOf(투수({ seasonEndState: 133, season: 13, popularity: 1600 }))).toEqual({ kind: '이벤트', eventId: 504 })
    expect(pitcherResumePointOf(투수({ seasonEndState: 133, season: 3 }))).toEqual({ kind: '이벤트', eventId: 462 })
    expect(pitcherResumePointOf(투수({ seasonEndState: 133, season: 4 }))).toEqual({ kind: '새시즌' })
    // 0xa 갈래가 트는 501 · 504 는 132 를 거치지 않는다 — S+0x50 그대로
    expect(enterPitcherYearEndEvent(투수({ seasonEndState: 133 }), 501).seasonEndState).toBe(133)
  })

  it('정규시즌 g 짝수는 관리 화면 · 보너스를 받은 엔딩 저장(S+0x50 == 6, 1c24e)은 141', () => {
    expect(pitcherResumePointOf(투수({ gamesPlayed: 12 }))).toEqual({ kind: '관리' })
    expect(pitcherResumePointOf(투수({ seasonEndState: 132, endingIndex: 2, endingBonusReceived: true })))
      .toEqual({ kind: '엔딩' })
  })

  it('정규시즌 맨 끝 갈래 — S+0x50 == 4(109)면 109, null 이면 g 홀수일 때 109 (1c38e~1c3b6)', () => {
    expect(pitcherResumePointOf(투수({ gamesPlayed: 12, seasonEndState: 109 }))).toEqual({ kind: '다음경기순위' })
    expect(pitcherResumePointOf(투수({ gamesPlayed: 13 }))).toEqual({ kind: '다음경기순위' })
  })
})

describe('128 포스트시즌 걸음', () => {
  it('376/377 뒤 대진이 있으면 128, 128 을 마친 표식이 있으면 132 의 이벤트', () => {
    const 대진 = 투수({ season: 2, postseason: startPostseason([0, 1, 2, 3, 4, 5, 6, 7]) })
    expect(nextPitcherYearEndStep(대진, [392, 393, 370, 371, 375, 376])).toEqual({ kind: '포스트시즌' })
    expect(nextPitcherYearEndStep(대진, [392, 393, 370, 371, 375, 376, PITCHER_POSTSEASON_STEP_ID])).toEqual({
      kind: '이벤트',
      eventId: 380,
    })
    expect(nextPitcherYearEndStep({ ...대진, postseason: null }, [375, 376])).toEqual({ kind: '이벤트', eventId: 380 })
    // 이어하기로 128 에 돌아와 끝냈다 — 앞 사슬의 본 번호가 없어도 132 다 (틀 0x15984)
    expect(nextPitcherYearEndStep(대진, [PITCHER_POSTSEASON_STEP_ID])).toEqual({ kind: '이벤트', eventId: 380 })
  })
})
