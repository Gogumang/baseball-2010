import { describe, expect, it } from 'vitest'
import {
  QUICK_LINEUP_SIZE,
  recordLineupPlay,
  rosterLineupOf,
  rosterSlotAt,
  tryQuickCpuPinchHit,
} from '@/entities/game/model/quickLineup'
import type { RandomPort } from '@/shared/api/random/randomPort'

/** nextInRange 가 차례로 내놓을 값을 정해 둔 난수 — 몇 번 불렸는지도 센다 */
function 정해진난수(values: readonly number[]): RandomPort & { readonly calls: () => number } {
  let index = 0
  return {
    next: () => 0,
    nextInRange: () => {
      const value = values[index] ?? 0
      index += 1
      return value
    },
    pick: (candidates) => candidates[0],
    calls: () => index,
  }
}

/** 타순 0번이 두 타석 범타로 물러난 명단 — 0xac228 의 막는 조건을 다 지난다 */
const 두타석범타 = () => {
  let lineup = rosterLineupOf(12)
  lineup = recordLineupPlay(lineup, 0, { kind: '아웃', detail: '땅볼아웃' }, 0)
  lineup = recordLineupPlay(lineup, 9, { kind: '삼진' }, 0)
  return lineup
}

describe('간이 엔진 명단과 CPU 대타 (0xac228 → 0xaf06c → 0xaebe4 대타 가지)', () => {
  it('경기 시작 명단은 로스터 차례 — 앞 아홉이 타순, 벤치 셋 (team+0x28c)', () => {
    const lineup = rosterLineupOf(12)

    expect(lineup.benchBatters).toBe(3)
    expect(rosterSlotAt(lineup, 0)).toBe(0)
    // 커서는 이닝 안에서 9 를 넘어 셀 수 있다 — 타순은 아홉 칸을 돈다 (0xaf020 mod 9)
    expect(rosterSlotAt(lineup, QUICK_LINEUP_SIZE + 2)).toBe(2)
  })

  it('두 타석 범타·만루면 500‰ — 걸리면 벤치 무작위 한 명이 그 칸에 들어오고 나간 선수는 지워진다', () => {
    const random = 정해진난수([499, 1])
    const pinch = tryQuickCpuPinchHit(두타석범타(), 0, { alreadyUsedThisGame: false, runnerCount: 3 }, random)

    expect(random.calls()).toBe(2)
    expect(pinch?.outgoingRosterSlot).toBe(0)
    // rand(0, 3) = 1 → 벤치 둘째 = 명단 10번 = 로스터 10
    expect(pinch?.incomingRosterSlot).toBe(10)
    expect(pinch?.lineup.rosterSlots).toEqual([10, 1, 2, 3, 4, 5, 6, 7, 8, 9, 11])
    // 들어온 선수의 기록(비어 있다)이 그 칸으로 온다 — 기록은 선수를 따라간다 (aed02~aed16)
    expect(pinch?.lineup.records[0].plateAppearances).toBe(0)
    expect(pinch?.lineup.benchBatters).toBe(2)
  })

  it('굴림이 문턱 이상이면 안 바꾼다 — 굴림은 하나만 쓴다', () => {
    const random = 정해진난수([500])
    const pinch = tryQuickCpuPinchHit(두타석범타(), 0, { alreadyUsedThisGame: false, runnerCount: 3 }, random)

    expect(pinch).toBeNull()
    expect(random.calls()).toBe(1)
  })

  it('막는 조건에 걸리면 굴림을 하나도 안 쓴다 — 타석 1번 · 이 경기 이미 씀', () => {
    const 한타석 = recordLineupPlay(rosterLineupOf(12), 0, { kind: '삼진' }, 0)
    const 첫째 = 정해진난수([0, 0])
    expect(tryQuickCpuPinchHit(한타석, 0, { alreadyUsedThisGame: false, runnerCount: 3 }, 첫째)).toBeNull()
    expect(첫째.calls()).toBe(0)

    const 둘째 = 정해진난수([0, 0])
    expect(tryQuickCpuPinchHit(두타석범타(), 0, { alreadyUsedThisGame: true, runnerCount: 3 }, 둘째)).toBeNull()
    expect(둘째.calls()).toBe(0)
  })
})
