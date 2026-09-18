import { describe, expect, it } from 'vitest'
import { pitchAgainstBatter, willSwing } from '@/entities/pitching/model/simulateBatter'
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

function 비율(pitch: Pitch, ability: BatterAbility, attempts = 600): number {
  const random = createSeededRandom(20100901)
  let swings = 0
  for (let i = 0; i < attempts; i += 1) {
    if (willSwing(pitch, ability, random)) swings += 1
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
