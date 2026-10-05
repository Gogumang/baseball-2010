import { describe, expect, it } from 'vitest'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { basePosition, horizontalDistance, runnerSpeedOf } from '@/entities/fielding/model/fieldGeometry'
import { createRunner } from '@/entities/fielding/model/fieldingState'
import { applyRunnerLead, runnerLeadOf } from '@/entities/fielding/model/runnerLead'

function 고정난수(ratio: number): RandomPort & { readonly count: () => number } {
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

const 일루도루 = { ...createRunner(1, 1, 335), targetBase: 2 }

describe('0x3d7b8 — 수비 판이 열릴 때 주자 리드 틱', () => {
  it('도루 주자(종류 5): 0xcffa8[루] + rand(0,9) — 2 이하는 3 으로 올린다', () => {
    expect(runnerLeadOf(일루도루, { playKind: 5, stealing: true, random: 고정난수(0) }).ticks).toBe(15 + 3)
    expect(runnerLeadOf(일루도루, { playKind: 5, stealing: true, random: 고정난수(0.3) }).ticks).toBe(15 + 3) // rand 2
    expect(runnerLeadOf(일루도루, { playKind: 5, stealing: true, random: 고정난수(0.95) }).ticks).toBe(15 + 8)
    const second = { ...createRunner(1, 2, 335), targetBase: 3 }
    const third = { ...createRunner(1, 3, 335), targetBase: 4 }
    expect(runnerLeadOf(second, { playKind: 5, stealing: true, random: 고정난수(0.5) }).ticks).toBe(14 + 4)
    expect(runnerLeadOf(third, { playKind: 5, stealing: true, random: 고정난수(0.5) })).toEqual({
      ticks: 14 + 4,
      leadTargetBase: 4,
      restoredTargetBase: 4,
    })
  })

  it('도루 주자는 rand 한 번, 도루 안 한 주자는 굴리지 않는다', () => {
    const random = 고정난수(0.5)
    runnerLeadOf(일루도루, { playKind: 5, stealing: true, random })
    runnerLeadOf(createRunner(2, 3, 335), { playKind: 5, stealing: false, random })
    expect(random.count()).toBe(1)
  })

  it('도루 안 한 주자: 0xcffb0 = 6·13·7 틱 다음 루로 갔다가 목표를 제 루로 되돌린다 · 번트 종류가 서면 +3', () => {
    expect(runnerLeadOf(createRunner(1, 1, 335), { playKind: 5, stealing: false })).toEqual({
      ticks: 6,
      leadTargetBase: 2,
      restoredTargetBase: 1,
    })
    expect(runnerLeadOf(createRunner(1, 2, 335), { playKind: 5, stealing: false }).ticks).toBe(13)
    expect(runnerLeadOf(createRunner(1, 3, 335), { playKind: 1, stealing: false, buntKind: 2 }).ticks).toBe(7 + 3)
    // 볼넷·사구(2·3)는 번트 덧틱이 없다
    expect(runnerLeadOf(createRunner(1, 3, 335), { playKind: 2, stealing: false, buntKind: 2 }).ticks).toBe(7)
  })

  it('종류 2·3 의 도루 주자는 틱 없이 끝나고 목표를 되돌리지 않는다', () => {
    const random = 고정난수(0.5)
    expect(runnerLeadOf(일루도루, { playKind: 2, stealing: true, random })).toEqual({
      ticks: 0,
      leadTargetBase: 2,
      restoredTargetBase: null,
    })
    expect(random.count()).toBe(0)
  })

  it('견제(종류 4): 0xcffac = 5 틱 + rand(0,100) 이 0 이면 5 더 · 목표는 닿은 루로', () => {
    expect(runnerLeadOf(일루도루, { playKind: 4, stealing: true, random: 고정난수(0) })).toEqual({
      ticks: 10,
      leadTargetBase: 2,
      restoredTargetBase: 1,
    })
    expect(runnerLeadOf(일루도루, { playKind: 4, stealing: false, random: 고정난수(0.5) }).ticks).toBe(5)
  })

  it('applyRunnerLead: 루 좌표에서 한 틱 이동(0xbf158)을 n 번 · 구간 출발점은 루 좌표 그대로', () => {
    const lead = runnerLeadOf(일루도루, { playKind: 5, stealing: true })
    const moved = applyRunnerLead(일루도루, lead)
    expect(moved.legStart).toEqual(basePosition(1))
    expect(moved.targetBase).toBe(2)
    expect(moved.startBase).toBe(1)
    // 한 틱마다 좌표를 정수로 자르므로 18 × 335 보다 조금 짧다
    expect(horizontalDistance(basePosition(1), moved.position)).toBe(6022)
    expect(moved.position).toEqual({ x: 21_338, y: 0, z: 20_298 })
  })

  it('applyRunnerLead: 목표에 닿으면 루 좌표에 정확히 멈춘다(도착 처리는 판 첫 틱에)', () => {
    const fast = { ...createRunner(1, 1, runnerSpeedOf(999, 0)), targetBase: 2 }
    const moved = applyRunnerLead(fast, { ticks: 23, leadTargetBase: 2, restoredTargetBase: 2 })
    expect(moved.position).toEqual(basePosition(2))
    expect(moved.settled).toBe(false)
  })

  it('applyRunnerLead: 되돌린 주자는 제 루를 향해 다시 달린다', () => {
    const plain = createRunner(1, 2, 335)
    const moved = applyRunnerLead(plain, runnerLeadOf(plain, { playKind: 5, stealing: false }))
    expect(moved.targetBase).toBe(2)
    expect(horizontalDistance(basePosition(2), moved.position)).toBe(4347)
  })
})
