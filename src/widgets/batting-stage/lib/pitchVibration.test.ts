import { describe, expect, it } from 'vitest'
import { pitchVibrationMillisecondsOf } from '@/widgets/batting-stage/lib/pitchVibration'
import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'

const 공 = { frameCount: 18, type: 'FASTBALL' }
const 타구: PitchOutcomeDetail = {
  resolution: { kind: '파울' },
  hasSwung: true,
  isBunt: false,
  resultCode: 9,
}

describe('타석 진동 — 0xbc5(0x5228c) · 사구 0x51b0e', () => {
  it('맞은 공은 타이밍 33 이상 300ms, 그 아래 200ms', () => {
    // F = N−2 = 16 → 타이밍 100
    expect(pitchVibrationMillisecondsOf(타구, 16, 공)).toBe(300)
    // F = 0 → 타이밍 trunc(100·(24 − trunc(1600/17))/24) 는 0 이하 → 0 → 200ms
    expect(pitchVibrationMillisecondsOf(타구, 0, 공)).toBe(200)
  })

  it('사구는 200ms', () => {
    expect(
      pitchVibrationMillisecondsOf(
        { resolution: { kind: '사구' }, hasSwung: false, isBunt: false, resultCode: null },
        null,
        공,
      ),
    ).toBe(200)
  })

  it('헛스윙·볼은 울리지 않는다', () => {
    expect(
      pitchVibrationMillisecondsOf(
        { resolution: { kind: '스트라이크', isSwinging: true }, hasSwung: true, isBunt: false, resultCode: null },
        10,
        공,
      ),
    ).toBe(0)
    expect(
      pitchVibrationMillisecondsOf({ resolution: { kind: '볼' }, hasSwung: false, isBunt: false, resultCode: null }, null, 공),
    ).toBe(0)
  })
})
