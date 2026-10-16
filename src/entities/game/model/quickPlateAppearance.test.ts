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
        runners: { first: null, second: 7, third: null },
        batterId: 0,
        runnerRunOf: () => 500,
      },
      차례난수([0.9, 0, 0.99, 0.9, 0, 0.99, 0.9, 0, 0.99, 0.9, 0], 0),
    )

    expect(result.play.outcome).toEqual({ kind: '볼넷' })
    expect(result.advance).toEqual({ bases: { first: true, second: false, third: true }, runsScored: 0, outsAdded: 0 })
    expect(result.stolenRunners).toEqual([])
    // 2루 주자(7번 칸)는 3루로, 타자(0번 칸)는 1루로
    expect(result.runners).toEqual({ first: 0, second: null, third: 7 })
  })

  it('판정 길 공마다 도루를 굴려 성공한 주자를 그 신원으로 낸다 — 주력도 그 주자 것 (c1982~c1ade)', () => {
    // 첫 공: 판정 길(0.9) · 존 밖(0) = 볼 → 도루 굴림 0 → 1루 주자(직전 타자) 2루로. 그 뒤 루킹 삼진
    const result = playQuickPlateAppearance(
      {
        batter: 타자,
        pitcher: 투수,
        situation: { inning: 1 },
        bases: { first: true, second: false, third: false },
        outs: 0,
        runners: { first: 5, second: null, third: null },
        batterId: 6,
        runnerRunOf: (runner) => (runner === 5 ? 500 : 0),
      },
      차례난수([0.9, 0, 0]),
    )

    expect(result.play.outcome).toEqual({ kind: '삼진' })
    expect(result.steals).toBe(1)
    expect(result.stolenRunners).toEqual([5])
    expect(result.advance.bases).toEqual({ first: false, second: true, third: false })
    expect(result.runners).toEqual({ first: null, second: 5, third: null })
  })

  it('도루 판정 주력은 실제로 앞선 주자의 것이다 — 타순에서 거꾸로 센 타자가 아니다', () => {
    // 1루 주자는 4번 칸(주력 0 → 도루 확률 표 첫 칸). 거꾸로 센 근사라면 직전 타자(5번 칸, 주력 999)를 봤다
    const 굴림 = [0.9, 0, 0.5]
    const result = playQuickPlateAppearance(
      {
        batter: 타자,
        pitcher: 투수,
        situation: { inning: 1 },
        bases: { first: true, second: false, third: false },
        outs: 0,
        runners: { first: 3, second: null, third: null },
        batterId: 5,
        runnerRunOf: (runner) => (runner === 3 ? 0 : 999),
      },
      차례난수(굴림),
    )
    expect(result.steals).toBe(0)
  })
  describe('공격 팀 레코드 +2 덮기 — 스윙 경로 0xab214(ab4c0~ab4d8) · 주자 있는 판정 경로 c19ec 만 (r104)', () => {
    const 빈루 = {
      batter: 타자,
      pitcher: 투수,
      situation: { inning: 1 },
      bases: { first: false, second: false, third: false },
      outs: 0,
      runners: { first: null, second: null, third: null },
      batterId: 0,
      runnerRunOf: () => 500,
    } as const

    it('주자 없이 판정 경로만으로 끝난 삼진은 공격 팀을 안 덮는다 (c1990 → c1ae2)', () => {
      const result = playQuickPlateAppearance(빈루, 차례난수([], 0.99))
      expect(result.play.outcome).toEqual({ kind: '삼진' })
      expect(result.touchesOffenseRecord).toBe(false)
    })

    it('스윙 경로를 한 번이라도 타면 덮는다 (c14e4 0xab214)', () => {
      const result = playQuickPlateAppearance(빈루, 차례난수([], 0))
      expect(result.touchesOffenseRecord).toBe(true)
    })

    it('판정 경로라도 주자가 있으면 앞선 주자 주력을 읽어 덮는다 (c19ec)', () => {
      const result = playQuickPlateAppearance(
        { ...빈루, bases: { first: true, second: false, third: false }, runners: { first: 5, second: null, third: null } },
        차례난수([], 0.99),
      )
      expect(result.play.outcome).toEqual({ kind: '삼진' })
      expect(result.touchesOffenseRecord).toBe(true)
    })
  })
})
