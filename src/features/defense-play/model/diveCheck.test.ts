import { describe, expect, it } from 'vitest'
import { AI_STATE, createFielders } from '@/entities/fielding/model/fieldingState'
import { POSE } from '@/entities/fielding/model/fielderPose'
import { diveCheckOf } from '@/features/defense-play/model/diveCheck'

const 야수들 = createFielders(Array.from({ length: 9 }, () => 500), 0)
const 공점 = (tick: number) => ({ x: 1000 * tick, y: 300, z: 20_000 })
const 검사 = (overrides: Partial<Parameters<typeof diveCheckOf>[0]>) =>
  diveCheckOf({
    fielder: { ...야수들[5], aiState: AI_STATE.IDLE },
    diveTick: 20,
    catchTick: 40,
    ballTick: 10,
    coverNeeded: () => true,
    ballPointAt: 공점,
    ...overrides,
  })

describe('비필살 다이빙 검사 b46c2~b475a (r180)', () => {
  it('n > 공 틱 − 5 면 공점 P(n) 의 (x, 0, z) 로 AI 0xd — 분기는 건너뛴다', () => {
    const 결과 = 검사({})
    expect(결과?.fielder.aiState).toBe(AI_STATE.DIVE)
    expect(결과?.fielder.target).toEqual({ x: 20_000, y: 0, z: 20_000 })
    expect(결과?.skipDispatch).toBe(true)
  })

  it('공 틱 == n 이면 vt60(+0xb3 · 동작 8)도 건다', () => {
    const 결과 = 검사({ ballTick: 20 })
    expect(결과?.dove).toBe(true)
    expect((결과!.fielder.pose & POSE.LOW_SWEEP) !== 0).toBe(true)
    expect(결과?.fielder.action).toBe(8)
  })

  it('창이 지나면(n ≤ 공 틱 − 5) AI 0 — 분기는 옛 상태로 한다', () => {
    const 결과 = 검사({ fielder: { ...야수들[5], aiState: AI_STATE.BUSY }, ballTick: 25 })
    expect(결과?.fielder.aiState).toBe(AI_STATE.IDLE)
    expect(결과?.dispatchState).toBe(AI_STATE.BUSY)
    expect(결과?.skipDispatch).toBe(false)
  })

  it('후보가 없거나(1000) 포구 틱 ≤ n + 5 · 필요한 커버 · 다른 AI 는 검사하지 않는다', () => {
    expect(검사({ diveTick: 1000 })).toBeNull()
    expect(검사({ catchTick: 25 })).toBeNull()
    expect(검사({ fielder: { ...야수들[5], aiState: AI_STATE.COVER_SECOND } })).toBeNull()
    expect(검사({ fielder: { ...야수들[5], aiState: AI_STATE.CHASE } })).toBeNull()
    expect(검사({ fielder: { ...야수들[5], aiState: AI_STATE.COVER_SECOND }, coverNeeded: () => false })?.fielder.aiState).toBe(
      AI_STATE.DIVE,
    )
  })

  it('+0x174 는 ldrsh — 빈 표의 100000 은 음수로 읽혀 닫힌다(원본 그대로)', () => {
    expect(검사({ catchTick: 100_000 })).toBeNull()
  })

  it('잠긴 야수는 vt14 가 목표를 안 받는다 — AI 는 0xd', () => {
    const 결과 = 검사({ fielder: { ...야수들[5], aiState: AI_STATE.IDLE, actionLockTicks: 3 } })
    expect(결과?.fielder.aiState).toBe(AI_STATE.DIVE)
    expect(결과?.fielder.target).toEqual(야수들[5].target)
  })
})
