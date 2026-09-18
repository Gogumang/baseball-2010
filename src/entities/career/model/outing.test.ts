import { describe, expect, it } from 'vitest'
import {
  outingBlockReasonOf,
  runOuting,
  recoverAfterRest,
  restBlockReasonOf,
  runRest,
} from '@/entities/career/model/outing'
import { createCareer } from '@/entities/career/model/playerCareer'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { OUTING_PLACES } from '@/shared/config/outingPlaces'

function 선수(overrides: Partial<PlayerCareer> = {}): PlayerCareer {
  // 신인은 사기 100(최고)이라 외식이 막힌다 — 다른 규칙을 보려고 낮춰 둔다
  return { ...createCareer('테스트'), morale: 50, ...overrides }
}

const 최소 = { next: () => 0, nextInRange: (minimum: number) => minimum, pick: <T,>(candidates: readonly T[]) => candidates[0] }
const 최대 = { ...최소, next: () => 0.999 }

function 기능(name: string) {
  for (const place of OUTING_PLACES) {
    const found = place.functions.find((f) => f.name === name)
    if (found !== undefined) return found
  }
  throw new Error(`${name} 을(를) 찾지 못했습니다`)
}

describe('외출 장소 데이터 — 원작 설명서와 일치해야 한다', () => {
  it('장소 5곳이다 (경기장·번화가·병원·학교·방송국)', () => {
    expect(OUTING_PLACES.map((p) => p.name)).toEqual([
      '경기장',
      '번화가',
      '병원',
      '학교',
      '방송국',
    ])
  })

  it('기능별 [a, b) 난수 표 — 인기도 0xcc358 · 평판 0xcc34e · 사기 0xcc33a (점검 10차)', () => {
    const table = OUTING_PLACES.flatMap((place) => place.functions).map((f) => [f.id, f.effect.popularity, f.effect.reputation, f.effect.morale])
    expect(table).toEqual([
      ['팬미팅', [4, 7], [0, 1], [2, 4]],
      ['외식', [0, 1], [0, 1], [25, 31]],
      ['입원', [0, 1], [0, 1], [3, 6]],
      ['야구교실', [1, 4], [3, 6], [-8, -11]],
      ['CF촬영', [2, 5], [8, 11], [-16, -21]],
    ])
  })

  it('장소마다 기능은 하나다 — 친선경기·회식·구단CF는 시즌모드 기능이다 (StrHOWTO[17]~[22])', () => {
    expect(OUTING_PLACES.flatMap((p) => p.functions).map((f) => f.name)).toEqual([
      '팬미팅',
      '외식',
      '입원',
      '야구교실',
      'CF촬영',
    ])
  })

  it('입원만 부상·질병을 낫게 한다', () => {
    const healers = OUTING_PLACES.flatMap((p) => p.functions).filter((f) => f.effect.healsInjury)

    expect(healers.map((f) => f.name)).toEqual(['입원'])
  })
})

describe('runOuting', () => {
  it('소지금이 모자라면 막는다', () => {
    expect(outingBlockReasonOf(선수({ money: 0, isSick: true }), 기능('입원'))).toBe('소지금부족')
  })

  it('수입이 생기는 외출은 소지금이 없어도 막지 않는다', () => {
    // CF촬영은 인기도 400 이 필요하다 (0xcc402)
    expect(outingBlockReasonOf(선수({ money: 0, popularity: 400 }), 기능('CF촬영'))).toBeNull()
  })

  it('입원하면 질병 90% · 부상 70% 확률로 낫는다 (0x1575c, 추정)', () => {
    const 환자 = 선수({ isInjured: true, isSick: true, money: 9999, injuryRemaining: 3, illnessRemaining: 3 })

    const 나음 = runOuting(환자, 기능('입원'), 최소)
    expect([나음.isInjured, 나음.isSick]).toEqual([false, false])

    const 안나음 = runOuting(환자, 기능('입원'), 최대)
    expect([안나음.isInjured, 안나음.isSick]).toEqual([true, true])
  })

  it('다른 외출은 부상을 낫게 하지 않는다', () => {
    const 환자 = 선수({ isInjured: true, money: 9999 })

    expect(runOuting(환자, 기능('외식'), 최소).isInjured).toBe(true)
  })

  it('CF촬영은 코드대로 소지금 +800만 · 평판 +8~10 · 사기 −16~20 (설명서의 평판 하락과 반대)', () => {
    const before = 선수({ popularity: 400, reputation: 100, morale: 50 })

    const 적게 = runOuting(before, 기능('CF촬영'), 최소)
    const 많이 = runOuting(before, 기능('CF촬영'), 최대)

    expect([적게.money - before.money, 적게.reputation, 적게.popularity, 적게.morale]).toEqual([800, 108, 402, 34])
    expect([많이.reputation, 많이.popularity, 많이.morale]).toEqual([110, 404, 30])
  })

  it('실행할 수 없는 상태에서 부르면 예외를 던진다', () => {
    expect(() => runOuting(선수({ money: 0 }), 기능('외식'), 최소)).toThrow('소지금부족')
  })

  it('입력 커리어를 변경하지 않는다', () => {
    const before = 선수({ popularity: 400 })
    const money = before.money

    runOuting(before, 기능('CF촬영'), 최소)

    expect(before.money).toBe(money)
  })
})

describe('runRest', () => {
  it('사기를 bfa55(10,16) = 10~15 회복한다 (0x18e3c, 누락 탐색 7차)', () => {
    const 지침 = 선수({ morale: 30 })

    expect(runRest(지침, 최소).career.morale).toBe(40)
    expect(runRest(지침, 최대)).toMatchObject({ moraleGain: 15, career: { morale: 45 } })
  })

  it('사기는 상한을 넘지 않는다', () => {
    expect(runRest(선수({ morale: 95 }), 최대).career.morale).toBe(100)
  })

  it('부상·질병을 낫게 한다 — StrHOWTO[14] "휴식 커맨드 … 로 회복할 수 있습니다"', () => {
    const rested = recoverAfterRest(runRest(선수({ isInjured: true, isSick: true, injuryRemaining: 2, illnessRemaining: 3 }), 최소).career, 최소).career

    expect(rested.isInjured).toBe(false)
    expect(rested.isSick).toBe(false)
  })

  it('휴식 결과 창을 닫으면 질병은 60%, 부상은 30% 확률로 낫고, 못 나으면 남은 기간이 준다 (0x1b308)', () => {
    const 아픔 = 선수({ isInjured: true, isSick: true, injuryRemaining: 3, illnessRemaining: 3 })

    const rested = recoverAfterRest(아픔, 최대)
    expect(rested.career).toMatchObject({ isInjured: true, isSick: true, injuryRemaining: 2, illnessRemaining: 2 })
    expect(rested.recoveries).toEqual([])
  })

  it('남은 기간이 0 이 되면 반드시 낫고 회복 문구가 나온다', () => {
    const 거의 = 선수({ isInjured: true, isSick: true, illnessName: '감기', injuryRemaining: 1, illnessRemaining: 0 })

    const rested = recoverAfterRest(거의, 최대)
    expect([rested.career.isInjured, rested.career.isSick]).toEqual([false, false])
    expect(rested.recoveries).toEqual(['다음 질병이 치료되었습니다 [감기]', '부상에서 회복 되었습니다.'])
  })

  it('사기가 100 이면 아파도 휴식을 거절한다 (0x1261c, StrMODE[91])', () => {
    expect(restBlockReasonOf(선수({ morale: 100, isInjured: true }))).toBe('사기최고')
  })
})
