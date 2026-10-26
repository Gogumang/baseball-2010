import { afterEach, describe, expect, it } from 'vitest'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
import { createFielders, initialPlayView } from '@/entities/fielding/model/fieldingState'
import { planThrow } from '@/entities/fielding/model/throwPlan'
import { describeThrowTarget, type ThrowTargetInput } from '@/entities/fielding/model/throwTargetBase'

afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

/** 우익수(8)가 펜스 앞 깊은 곳에서 공을 쥐었다 — 홈까지는 중계 문턱(17000)을 넘는다 */
const 깊은곳 = { x: 34000, y: 0, z: 4000 }
const 야수 = createFielders(Array.from({ length: 9 }, () => 500)).map((fielder, slot) =>
  slot === 8 ? { ...fielder, holdingBall: true, position: 깊은곳, target: 깊은곳 } : fielder,
)

/** 2루 커버가 비어(−1) 2루 → 홈 재송구는 공 가진 우익수가 던진다(0xafe0a) */
const 입력: ThrowTargetInput = {
  play: { ...initialPlayView(1), coverOfBase: [1, 2, -1, 4], ballHolderSlot: 8, catchFielderSlot: 8, everHeld: true, held: true },
  fielders: 야수,
  runners: [],
  currentTick: 0,
  landingTick: 30,
  outs: 0,
  activeRunnerCount: 0,
}

describe('B-60 중계가 낀 재송구 틱', () => {
  const 계획 = planThrow({ fielders: 야수, fromSlot: 8, finalSlot: 1, base: 0 })

  it('바탕: 우익수 → 포수 송구는 중계를 낀다', () => {
    expect(계획.relayed).toBe(true)
    expect(계획.totalTicks).toBeGreaterThan(계획.firstLegTicks)
  })

  it('원본: 1구간 틱 res[5] 만 본다', () => {
    expect(describeThrowTarget(입력).candidates[2].rethrow[0]).toBe(계획.firstLegTicks)
  })

  it('고침: 중계 포함 전체 틱 res[6] 을 본다', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-60']))
    expect(describeThrowTarget(입력).candidates[2].rethrow[0]).toBe(계획.totalTicks)
  })
})
