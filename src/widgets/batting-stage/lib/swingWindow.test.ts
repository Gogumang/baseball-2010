import { describe, expect, it } from 'vitest'
import {
  acceptsBattingKey,
  buntJudgeTickOf,
  isBallInSwingReach,
  isSwingJudgeable,
  keyTickOf,
  nextFlightEvent,
  pitchEndTickOf,
  swingJudgeTickOf,
  swingReleaseTickOf,
} from '@/widgets/batting-stage/lib/swingWindow'

describe('키 틱 F — 보이던 공 틱 + 1 (키는 다음 그림에서, 0x3f378 의 +1 뒤에 읽힌다)', () => {
  it('릴리스 그림(공 틱 0)을 보고 누르면 F = 1', () => {
    expect(keyTickOf(0)).toBe(1)
    expect(keyTickOf(15)).toBe(16)
  })
})

describe('스윙 창 — 0x4e060 · 0x51db6 (N = 18)', () => {
  const N = 18

  it('와인드업(보이던 틱 < 0)과 F ≥ N + 1 은 키를 안 받는다', () => {
    expect(acceptsBattingKey(-1, N)).toBe(false)
    expect(acceptsBattingKey(0, N)).toBe(true)
    expect(acceptsBattingKey(N - 1, N)).toBe(true)
    expect(acceptsBattingKey(N, N)).toBe(false)
  })

  it('키 틱 t 의 스윙은 t + 1 에 나가고 t + 2 에 판정한다', () => {
    expect(swingReleaseTickOf(10)).toBe(11)
    expect(swingJudgeTickOf(10)).toBe(12)
  })

  it('t ≤ N − 1 이면 판정이 서고 t = N 이면 스윙만 나간다 — 공 끝은 N + 1', () => {
    expect(isSwingJudgeable(N - 1, N)).toBe(true)
    expect(isSwingJudgeable(N, N)).toBe(false)
    expect(pitchEndTickOf(N)).toBe(N + 1)
  })

  it('깊이 |29705 − 경로[min(틱, N − 1)].z| ≤ 3000 이면 판정, 아니면 판정 없는 헛스윙', () => {
    const 경로 = [{ z: 24500 }, { z: 26000 }, { z: 26705 }, { z: 29705 }]
    expect(isBallInSwingReach(경로, 4, 1, 29705)).toBe(false)
    expect(isBallInSwingReach(경로, 4, 2, 29705)).toBe(true)
    // 틱이 N − 1 을 넘으면 마지막 점
    expect(isBallInSwingReach(경로, 4, 9, 29705)).toBe(true)
    expect(isBallInSwingReach(null, 4, 0, 29705)).toBe(true)
  })

  it('번트는 자세(F + 1)가 N − 1 까지 서야 N − 1 에 판정한다', () => {
    expect(buntJudgeTickOf(N - 2, N)).toBe(N - 1)
    expect(buntJudgeTickOf(N - 1, N)).toBeNull()
    expect(buntJudgeTickOf(1, N)).toBe(N - 1)
  })
})

describe('공이 나는 동안의 차례 — nextFlightEvent (0x4e060 한 갱신)', () => {
  const N = 18
  const 스윙 = (frame: number, extra: Partial<{ isReleased: boolean; isUnjudgedWhiff: boolean; isSpecial: boolean }> = {}) => ({
    frame,
    isSpecial: false,
    isReleased: false,
    isUnjudgedWhiff: false,
    ...extra,
  })
  const 상태 = (over: Partial<Parameters<typeof nextFlightEvent>[0]> = {}) => ({
    frameCount: N,
    swing: null,
    bunt: null,
    isJudged: false,
    isInReach: () => true,
    isBuntJudgeTick: (at: number) => at >= N - 1,
    ...over,
  })

  it('키 틱 10 의 스윙: 10 까지는 아무 일 없고 11 에 나가고 12 에 판정한다', () => {
    expect(nextFlightEvent(상태({ swing: 스윙(10) }), 10)).toBeNull()
    expect(nextFlightEvent(상태({ swing: 스윙(10) }), 11)).toEqual({ kind: '스윙나감' })
    expect(nextFlightEvent(상태({ swing: 스윙(10, { isReleased: true }) }), 11)).toBeNull()
    expect(nextFlightEvent(상태({ swing: 스윙(10, { isReleased: true, isSpecial: true }) }), 12)).toEqual({
      kind: '판정',
      frame: 10,
      buntKind: 0,
      isSpecial: true,
    })
  })

  it('판정 틱에 공이 멀면 판정 없는 헛스윙 — 그 뒤엔 공 끝(N + 1)까지 기다린다', () => {
    const 멀다 = { isInReach: () => false }
    expect(nextFlightEvent(상태({ ...멀다, swing: 스윙(5, { isReleased: true }) }), 7)).toEqual({ kind: '판정없는헛스윙' })
    expect(nextFlightEvent(상태({ ...멀다, swing: 스윙(5, { isReleased: true, isUnjudgedWhiff: true }) }), 7)).toBeNull()
    expect(nextFlightEvent(상태({ ...멀다, swing: 스윙(5, { isReleased: true, isUnjudgedWhiff: true }) }), N + 1)).toEqual({
      kind: '공끝',
    })
  })

  it('키 틱 N − 1 은 N + 1 에 판정이 공 끝보다 먼저, 키 틱 N 은 스윙만 나가고 공 끝', () => {
    expect(nextFlightEvent(상태({ swing: 스윙(N - 1, { isReleased: true }) }), N + 1)).toMatchObject({ kind: '판정' })
    expect(nextFlightEvent(상태({ swing: 스윙(N) }), N + 1)).toEqual({ kind: '스윙나감' })
    expect(nextFlightEvent(상태({ swing: 스윙(N, { isReleased: true }) }), N + 1)).toEqual({ kind: '공끝' })
  })

  it('안 친 공은 N + 1 에 끝나고, 판정이 난 공(헛스윙)도 공 끝까지 기다린다', () => {
    expect(nextFlightEvent(상태(), N)).toBeNull()
    expect(nextFlightEvent(상태(), N + 1)).toEqual({ kind: '공끝' })
    expect(nextFlightEvent(상태({ swing: 스윙(3, { isReleased: true }), isJudged: true }), 10)).toBeNull()
  })

  it('번트 자세는 번트 판정 틱에 깊이 없이 판정한다', () => {
    expect(nextFlightEvent(상태({ bunt: { kind: 2, frame: 4 } }), N - 2)).toBeNull()
    expect(nextFlightEvent(상태({ bunt: { kind: 2, frame: 4 }, isInReach: () => false }), N - 1)).toEqual({
      kind: '판정',
      frame: 4,
      buntKind: 2,
      isSpecial: false,
    })
  })
})
