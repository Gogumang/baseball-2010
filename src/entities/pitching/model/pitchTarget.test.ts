import { describe, expect, it } from 'vitest'
import { applyControlError, applyMissionAimShake, pitchTargetOf } from '@/entities/pitching/model/pitchTarget'
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

describe('투수 미션 조준점 흔들림 — 0x39c5c (E-7 · 4a)', () => {
  /** 흔들리기 전에 늘 존 중심 ±600/±400 으로 자른다 */
  it('세기 0 이면 자르기만 하고 난수를 쓰지 않는다', () => {
    const 난수 = 차례난수([])
    expect(applyMissionAimShake({ x: C.x + 9999, y: C.y - 9999, z: C.z }, 0, 1, 난수)).toEqual({
      x: C.x + 600,
      y: C.y - 400,
      z: C.z,
    })
  })

  it('rand(0,100) 이 50 이면 흔들고 51 이면 안 흔든다 — 51% 다 (원본 그대로)', () => {
    // 0.5 → rand(0,100) = 50 → `<= 50` 이라 흔든다 (둘째 난수 0 → rand(−40,40) = −40)
    expect(applyMissionAimShake(C, 1, 1, 차례난수([0.5]))).toEqual({ x: C.x - 40, y: C.y, z: C.z })
    expect(applyMissionAimShake(C, 1, 1, 차례난수([0.51]))).toEqual({ x: C.x, y: C.y, z: C.z })
  })

  it('세기 1 은 가로만 rand(−40,40) 흔든다 (세로 난수를 안 뽑는다)', () => {
    // 첫 난수 0 → rand(0,100)=0 ≤ 50 이라 흔든다, 둘째 0 → rand(−40,40) = −40
    expect(applyMissionAimShake(C, 1, 1, 차례난수([0, 0]))).toEqual({ x: C.x - 40, y: C.y, z: C.z })
    // 세로 난수를 뽑지 않으므로 값을 하나만 줘도 y 가 그대로다
    expect(applyMissionAimShake(C, 1, 1, 차례난수([0, 0.999])).y).toBe(C.y)
  })

  it('세기 2 는 가로·세로를 rand(−80,80) 씩 흔든다', () => {
    expect(applyMissionAimShake(C, 2, 1, 차례난수([0, 0, 0.999]))).toEqual({
      x: C.x - 80,
      y: C.y + 79,
      z: C.z,
    })
  })

  it('세기 3 은 존 안 아무 데로 튄다 — x rand(중심±600) · y rand(중심±400)', () => {
    expect(applyMissionAimShake(C, 3, 1, 차례난수([0, 0, 0]))).toEqual({
      x: C.x - 600,
      y: C.y - 400,
      z: C.z,
    })
    expect(applyMissionAimShake(C, 3, 1, 차례난수([0, 0.999, 0.999]))).toEqual({
      x: C.x + 598,
      y: C.y + 399,
      z: C.z,
    })
  })

  it('흔든 값은 다시 자르지 않는다 — 원본도 다음 틱에서야 자른다 (원본 그대로)', () => {
    const 오른쪽끝 = { x: C.x + 600, y: C.y, z: C.z }
    expect(applyMissionAimShake(오른쪽끝, 1, 1, 차례난수([0, 0.999])).x).toBe(C.x + 600 + 39)
  })
})

describe('제구 오차에 미션 흔들림 꿰기', () => {
  it('missionAim 을 안 넘기면 난수 차례가 그대로다 — 지금까지와 똑같이 논다', () => {
    const 값 = [0, 89 / 360, 0.4, 0.4, 0, 0]
    expect(applyControlError(C, { tier: 3, isComputer: true }, 차례난수(값))).toEqual(
      applyControlError(C, { tier: 3, isComputer: true, missionAim: undefined }, 차례난수(값)),
    )
  })

  it('조건코드 0 도 난수를 건드리지 않는다', () => {
    const 값 = [0, 89 / 360, 0.4, 0.4, 0, 0]
    expect(
      applyControlError(C, { tier: 3, isComputer: true, missionAim: { conditionCode: 0, side: 1 } }, 차례난수(값)),
    ).toEqual({ x: C.x + 119, y: C.y, z: C.z })
  })

  it('조건코드 1 이면 흔들림 난수를 먼저 쓰고 그 자리에서 흩어진다', () => {
    // 앞 둘이 흔들림(0 → 흔든다, 0 → −40), 나머지는 위 "제구 오차" 시험과 같은 차례다
    const random = 차례난수([0, 0, 0, 89 / 360, 0.4, 0.4, 0, 0])
    const moved = applyControlError(
      C,
      { tier: 3, isComputer: true, missionAim: { conditionCode: 1, side: 1 } },
      random,
    )

    expect(moved).toEqual({ x: C.x - 40 + 119, y: C.y, z: C.z })
  })
})
