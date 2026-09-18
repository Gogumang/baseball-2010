import { describe, expect, it } from 'vitest'
import { EMPTY_BATTER_GAME_LOG, recordBatterAtBat } from '@/entities/game/model/batterGameLog'
import type { BatterGameLog } from '@/entities/game/model/batterGameLog'

const 쌓기 = (outcomes: readonly Parameters<typeof recordBatterAtBat>[1][]) =>
  outcomes.reduce<{ log: BatterGameLog; ids: number[] }>(
    (current, outcome) => {
      const recorded = recordBatterAtBat(current.log, outcome, 0)
      return { log: recorded.log, ids: [...current.ids, ...recorded.recordIds] }
    },
    { log: EMPTY_BATTER_GAME_LOG, ids: [] },
  )

describe('recordBatterAtBat — 타자 한 명의 기록달성 판정 (0xa77f0)', () => {
  it('3루타는 기록 0 을 준다', () => {
    expect(recordBatterAtBat(EMPTY_BATTER_GAME_LOG, { kind: '안타', bases: 3 }, 0).recordIds).toContain(0)
  })

  it('연타석 안타는 3·4·5 번째에 각각 기록 9·10·11 이 된다', () => {
    const 안타 = { kind: '안타', bases: 1 } as const
    const { ids } = 쌓기([안타, 안타, 안타, 안타, 안타])

    expect(ids).toContain(9)
    expect(ids).toContain(10)
    expect(ids).toContain(11)
  })

  it('볼넷은 연타석을 끊는다 (0xa75f4)', () => {
    const 안타 = { kind: '안타', bases: 1 } as const
    const { ids } = 쌓기([안타, 안타, { kind: '볼넷' }, 안타])

    expect(ids).not.toContain(9)
  })

  it('단타·2루타·3루타·홈런이 다 모이면 사이클링 히트(15)를 한 번만 준다', () => {
    const { ids } = 쌓기([
      { kind: '안타', bases: 1 },
      { kind: '안타', bases: 2 },
      { kind: '안타', bases: 3 },
      { kind: '홈런' },
      { kind: '홈런' },
    ])

    expect(ids.filter((id) => id === 15)).toHaveLength(1)
  })

  it('입력 기록을 바꾸지 않는다', () => {
    const before = EMPTY_BATTER_GAME_LOG
    recordBatterAtBat(before, { kind: '홈런' }, 1)

    expect(before.stats.homeRuns).toBe(0)
  })
})
