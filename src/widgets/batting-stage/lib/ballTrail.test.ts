import { describe, expect, it } from 'vitest'
import { HIT_BALL_TRAIL, PITCH_BALL_TRAIL, ballTrailLinesOf, trailsAt } from '@/widgets/batting-stage/lib/ballTrail'

/** 경로 점 k 의 화면 자리 — 시험용 (x = 10k, y = 100 + k) */
const pixelAt = (index: number) => ({ x: 10 * index, y: 100 + index })

describe('타석 공 꼬리선 0x3b188 (r274 직접 떴다)', () => {
  it('공 틱 0 이면 없다 (3b19c)', () => {
    expect(ballTrailLinesOf(PITCH_BALL_TRAIL, 0, 20, pixelAt)).toEqual([])
  })

  it('투구(5, 0xdf) — 마디 i 는 점 k − 1 → k (k = 틱 − 5 + i), 굵기 i 줄 · 밝기 223·i/5', () => {
    const lines = ballTrailLinesOf(PITCH_BALL_TRAIL, 10, 20, pixelAt)
    expect(lines).toHaveLength(1 + 2 + 3 + 4 + 5)
    // i = 1: k = 6, 한 줄, x 보정 j − 0
    expect(lines[0]).toEqual({ from: { x: 60, y: 106 }, to: { x: 50, y: 105 }, shade: 44 })
    // i = 2: k = 7, 두 줄, x 보정 j − 1
    expect(lines.slice(1, 3)).toEqual([
      { from: { x: 69, y: 107 }, to: { x: 59, y: 106 }, shade: 89 },
      { from: { x: 70, y: 107 }, to: { x: 60, y: 106 }, shade: 89 },
    ])
    // i = 5: k = 10, 밝기 0xdf
    expect(lines.at(-1)).toEqual({ from: { x: 102, y: 110 }, to: { x: 92, y: 109 }, shade: 0xdf })
  })

  it('k ≤ 0 마디는 건너뛰고 k ≥ N 이면 N − 1 로 자른다 (3b1c8 · 3b1d2)', () => {
    expect(ballTrailLinesOf(PITCH_BALL_TRAIL, 2, 20, pixelAt).map((line) => line.shade)).toEqual([178, 178, 178, 178, 223, 223, 223, 223, 223])
    const clipped = ballTrailLinesOf(HIT_BALL_TRAIL, 12, 10, pixelAt)
    // 0x13(3, 0x8f): k = 10 · 11 · 12 → 모두 9
    expect(clipped.map((line) => line.from.y)).toEqual([109, 109, 109, 109, 109, 109])
    expect(clipped.map((line) => line.shade)).toEqual([47, 95, 95, 143, 143, 143])
  })

  it('공 틱 ≤ 점 수일 때만 긋는다 (3b434)', () => {
    expect(trailsAt(20, 20)).toBe(true)
    expect(trailsAt(21, 20)).toBe(false)
  })
})
