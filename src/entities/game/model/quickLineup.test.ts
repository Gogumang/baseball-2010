import { describe, expect, it } from 'vitest'
import {
  QUICK_LINEUP_SIZE,
  recordLineupPlay,
  rosterLineupOf,
  recordSlotAt,
  rosterSlotAt,
  tryQuickCpuPinchHit,
  withLineupRecordSlot,
} from '@/entities/game/model/quickLineup'
import type { RandomPort } from '@/shared/api/random/randomPort'

/** rand 가 차례로 내놓을 값을 정해 둔 난수 — 몇 번 불렸는지도 센다 */
function 정해진난수(values: readonly number[]): RandomPort & { readonly calls: () => number } {
  let index = 0
  return {
    rand: () => {
      const value = values[index] ?? 0
      index += 1
      return value
    },
    rand9d: () => 0,
    calls: () => index,
  }
}

/** 타순 0번이 두 타석 범타로 물러난 명단 — 0xac228 의 막는 조건을 다 지난다 */
const 두타석범타 = () => {
  let lineup = rosterLineupOf(12)
  lineup = recordLineupPlay(lineup, 0, { kind: '아웃', detail: '땅볼아웃' })
  lineup = recordLineupPlay(lineup, 9, { kind: '삼진' })
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
    // 레코드 칸 0xb6394 는 선수 레코드에 붙어 있다 — 0xaebe4 는 명단 칸만 맞바꾼다
    expect(pinch?.lineup.recordSlots).toEqual([10, 1, 2, 3, 4, 5, 6, 7, 8, 9, 11])
  })

  it('굴림이 문턱 이상이면 안 바꾼다 — 굴림은 하나만 쓴다', () => {
    const random = 정해진난수([500])
    const pinch = tryQuickCpuPinchHit(두타석범타(), 0, { alreadyUsedThisGame: false, runnerCount: 3 }, random)

    expect(pinch).toBeNull()
    expect(random.calls()).toBe(1)
  })

  it('막는 조건에 걸리면 굴림을 하나도 안 쓴다 — 타석 1번 · 이 경기 이미 씀', () => {
    const 한타석 = recordLineupPlay(rosterLineupOf(12), 0, { kind: '삼진' })
    const 첫째 = 정해진난수([0, 0])
    expect(tryQuickCpuPinchHit(한타석, 0, { alreadyUsedThisGame: false, runnerCount: 3 }, 첫째)).toBeNull()
    expect(첫째.calls()).toBe(0)

    const 둘째 = 정해진난수([0, 0])
    expect(tryQuickCpuPinchHit(두타석범타(), 0, { alreadyUsedThisGame: true, runnerCount: 3 }, 둘째)).toBeNull()
    expect(둘째.calls()).toBe(0)
  })

  it('타석 타자가 마선수(0xb633c)면 굴림 없이 안 바꾼다 — ac232 가 벤치 수보다 먼저 본다', () => {
    const random = 정해진난수([0, 1])
    const pinch = tryQuickCpuPinchHit(
      두타석범타(),
      0,
      { alreadyUsedThisGame: false, runnerCount: 3, batterIsAce: true },
      random,
    )
    expect(pinch).toBeNull()
    expect(random.calls()).toBe(0)
  })
})

describe('오늘 타석 결과 링 — 간이 엔진 타석의 아웃은 늘 5 (state[0x1f] 가 서지 않는다, a8a9e)', () => {
  it('사람 판 기준은 뜬공 아웃 6 · 땅볼 아웃 5, 간이 엔진은 둘 다 5', () => {
    const 뜬공 = { kind: '아웃', detail: '뜬공아웃' } as const
    const 땅볼 = { kind: '아웃', detail: '땅볼아웃' } as const
    const 사람 = recordLineupPlay(recordLineupPlay(rosterLineupOf(12), 0, 뜬공), 0, 땅볼)
    const 간이 = recordLineupPlay(recordLineupPlay(rosterLineupOf(12), 0, 뜬공, { quickEngine: true }), 0, 땅볼, { quickEngine: true })

    expect(사람.records[0]?.results).toEqual([6, 5])
    expect(간이.records[0]?.results).toEqual([5, 5])
  })

  it('간이 엔진도 안타 · 삼진 · 볼넷 코드는 같다', () => {
    let lineup = rosterLineupOf(12)
    for (const outcome of [{ kind: '안타', bases: 2 }, { kind: '삼진' }, { kind: '볼넷' }, { kind: '홈런' }] as const) {
      lineup = recordLineupPlay(lineup, 3, outcome, { quickEngine: true })
    }
    expect(lineup.records[3]?.results).toEqual([2, 7, 8, 4])
  })
})

describe('레코드 칸 0xb6394 — 경기 준비 0xb8768 → 0xb603c 의 배열 첨자', () => {
  it('명단 칸 i 의 선수는 i, 마선수는 타자 쪽 순번 그대로', () => {
    const lineup = { ...rosterLineupOf(12), recordSlots: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] }
    expect(recordSlotAt(lineup, 9 + 3)).toBe(3)
    const batter = { hit: 1, power: 1, run: 1, skillIds: [], recordSlot: 9 }
    expect(withLineupRecordSlot(batter, lineup, 4).recordSlot).toBe(4)
    const ace = { ...batter, recordSlot: 2, ace: { order: 2, level: 0 } }
    expect(withLineupRecordSlot(ace, lineup, 4).recordSlot).toBe(2)
  })

  it('명단이 칸을 안 들면(옛 저장) 타자 쪽 값 그대로', () => {
    const { recordSlots: _unused, ...old } = rosterLineupOf(12)
    const batter = { hit: 1, power: 1, run: 1, skillIds: [], recordSlot: 7 }
    expect(withLineupRecordSlot(batter, old, 4).recordSlot).toBe(7)
  })
})
