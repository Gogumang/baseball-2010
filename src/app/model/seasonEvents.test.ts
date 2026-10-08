import { describe, expect, it } from 'vitest'
import { batterSalaryNegotiationRankOf, enterSeasonEvent, nextSeasonStep, resumePointOf } from '@/app/model/seasonEvents'
import { startPostseason } from '@/entities/league/model/league'
import { createCareer } from '@/entities/career/model/playerCareer'

const 선수 = (overrides = {}) => ({ ...createCareer('테스트'), ...overrides })

describe('nextSeasonStep — 연말 이벤트 연결', () => {
  it('392 → 목표 결과 → 130 타이틀 370 → 371+수상 수 → 131 MVP 375 → 376/377 → 포스트시즌 대진 128', () => {
    expect(nextSeasonStep(선수(), [392])).toEqual({ kind: '이벤트', eventId: 396 })
    expect(nextSeasonStep(선수({ season: 3 }), [396])).toEqual({ kind: '이벤트', eventId: 370 })
    // 리그 기록표가 비어 있으면 1위가 없다 — 수상 0 → 371
    expect(nextSeasonStep(선수(), [370])).toEqual({ kind: '이벤트', eventId: 371 })
    expect(nextSeasonStep(선수(), [372])).toEqual({ kind: '이벤트', eventId: 375 })
    expect(nextSeasonStep(선수(), [375])).toEqual({ kind: '이벤트', eventId: 376 })
    expect(nextSeasonStep(선수({ season: 3 }), [377])).toEqual({ kind: '포스트시즌' })
    expect(nextSeasonStep(선수(), [376])).toEqual({ kind: '포스트시즌' })
  })

  it('MVP 결과는 375 진입 때 남긴 그 해 비트(0x8b370 ← evt+0x388)를 읽는다', () => {
    // 2년차 비트(1 << 1)
    expect(nextSeasonStep(선수({ season: 2, mvpSeasonBits: 0b10 }), [375])).toEqual({ kind: '이벤트', eventId: 377 })
    expect(nextSeasonStep(선수({ season: 3, mvpSeasonBits: 0b10 }), [375])).toEqual({ kind: '이벤트', eventId: 376 })
  })

  it('연봉 등급 k 의 MVP 몫(+2)도 비트를 읽는다 — 재판정이 아니다 (0xa4d40)', () => {
    // 타이틀 0 · 비트 있음 → k = 2 → 강경 386
    expect(batterSalaryNegotiationRankOf(선수({ mvpSeasonBits: 0b1 }))).toBe(2)
    expect(nextSeasonStep(선수({ mvpSeasonBits: 0b1 }), [380, 381])).toEqual({ kind: '이벤트', eventId: 386 })
  })

  it('375 에 들어가기 전에 MVP 판정 비트를 남긴다 — 다른 이벤트는 그대로 (0x19774 → 0x8dd60)', () => {
    const career = 선수()
    expect(enterSeasonEvent(career, 371)).toBe(career)
    expect(enterSeasonEvent(career, 370)).toEqual({ ...career, seasonEndState: 130 })
    // 리그 기록표가 비어 타이틀이 없으면 MVP 가 아니다 — 비트 그대로
    expect(enterSeasonEvent(career, 375).mvpSeasonBits).toBe(0)
  })

  it('혼자 3관왕이면 370 결과는 374, 375 진입 때 그 해 비트가 서고 결과는 377 이다', () => {
    const 삼관왕 = 선수({
      season: 2,
      stats: { ...createCareer('테스트').stats, atBats: 300, hits: 150, homeRuns: 60, runsBattedIn: 150 },
    })
    expect(nextSeasonStep(삼관왕, [370])).toEqual({ kind: '이벤트', eventId: 374 })
    const entered = enterSeasonEvent(삼관왕, 375)
    expect(entered.mvpSeasonBits).toBe(0b10)
    expect(nextSeasonStep(entered, [375])).toEqual({ kind: '이벤트', eventId: 377 })
    // 3관왕 + MVP 비트 = 5 → 강경 384
    expect(nextSeasonStep(entered, [380, 381])).toEqual({ kind: '이벤트', eventId: 384 })
  })

  it('강경·정중을 고르면 연봉 결과 이벤트로, 결과나 수락 뒤에는 새 시즌', () => {
    expect(nextSeasonStep(선수(), [380, 381])).toEqual({ kind: '이벤트', eventId: 387 })
    expect(nextSeasonStep(선수(), [380, 382])).toEqual({ kind: '이벤트', eventId: 391 })
    expect(nextSeasonStep(선수(), [391])).toEqual({ kind: '새시즌' })
    expect(nextSeasonStep(선수(), [380, 383])).toEqual({ kind: '새시즌' })
  })

  it('은퇴 선택(502 → 496 → 503)은 엔딩 판정표로, 방출(501)은 엔딩 1 로 끝난다 — 141 진입 0xa3a85 가 새로 판정', () => {
    expect(nextSeasonStep(선수({ season: 8, popularity: 1600 }), [502, 496, 503], true)).toEqual({ kind: '엔딩', endingIndex: 5 })
    expect(nextSeasonStep(선수({ season: 7, popularity: 10 }), [501], true)).toEqual({ kind: '엔딩', endingIndex: 1 })
    // 부상 누적 > 19 면 연차와 상관없이 0 (0xa3a84 첫 줄)
    expect(nextSeasonStep(선수({ season: 3, injuredGamesPlayed: 20 }), [500], true)).toEqual({ kind: '엔딩', endingIndex: 0 })
  })

  it('엔딩은 본 번호가 아니라 [0x1552adc](첫 종류 21 로 끝남)로 간다 — 엔딩 이벤트 번호만 있고 요청이 없으면 엔딩이 아니다', () => {
    expect(nextSeasonStep(선수({ season: 8, popularity: 1600 }), [502, 496, 503]).kind).not.toBe('엔딩')
  })
})

describe('이어하기 분기 0x1c154 — S+0x50(seasonEndState)', () => {
  it('상태 진입이 S+0x50 을 쓴다 — 136(392) 0xb · 130(370) 0xc · 131(375) 0xe', () => {
    expect(enterSeasonEvent(선수(), 392).seasonEndState).toBe(136)
    expect(enterSeasonEvent(선수(), 370).seasonEndState).toBe(130)
    expect(enterSeasonEvent(선수(), 375).seasonEndState).toBe(131)
  })

  it('136·130·131·132 는 그 상태가 트는 이벤트로 돌아간다', () => {
    expect(resumePointOf(선수({ seasonEndState: 136 }))).toEqual({ kind: '이벤트', eventId: 392 })
    expect(resumePointOf(선수({ seasonEndState: 130 }))).toEqual({ kind: '이벤트', eventId: 370 })
    expect(resumePointOf(선수({ seasonEndState: 131 }))).toEqual({ kind: '이벤트', eventId: 375 })
    // 132 연말 0x10c54 — 1~6년차는 연봉협상 380, 7년차 이상은 502
    expect(resumePointOf(선수({ seasonEndState: 132 }))).toEqual({ kind: '이벤트', eventId: 380 })
    expect(resumePointOf(선수({ seasonEndState: 132, season: 8, popularity: 1600 }))).toEqual({ kind: '이벤트', eventId: 502 })
  })

  it('포스트시즌 중 0xf 는 128, 대진만 열리고 사슬 전이면 시즌종료(116 → 136), 그 밖은 관리', () => {
    const 대진 = startPostseason([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(resumePointOf(선수({ seasonEndState: 128, postseason: 대진 }))).toEqual({ kind: '포스트시즌' })
    expect(resumePointOf(선수({ postseason: 대진 }))).toEqual({ kind: '시즌종료' })
    expect(resumePointOf(선수())).toEqual({ kind: '관리' })
    expect(resumePointOf(선수({ seasonEndState: 132, endingIndex: 1 }))).toEqual({ kind: '관리' })
  })

  it('정규시즌 맨 끝 갈래 1c38e — S+0x50 == 4(109)면 g 와 상관없이 109', () => {
    expect(resumePointOf(선수({ gamesPlayed: 4, seasonEndState: 109 }))).toEqual({ kind: '다음경기순위' })
    expect(resumePointOf(선수({ gamesPlayed: 5, seasonEndState: 109 }))).toEqual({ kind: '다음경기순위' })
  })

  it('정규시즌 null(S+0x50 1 · 2 · 3)은 g 짝수면 105, 홀수면 109 — 2 는 116 의 끝(0x12b98)이 같은 짝홀로 가른다', () => {
    expect(resumePointOf(선수({ gamesPlayed: 0 }))).toEqual({ kind: '관리' })
    expect(resumePointOf(선수({ gamesPlayed: 6 }))).toEqual({ kind: '관리' })
    expect(resumePointOf(선수({ gamesPlayed: 7 }))).toEqual({ kind: '다음경기순위' })
  })
})
