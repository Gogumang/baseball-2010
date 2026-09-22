import { describe, expect, it } from 'vitest'
import {
  contactSoundIdOf,
  inPlayCallSoundIdOf,
  pitchCallSoundIdOf,
  PITCH_RELEASE_SOUND,
} from '@/features/play-at-bat/model/atBatSounds'
import type { AtBatState } from '@/entities/at-bat/model/atBatState'
import type { BattedBallPattern } from '@/shared/config/original/battedBallPatterns'

/**
 * 번호는 `shared/config/original/sounds` 의 표, 분기는 docs/re/R2-game-effects.md 3-3·8절이다.
 */

const 카운트 = (balls: number, strikes: number, outcome: AtBatState['outcome'] = null): AtBatState =>
  ({ balls, strikes, outcome })

/** [수평각, 세기, 높이, 플래그] */
const 패턴 = (angle: number, speed: number, height: number, flags = 0): BattedBallPattern =>
  [angle, speed, height, flags] as BattedBallPattern

describe('타구 순간 소리 (0x515de~0x5164a)', () => {
  it('배트를 내지 않았으면 아무 소리도 없다 — 타구음 갈래를 지나지 않는다', () => {
    expect(contactSoundIdOf({ hasSwung: false, hasHit: false, buntKind: 0, resultCode: null, pattern: null })).toBeNull()
  })

  it('헛스윙은 바람 소리 8 (0x51350)', () => {
    expect(contactSoundIdOf({ hasSwung: true, hasHit: false, buntKind: 0, resultCode: null, pattern: null })).toBe(8)
  })

  it('번트 자세로 못 맞히면 바람 소리도 안 난다 — 원본 조건이 스윙 +8 == 0 이다', () => {
    expect(contactSoundIdOf({ hasSwung: true, hasHit: false, buntKind: 2, resultCode: null, pattern: null })).toBeNull()
  })

  it('세기 1200 을 넘으면 강한 타구 5 (0x35988)', () => {
    expect(contactSoundIdOf({ hasSwung: true, hasHit: true, buntKind: 0, resultCode: 0, pattern: 패턴(90, 1300, 200) })).toBe(5)
  })

  it('세기·높이가 다 작으면 약한 타구 59 (0x39304)', () => {
    expect(contactSoundIdOf({ hasSwung: true, hasHit: true, buntKind: 0, resultCode: 0, pattern: 패턴(90, 400, 400) })).toBe(59)
  })

  it('강도 약도 아니면 보통 타구 6 (0x51640)', () => {
    expect(contactSoundIdOf({ hasSwung: true, hasHit: true, buntKind: 0, resultCode: 0, pattern: 패턴(90, 700, 700) })).toBe(6)
  })

  it('번트로 맞으면 9 — 강·약보다 먼저 걸린다 (0x51606)', () => {
    expect(contactSoundIdOf({ hasSwung: true, hasHit: true, buntKind: 1, resultCode: 0, pattern: 패턴(90, 1300, 200) })).toBe(9)
  })

  it('홈런성 결과 코드로 멀리 날아가면 특수 타구 7 (0x392ac) — 번트보다도 먼저다', () => {
    const 큰타구 = 패턴(90, 1500, 1200)
    expect(contactSoundIdOf({ hasSwung: true, hasHit: true, buntKind: 0, resultCode: 24, pattern: 큰타구 })).toBe(7)
    expect(contactSoundIdOf({ hasSwung: true, hasHit: true, buntKind: 1, resultCode: 24, pattern: 큰타구 })).toBe(7)
  })

  it('폴에 맞는 각(45·135)이면 큰 타구로 보지 않는다 (0x392ac 의 +0xab0 == −1)', () => {
    expect(contactSoundIdOf({ hasSwung: true, hasHit: true, buntKind: 0, resultCode: 24, pattern: 패턴(45, 1500, 1200) })).toBe(5)
  })

  it('세기 800 을 넘고 세기+|높이| 가 1599 를 넘으면 강한 타구다 — 높이 부호는 안 본다 (0xb0614 플래그)', () => {
    expect(contactSoundIdOf({ hasSwung: true, hasHit: true, buntKind: 0, resultCode: 0, pattern: 패턴(90, 900, 800) })).toBe(5)
    expect(contactSoundIdOf({ hasSwung: true, hasHit: true, buntKind: 0, resultCode: 0, pattern: 패턴(90, 900, 800, 1) })).toBe(5)
    // 세기 900 · 높이 600 이면 합이 1500 이라 강타에서 빠진다
    expect(contactSoundIdOf({ hasSwung: true, hasHit: true, buntKind: 0, resultCode: 0, pattern: 패턴(90, 900, 600) })).toBe(6)
  })

  it('파울선 쪽(각 ≤ 75)은 약한 타구 기준이 다르다 (0x39304 의 두 갈래)', () => {
    // 각 70 = a −70 → −165 < a < −75 가 아니라 아래 갈래: 세기 ≤ 349 이고 |높이| ≤ 899
    expect(contactSoundIdOf({ hasSwung: true, hasHit: true, buntKind: 0, resultCode: 0, pattern: 패턴(70, 300, 800) })).toBe(59)
    // 각 90 이면 위 갈래라 |높이| 800 은 449 를 넘어 보통 타구다
    expect(contactSoundIdOf({ hasSwung: true, hasHit: true, buntKind: 0, resultCode: 0, pattern: 패턴(90, 300, 800) })).toBe(6)
  })
})

describe('심판 콜 (판정 스위치 0x51a94)', () => {
  it('볼은 16, 네 번째 볼은 볼넷 24', () => {
    expect(pitchCallSoundIdOf({ kind: '볼' }, 카운트(1, 0))).toBe(16)
    expect(pitchCallSoundIdOf({ kind: '볼' }, 카운트(4, 0, { kind: '볼넷' }))).toBe(24)
  })

  it('스트라이크는 18, 두 번째는 39, 세 번째(삼진)는 21', () => {
    expect(pitchCallSoundIdOf({ kind: '스트라이크', isSwinging: false }, 카운트(0, 1))).toBe(18)
    expect(pitchCallSoundIdOf({ kind: '스트라이크', isSwinging: true }, 카운트(0, 2))).toBe(39)
    expect(pitchCallSoundIdOf({ kind: '스트라이크', isSwinging: true }, 카운트(0, 3, { kind: '삼진' }))).toBe(21)
  })

  it('파울은 25', () => {
    expect(pitchCallSoundIdOf({ kind: '파울' }, 카운트(0, 1))).toBe(25)
  })

  it('인플레이 타구는 이 자리에서 안 낸다 — 플레이가 끝나야 콜이 난다', () => {
    expect(pitchCallSoundIdOf({ kind: '타구', outcome: { kind: '안타', bases: 1 } }, 카운트(0, 0))).toBeNull()
  })
})

describe('플레이가 끝난 뒤의 콜', () => {
  it('홈런은 함성 11, 아웃은 아웃 콜 20, 안타는 소리가 없다', () => {
    expect(inPlayCallSoundIdOf({ kind: '홈런' })).toBe(11)
    expect(inPlayCallSoundIdOf({ kind: '아웃', detail: '뜬공아웃' })).toBe(20)
    expect(inPlayCallSoundIdOf({ kind: '안타', bases: 2 })).toBeNull()
  })

  it('삼진·볼넷은 심판 콜 쪽이 이미 냈으므로 여기서 또 내지 않는다', () => {
    expect(inPlayCallSoundIdOf({ kind: '삼진' })).toBeNull()
    expect(inPlayCallSoundIdOf({ kind: '볼넷' })).toBeNull()
  })
})

describe('투구 순간 소리', () => {
  it('보통 투구는 12 다 (마구 28 은 웹이 가를 수 없어 안 쓴다)', () => {
    expect(PITCH_RELEASE_SOUND).toBe(12)
  })
})
