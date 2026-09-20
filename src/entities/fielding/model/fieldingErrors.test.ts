import { describe, expect, it } from 'vitest'
import {
  BOUNCE_THROW_DISTANCE,
  FUMBLE_PERMYRIAD,
  fumbleChanceOf,
  rollFumble,
  rollSpecialDefense,
  rollThrowError,
  specialDefenseThresholdOf,
  SPECIAL_DEFENSE_PERCENT,
  throwErrorChanceOf,
} from '@/entities/fielding/model/fieldingErrors'
import type { RandomPort } from '@/shared/api/random/randomPort'

const 고정 = (value: number): RandomPort => ({
  next: () => value,
  nextInRange: (minimum, maximum) => minimum + value * (maximum - minimum),
  pick: (candidates) => candidates[0],
})

/** next() 를 차례대로 돌려주는 포트 */
const 차례 = (values: readonly number[]): RandomPort => {
  let index = 0
  return {
    next: () => values[Math.min(index++, values.length - 1)],
    nextInRange: (minimum, maximum) => minimum + (maximum - minimum) / 2,
    pick: (candidates) => candidates[0],
  }
}

describe('펌블 — 표 0xd87d4', () => {
  it('등급별 확률표 (만분율)', () => {
    expect(FUMBLE_PERMYRIAD).toEqual([200, 180, 160, 140, 120, 100, 80, 50])
    const 표: readonly [number, number][] = [
      [100, 200],
      [200, 180],
      [300, 160],
      [500, 140],
      [600, 120],
      [800, 100],
      [900, 80],
      [999, 50],
    ]
    표.forEach(([defense, chance]) => expect(fumbleChanceOf(defense)).toBe(chance))
  })

  it('rand(0,10000) 이 확률보다 작으면 펌블이다 (수비 100 → 2.0%)', () => {
    expect(rollFumble(100, true, 고정(0.0199))).toBe(true)
    expect(rollFumble(100, true, 고정(0.02))).toBe(false)
  })

  it('**멈춘 공을 주울 때는 굴리지 않는다** — 뜬공 직접 포구에는 걸린다 (P2 3절 정정)', () => {
    expect(rollFumble(100, false, 고정(0))).toBe(false)
    expect(rollFumble(100, true, 고정(0))).toBe(true)
  })
})

describe('악송구 — 0xa1828', () => {
  it('기준 = (10 − 등급) + 특수×100 + 100 → 약 1.03~1.10%', () => {
    expect(throwErrorChanceOf(100)).toBe(110)
    expect(throwErrorChanceOf(999)).toBe(103)
    expect(throwErrorChanceOf(999, true)).toBe(203)
  })

  it('굴림이 기준보다 작을 때만 속도·방향이 흔들린다', () => {
    expect(rollThrowError(100, false, 고정(0.011)).errant).toBe(false)
    const 악송구 = rollThrowError(100, false, 차례([0.0109, 0, 0]))
    expect(악송구.errant).toBe(true)
    expect(악송구.speedDelta).toBe(-50)
    expect(악송구.angleDelta).toBe(-49)
  })

  it('특수 송구는 위쪽 보정이 막혀 늘 느려지고 왼쪽으로 샌다 (원본 그대로)', () => {
    const 악송구 = rollThrowError(100, true, 차례([0, 0.99, 0.99]))
    expect(악송구.errant).toBe(true)
    expect(악송구.speedDelta).toBeLessThan(0)
    expect(악송구.angleDelta).toBeLessThan(0)
  })

  it('송구 거리 상한 20400 = 17000 × 120 / 100', () => {
    expect(BOUNCE_THROW_DISTANCE).toBe(20_400)
  })
})

describe('필살수비 발동 — 0x66b30 = 0x66be4, 표 0xd25b0', () => {
  it('등급별 1~6%', () => {
    expect(SPECIAL_DEFENSE_PERCENT).toEqual([1, 2, 3, 3, 4, 4, 5, 6])
    expect(specialDefenseThresholdOf(100)).toBe(10)
    expect(specialDefenseThresholdOf(999)).toBe(60)
  })

  it('스킬 21 초감각은 +3%p, 나리 타자편은 절반', () => {
    expect(specialDefenseThresholdOf(999, { hasSixthSense: true })).toBe(90)
    expect(specialDefenseThresholdOf(999, { isBatterCareerMode: true })).toBe(30)
  })

  it('A 가 성공하면 점프 창만 열리고 B 는 굴리지 않는다', () => {
    expect(rollSpecialDefense(999, 고정(0.0))).toEqual({ jumpUnlocked: true, slideUnlocked: false })
  })

  it('A 가 실패했을 때만 B 를 굴려 슬라이딩 창을 연다', () => {
    expect(rollSpecialDefense(999, 차례([0.9, 0.0]))).toEqual({ jumpUnlocked: false, slideUnlocked: true })
    expect(rollSpecialDefense(999, 고정(0.9))).toEqual({ jumpUnlocked: false, slideUnlocked: false })
  })
})
