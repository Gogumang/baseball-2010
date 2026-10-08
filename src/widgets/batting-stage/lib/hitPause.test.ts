import { describe, expect, it } from 'vitest'
import {
  bigHitHoldTicksOf,
  canSkipHitPause,
  earlyHitPauseTickOf,
  groundPathIndexOf,
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

  it('가운데 부채꼴(54 < 각 < 126, 경계 미포함 — 0x406a4)이면 낙구틱 − 7 까지 기다린다', () => {
    expect(hitPauseTicksOf({ ...큰타구, angle: 90, landingTick: 40 })).toBe(33)
    expect(bigHitHoldTicksOf(55, 40)).toBe(33)
    expect(bigHitHoldTicksOf(125, 40)).toBe(33)
  })

  it('경계(54 · 126)와 파울선 쪽이면 낙구틱 >> 1 이다 — 7 을 빼지 않는다', () => {
    expect(bigHitHoldTicksOf(54, 40)).toBe(20)
    expect(bigHitHoldTicksOf(126, 40)).toBe(20)
    expect(bigHitHoldTicksOf(45, 40)).toBe(20)
    expect(bigHitHoldTicksOf(135, 41)).toBe(20)
  })

  it('문턱을 자르지 않는다 — 음수 문턱은 첫 틱에 넘는다(0x406e8 `문턱 ≤ 공 틱`)', () => {
    expect(bigHitHoldTicksOf(90, 3)).toBe(-4)
  })
})

describe('플래그가 꺼진 갈래의 이른 넘김 (0x406e8 4071a~40784)', () => {
  /** 점 목록을 손으로 깐 궤적 — i 번째 점 */
  const 궤적 = (points: readonly { x: number; y: number; z: number }[]) => ({
    length: points.length,
    pointAt: (tick: number) => points[Math.max(0, Math.min(tick, points.length - 1))],
  })
  /** 거리 ÷ 265 = 45 인 땅 점 (x 만 벌린다) */
  const 땅 = { x: 25068 + 265 * 45, y: 0, z: 23275 }

  it('땅 번호는 trunc(6y/10) 이 처음 0 이 된 점이다 (0x33e34) — |y| ≤ 1', () => {
    expect(groundPathIndexOf(궤적([{ x: 0, y: 900, z: 0 }, { x: 0, y: 2, z: 0 }, { x: 0, y: 1, z: 0 }]))).toBe(2)
    expect(groundPathIndexOf(궤적([{ x: 0, y: 900, z: 0 }, { x: 0, y: -1, z: 0 }]))).toBe(1)
    expect(groundPathIndexOf(궤적([{ x: 0, y: 900, z: 0 }, { x: 0, y: -2, z: 0 }]))).toBe(-1)
  })

  it('결과 코드 ≤ 2 이고 땅 점 거리 ÷ 265 가 40~55 면 땅 번호 − 1 틱에 넘긴다', () => {
    const 공 = 궤적([{ x: 0, y: 900, z: 0 }, { x: 0, y: 300, z: 0 }, { x: 0, y: 100, z: 0 }, 땅])
    expect(earlyHitPauseTickOf(2, 공)).toBe(2)
    expect(hitPauseTicksOf({ resultCode: 2, poleTick: -1, carryScale: 0, angle: 90, landingTick: 3, earlyTick: 2 })).toBe(2)
  })

  it('결과 코드 3 이상 · 거리 밖이면 틱 8 그대로', () => {
    const 공 = 궤적([{ x: 0, y: 900, z: 0 }, 땅])
    expect(earlyHitPauseTickOf(3, 공)).toBeNull()
    expect(earlyHitPauseTickOf(0, 궤적([{ x: 0, y: 900, z: 0 }, { ...땅, x: 25068 + 265 * 56 }]))).toBeNull()
    expect(earlyHitPauseTickOf(0, 궤적([{ x: 0, y: 900, z: 0 }, { ...땅, x: 25068 + 265 * 39 }]))).toBeNull()
    expect(hitPauseTicksOf({ resultCode: 1, poleTick: -1, carryScale: 0, angle: 90, landingTick: 3, earlyTick: 12 })).toBe(
      SHORT_HIT_TICKS,
    )
  })

  it('OK·5 건너뛰기는 큰 타구(+0x199a)에서만 된다', () => {
    expect(canSkipHitPause(true)).toBe(true)
    expect(canSkipHitPause(false)).toBe(false)
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
