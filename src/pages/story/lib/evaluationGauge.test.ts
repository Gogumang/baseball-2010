import { describe, expect, it } from 'vitest'
import {
  EVALUATION_GAUGE_ANCHOR, EVALUATION_GAUGE_FILL, EVALUATION_GAUGE_VALUE_BOX, evaluationGaugeDivisorOf,
  evaluationGaugeRowsOf, evaluationGaugeValueOf, startEvaluationGauge, tickEvaluationGauge,
} from '@/pages/story/lib/evaluationGauge'
import type { EvaluationGaugeState } from '@/pages/story/lib/evaluationGauge'

const ticks = (state: EvaluationGaugeState, count: number) => {
  let next = state
  for (let index = 0; index < count; index += 1) next = tickEvaluationGauge(next)
  return next
}

describe('0x8587c · 0x858cc — 인기도 변화 막대', () => {
  it('d: 타자편 6 · 투수편 선발(보직 0) 12 · 그 밖 보직 6 (0x8a816~0x8a81c)', () => {
    expect(evaluationGaugeDivisorOf({ kind: 'batter' })).toBe(6)
    expect(evaluationGaugeDivisorOf({ kind: 'pitcher', role: 0 })).toBe(12)
    expect(evaluationGaugeDivisorOf({ kind: 'pitcher', role: 2 })).toBe(6)
    expect(evaluationGaugeDivisorOf({ kind: 'pitcher', role: 1 })).toBe(6)
  })

  it('v ≥ 0: 0 에서 v × 60 / d 까지 한 줄씩 오른다', () => {
    const state = startEvaluationGauge(3, 6)
    expect(state).toEqual({ current: 0, step: 1, target: 30 })
    expect(ticks(state, 29).current).toBe(29)
    expect(ticks(state, 30).current).toBe(30)
    expect(ticks(state, 40).current).toBe(30)
    expect(startEvaluationGauge(6, 6).target).toBe(60)
    expect(startEvaluationGauge(5, 12).target).toBe(25)
    expect(startEvaluationGauge(0, 6)).toEqual({ current: 0, step: 1, target: 0 })
  })

  it('v < 0: −1 은 30, 그 밖은 60 에서 v 까지 내려간다 (0 이하는 안 그린다)', () => {
    expect(startEvaluationGauge(-1, 6)).toEqual({ current: 30, step: -1, target: -1 })
    expect(startEvaluationGauge(-2, 6)).toEqual({ current: 60, step: -1, target: -2 })
    const drained = ticks(startEvaluationGauge(-1, 6), 31)
    expect(drained.current).toBe(-1)
    expect(evaluationGaugeRowsOf(drained)).toHaveLength(0)
  })

  it('0x847e0: 프레임 58 을 (1, 136) 에 · 채움 프레임 59 를 (6, 132 − i) 에', () => {
    expect(EVALUATION_GAUGE_ANCHOR).toEqual({ x: 1, y: 136 })
    expect(EVALUATION_GAUGE_FILL).toEqual({ x: 6, bottom: 132 })
    expect(evaluationGaugeRowsOf({ current: 3, step: 1, target: 10 })).toEqual([132, 131, 130])
  })

  it('0x85944: 칸 (25, 125, 14, 10) — "+" 는 x+1 로 두 번, "-" 는 y+1 로 두 번 · |v| 는 num 80~ 오른쪽 맞춤', () => {
    expect(EVALUATION_GAUGE_VALUE_BOX).toEqual({ x: 25, y: 125, width: 14, height: 10 })
    expect(evaluationGaugeValueOf(3)).toEqual({
      sign: '+',
      signs: [{ x: 25, y: 124 }, { x: 26, y: 124 }],
      digits: [{ image: 83, x: 31, y: 125 }],
    })
    expect(evaluationGaugeValueOf(-1)).toEqual({
      sign: '-',
      signs: [{ x: 25, y: 124 }, { x: 25, y: 125 }],
      digits: [{ image: 81, x: 35, y: 125 }],
    })
    // |v| > 9 면 ox 5 — 12: 4 + 8 = 12 → x = 25 + 5 + 14 − 12 = 32
    expect(evaluationGaugeValueOf(12).digits).toEqual([{ image: 81, x: 32, y: 125 }, { image: 82, x: 36, y: 125 }])
  })
})
