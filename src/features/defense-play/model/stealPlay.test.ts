import { describe, expect, it } from 'vitest'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { EMPTY_BASES } from '@/entities/game/model/baseState'
import { RUNNER_PLAY_RESULT } from '@/features/defense-play/model/runnerPlayEngine'
import { isStealPlayResult, runStealPlay, stealCallSoundIdOf } from '@/features/defense-play/model/stealPlay'
import { runPickoffPlay } from '@/features/defense-play/model/pickoffPlay'

function 세는난수(ratio: number): RandomPort & { readonly count: () => number } {
  let rolls = 0
  return {
    next: () => {
      rolls += 1
      return ratio
    },
    nextInRange: (minimum, maximum) => {
      rolls += 1
      return minimum + ratio * (maximum - minimum)
    },
    pick: (candidates) => candidates[0],
    count: () => rolls,
  }
}

const 일루 = { ...EMPTY_BASES, first: true }
const 일삼루 = { ...EMPTY_BASES, first: true, third: true }

describe('도루 한 판 — 종류 5 (0xb2950 · 0xb1c90 · 0xb36d0 · 0xb4292)', () => {
  it('포수가 처음부터 공을 쥐고, 자동 규칙(0xb1c90)이 2루로 던져 태그로 잡는다 — 도루사 13 · 콜 62', () => {
    const result = runStealPlay({ bases: 일루, stealingFrom: [1], outs: 0, runAbility: 500 })
    expect(result.throwBase).toBe(2)
    expect(result.resultCode).toBe(RUNNER_PLAY_RESULT.OUT)
    expect(result.tagOut).toBe(true)
    expect(stealCallSoundIdOf(result)).toBe(62)
    expect(result.advance).toEqual({ bases: EMPTY_BASES, runsScored: 0, outsAdded: 1 })
    expect(result.runnerFates).toEqual([{ fromBase: 1, scored: false, retired: true }])
    expect(result.caughtFrom).toEqual([1])
    expect(result.stolenFrom).toEqual([])
  })

  it('타자주자를 만들지 않는다 — 주자는 찬 루 오름차순이고 번호는 1 부터', () => {
    const result = runStealPlay({ bases: 일삼루, stealingFrom: [1], outs: 0 })
    expect(result.ticks[0].runners.map((runner) => runner.index)).toEqual([1, 2])
  })

  it('사람이 3루를 고르면 3루 주자는 제 루 위라 세이프(결과 9 · 콜 17) — 1루 주자는 그사이 2루에 닿는다', () => {
    const result = runStealPlay({ bases: 일삼루, stealingFrom: [1], outs: 0, manualThrowBase: 3 })
    expect(result.throwBase).toBe(3)
    expect(result.resultCode).toBe(RUNNER_PLAY_RESULT.SAFE)
    expect(stealCallSoundIdOf(result)).toBe(17)
    expect(result.advance).toEqual({ bases: { first: false, second: true, third: true }, runsScored: 0, outsAdded: 0 })
    expect(result.stolenFrom).toEqual([1])
    expect(result.caughtFrom).toEqual([])
  })

  it('홈 도루 — 공 쥔 포수가 홈 커버라 던지지 않고(0xb2c90 직접 밟기) 홈에서 태그한다', () => {
    const result = runStealPlay({ bases: { ...EMPTY_BASES, third: true }, stealingFrom: [3], outs: 1 })
    expect(result.throwBase).toBe(-1)
    expect(result.resultCode).toBe(RUNNER_PLAY_RESULT.OUT)
    expect(result.advance).toEqual({ bases: EMPTY_BASES, runsScored: 0, outsAdded: 1 })
  })

  it('난수는 송구 때 악송구 굴림(0xa1828) 한 번 — 악송구면 두 번 더, 받는 야수가 없어 도루가 산다(근사)', () => {
    const quiet = 세는난수(0.9)
    const plain = runStealPlay({ bases: 일루, stealingFrom: [1], outs: 0, random: quiet })
    expect(quiet.count()).toBe(1)
    expect(plain.errantThrow).toBe(false)

    const wild = 세는난수(0)
    const errant = runStealPlay({ bases: 일루, stealingFrom: [1], outs: 0, random: wild })
    expect(wild.count()).toBe(3)
    expect(errant.errantThrow).toBe(true)
    expect(errant.resultCode).toBeNull()
    expect(stealCallSoundIdOf(errant)).toBeNull()
    expect(errant.advance.bases).toEqual({ ...EMPTY_BASES, second: true })
  })

  it('재생 칸에 든 결과가 도루 판인지 가를 수 있다 — 견제 결과는 아니다', () => {
    const result = runStealPlay({ bases: 일루, stealingFrom: [1], outs: 0 })
    expect(isStealPlayResult(result)).toBe(true)
    expect(isStealPlayResult(null)).toBe(false)
    const pickoff = runPickoffPlay({ targetBase: 1, bases: 일루, outs: 0 })
    expect(isStealPlayResult(pickoff)).toBe(false)
  })
})
