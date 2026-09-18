import { describe, expect, it } from 'vitest'
import { nextSeasonStep } from '@/app/model/seasonEvents'
import { createCareer } from '@/entities/career/model/playerCareer'

const 선수 = (overrides = {}) => ({ ...createCareer('테스트'), ...overrides })

describe('nextSeasonStep — 연말 이벤트 연결', () => {
  it('392 뒤에는 목표 결과, 결과 뒤에는 연말 이벤트', () => {
    expect(nextSeasonStep(선수(), [392])).toEqual({ kind: '이벤트', eventId: 396 })
    expect(nextSeasonStep(선수({ season: 3 }), [396])).toEqual({ kind: '이벤트', eventId: 380 })
  })

  it('강경·정중을 고르면 연봉 결과 이벤트로, 결과나 수락 뒤에는 새 시즌', () => {
    expect(nextSeasonStep(선수(), [380, 381])).toEqual({ kind: '이벤트', eventId: 387 })
    expect(nextSeasonStep(선수(), [380, 382])).toEqual({ kind: '이벤트', eventId: 391 })
    expect(nextSeasonStep(선수(), [391])).toEqual({ kind: '새시즌' })
    expect(nextSeasonStep(선수(), [380, 383])).toEqual({ kind: '새시즌' })
  })

  it('은퇴 선택(502 → 496 → 503)은 엔딩 판정표로, 방출(501)은 엔딩 1 로 끝난다', () => {
    expect(nextSeasonStep(선수({ season: 8, popularity: 1600 }), [502, 496, 503])).toEqual({ kind: '엔딩', endingIndex: 5 })
    expect(nextSeasonStep(선수({ season: 7, popularity: 10 }), [501])).toEqual({ kind: '엔딩', endingIndex: 1 })
  })
})
