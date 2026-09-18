import { describe, expect, it } from 'vitest'
import { simulateHalfInning } from '@/entities/game/model/simulateHalfInning'
import type { QuickAtBatBatter, QuickAtBatPitcher } from '@/entities/game/model/quickAtBat'
import type { RandomPort } from '@/shared/api/random/randomPort'

const 타자 = (hit: number): QuickAtBatBatter => ({ hit, power: hit, run: hit, skillIds: [] })
const 투수 = (control: number): QuickAtBatPitcher => ({
  control,
  velocity: control,
  stamina: 90,
  skillIds: [],
})

/** 결정론적인 선형 합동 난수 — 같은 씨앗이면 항상 같은 경기가 나온다 */
function 씨앗난수(seed: number): RandomPort {
  let state = seed
  return {
    next: () => {
      state = (state * 1103515245 + 12345) % 2147483648
      return state / 2147483648
    },
    nextInRange: (minimum, maximum) => minimum + (maximum - minimum) / 2,
    pick: (candidates) => candidates[0],
  }
}

describe('simulateHalfInning — 3아웃까지 원본 타석 엔진을 돌린다', () => {
  it('반드시 끝나고 타순이 최소 세 명은 넘어간다', () => {
    const result = simulateHalfInning(0, () => 타자(500), 투수(500), 1, 씨앗난수(7))

    expect(result.runs).toBeGreaterThanOrEqual(0)
    expect(result.nextBattingOrderIndex).toBeGreaterThanOrEqual(3)
  })

  it('같은 씨앗이면 같은 결과가 나온다', () => {
    const 첫번째 = simulateHalfInning(0, () => 타자(500), 투수(500), 1, 씨앗난수(2010))
    const 두번째 = simulateHalfInning(0, () => 타자(500), 투수(500), 1, 씨앗난수(2010))

    expect(첫번째).toEqual(두번째)
  })

  it('강한 타선이 약한 투수를 만나면 약한 타선보다 많이 낸다 — 확률표가 아니라 능력치가 점수를 만든다', () => {
    const 합계 = (hit: number, control: number) => {
      const random = 씨앗난수(4242)
      let total = 0
      for (let inning = 1; inning <= 60; inning += 1) {
        total += simulateHalfInning(0, () => 타자(hit), 투수(control), 1, random).runs
      }
      return total
    }

    expect(합계(900, 200)).toBeGreaterThan(합계(200, 900))
  })

  it('타순은 이어받은 자리부터 시작한다', () => {
    const 받은타순: number[] = []
    simulateHalfInning(
      7,
      (index) => {
        받은타순.push(index)
        return 타자(500)
      },
      투수(500),
      1,
      씨앗난수(11),
    )

    expect(받은타순[0]).toBe(7)
    expect(받은타순[1]).toBe(8)
  })
})
