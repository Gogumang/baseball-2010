import { describe, expect, it } from 'vitest'
import {
  bigHitHoldTicksOf,
  carryScaleOf,
  CARRY_THRESHOLD,
  hitPauseTicksOf,
  isBigHit,
  pauseInputOf,
  SHORT_HIT_TICKS,
} from '@/widgets/batting-stage/lib/hitPause'
import { battedBallTrajectory } from '@/entities/batting/model/battedBallFlight'
import { createPatternDeck, drawPattern } from '@/entities/batting/model/battedBallOutcome'
import { createSeededRandom } from '@/shared/api/random/seededRandom'

/** 큰 타구 세 조건을 다 만족하는 입력 */
const 큰타구 = { resultCode: 24, poleTick: -1, carryScale: CARRY_THRESHOLD + 1 }

describe('감상 플래그 +0x199a (0x392ac)', () => {
  it('홈런성(24~26) · 폴 미접촉 · 거리 111 초과면 켜진다', () => {
    expect([24, 25, 26].map((resultCode) => isBigHit({ ...큰타구, resultCode }))).toEqual([true, true, true])
  })

  it('홈런성이 아니면 꺼진다', () => {
    expect([null, 0, 15, 23, 27].map((resultCode) => isBigHit({ ...큰타구, resultCode }))).toEqual([
      false, false, false, false, false,
    ])
  })

  it('폴에 닿았으면 꺼진다', () => {
    expect(isBigHit({ ...큰타구, poleTick: 0 })).toBe(false)
  })

  it('거리 눈금이 111 이하면 꺼진다 — 초과일 때만 켜진다', () => {
    expect(isBigHit({ ...큰타구, carryScale: CARRY_THRESHOLD })).toBe(false)
    expect(isBigHit({ ...큰타구, carryScale: CARRY_THRESHOLD + 1 })).toBe(true)
  })
})

describe('낙구 거리 눈금 공+0xac0 — 마무리 0xa2a88', () => {
  it('거리 ÷ 265 를 160 에서 자른다', () => {
    expect(carryScaleOf(265 * 160)).toBe(160)
    expect(carryScaleOf(265 * 400)).toBe(160)
    expect(carryScaleOf(265 * 111 + 264)).toBe(111)
    expect(carryScaleOf(0)).toBe(0)
  })

  it('궤적은 담장을 넘은 페어 타구에만 눈금을 든다 — 원본 패턴 그대로', () => {
    // 코드 24 [126, 1337, 1006] 은 담장을 넘어 페어로 떨어지고, 코드 0 첫 패턴 [90, 810, 1592] 는 담장 면에 맞는다
    const 넘김 = battedBallTrajectory([126, 1337, 1006, 0])
    const 담장면 = battedBallTrajectory([90, 810, 1592, 0])
    expect(넘김.fenceTick).toBeGreaterThan(0)
    expect(넘김.carryScale).toBeGreaterThan(0)
    expect(담장면.fenceTick).toBe(-1)
    expect(담장면.carryScale).toBe(0)
  })
})

describe('상태 0x13 이 붙잡아 두는 틱', () => {
  it('플래그가 꺼져 있으면 틱 8 이다', () => {
    expect(hitPauseTicksOf({ ...큰타구, resultCode: 15, angle: 90, landingTick: 40 })).toBe(SHORT_HIT_TICKS)
  })

  it('가운데 부채꼴(54~126)이면 낙구틱 − 7 까지 기다린다', () => {
    expect(hitPauseTicksOf({ ...큰타구, angle: 90, landingTick: 40 })).toBe(33)
    expect(bigHitHoldTicksOf(54, 40)).toBe(33)
    expect(bigHitHoldTicksOf(126, 40)).toBe(33)
  })

  it('파울선 쪽이면 그 절반이다', () => {
    expect(bigHitHoldTicksOf(45, 40)).toBe(16)
    expect(bigHitHoldTicksOf(135, 41)).toBe(17)
  })

  it('낙구가 너무 이르면 음수로 내려가지 않는다', () => {
    expect(bigHitHoldTicksOf(90, 3)).toBe(0)
  })
})

describe('덱에서 방금 친 패턴을 되읽어 판정값을 만든다', () => {
  it('뽑은 패턴의 수평각이 그대로 들어온다', () => {
    const random = createSeededRandom(7)
    const drawn = drawPattern(createPatternDeck(random), 24, random)

    const input = pauseInputOf(24, drawn.deck)

    expect(input.angle).toBe(drawn.pattern[0])
    expect(input.resultCode).toBe(24)
    expect(input.landingTick).toBeGreaterThan(0)
  })

  it('패턴이 없는 코드면 붙잡지 않고 틱 8 로 둔다', () => {
    const 빈덱 = { orders: {}, cursors: {} }

    expect(hitPauseTicksOf(pauseInputOf(24, 빈덱))).toBe(SHORT_HIT_TICKS)
  })
})
