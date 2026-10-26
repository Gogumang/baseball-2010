import { afterEach, describe, expect, it } from 'vitest'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
import { derbyNoContactWaitFramesOf, derbyPitchCallOf } from '@/pages/home-run-derby/lib/derbyPitchCall'

afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

/** 볼 다섯 개를 이어 던진다 — 공 사이에 0xd 가 없다 */
const 볼다섯 = () => {
  let balls = 0
  return Array.from({ length: 5 }, () => {
    const call = derbyPitchCallOf({ kind: '볼' }, balls)
    balls = call.balls
    return call
  })
}

describe('B-54 홈런더비 볼 카운트가 안 지워져 넷째 볼부터 "볼넷"', () => {
  it('원본: 넷째 볼부터 판정 3 · 콜 24 · 대기 31', () => {
    const calls = 볼다섯()
    expect(calls.map((call) => call.judgment)).toEqual([2, 2, 2, 3, 3])
    expect(calls.map((call) => call.soundId)).toEqual([16, 16, 16, 24, 24])
    expect(derbyNoContactWaitFramesOf(calls[3].judgment)).toBe(31)
  })

  it('고침: 볼은 늘 판정 2 · 콜 16 · 볼 수 0 · 대기 15', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-54']))
    const calls = 볼다섯()
    expect(calls.map((call) => call.judgment)).toEqual([2, 2, 2, 2, 2])
    expect(calls.map((call) => call.soundId)).toEqual([16, 16, 16, 16, 16])
    expect(calls.map((call) => call.balls)).toEqual([0, 0, 0, 0, 0])
    expect(derbyNoContactWaitFramesOf(calls[3].judgment)).toBe(15)
    // 사구는 그대로 판정 4 — 타순 넘김은 B-55 가 막는다
    expect(derbyPitchCallOf({ kind: '사구' }, 0).judgment).toBe(4)
  })
})
