import { describe, expect, it } from 'vitest'
import { PRE_PITCH_TICKS, resultPhaseTicksOf } from '@/widgets/batting-stage/lib/stagePhaseTicks'

describe('타석 단계 길이 — 그림 수', () => {
  it('대기는 0xf 9 그림 + 0x10 7 그림', () => {
    expect(PRE_PITCH_TICKS).toBe(16)
  })

  it('결과(0x12)는 문턱 15 → 16 그림, 볼넷 · 사구 · 삼진은 문턱 31 → 32 그림 (0x4e6d4)', () => {
    const 카운트 = { balls: 1, strikes: 1 }
    expect(resultPhaseTicksOf({ kind: '볼' }, 카운트)).toBe(16)
    expect(resultPhaseTicksOf({ kind: '스트라이크', isSwinging: true }, 카운트)).toBe(16)
    expect(resultPhaseTicksOf({ kind: '볼' }, { balls: 3, strikes: 0 })).toBe(32)
    expect(resultPhaseTicksOf({ kind: '스트라이크', isSwinging: false }, { balls: 0, strikes: 2 })).toBe(32)
    expect(resultPhaseTicksOf({ kind: '사구' }, null)).toBe(32)
    expect(resultPhaseTicksOf({ kind: '파울' }, { balls: 0, strikes: 2 })).toBe(16)
  })
})
