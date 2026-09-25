import { describe, expect, it } from 'vitest'
import { pitchAgainstBatter, willSwing } from '@/entities/pitching/model/simulateBatter'
import type { BatterSituation } from '@/entities/pitching/model/simulateBatter'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import type { Pitch } from '@/entities/pitching/model/pitch'
import type { BatterAbility } from '@/entities/batting/model/batter'

const 한가운데: Pitch = {
  type: '직구',
  plate: { x: 0, y: 0 },
  breakOffset: { x: 0, y: 0 },
  flightDurationMilliseconds: 18 * 62,
  frameCount: 18,
  controlTier: 3,
  worldPath: null,
  stageSide: 1,
}
const 크게빠진공: Pitch = { ...한가운데, plate: { x: 1.7, y: -1.6 } }

function 타자(hit: number): BatterAbility {
  return { hit, power: 500, run: 500, defense: 500 }
}

const 무사주자없음 = { strikes: 0, balls: 0, outs: 0, hasRunner: false }

function 비율(
  pitch: Pitch,
  ability: BatterAbility,
  situation: BatterSituation = 무사주자없음,
  attempts = 2000,
): number {
  const random = createSeededRandom(20100901)
  let swings = 0
  for (let i = 0; i < attempts; i += 1) {
    if (willSwing(pitch, ability, random, situation)) swings += 1
  }
  return swings / attempts
}

describe('willSwing — 상대 타자의 판단', () => {
  it('존 안 공은 대체로 휘두른다', () => {
    expect(비율(한가운데, 타자(500))).toBeGreaterThan(0.5)
  })

  it('크게 빠진 공은 거의 쫓지 않는다', () => {
    expect(비율(크게빠진공, 타자(500))).toBeLessThan(0.2)
  })

  it('히트가 높을수록 존 밖 공을 덜 쫓는다 — 선구안', () => {
    const 조금빠진공: Pitch = { ...한가운데, plate: { x: 1.2, y: 0 } }

    expect(비율(조금빠진공, 타자(950))).toBeLessThan(비율(조금빠진공, 타자(100)))
  })

  it('존 안 공은 원본 표의 치기+번트 칸만큼 휘두른다 (battingPattern.arr)', () => {
    // 주자 없음·0사 0-0 = [60, 10, 30] → 70%
    expect(비율(한가운데, 타자(500), 무사주자없음)).toBeCloseTo(0.7, 1)
    // 주자 없음·0사 2스트라이크 0볼 = [95, 0, 5] → 95%
    expect(비율(한가운데, 타자(500), { ...무사주자없음, strikes: 2 })).toBeCloseTo(0.95, 1)
    // 주자 없음·0사 0스트라이크 3볼 = [30, 5, 65] → 35%
    expect(비율(한가운데, 타자(500), { ...무사주자없음, balls: 3 })).toBeCloseTo(0.35, 1)
  })

  it('주자가 있으면 다른 열을 쓴다 — 0-0 은 65+3 = 68%', () => {
    expect(비율(한가운데, 타자(500), { ...무사주자없음, hasRunner: true })).toBeCloseTo(0.68, 1)
  })

  it('존 밖 띠(20px)와 그 밖은 문턱이 다르다 — 2000 − 3h/2 · 250 − h/4', () => {
    // 히트 500 → 띠 (2000 − 750)/10000 = 12.5% · 그 밖 (250 − 125)/10000 = 1.25%
    // 둘 다 표의 70% 를 먼저 통과해야 한다
    const 띠: Pitch = { ...한가운데, plate: { x: 2.0, y: 0 } }
    const 저멀리: Pitch = { ...한가운데, plate: { x: 3.0, y: 0 } }

    expect(비율(띠, 타자(500))).toBeCloseTo(0.7 * 0.125, 1)
    expect(비율(저멀리, 타자(500))).toBeLessThan(0.03)
  })
})

/**
 * 난수 차례 — 원본 0x34334 는 표 뽑기 `rand(0,100)` 를 **늘 한 번**,
 * 쫓아가기 `rand(0,10000)` 를 **존 밖이고 휘두를 마음이 있을 때만 한 번 더** 돈다.
 * (옛 지어낸 규칙은 어느 경우에도 딱 한 번이었다.)
 */
describe('willSwing — 난수 굴림 차례', () => {
  function 굴림수(pitch: Pitch, situation: BatterSituation, values: readonly number[]): number {
    let used = 0
    const random = {
      next: () => {
        const value = values[Math.min(used, values.length - 1)]
        used += 1
        return value
      },
      nextInRange: () => 0,
      pick: <T,>(c: readonly T[]) => c[0],
    }
    willSwing(pitch, 타자(500), random, situation)
    return used
  }
  const 존밖: Pitch = { ...한가운데, plate: { x: 2.0, y: 0 } }

  it('지켜보기로 끝나면 한 번만 돈다', () => {
    // 0-0 주자 없음 = [60, 10, 30] → 0.99 는 지켜보기
    expect(굴림수(존밖, 무사주자없음, [0.99])).toBe(1)
  })

  it('존 안이면 쫓아가기를 굴리지 않는다', () => {
    expect(굴림수(한가운데, 무사주자없음, [0.0])).toBe(1)
  })

  it('존 밖에서 휘두를 마음이 있으면 한 번 더 돈다', () => {
    expect(굴림수(존밖, 무사주자없음, [0.0])).toBe(2)
  })
})

describe('pitchAgainstBatter', () => {
  it('존 밖 공을 안 휘두르면 볼이다', () => {
    const random = createSeededRandom(20100901)
    const results = Array.from({ length: 200 }, () =>
      pitchAgainstBatter(크게빠진공, 타자(900), random),
    )

    expect(results.filter((r) => r.kind === '볼').length).toBeGreaterThan(100)
  })

  it('존 안 공은 스트라이크나 타구로 이어진다', () => {
    const random = createSeededRandom(20100901)
    const results = Array.from({ length: 200 }, () =>
      pitchAgainstBatter(한가운데, 타자(500), random),
    )

    expect(results.some((r) => r.kind === '스트라이크')).toBe(true)
    expect(results.some((r) => r.kind === '타구')).toBe(true)
  })

  it('약한 타자는 강한 타자보다 헛스윙이 많다', () => {
    function 헛스윙수(hit: number): number {
      const random = createSeededRandom(777)
      let count = 0
      for (let i = 0; i < 400; i += 1) {
        const r = pitchAgainstBatter(한가운데, 타자(hit), random)
        if (r.kind === '스트라이크' && r.isSwinging) count += 1
      }
      return count
    }

    expect(헛스윙수(100)).toBeGreaterThan(헛스윙수(950))
  })

  it('강한 타자는 약한 타자보다 타구를 많이 만든다', () => {
    function 타구수(hit: number): number {
      const random = createSeededRandom(777)
      let count = 0
      for (let i = 0; i < 400; i += 1) {
        if (pitchAgainstBatter(한가운데, 타자(hit), random).kind === '타구') count += 1
      }
      return count
    }

    expect(타구수(950)).toBeGreaterThan(타구수(100))
  })

  it('같은 시드는 같은 결과를 낸다', () => {
    const a = pitchAgainstBatter(한가운데, 타자(600), createSeededRandom(42))
    const b = pitchAgainstBatter(한가운데, 타자(600), createSeededRandom(42))

    expect(a).toEqual(b)
  })
})
