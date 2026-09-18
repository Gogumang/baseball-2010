import { describe, expect, it } from 'vitest'
import {
  atan2Degrees,
  cosineHundred,
  cosineSixteen,
  integerSquareRoot,
  sineHundred,
  sineSixteen,
} from '@/shared/lib/math/originalTrigonometry'

describe('원본 정수 삼각함수 — 0x6c6a8 · 0x6c768 · 0x6c7c0', () => {
  it('sin × 100 은 표를 0~90° 로 접고 180° 넘으면 부호를 뒤집는다', () => {
    expect([0, 30, 90, 150, 180, 210, 270, 350, -10, 360].map(sineHundred)).toEqual([0, 50, 100, 50, 0, -50, -100, -17, -17, 0])
    expect(cosineHundred(0)).toBe(100)
    expect(cosineHundred(120)).toBe(-50)
  })

  it('sin × 65535 도 같은 규칙이다', () => {
    expect([0, 30, 90, 200].map(sineSixteen)).toEqual([0, 32768, 65535, -22414])
    expect(cosineSixteen(0)).toBe(65535)
  })

  it('atan2Degrees(x, y) — 비율 trunc(y×10000/x) 를 tan 표에서 이진 탐색하고 사분면을 붙인다', () => {
    expect(atan2Degrees(100, 100)).toBe(45)
    expect(atan2Degrees(100, 0)).toBe(0)
    expect(atan2Degrees(0, 0)).toBe(0)
    expect(atan2Degrees(0, 5)).toBe(90)
    expect(atan2Degrees(0, -5)).toBe(270)
    expect(atan2Degrees(-100, 100)).toBe(135)
    expect(atan2Degrees(-100, -100)).toBe(225)
    expect(atan2Degrees(100, -100)).toBe(315)
  })

  it('이진 탐색은 tan 표에서 비율 이하인 칸을 주고, 89° 에는 닿지 못한다 (원본 그대로)', () => {
    expect(atan2Degrees(5205, 504)).toBe(5)
    expect(atan2Degrees(5205, 520)).toBe(5)
    expect(atan2Degrees(1, 1_000_000)).toBe(88)
  })

  it('정수 제곱근은 버림이다 (0x6c64c)', () => {
    expect([0, 1, 3, 4, 99, 100, 12345678].map(integerSquareRoot)).toEqual([0, 1, 1, 2, 9, 10, 3513])
  })
})
