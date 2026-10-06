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

describe('삼진 진동 — 상태 0x12 첫 그리기 0x4d0d6 (state[0xc] == 5)', () => {
  const 스트라이크 = (isSwinging: boolean): PitchOutcomeDetail => ({
    resolution: { kind: '스트라이크', isSwinging },
    hasSwung: isSwinging,
    isBunt: false,
    resultCode: null,
  })

  it('2 스트라이크에서 스트라이크(헛스윙·루킹)면 100ms', () => {
    expect(pitchVibrationMillisecondsOf(스트라이크(true), 10, 공, 2)).toBe(100)
    expect(pitchVibrationMillisecondsOf(스트라이크(false), null, 공, 2)).toBe(100)
  })

  it('0·1 스트라이크의 스트라이크, 볼, 볼카운트를 모를 때는 울리지 않는다', () => {
    expect(pitchVibrationMillisecondsOf(스트라이크(true), 10, 공, 1)).toBe(0)
    expect(pitchVibrationMillisecondsOf(스트라이크(false), null, 공, 0)).toBe(0)
    expect(
      pitchVibrationMillisecondsOf({ resolution: { kind: '볼' }, hasSwung: false, isBunt: false, resultCode: null }, null, 공, 2),
    ).toBe(0)
    expect(pitchVibrationMillisecondsOf(스트라이크(true), 10, 공, null)).toBe(0)
  })

  it('2 스트라이크 파울은 맞은 공 진동(0xbc5) 그대로', () => {
    expect(pitchVibrationMillisecondsOf(타구, 16, 공, 2)).toBe(300)
  })
})
