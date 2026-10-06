import { describe, expect, it } from 'vitest'
import { strikeoutVibrationMillisecondsOf } from '@/features/play-game/model/strikeoutVibration'

describe('사람이 던진 공의 삼진 진동 — 상태 0x12 첫 그리기 0x4d0d6 (state[0xc] == 5)', () => {
  it('2 스트라이크에서 스트라이크(헛스윙·루킹)면 100ms', () => {
    expect(strikeoutVibrationMillisecondsOf({ kind: '스트라이크', isSwinging: true }, 2)).toBe(100)
    expect(strikeoutVibrationMillisecondsOf({ kind: '스트라이크', isSwinging: false }, 2)).toBe(100)
  })

  it('0·1 스트라이크의 스트라이크, 볼·사구·파울·타구, 판정 없음은 울리지 않는다', () => {
    expect(strikeoutVibrationMillisecondsOf({ kind: '스트라이크', isSwinging: true }, 1)).toBe(0)
    expect(strikeoutVibrationMillisecondsOf({ kind: '스트라이크', isSwinging: false }, 0)).toBe(0)
    expect(strikeoutVibrationMillisecondsOf({ kind: '볼' }, 2)).toBe(0)
    expect(strikeoutVibrationMillisecondsOf({ kind: '사구' }, 2)).toBe(0)
    expect(strikeoutVibrationMillisecondsOf({ kind: '파울' }, 2)).toBe(0)
    expect(strikeoutVibrationMillisecondsOf({ kind: '타구', outcome: { kind: '안타', bases: 1 } }, 2)).toBe(0)
    expect(strikeoutVibrationMillisecondsOf(null, 2)).toBe(0)
  })
})
