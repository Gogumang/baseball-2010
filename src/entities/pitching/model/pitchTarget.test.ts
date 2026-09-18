import { describe, expect, it } from 'vitest'
import { applyControlError, pitchTargetOf } from '@/entities/pitching/model/pitchTarget'
import { ZONE_CENTERS } from '@/entities/pitching/model/pitchCurve'
import type { RandomPort } from '@/shared/api/random/randomPort'

/** next() 가 차례로 values 를 돌려준다 — randomIntegerBelow(a, b) = a + floor(v × (b − a)) */
const 차례난수 = (values: number[]): RandomPort => {
  let index = 0
  return {
    next: () => values[index++] ?? 0,
    nextInRange: (minimum, maximum) => minimum + (values[index++] ?? 0) * (maximum - minimum),
    pick: (candidates) => candidates[0],
  }
}
const C = ZONE_CENTERS[1]

describe('목표점 — 0x345fc', () => {
  it('종류 0 은 존 중심 ±141 안이다 (x 먼저, 그다음 y)', () => {
    expect(pitchTargetOf(0, { side: 1, batterSide: 1, runnerCount: 0 }, 차례난수([0, 0.999]))).toEqual({ x: C.x - 141, y: C.y + 140, z: 29705 })
  })

  it('종류 1 은 dx 141~331 · dy 141~329, 부호는 rand(0,2) 두 번 (0 이면 +)', () => {
    expect(pitchTargetOf(1, { side: 1, batterSide: 1, runnerCount: 0 }, 차례난수([0, 0, 0, 0.5]))).toEqual({ x: C.x + 141, y: C.y - 141, z: 29705 })
  })

  it('종류 2 는 dx 282~331 · dy 280~329', () => {
    expect(pitchTargetOf(2, { side: 1, batterSide: 1, runnerCount: 0 }, 차례난수([0.999, 0.999, 0.5, 0]))).toEqual({ x: C.x - 331, y: C.y + 329, z: 29705 })
  })

  it('종류 3 은 존 밖 — 타자 쪽(side0 +, 그 밖 −)이고 rand(0,3) == 0 이면 뒤집는다', () => {
    expect(pitchTargetOf(3, { side: 1, batterSide: 0, runnerCount: 0 }, 차례난수([0, 0, 0.5, 0])).x).toBe(C.x + 332)
    expect(pitchTargetOf(3, { side: 1, batterSide: 0, runnerCount: 0 }, 차례난수([0, 0, 0, 0])).x).toBe(C.x - 332)
    expect(pitchTargetOf(3, { side: 1, batterSide: 1, runnerCount: 0 }, 차례난수([0, 0, 0.5, 0.5])).y).toBe(C.y - 330)
  })

  it('종류 4(견제)는 주자가 0·3명이면 종류 1 이고, 그 밖은 웹에 견제가 없어 종류 1 로 둔다 (추정)', () => {
    const 종류1 = pitchTargetOf(1, { side: 1, batterSide: 1, runnerCount: 1 }, 차례난수([0.2, 0.3, 0, 0]))
    expect(pitchTargetOf(4, { side: 1, batterSide: 1, runnerCount: 1 }, 차례난수([0.2, 0.3, 0, 0]))).toEqual(종류1)
  })
})

describe('제구 오차 — 0x4dc78', () => {
  it('각도 rand(0,360)+1, 반경 = 계수 × (반폭 + rand(−2,3)) × sin16 >> 16, 부호는 rand(0,2)', () => {
    // 등급 3 (CPU 는 조준 칸 3+3=6 → 반폭 10), rand(0,100)=0 → 계수 12, 각도 90°
    const random = 차례난수([0, 89 / 360, 0.4, 0.4, 0, 0])
    const moved = applyControlError(C, { tier: 3, isComputer: true }, random)

    // dx = 12 × (10+0) × 65535 >> 16 = 119, dy = 12 × 10 × cos16(90)=0 → 0
    expect(moved).toEqual({ x: C.x + 119, y: C.y, z: C.z })
  })

  it('등급 0 은 반폭 21 을 쓴다', () => {
    const random = 차례난수([0, 89 / 360, 0.4, 0.4, 0.5, 0.5])
    expect(applyControlError(C, { tier: 0, isComputer: true }, random).x).toBe(C.x - 251)
  })
})
