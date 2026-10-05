import { describe, expect, it } from 'vitest'
import { createPitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { isPitcherEventEligible, pitcherPlaceEventOf } from '@/entities/pitcher-career/model/pitcherStoryScene'
import { ORIGINAL_EVENTS } from '@/shared/config/original/events'

const 투수 = (overrides: Partial<PitcherCareer> = {}): PitcherCareer => ({ ...createPitcherCareer('테스트'), ...overrides })
const 이벤트 = (id: number) => ORIGINAL_EVENTS.find((event) => event.id === id)!

describe('투수편 이벤트 판정 (0xacfbc 모드 3)', () => {
  it('대상 1·3 만 받는다 — 타자 전용(대상 2)·코드 전용(대상 0)은 불발', () => {
    const 대상 = new Set(
      ORIGINAL_EVENTS.filter((event) => isPitcherEventEligible(event, 투수({ season: 13, gamesPlayed: 40 }), event.trigger)).map(
        (event) => event.audience,
      ),
    )
    expect([...대상].every((audience) => audience === 1 || audience === 3)).toBe(true)
  })

  it('조건 0~3 은 제구·구속·변화·체력 기본값이다 — 히든 변화구 30 (제구 200 · 구속 250 · 변화 300)', () => {
    const 이른 = 투수({ season: 5, gamesPlayed: 10, ability: { control: 200, velocity: 250, breaking: 300, stamina: 0 } })
    expect(isPitcherEventEligible(이벤트(30), 이른, 0)).toBe(true)
    expect(isPitcherEventEligible(이벤트(30), { ...이른, ability: { ...이른.ability, breaking: 299 } }, 0)).toBe(false)
    // 본 이벤트는 반복이어도 불발
    expect(isPitcherEventEligible(이벤트(30), { ...이른, seenEventIds: ['30'] }, 0)).toBe(false)
  })

  it('날짜 창은 연차idx·45 + 경기 수 + 1 — 230(경기장, 1년 13경기~)은 12경기 뒤부터', () => {
    expect(isPitcherEventEligible(이벤트(230), 투수({ gamesPlayed: 11 }), 2)).toBe(false)
    expect(isPitcherEventEligible(이벤트(230), 투수({ gamesPlayed: 12 }), 2)).toBe(true)
  })
})

describe('장소 배정 0x8cdc0', () => {
  it('장소마다 파일 순서 첫 통과 이벤트 — 없으면 null', () => {
    const 첫해 = 투수({ gamesPlayed: 12 })
    expect(pitcherPlaceEventOf(첫해, ORIGINAL_EVENTS, 1)?.id).toBe(230)
    expect(pitcherPlaceEventOf(투수(), ORIGINAL_EVENTS, 1)).toBeNull()
  })

  it('본 이벤트는 건너뛰고 다음 것을 넣는다', () => {
    const 본뒤 = 투수({ gamesPlayed: 30, seenEventIds: ['230'] })
    expect(pitcherPlaceEventOf(본뒤, ORIGINAL_EVENTS, 1)?.id).toBe(231)
  })
})
