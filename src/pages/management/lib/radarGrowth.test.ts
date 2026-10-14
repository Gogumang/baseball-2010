import { describe, expect, it } from 'vitest'
import { radarGrowthAt, radarGrowthStart } from '@/pages/management/lib/radarGrowth'

describe('레이더 자라는 애니 0x760e8', () => {
  it('들어오면 0 에서 그림마다 48 씩 — 첫 그림도 굴린 뒤라 48 이다', () => {
    const start = radarGrowthStart([], false, 4, true)
    const targets = [100, 200, 999, 0]
    expect(radarGrowthAt(start, targets, 0).current).toEqual([48, 48, 48, 0])
    expect(radarGrowthAt(start, targets, 2).current).toEqual([100, 144, 144, 0])
  })

  it('네 축이 한 그림에서 다 닿아야 끝난다 — 0 → 999 는 21 걸음(그림 20)', () => {
    const start = radarGrowthStart([], false, 4, true)
    const targets = [999, 999, 999, 999]
    expect(radarGrowthAt(start, targets, 19).isDone).toBe(false)
    expect(radarGrowthAt(start, targets, 20)).toMatchObject({ isDone: true, current: targets })
  })

  it('끼워 보기는 지난 목표값에서 오르내린다 — 내려가는 축은 −48', () => {
    const settled = radarGrowthAt(radarGrowthStart([], false, 4, true), [500, 500, 500, 500], 30)
    const start = radarGrowthStart(settled.previous, settled.hasPrevious, 4, false)
    expect(radarGrowthAt(start, [600, 400, 500, 500], 0).current).toEqual([548, 452, 500, 500])
  })

  it('원본 특이점 — 들어올 때 prev 를 안 지워 첫 축이 닿은 뒤 prev 가 큰 축은 목표로 튄다', () => {
    const start = radarGrowthStart([900, 900, 900, 900], true, 4, true)
    expect(start.current).toEqual([0, 0, 0, 0])
    // 그림 0: 축 0(목표 10)이 닿아 +0xad 가 서고, 축 1(목표 300 < prev 900)은 감소 갈래 0 − 48 ≤ 300 → 300 으로 튄다
    expect(radarGrowthAt(start, [10, 300, 300, 300], 0).current).toEqual([10, 300, 300, 300])
  })
})
