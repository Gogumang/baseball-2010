import { describe, expect, it } from 'vitest'
import { atBatRecordIdsOf, gameEndRecordIdsOf, recordGamePointsOf, RECORD_NAMES } from '@/entities/game/model/gameRecords'

const 타석 = (overrides = {}) => ({
  outcome: { kind: '아웃', detail: '땅볼아웃' } as const,
  runsScored: 0,
  consecutiveHits: 0,
  homeRunsInGame: 0,
  walksInGame: 0,
  completesCycle: false,
  ...overrides,
})

describe('기록달성 — 0xa77f0 · 금액표 0xd8158', () => {
  it('이름은 StrGAME[id+8]', () => {
    expect([RECORD_NAMES[0], RECORD_NAMES[15], RECORD_NAMES[39]]).toEqual(['3루타', '사이클링 히트', '30점차 이상 승'])
  })

  it('3루타 · 홈런은 그 플레이 득점 수 1~4 로 솔로~만루 (0xa8024)', () => {
    expect(atBatRecordIdsOf(타석({ outcome: { kind: '안타', bases: 3 } }))).toEqual([0])
    expect(atBatRecordIdsOf(타석({ outcome: { kind: '홈런' }, runsScored: 4, homeRunsInGame: 1 }))).toEqual([4])
  })

  it('연타석 히트 3·4·5 · 한 타자 2·3·4홈런 · 사이클링 · 2·3볼넷', () => {
    expect(atBatRecordIdsOf(타석({ outcome: { kind: '홈런' }, runsScored: 1, consecutiveHits: 3, homeRunsInGame: 2 }))).toEqual([1, 9, 12])
    expect(atBatRecordIdsOf(타석({ outcome: { kind: '안타', bases: 2 }, consecutiveHits: 5, completesCycle: true }))).toEqual([11, 15])
    expect(atBatRecordIdsOf(타석({ outcome: { kind: '볼넷' }, walksInGame: 3 }))).toEqual([35])
  })

  it('경기 끝 — 10·20·30점차 이상 승 (가장 큰 것 하나, 추정)', () => {
    expect([9, 10, 25, 31].map((margin) => gameEndRecordIdsOf(margin))).toEqual([[], [37], [38], [39]])
  })

  it('지급액 = Σ 금액 (0x4ea0c)', () => {
    expect(recordGamePointsOf([0, 4, 15, 37])).toBe(10 + 15 + 100 + 10)
  })
})
