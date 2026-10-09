import { describe, expect, it } from 'vitest'
import { laserTrailStampsOf } from '@/pages/defense/lib/laserTrail'

describe('레이저 잔상 0x37076', () => {
  it('가까우면(d ≤ 120) k = 1 부터 공 폭 배수 자리마다 하나씩, 단계는 1 씩 오른다', () => {
    // d = 50, w = 10 → k = 10 · 20 · 30 · 40, 걸음 = max(1, (49/10)/14) = 1
    const stamps = laserTrailStampsOf({ x: 0, y: 0 }, { x: 50, y: 0 }, 10)
    expect(stamps).toEqual([
      { x: 10, y: 0, level: 1 },
      { x: 20, y: 0, level: 2 },
      { x: 30, y: 0, level: 3 },
      { x: 40, y: 0, level: 4 },
    ])
  })

  it('멀면 공 뒤 마지막 120 화소만 — k0 = d − 120, 걸음 = (120 / w) / 14, 단계는 15 에서 멈춘다', () => {
    // d = 300, w = 4 → k0 = 180 · 걸음 = max(1, 30/14) = 2 · k = 180, 184, … , 296 (30 장)
    const stamps = laserTrailStampsOf({ x: 0, y: 0 }, { x: 0, y: 300 }, 4)
    expect(stamps).toHaveLength(30)
    expect(stamps[0]).toEqual({ x: 0, y: 180, level: 1 })
    expect(stamps[1]?.level).toBe(3)
    expect(stamps.at(-1)).toEqual({ x: 0, y: 296, level: 15 })
  })

  it('사선 거리는 정수 제곱근(버림)이고 점은 0 쪽으로 버린다', () => {
    // d = isqrt(30² + 40²) = 50
    const stamps = laserTrailStampsOf({ x: 0, y: 0 }, { x: -30, y: 40 }, 25)
    expect(stamps).toEqual([{ x: -15, y: 20, level: 1 }])
  })

  it('같은 점이면 그리지 않는다', () => {
    expect(laserTrailStampsOf({ x: 5, y: 5 }, { x: 5, y: 5 }, 4)).toEqual([])
  })
})
