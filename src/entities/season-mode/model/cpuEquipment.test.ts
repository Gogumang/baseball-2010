import { describe, expect, it } from 'vitest'
import { applyCpuEquipment, cpuEquipmentCallsOf, rollCpuEquipment } from '@/entities/season-mode/model/cpuEquipment'
import { tableRosterOf } from '@/entities/season-mode/model/seasonEntry'
import type { RandomPort } from '@/shared/api/random/randomPort'

/** 늘 같은 값을 내는 난수 — 부른 횟수를 센다 */
function 고정난수(value: number): RandomPort & { calls: [number, number][] } {
  const calls: [number, number][] = []
  return {
    calls,
    rand: (lo: number, hi: number) => {
      calls.push([lo, hi])
      return lo + value
    },
  } as RandomPort & { calls: [number, number][] }
}

describe('새 해 CPU 장비 굴림 0x665e8', () => {
  it('2년차(새 연차 idx 1, r4 = 2)는 타자 3번 부위 1 · 투수 칸 (3·1)%4 = 3 부위 0 두 줄 — 기준은 표 0xd0abb[0] · 0xd0aa6[0]', () => {
    expect(cpuEquipmentCallsOf(1)).toEqual([
      { isBatter: true, part: 1, recordIndex: 3, base: 0 },
      { isBatter: false, part: 0, recordIndex: 3, base: 0 },
    ])
  })

  it('10년차(r4 = 10)는 열 줄 모두 — 시즌은 r4 > 10 이면 아무것도 안 한다', () => {
    const calls = cpuEquipmentCallsOf(9)
    expect(calls).toHaveLength(10)
    expect(calls.map((call) => call.base)).toEqual([3, 2, 1, 3, 2, 3, 2, 2, 3, 1])
    // 투수 칸: (0 + 3·9) % 4 = 3 · (1 + 3·9) % 4 = 0
    expect(calls[5]).toMatchObject({ isBatter: false, recordIndex: 3 })
    expect(calls[6]).toMatchObject({ isBatter: false, recordIndex: 0 })
    expect(cpuEquipmentCallsOf(10)).toEqual([])
  })

  it('줄마다 내 팀을 뺀 아홉 팀에 rand(0, 2) 한 번씩 — 니블은 기준 + rand + 1', () => {
    const random = 고정난수(1)
    const writes = rollCpuEquipment(random, 1, 4)
    expect(random.calls).toHaveLength(18)
    expect(random.calls.every(([lo, hi]) => lo === 0 && hi === 2)).toBe(true)
    expect(writes.some((write) => write.teamId === 4)).toBe(false)
    expect(writes.every((write) => write.value === 2)).toBe(true)
  })

  it('명단에 얹으면 그 부위만 바뀌고 같은 바이트의 다른 니블은 남는다', () => {
    const rosters = applyCpuEquipment(
      [{ teamId: 0, isBatter: true, recordIndex: 3, part: 1, value: 2 }],
      tableRosterOf,
      (_team, _roster, recordIndex) => recordIndex,
    )
    expect(rosters[0]?.batters[3]?.equipment).toEqual([0, 2, 0, 0])
    expect(rosters[0]?.batters[2]?.equipment).toBeUndefined()
    expect(rosters[1]).toBeUndefined()
  })
})
