import { describe, expect, it } from 'vitest'
import { createPitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import {
  isPitcherEventEligible,
  meetsPitcherSkillCondition,
  pitcherPlaceEventOf,
  scanPitcherEventFrom,
} from '@/entities/pitcher-career/model/pitcherStoryScene'
import { countReleaseTrainingStreak } from '@/entities/pitcher-career/model/pitcherManagement'
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

describe('조건 20/21 투수 갈래 (0xd8408 · 0xd8454 의 모드 3 쪽)', () => {
  it('424 닥터K(투수 비트 11) — 통산 탈삼진 ≥ 500 (0xad4f8), 이미 가졌으면 불발', () => {
    const 통산 = (strikeouts: number) => ({ ...createPitcherCareer('x').careerStats, strikeouts })
    expect(meetsPitcherSkillCondition(투수({ careerStats: 통산(499) }), 'acquire', 12)).toBe(false)
    expect(meetsPitcherSkillCondition(투수({ careerStats: 통산(500) }), 'acquire', 12)).toBe(true)
    expect(meetsPitcherSkillCondition(투수({ careerStats: 통산(500), skillIds: [11] }), 'acquire', 12)).toBe(false)
    // 통산 칸은 s16 로 읽는다 — 32768 을 넘으면 음수라 불발
    expect(meetsPitcherSkillCondition(투수({ careerStats: 통산(40000) }), 'acquire', 12)).toBe(false)
  })

  it('428 비겁자(18) — 이번 시즌 이닝이 16경기에 ≤ 14 · 36경기에 ≤ 32, 그 해 해제한 적 있으면 불발', () => {
    const 시즌 = (outs: number) => ({ ...createPitcherCareer('x').stats, outs })
    expect(meetsPitcherSkillCondition(투수({ gamesPlayed: 16, stats: 시즌(44) }), 'acquire', 19)).toBe(true)
    expect(meetsPitcherSkillCondition(투수({ gamesPlayed: 16, stats: 시즌(45) }), 'acquire', 19)).toBe(false)
    expect(meetsPitcherSkillCondition(투수({ gamesPlayed: 17, stats: 시즌(0) }), 'acquire', 19)).toBe(false)
    expect(
      meetsPitcherSkillCondition(투수({ gamesPlayed: 16, stats: 시즌(0), removedMinusSkillIds: [18] }), 'acquire', 19),
    ).toBe(false)
  })

  it('해제 429·431·433 — 해제 카운터 +0x73 · +0x72 · +0x70 > 7', () => {
    const 카운터 = (slot: number, count: number) => [0, 0, 0, 0, 0].map((value, index) => (index === slot ? count : value))
    expect(meetsPitcherSkillCondition(투수({ skillIds: [18], releaseTrainingStreaks: 카운터(3, 7) }), 'release', 19)).toBe(false)
    expect(meetsPitcherSkillCondition(투수({ skillIds: [18], releaseTrainingStreaks: 카운터(3, 8) }), 'release', 19)).toBe(true)
    expect(meetsPitcherSkillCondition(투수({ skillIds: [19], releaseTrainingStreaks: 카운터(2, 8) }), 'release', 20)).toBe(true)
    expect(meetsPitcherSkillCondition(투수({ skillIds: [20], releaseTrainingStreaks: 카운터(0, 8) }), 'release', 21)).toBe(true)
    // 못 가졌으면 해제 불발
    expect(meetsPitcherSkillCondition(투수({ releaseTrainingStreaks: 카운터(0, 8) }), 'release', 21)).toBe(false)
  })

  it('미이식 갈래(몹쓸몸·유리몸·전설·좌우타UP·투지)는 불발로 둔다', () => {
    for (const value of [4, 5, 8, 13, 14, 15]) {
      expect(meetsPitcherSkillCondition(투수({ season: 13, gamesPlayed: 30, morale: 0 }), 'acquire', value)).toBe(false)
    }
  })
})

describe('먹튀 2 · 무력감 5 — 116 카운터를 세게 되어 두 편 공용 식 그대로 (0xad2a2 · 0xad43a · 0xad9ce · 0xada0e)', () => {
  it('먹튀 얻기: 연차idx > 1 · g == 14 에서 +0x1c2 ≤ 15 · g == 32 에서 ≤ 35', () => {
    expect(meetsPitcherSkillCondition(투수({ season: 3, gamesPlayed: 14, seasonPopularityGain: 15 }), 'acquire', 3)).toBe(true)
    expect(meetsPitcherSkillCondition(투수({ season: 3, gamesPlayed: 14, seasonPopularityGain: 16 }), 'acquire', 3)).toBe(false)
    expect(meetsPitcherSkillCondition(투수({ season: 2, gamesPlayed: 14, seasonPopularityGain: 0 }), 'acquire', 3)).toBe(false)
    expect(meetsPitcherSkillCondition(투수({ season: 3, gamesPlayed: 32, seasonPopularityGain: 35 }), 'acquire', 3)).toBe(true)
    expect(meetsPitcherSkillCondition(투수({ season: 3, gamesPlayed: 14, removedMinusSkillIds: [2] }), 'acquire', 3)).toBe(false)
  })

  it('무력감 얻기: 사기 ≤ 20 · 연차idx > 2 뒤에만 rand(0,100) > 69 를 굴린다', () => {
    let rolls = 0
    const 굴림 = (value: number) => ({ nextInRange: () => { rolls += 1; return value } }) as never
    expect(meetsPitcherSkillCondition(투수({ season: 4, morale: 20 }), 'acquire', 6, 굴림(70))).toBe(true)
    expect(meetsPitcherSkillCondition(투수({ season: 4, morale: 20 }), 'acquire', 6, 굴림(69))).toBe(false)
    expect(rolls).toBe(2)
    expect(meetsPitcherSkillCondition(투수({ season: 3, morale: 20 }), 'acquire', 6, 굴림(99))).toBe(false)
    expect(meetsPitcherSkillCondition(투수({ season: 4, morale: 21 }), 'acquire', 6, 굴림(99))).toBe(false)
    expect(rolls).toBe(2)
  })

  it('해제: 먹튀 +0x1cd > 4 이고 평균 > 3 · 무력감 +0x1c7 > 5', () => {
    expect(meetsPitcherSkillCondition(투수({ skillIds: [2], moneyGrubberGames: 5, moneyGrubberPopularityGain: 20 }), 'release', 3)).toBe(true)
    expect(meetsPitcherSkillCondition(투수({ skillIds: [2], moneyGrubberGames: 5, moneyGrubberPopularityGain: 19 }), 'release', 3)).toBe(false)
    expect(meetsPitcherSkillCondition(투수({ skillIds: [5], highMoraleStreak: 6 }), 'release', 6)).toBe(true)
    expect(meetsPitcherSkillCondition(투수({ skillIds: [5], highMoraleStreak: 5 }), 'release', 6)).toBe(false)
  })
})

describe('해제 카운터 +0x70+칸 (훈련 0x18a80 모드 3)', () => {
  it('가진 스킬과 맞는 칸이면 +1, 아니면 다섯 칸 모두 0', () => {
    const 비겁 = 투수({ skillIds: [18] })
    const 한번 = countReleaseTrainingStreak(비겁, 3)
    expect(한번.releaseTrainingStreaks).toEqual([0, 0, 0, 1, 0])
    expect(countReleaseTrainingStreak(한번, 0).releaseTrainingStreaks).toEqual([0, 0, 0, 0, 0])
    // 스킬이 없으면 같은 칸이어도 세지 않는다
    expect(countReleaseTrainingStreak(투수(), 3).releaseTrainingStreaks).toEqual([0, 0, 0, 0, 0])
  })
})

describe('자동 발동 훑기 0xadc70', () => {
  it('커서에서 이어 훑고 당첨 레코드에 멈춘다 — 끝까지 없으면 0 으로 되감고 없음', () => {
    const 첫날 = 투수()
    const 첫 = scanPitcherEventFrom(첫날, ORIGINAL_EVENTS, 0, 0)
    expect(첫.event?.id).toBe(1)
    const 다음 = scanPitcherEventFrom({ ...첫날, seenEventIds: ['1'] }, ORIGINAL_EVENTS, 0, 첫.cursor)
    expect(다음.event?.id).toBe(34)
    expect(scanPitcherEventFrom({ ...첫날, seenEventIds: ['1', '34'] }, ORIGINAL_EVENTS, 0, 다음.cursor)).toEqual({
      event: null,
      cursor: 0,
    })
  })
})
