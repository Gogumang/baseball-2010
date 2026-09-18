import { describe, expect, it } from 'vitest'
import { bernsteinWeights, bezierPointAt } from '@/shared/lib/bezier/bezier'

describe('bernsteinWeights — 0xbcb84 정수식', () => {
  it('차수 0 은 원본 버그대로 [1]', () => {
    expect(bernsteinWeights(0, 5000)).toEqual([1])
  })

  it('차수 2, t = 5000 이면 [2500, 5000, 2500]', () => {
    expect(bernsteinWeights(2, 5000)).toEqual([2500, 5000, 2500])
  })

  it('끝점 t = 10000 은 마지막 제어점 가중치만 남는다', () => {
    expect(bernsteinWeights(2, 10000)).toEqual([0, 0, 10000])
  })
})

describe('bezierPointAt — 0xbcc6c', () => {
  const 점 = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }]

  it('i 번째 점은 t = trunc(i×10000/(N−1)) 이다', () => {
    expect(bezierPointAt(점, 0, 3)).toEqual({ x: 0, y: 0 })
    expect(bezierPointAt(점, 1, 3)).toEqual({ x: 75, y: 25 })
    expect(bezierPointAt(점, 2, 3)).toEqual({ x: 100, y: 100 })
  })
})
