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
  it('판이 열릴 때 도루 주자는 이미 15+3 틱 달려 나가 있다(0x46418 → 0x3d7b8) — 사람이 2루로 던져도 세이프 9 · 콜 17', () => {
    const result = runStealPlay({ bases: 일루, stealingFrom: [1], outs: 0, runAbility: 500, manualThrowBase: 2 })
    // 속도 335 로 1루(25946, 24175)에서 2루 쪽으로 18 틱 — 그림 0틱은 움직이기 전이다
    expect(result.ticks[0].runners[0]).toMatchObject({ x: 21338, z: 20298, base: 2 })
    expect(result.throwBase).toBe(2)
    expect(result.resultCode).toBe(RUNNER_PLAY_RESULT.SAFE)
    expect(stealCallSoundIdOf(result)).toBe(17)
    expect(result.advance).toEqual({ bases: { ...EMPTY_BASES, second: true }, runsScored: 0, outsAdded: 0 })
    expect(result.runnerFates).toEqual([{ fromBase: 1, scored: false, retired: false }])
    expect(result.caughtFrom).toEqual([])
    expect(result.stolenFrom).toEqual([1])
  })

  it('도루 안 한 주자도 0xcffb0 틱(3루 7)만큼 다음 루로 갔다가 목표를 제 루로 되돌린 채 판이 열린다', () => {
    const result = runStealPlay({ bases: 일삼루, stealingFrom: [1], outs: 0, runAbility: 500 })
    const third = result.ticks[0].runners[1]
    expect(third.base).toBe(3)
    expect(third.isAdvancing).toBe(false)
    expect({ x: third.x, z: third.z }).not.toEqual({ x: 14_055, z: 24_175 })
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

  it('난수는 판이 열릴 때 도루 주자 리드 rand(0,9) 한 번, 송구 때 악송구 굴림(0xa1828) 한 번 — 악송구면 넷 더(수평·수직 속도 · 방향 크기 · 부호)', () => {
    const quiet = 세는난수(0.5)
    const plain = runStealPlay({ bases: 일루, stealingFrom: [1], outs: 0, runAbility: 0, random: quiet, manualThrowBase: 2 })
    expect(quiet.count()).toBe(2)
    expect(plain.throwBase).toBe(2)
    expect(plain.errantThrow).toBe(false)

    const wild = 세는난수(0)
    const errant = runStealPlay({ bases: 일루, stealingFrom: [1], outs: 0, runAbility: 0, random: wild, manualThrowBase: 2 })
    expect(wild.count()).toBe(6)
    expect(errant.errantThrow).toBe(true)
    expect(errant.resultCode).toBeNull()
    expect(stealCallSoundIdOf(errant)).toBeNull()
    expect(errant.advance.bases).toEqual({ ...EMPTY_BASES, second: true })
  })

  it('사람 수비·수동 송구에서 키가 없으면 포수는 공을 들고 있다 — 0xb1c90 자동 가지에는 송구 호출이 없다', () => {
    const counted = 세는난수(0.95)
    const result = runStealPlay({ bases: 일루, stealingFrom: [1], outs: 0, runAbility: 500, random: counted })
    expect(result.throwBase).toBe(-1)
    expect(result.resultCode).toBeNull()
    expect(result.stolenFrom).toEqual([1])
    // 굴림은 리드 rand(0,9) 한 번뿐 — 악송구 굴림이 없다
    expect(counted.count()).toBe(1)
  })

  it('재생 칸에 든 결과가 도루 판인지 가를 수 있다 — 견제 결과는 아니다', () => {
    const result = runStealPlay({ bases: 일루, stealingFrom: [1], outs: 0 })
    expect(isStealPlayResult(result)).toBe(true)
    expect(isStealPlayResult(null)).toBe(false)
    const pickoff = runPickoffPlay({ targetBase: 1, bases: 일루, outs: 0 })
    expect(isStealPlayResult(pickoff)).toBe(false)
  })
})
