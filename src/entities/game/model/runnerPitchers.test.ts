import { describe, expect, it } from 'vitest'
import {
  chargedRunsByPitcher,
  freezeRunnerPitchers,
  pitcherOnBase,
  scoredFromBasesOf,
  settleRunnerPitchers,
} from '@/entities/game/model/runnerPitchers'

const 루 = (first: number | null, second: number | null, third: number | null) => ({ first, second, third })

describe('책임 투수(주자+0x30) — a93ac 가 적고 a9c68 이 그대로 옮기고 a8ee4 가 그 투수에게 실점을 매긴다', () => {
  it('새로 나간 타자주자는 지금 투수, 루에 남은 주자는 적힌 투수를 그대로 든다', () => {
    // 1루 주자(타순 3)는 투수 A(1)가 내보냈고 지금 마운드는 B(2) — 타순 4 가 안타로 나가 주자는 2루로
    const settled = settleRunnerPitchers({
      tags: { runners: 루(3, null, null), pitchers: 루(1, null, null) },
      before: 루(3, null, null),
      after: 루(4, 3, null),
      batter: 4,
      pitcher: 2,
      scoredFromBases: [],
    })
    expect(settled.tags.pitchers).toEqual(루(2, 1, null))
    expect(settled.charged).toEqual([])
  })

  it('승계 주자가 들어오면 실점은 그 주자를 내보낸 앞 투수에게, 타자 득점은 지금 투수에게', () => {
    const settled = settleRunnerPitchers({
      tags: { runners: 루(5, null, 3), pitchers: 루(1, null, 1) },
      before: 루(5, null, 3),
      after: 루(null, null, null),
      batter: 6,
      pitcher: 2,
      // 홈런 — 타자주자(0) · 1루 · 3루가 모두 들어온다
      scoredFromBases: [0, 1, 3],
    })
    expect(settled.charged).toEqual([2, 1, 1])
    expect(chargedRunsByPitcher(settled.charged)).toEqual([
      [2, 1],
      [1, 2],
    ])
  })

  it('적은 신원과 지금 루의 신원이 다르면 모르는 주자로 보고 지금 투수로 대신한다', () => {
    const tags = { runners: 루(3, null, null), pitchers: 루(1, null, null) }
    expect(pitcherOnBase(tags, 루(3, null, null), 1, 9)).toBe(1)
    expect(pitcherOnBase(tags, 루(7, null, null), 1, 9)).toBe(9)
  })

  it('투수가 바뀌면 모르는 루를 내려가는 투수 몫으로 굳힌다', () => {
    const frozen = freezeRunnerPitchers({ runners: 루(3, null, null), pitchers: 루(1, null, null) }, 루(3, 4, null), 2)
    expect(frozen).toEqual({ runners: 루(3, 4, null), pitchers: 루(1, 2, null) })
  })

  it('운명 없는 간이 엔진 득점 — 루에서 빠진 앞선 주자부터, 모자라면 타자주자', () => {
    // 1·3루에서 2루타: 3루 · 1루 주자가 들어오고 타자는 2루
    expect(scoredFromBasesOf(루(1, null, 2), 루(null, 3, null), 2)).toEqual([3, 1])
    // 빈 루 홈런
    expect(scoredFromBasesOf(루(null, null, null), 루(null, null, null), 1)).toEqual([0])
    expect(scoredFromBasesOf(루(1, null, null), 루(null, null, null), 0)).toEqual([])
  })
})
