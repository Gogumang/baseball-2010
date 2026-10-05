import { describe, expect, it } from 'vitest'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { EMPTY_BASES } from '@/entities/game/model/baseState'
import {
  CPU_STEAL_TABLE,
  cpuStealSpeedColumnOf,
  cpuStealTargetOf,
  rollCpuSteal,
} from '@/entities/fielding/model/cpuSteal'
import { runnerSpeedOf } from '@/entities/fielding/model/fieldGeometry'

/** 정해진 rand(0,1000) 값을 내고 굴림 수를 센다 */
function 고정난수(value: number): RandomPort & { readonly count: () => number } {
  let rolls = 0
  return {
    next: () => {
      rolls += 1
      return value / 1000
    },
    nextInRange: (minimum, maximum) => {
      rolls += 1
      return minimum + (value / 1000) * (maximum - minimum)
    },
    pick: (candidates) => candidates[0],
    count: () => rolls,
  }
}

const 일루 = { ...EMPTY_BASES, first: true }
const 이루 = { ...EMPTY_BASES, second: true }
const 일이루 = { ...EMPTY_BASES, first: true, second: true }

describe('CPU 도루 0x520de — 표 0xd047c', () => {
  it('표는 바이트 그대로다', () => {
    expect(CPU_STEAL_TABLE).toEqual([
      [5, 10, 40, 100],
      [2, 4, 12, 20],
      [1, 2, 5, 15],
    ])
  })

  it('후보 — 1루 주자(줄 0) · 2루 단독(줄 1) · 1·2루면 2루 주자(줄 2) · 1·3루면 1루 주자', () => {
    expect(cpuStealTargetOf(일루)).toEqual({ base: 1, row: 0 })
    expect(cpuStealTargetOf(이루)).toEqual({ base: 2, row: 1 })
    expect(cpuStealTargetOf(일이루)).toEqual({ base: 2, row: 2 })
    expect(cpuStealTargetOf({ ...EMPTY_BASES, first: true, third: true })).toEqual({ base: 1, row: 0 })
  })

  it('2·3루 · 만루 · 3루 단독 · 빈 루는 안 뛴다', () => {
    expect(cpuStealTargetOf({ ...EMPTY_BASES, second: true, third: true })).toBeNull()
    expect(cpuStealTargetOf({ first: true, second: true, third: true })).toBeNull()
    expect(cpuStealTargetOf({ ...EMPTY_BASES, third: true })).toBeNull()
    expect(cpuStealTargetOf(EMPTY_BASES)).toBeNull()
  })

  it('속도 칸은 주루와 무관하게 늘 1 이다 (원본 그대로 — 300~383 ÷ 250)', () => {
    for (const run of [0, 250, 500, 999]) {
      for (const grade of [0, 7]) expect(cpuStealSpeedColumnOf(runnerSpeedOf(run, grade))).toBe(1)
    }
  })

  it('표 ≥ rand 면 뛴다 — 1루 11/1000 · 2루 단독 5/1000 · 1·2루 3/1000', () => {
    const run = { offenseIsCpu: true, runAbilityOf: () => 500 }
    expect(rollCpuSteal({ ...run, bases: 일루 }, 고정난수(10))).toBe(1)
    expect(rollCpuSteal({ ...run, bases: 일루 }, 고정난수(11))).toBeNull()
    expect(rollCpuSteal({ ...run, bases: 이루 }, 고정난수(4))).toBe(2)
    expect(rollCpuSteal({ ...run, bases: 이루 }, 고정난수(5))).toBeNull()
    expect(rollCpuSteal({ ...run, bases: 일이루 }, 고정난수(2))).toBe(2)
    expect(rollCpuSteal({ ...run, bases: 일이루 }, 고정난수(3))).toBeNull()
  })

  it('후보가 없거나 사람 공격이거나 플레이가 끝났으면 굴리지 않는다', () => {
    const random = 고정난수(0)
    expect(rollCpuSteal({ bases: EMPTY_BASES, offenseIsCpu: true, runAbilityOf: () => 500 }, random)).toBeNull()
    expect(rollCpuSteal({ bases: 일루, offenseIsCpu: false, runAbilityOf: () => 500 }, random)).toBeNull()
    expect(
      rollCpuSteal({ bases: 일루, offenseIsCpu: true, playFinished: true, runAbilityOf: () => 500 }, random),
    ).toBeNull()
    expect(random.count()).toBe(0)
    rollCpuSteal({ bases: 일루, offenseIsCpu: true, runAbilityOf: () => 500 }, random)
    expect(random.count()).toBe(1)
  })
})
