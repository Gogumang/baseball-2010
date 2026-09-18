import { describe, expect, it } from 'vitest'
import { timingOf } from '@/entities/batting/model/swingTiming'

/** 위치 분석 4차 표 — F = N−2 기준 −5..+3 프레임 */
const 주변타이밍 = (frameCount: number) =>
  Array.from({ length: 9 }, (_unused, index) => timingOf(frameCount - 2 + index - 5, frameCount, false))

describe('timingOf — 0x34be0', () => {
  it('F = N−2 에서 100 이고 멀어질수록 떨어진다', () => {
    expect(주변타이밍(12)).toEqual([0, 0, 0, 25, 62, 100, 62, 25, 0])
    expect(주변타이밍(18)).toEqual([0, 4, 29, 54, 79, 100, 79, 54, 29])
    expect(주변타이밍(24)).toEqual([12, 29, 45, 66, 83, 100, 83, 66, 45])
  })

  it('점이 3개 미만이면 0', () => {
    expect(timingOf(0, 2, false)).toBe(0)
  })

  it('특수구는 24 대신 22, N−1 대신 12 로 나눈다', () => {
    expect(timingOf(28, 30, true)).toBe(100)
    expect(timingOf(29, 30, true)).toBe(Math.trunc((100 * (22 - Math.trunc(100 / 12))) / 22))
  })
})
