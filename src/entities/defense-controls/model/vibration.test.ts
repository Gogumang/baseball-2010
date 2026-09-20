import { describe, expect, it } from 'vitest'
import {
  vibrationGradeOf,
  vibrationMillisecondsOf,
  VIBRATION_MILLISECONDS_BY_GRADE,
} from '@/entities/defense-controls/model/vibration'

describe('스윙 타이밍 → 진동 길이 — 원본 0xac758 · 0x5228c', () => {
  it('등급 표 (span 100, span/3 = 33)', () => {
    const 표: ReadonlyArray<readonly [number, 1 | 2 | 3]> = [
      [0, 2],
      [32, 2],
      [33, 3],
      [100, 3],
      [-32, 2],
      [-33, 1],
    ]
    표.forEach(([timingScore, grade]) => {
      expect(vibrationGradeOf(timingScore), `타이밍 ${timingScore}`).toBe(grade)
    })
  })

  it('등급 1/2/3 = 100/200/300 ms', () => {
    expect(VIBRATION_MILLISECONDS_BY_GRADE).toEqual({ 1: 100, 2: 200, 3: 300 })
    expect(vibrationMillisecondsOf(0)).toBe(200)
    expect(vibrationMillisecondsOf(33)).toBe(300)
    expect(vibrationMillisecondsOf(100)).toBe(300)
  })

  it('타이밍 점수가 0 아래로 안 내려가므로 등급 1(100ms)은 실제로 안 나온다', () => {
    // 0x34be0 이 t 를 d_level.dat D[0x10] = 0 으로 하한 클램프한다. 갈래만 남은 죽은 값이다.
    for (let t = 0; t <= 100; t += 1) {
      expect(vibrationGradeOf(t), `타이밍 ${t}`).not.toBe(1)
    }
  })
})
