import { describe, expect, it } from 'vitest'
import {
  battingAverageOf,
  EMPTY_SEASON_STATS,
  formatBattingAverage,
  recordAtBat,
} from '@/entities/career/model/seasonStats'

describe('recordAtBat', () => {
  it('안타는 타수와 안타 수를 함께 올린다', () => {
    const stats = recordAtBat(EMPTY_SEASON_STATS, { kind: '안타', bases: 1 }, 0)

    expect(stats.atBats).toBe(1)
    expect(stats.hits).toBe(1)
    expect(stats.plateAppearances).toBe(1)
  })

  it('볼넷은 타석에만 잡히고 타수에는 잡히지 않는다', () => {
    const stats = recordAtBat(EMPTY_SEASON_STATS, { kind: '볼넷' }, 0)

    expect(stats.plateAppearances).toBe(1)
    expect(stats.atBats).toBe(0)
    expect(stats.walks).toBe(1)
  })

  it('홈런은 안타에도 홈런에도 잡힌다', () => {
    const stats = recordAtBat(EMPTY_SEASON_STATS, { kind: '홈런' }, 3)

    expect(stats.hits).toBe(1)
    expect(stats.homeRuns).toBe(1)
    expect(stats.runsBattedIn).toBe(3)
  })

  it('2루타와 3루타를 구분해 기록한다', () => {
    const 이루타 = recordAtBat(EMPTY_SEASON_STATS, { kind: '안타', bases: 2 }, 1)
    const 삼루타 = recordAtBat(이루타, { kind: '안타', bases: 3 }, 1)

    expect(삼루타.doubles).toBe(1)
    expect(삼루타.triples).toBe(1)
    expect(삼루타.hits).toBe(2)
    expect(삼루타.runsBattedIn).toBe(2)
  })

  it('삼진은 타수에 잡히고 안타에는 잡히지 않는다', () => {
    const stats = recordAtBat(EMPTY_SEASON_STATS, { kind: '삼진' }, 0)

    expect(stats.atBats).toBe(1)
    expect(stats.hits).toBe(0)
    expect(stats.strikeouts).toBe(1)
  })
})

describe('battingAverageOf', () => {
  it('타수가 0이면 타율은 없음이다 — 0할로 내리지 않는다', () => {
    expect(battingAverageOf(EMPTY_SEASON_STATS)).toBeNull()
    expect(formatBattingAverage(null)).toBe('-.---')
  })

  it('4타수 1안타는 2할5푼이다', () => {
    const stats = { ...EMPTY_SEASON_STATS, atBats: 4, hits: 1 }

    expect(battingAverageOf(stats)).toBeCloseTo(0.25, 5)
    expect(formatBattingAverage(battingAverageOf(stats))).toBe('.250')
  })

  it('3할3푼3리를 올바르게 표기한다', () => {
    const stats = { ...EMPTY_SEASON_STATS, atBats: 3, hits: 1 }

    expect(formatBattingAverage(battingAverageOf(stats))).toBe('.333')
  })
})
