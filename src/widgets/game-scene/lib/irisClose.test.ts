import { describe, expect, it } from 'vitest'
import { irisHoleSpansOf } from '@/widgets/game-scene/lib/irisClose'

describe('원 닫기 구멍 0xbd5bc', () => {
  it('상자 안에서 줄마다 가운데로 모인 구멍 칸 — 위아래 대칭, 상자를 넘지 않는다', () => {
    const spans = irisHoleSpansOf(116, 161, 7)
    expect(spans.length).toBe(7)
    for (const span of spans) {
      expect(span.from).toBeGreaterThanOrEqual(116)
      expect(span.to).toBeLessThanOrEqual(122)
    }
    expect(spans[3]).toEqual({ y: 164, from: 116, to: 122 })
    expect(spans[0]!.to - spans[0]!.from).toBe(spans[6]!.to - spans[6]!.from)
  })

  it('크기 0 이면 구멍이 없다', () => {
    expect(irisHoleSpansOf(120, 165, 0)).toEqual([])
  })
})
