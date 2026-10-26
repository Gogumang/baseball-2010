import { afterEach, describe, expect, it } from 'vitest'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
import { backupPointOf } from '@/entities/fielding/model/catchPrediction'

afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

const 목표 = { x: 30_000, y: 0, z: 10_000 }

describe('B-59 외야 백업이 음수 쪽 큰 차이를 무시한다', () => {
  it('원본: 공 가진 야수의 목표가 내 왼쪽(음수 쪽) 멀리면 백업 점이 없다', () => {
    expect(backupPointOf(목표, { x: 40_000, y: 0, z: 10_000 })).toBeNull()
    expect(backupPointOf(목표, { x: 20_000, y: 0, z: 10_000 })).toEqual({ x: 28_000, y: 0, z: 10_000 })
  })

  it('고침: 음수 쪽도 2000 넘게 벌어지면 목표 앞 2000 자리로 — 양수 쪽 · 가까운 차이는 그대로', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-59']))
    expect(backupPointOf(목표, { x: 40_000, y: 0, z: 10_000 })).toEqual({ x: 32_000, y: 0, z: 10_000 })
    expect(backupPointOf(목표, { x: 20_000, y: 0, z: 10_000 })).toEqual({ x: 28_000, y: 0, z: 10_000 })
    expect(backupPointOf(목표, { x: 31_000, y: 0, z: 9_000 })).toBeNull()
  })
})
