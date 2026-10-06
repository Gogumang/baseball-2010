import { describe, expect, it } from 'vitest'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { basePosition } from '@/entities/fielding/model/fieldGeometry'
import { EMPTY_BASES } from '@/entities/game/model/baseState'
import {
  isPickoffPlayResult,
  pickoffCallSoundIdOf,
  PICKOFF_RESULT,
  runPickoffPlay,
} from '@/features/defense-play/model/pickoffPlay'

/** 굴림 수를 세는 난수 — 값은 늘 같은 비율 */
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
const 만루 = { first: true, second: true, third: true }

describe('견제 한 판 — 종류 4 (0xb28be · 0xb47da · 0xb4292)', () => {
  it('리드 5틱(0xcffac)이면 공이 오기 전에 돌아와 있다 — 결과 9(세이프), 경기 상태는 그대로', () => {
    for (const targetBase of [1, 2, 3] as const) {
      const result = runPickoffPlay({ targetBase, bases: 만루, outs: 1, offenseIsCpu: true, random: 세는난수(0.9) })
      expect(result.resultCode, `${targetBase}루`).toBe(PICKOFF_RESULT.SAFE)
      expect(result.advance).toEqual({ bases: 만루, runsScored: 0, outsAdded: 0 })
      expect(result.tagOut).toBe(false)
    }
  })

  it('판이 열릴 때 주자는 루를 떠나 있다(0x46418 → 0x3d7b8) — 덧틱 5(rand(0,100) == 0)면 1·3루 주자는 돌아오기 전에 태그된다', () => {
    // 리드 굴림 셋(주자마다 0) → 악송구 굴림(0.9, 아님)
    const 차례 = [0, 0, 0, 0.9]
    let i = 0
    const 정한난수: RandomPort = {
      next: () => 차례[Math.min(i++, 차례.length - 1)],
      nextInRange: (minimum, maximum) => minimum + 차례[Math.min(i++, 차례.length - 1)] * (maximum - minimum),
      pick: (candidates) => candidates[0],
    }
    const result = runPickoffPlay({ targetBase: 1, bases: 만루, outs: 1, offenseIsCpu: true, random: 정한난수 })
    expect(result.ticks[0].runners[0]).not.toMatchObject({ x: basePosition(1).x, z: basePosition(1).z })
    expect(result.resultCode).toBe(PICKOFF_RESULT.OUT)
    expect(result.tagOut).toBe(true)
    expect(pickoffCallSoundIdOf(result)).toBe(62)
    expect(result.advance).toEqual({ bases: { first: false, second: true, third: true }, runsScored: 0, outsAdded: 1 })
  })

  it('공은 대상 루 커버(루 번호 + 1)의 손에서 끝난다 — 2루도 늘 2루수다', () => {
    const result = runPickoffPlay({ targetBase: 2, bases: 만루, outs: 0 })
    const last = result.ticks[result.ticks.length - 1]
    expect(last.ball).toMatchObject({ x: basePosition(2).x, z: basePosition(2).z })
    const second = last.fielders.find((fielder) => fielder.slot === 3)
    expect(second).toMatchObject({ x: basePosition(2).x, z: basePosition(2).z })
  })

  it('타자주자를 만들지 않는다 — 그림의 주자는 루에 있던 주자뿐이다', () => {
    const result = runPickoffPlay({ targetBase: 1, bases: 일루, outs: 0 })
    expect(result.ticks[0].runners.map((runner) => runner.index)).toEqual([1])
  })

  it('난수는 주자마다 리드 rand(0,100) 한 번 → 악송구 굴림(0xa1828) 한 번 — 악송구가 아니면 더 안 굴린다', () => {
    const random = 세는난수(0.9)
    const result = runPickoffPlay({ targetBase: 1, bases: 일루, outs: 0, random })
    expect(random.count()).toBe(2)
    expect(result.errantThrow).toBe(false)
  })

  it('악송구면 수평·수직 속도 · 방향 크기 · 부호 넷을 더 굴리고(0xa1868~0xa1924), 받는 야수가 없어 결과 코드가 안 선다 (근사)', () => {
    const random = 세는난수(0)
    const result = runPickoffPlay({ targetBase: 1, bases: 일루, outs: 0, random })
    expect(random.count()).toBe(6)
    expect(result.errantThrow).toBe(true)
    expect(result.resultCode).toBeNull()
    expect(result.advance).toEqual({ bases: 일루, runsScored: 0, outsAdded: 0 })
  })

  it('세이프 콜은 늘 17 이다 (0x51c14 의 종류 4·5 갈래) — 결과 코드가 없으면 소리도 없다', () => {
    expect(pickoffCallSoundIdOf({ resultCode: PICKOFF_RESULT.SAFE, tagOut: false })).toBe(17)
    expect(pickoffCallSoundIdOf({ resultCode: PICKOFF_RESULT.OUT, tagOut: true })).toBe(62)
    expect(pickoffCallSoundIdOf({ resultCode: null, tagOut: false })).toBeNull()
  })

  it('재생 칸에 든 결과가 견제 판인지 가를 수 있다', () => {
    const result = runPickoffPlay({ targetBase: 3, bases: 만루, outs: 0 })
    expect(isPickoffPlayResult(result)).toBe(true)
    expect(isPickoffPlayResult(null)).toBe(false)
  })
})
