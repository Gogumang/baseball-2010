import { describe, expect, it } from 'vitest'
import { playQuickPlateAppearance } from '@/entities/game/model/quickPlateAppearance'
import type { QuickAtBatBatter, QuickAtBatPitcher } from '@/entities/game/model/quickAtBat'
import { createFractionRandom } from '@/shared/api/random/fractionRandom'

const 타자: QuickAtBatBatter = { hit: 500, power: 500, run: 500, skillIds: [] }
const 투수: QuickAtBatPitcher = { control: 500, velocity: 500, stamina: 90, skillIds: [] }

const 차례난수 = (values: readonly number[], rest = 0.99) => {
  let index = 0
  return createFractionRandom(() => values[index++] ?? rest)
}

describe('playQuickPlateAppearance — 간이 타석 하나를 주자까지 (0xc262c · 0xc1818 · 0xc11f0)', () => {
  it('볼넷은 모든 주자를 한 루씩 민다 — 2루 주자 혼자여도 3루로 간다 (c1918 → 0xc0fb4)', () => {
    // 판정 길(0.9) · 존 밖(0) 셋 = 볼 — 공마다 2루 주자 도루 굴림(0.99 실패). 넷째 = 포볼 → 앞선 주자가 3루라 안 굴린다
    const result = playQuickPlateAppearance(
      {
        batter: 타자,
        pitcher: 투수,
        situation: { inning: 1 },
        bases: { first: false, second: true, third: false },
        outs: 0,
        runnerRunAt: () => 500,
      },
      차례난수([0.9, 0, 0.99, 0.9, 0, 0.99, 0.9, 0, 0.99, 0.9, 0], 0),
    )

    expect(result.play.outcome).toEqual({ kind: '볼넷' })
    expect(result.advance).toEqual({ bases: { first: true, second: false, third: true }, runsScored: 0, outsAdded: 0 })
    expect(result.stolenRunners).toEqual([])
  })

  it('판정 길 공마다 도루를 굴려 성공한 주자를 거꾸로 센 수로 낸다 (c1982~c1ade)', () => {
    // 첫 공: 판정 길(0.9) · 존 밖(0) = 볼 → 도루 굴림 0 → 1루 주자(직전 타자) 2루로. 그 뒤 루킹 삼진
    const result = playQuickPlateAppearance(
      {
        batter: 타자,
        pitcher: 투수,
        situation: { inning: 1 },
        bases: { first: true, second: false, third: false },
        outs: 0,
        runnerRunAt: (ordersBack) => (ordersBack === 1 ? 500 : 0),
      },
      차례난수([0.9, 0, 0]),
    )

    expect(result.play.outcome).toEqual({ kind: '삼진' })
    expect(result.steals).toBe(1)
    expect(result.stolenRunners).toEqual([1])
    expect(result.advance.bases).toEqual({ first: false, second: true, third: false })
  })
})
