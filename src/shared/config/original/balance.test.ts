import { describe, expect, it } from 'vitest'
import { BALANCE } from '@/shared/config/original/balance'
import balanceJson from '@/shared/config/original/data/balance.json'
import { RECORD_NAMES } from '@/entities/game/model/gameRecords'

describe('balance.json — 원본 수치표', () => {
  it('기록달성 금액 40개가 기록 이름 40개와 짝이 맞는다', () => {
    expect(BALANCE.recordGamePoints).toHaveLength(RECORD_NAMES.length)
  })

  it('원본에서 직접 읽은 값이 그대로 있다 — 숫자가 조용히 바뀌면 여기서 걸린다', () => {
    expect(BALANCE.ability.maximum).toBe(999)
    expect(BALANCE.season.gamesPerSeason).toBe(45)
    expect(BALANCE.rookie.reputation).toBe(300)
    // 신인 G포인트는 0 이다 — 0x11244 초기화가 G포인트를 넣지 않는다
    expect(BALANCE.rookie.gamePoint).toBe(0)
    expect(BALANCE.specialSwing.gamePointCost).toEqual([500, 700, 900, 1200])
    expect(BALANCE.swing.pitchGradeMultipliers).toEqual([80, 90, 95, 100, 115, 130])
  })

  it('모든 그룹이 근거(source)를 달고 있다 — 근거 없는 수치를 못 넣게 막는다', () => {
    const groups = Object.entries(balanceJson as Record<string, unknown>).filter(
      ([key, value]) =>
        typeof value === 'object' && value !== null && !Array.isArray(value) && key !== 'note',
    )

    expect(groups.length).toBeGreaterThan(5)
    for (const [key, value] of groups) {
      const source = (value as Record<string, unknown>).source
      expect(typeof source, `${key} 에 source 가 없습니다`).toBe('string')
      expect((source as string).length, `${key} 의 source 가 비었습니다`).toBeGreaterThan(5)
    }
  })

  it('범위 값은 최솟값이 최댓값보다 작다', () => {
    const ranges = [
      BALANCE.training.gainRange,
      BALANCE.training.legGainRange,
      BALANCE.training.moraleLossRange,
      BALANCE.specialSwing.moraleLossRange,
      BALANCE.quickAtBat.spreadRange,
    ]

    for (const range of ranges) {
      expect(range.minimum).toBeLessThan(range.maximumExclusive)
    }
  })
})
