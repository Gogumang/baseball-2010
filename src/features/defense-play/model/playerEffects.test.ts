import { describe, expect, it } from 'vitest'
import { basePosition } from '@/entities/fielding/model/fieldGeometry'
import { createRunner } from '@/entities/fielding/model/fieldingState'
import {
  DUST_TRAIL_OFF,
  slideDustDirectionOf,
  stepDustTrail,
  tickMarkCounter,
  type DustTrailState,
} from '@/features/defense-play/model/playerEffects'
import { FIELDER_ACTION } from '@/pages/defense/lib/defenseView'

describe('달리기 먼지 자국 (0x43546 · vt6c~vt84)', () => {
  const 자리 = { x: 10_000, y: 0, z: 20_000 }
  const 돌리기 = (action: number, n: number) => {
    let state: DustTrailState = DUST_TRAIL_OFF
    const 찍힘: (number | null)[] = []
    for (let i = 0; i < n; i += 1) {
      const step = stepDustTrail(state, action, 자리)
      state = step.state
      찍힘.push(step.mark?.frame ?? null)
    }
    return 찍힘
  }

  it('달리는 동안 5 그림 주기로 18 · 19 · 20 을 찍는다 — 켜는 그림 · 끄는 그림은 빈다', () => {
    expect(돌리기(FIELDER_ACTION.runLeft, 11)).toEqual([null, 18, 19, 20, null, null, 18, 19, 20, null, null])
  })

  it('진행 반대쪽 500 뒤 — ← 는 x + 500, ↑ 는 z + 500, → 는 x − 500', () => {
    const 첫점 = (action: number) => stepDustTrail(stepDustTrail(DUST_TRAIL_OFF, action, 자리).state, action, 자리).mark?.point
    expect(첫점(FIELDER_ACTION.runLeft)).toEqual({ x: 10_500, y: 0, z: 20_000 })
    expect(첫점(FIELDER_ACTION.runUp)).toEqual({ x: 10_000, y: 0, z: 20_500 })
    expect(첫점(FIELDER_ACTION.runRight)).toEqual({ x: 9_500, y: 0, z: 20_000 })
  })

  it('↓ 달리기(1)·제자리는 vtdc 가 거짓이라 끈다 — 자국이 없다', () => {
    expect(돌리기(FIELDER_ACTION.runDown, 6).every((frame) => frame === null)).toBe(true)
    const 켜짐 = stepDustTrail(DUST_TRAIL_OFF, FIELDER_ACTION.runUp, 자리).state
    expect(stepDustTrail(켜짐, FIELDER_ACTION.stand, 자리).state.on).toBe(false)
  })

  it('자국 점은 켤 때 정한 자리 그대로다 — 야수가 움직여도 따라가지 않는다', () => {
    const 켜짐 = stepDustTrail(DUST_TRAIL_OFF, FIELDER_ACTION.runRight, 자리).state
    const 옮김 = stepDustTrail(켜짐, FIELDER_ACTION.runRight, { x: 12_000, y: 0, z: 20_000 })
    expect(옮김.mark?.point).toEqual({ x: 9_500, y: 0, z: 20_000 })
  })
})

describe('표시 카운터 (야수 틱 0xa1284 a12da · a12e6)', () => {
  it('잠금이 없을 때만 1 씩 줄고 0 아래로 안 간다', () => {
    expect(tickMarkCounter(6, false)).toBe(5)
    expect(tickMarkCounter(6, true)).toBe(6)
    expect(tickMarkCounter(0, false)).toBe(0)
  })
})

describe('슬라이딩 먼지 방향 0x9ff40 — 원본 갈래 그대로', () => {
  const 주자 = (startBase: number, targetBase: number, at: number) =>
    createRunner(1, startBase, 300, { targetBase, position: basePosition(at), sliding: true })

  it('앞으로 2 → 3루는 4, 3 → 홈은 3', () => {
    expect(slideDustDirectionOf(주자(2, 3, 2), 2)).toBe(4)
    expect(slideDustDirectionOf(주자(3, 4, 3), 3)).toBe(3)
  })

  it('⚠️ 앞으로 1 → 2루 · 홈 → 1루는 0 — 먼지가 없다(원본 그대로)', () => {
    expect(slideDustDirectionOf(주자(1, 2, 1), 1)).toBe(0)
    expect(slideDustDirectionOf(주자(0, 1, 0), 0)).toBe(0)
  })

  it('되돌아가는 3 → 2루는 1, 2 → 1루는 0', () => {
    expect(slideDustDirectionOf(주자(3, 2, 3), 3)).toBe(1)
    expect(slideDustDirectionOf(주자(2, 1, 2), 2)).toBe(0)
  })
})
