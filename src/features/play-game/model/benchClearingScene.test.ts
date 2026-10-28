import { describe, expect, it } from 'vitest'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { createFractionRandom } from '@/shared/api/random/fractionRandom'
import {
  holdsUntilResultWaitEnd,
  opensArrivalPlayAtOnce,
  outsShownDuringResultWait,
  rollBenchClearingEntry,
  rollBenchClearingTargets,
} from '@/features/play-game/model/benchClearingScene'

const 세는난수 = () => {
  const calls: number[] = []
  const random: RandomPort = createFractionRandom(() => {
    calls.push(1)
    return 0.5
  })
  return { calls, random }
}

describe('벤치 클리어링 연출의 전역 rand', () => {
  it('진입 0x3a5f0 — 공격 9명 × 다섯 = 45 번', () => {
    const { calls, random } = 세는난수()
    rollBenchClearingEntry(random)
    expect(calls.length).toBe(45)
  })

  it('틱 10 (0x401d4) — 수비 8명 목표 8 번', () => {
    const { calls, random } = 세는난수()
    rollBenchClearingTargets(random)
    expect(calls.length).toBe(8)
  })
})

describe('0x12 대기 끝까지 붙드는 타석 결과 — 0x4e6d4 문턱 0x1f (st[0xb] ∈ {3, 4, 5}) · 0x3dfac 의 0x17 직행 갈래 (r298)', () => {
  it('볼넷 · 사구는 판(종류 2)과 함께 늘, 삼진은 공 도착 판이 안 열렸을 때만 붙든다', () => {
    expect(holdsUntilResultWaitEnd({ kind: '볼넷' }, { kind: 2 })).toBe(true)
    expect(holdsUntilResultWaitEnd({ kind: '사구' }, null)).toBe(true)
    expect(holdsUntilResultWaitEnd({ kind: '삼진' }, null)).toBe(true)
    expect(holdsUntilResultWaitEnd({ kind: '삼진' }, undefined)).toBe(true)
    // 3e09a(폭투·포일 · 낫아웃) · 3e114(도루) — 곧장 0x17
    expect(holdsUntilResultWaitEnd({ kind: '삼진' }, { kind: 9 })).toBe(false)
    expect(holdsUntilResultWaitEnd({ kind: '삼진' }, { kind: 5 })).toBe(false)
    expect(holdsUntilResultWaitEnd({ kind: '홈런' }, null)).toBe(false)
  })

  it('도루 출발 중 볼넷 · 사구의 밀어내기 판은 붙들지 않는다 — 3e0e4 → 3e114 곧장 0x17 (A-24, r302)', () => {
    const 도루밀어내기 = { kind: 2, result: { opensAtArrival: true } }
    expect(holdsUntilResultWaitEnd({ kind: '볼넷' }, 도루밀어내기)).toBe(false)
    expect(holdsUntilResultWaitEnd({ kind: '사구' }, 도루밀어내기)).toBe(false)
    expect(holdsUntilResultWaitEnd({ kind: '사구' }, { kind: 2, result: {} })).toBe(true)
    expect(opensArrivalPlayAtOnce(도루밀어내기)).toBe(true)
    expect(opensArrivalPlayAtOnce({ kind: 5 })).toBe(true)
    expect(opensArrivalPlayAtOnce({ kind: 9 })).toBe(true)
    expect(opensArrivalPlayAtOnce({ kind: 2 })).toBe(false)
    expect(opensArrivalPlayAtOnce(null)).toBe(false)
  })

  it('대기 중 HUD 아웃 — 붙든 삼진만 진입 3e1a6 의 st[6]++ 을 미리 그린다(3 에서 멈춤)', () => {
    expect(outsShownDuringResultWait(1, { phase: 'wait', outcome: { kind: '삼진' } })).toBe(2)
    expect(outsShownDuringResultWait(2, { phase: 'wait', outcome: { kind: '삼진' } })).toBe(3)
    expect(outsShownDuringResultWait(1, { phase: 'wait', outcome: { kind: '볼넷' } })).toBe(1)
    expect(outsShownDuringResultWait(1, null)).toBe(1)
  })
})
