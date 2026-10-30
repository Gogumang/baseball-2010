import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
import { isSwingJudgeable, judgeTickOf, nextFlightEvent } from '@/widgets/batting-stage/lib/swingWindow'

/** B-130 — 공이 홈에 닿아 보이는 그림에서 누른 스윙(F = N)도 공 끝 갱신(N + 1)에서 판정한다 */
const N = 18
const 스윙 = (frame: number, isReleased: boolean) => ({ frame, isSpecial: false, isReleased, isUnjudgedWhiff: false })
const 상태 = (swing: ReturnType<typeof 스윙>, isInReach: (tick: number) => boolean = () => true) => ({
  frameCount: N,
  swing,
  bunt: null,
  isJudged: false,
  isInReach,
  isBuntJudgeTick: () => false,
})

describe('B-130 원본 길 — F = N 은 판정 없이 공 끝', () => {
  beforeEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

  it('판정 틱은 F + 2 그대로라 F = N 은 공 끝(N + 1) 뒤다', () => {
    expect(judgeTickOf(N, N)).toBe(N + 2)
    expect(isSwingJudgeable(N, N)).toBe(false)
    expect(nextFlightEvent(상태(스윙(N, true)), N + 1)).toEqual({ kind: '공끝' })
  })
})

describe('B-130 고친 길 — F = N 도 N + 1 에서 판정', () => {
  beforeEach(() => setBugfixConfigForTests(bugfixConfigWith(['B-130'])))
  afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

  it('F ≤ N − 1 의 판정 틱은 원본과 같은 F + 2 이고, F = N 만 N + 1 로 당긴다', () => {
    expect(judgeTickOf(10, N)).toBe(12)
    expect(judgeTickOf(N - 1, N)).toBe(N + 1)
    expect(judgeTickOf(N, N)).toBe(N + 1)
    expect(isSwingJudgeable(N, N)).toBe(true)
  })

  it('N + 1 한 갱신에서 스윙나감 → 판정(F 그대로) — 판정이 공 끝보다 먼저', () => {
    expect(nextFlightEvent(상태(스윙(N, false)), N)).toBeNull()
    expect(nextFlightEvent(상태(스윙(N, false)), N + 1)).toEqual({ kind: '스윙나감' })
    expect(nextFlightEvent(상태(스윙(N, true)), N + 1)).toEqual({ kind: '판정', frame: N, buntKind: 0, isSpecial: false })
  })

  it('깊이 관문은 당긴 판정 틱(N + 1 → 경로 [N − 1])을 본다 — 멀면 판정 없는 헛스윙', () => {
    const 본틱: number[] = []
    const 멀다 = (tick: number) => {
      본틱.push(tick)
      return false
    }
    expect(nextFlightEvent(상태(스윙(N, true), 멀다), N + 1)).toEqual({ kind: '판정없는헛스윙' })
    expect(본틱).toEqual([N + 1])
  })
})
