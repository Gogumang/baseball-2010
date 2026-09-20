import { describe, expect, it } from 'vitest'
import {
  BURST_MODE,
  BURST_ROW_COUNTS,
  BURST_TABLES,
  burstRowsFor,
  burstTableNameOf,
  decodeBurstRow,
  SEASON_BATTING_ROWS,
  SEASON_FIELDING_ROWS,
} from '@/entities/burst-mission/model/burstMissionRow'
import { 행 } from '@/entities/burst-mission/model/burstMissionTestRows'

describe('돌발미션 행 풀기', () => {
  it('16바이트 한 줄을 열 16개로 푼다 (K 4절 1-0)', () => {
    // 타자 표 3행 "3홈런" 모양: 상황 0 · 주자 무관 · 아웃 무관 · 점수차 무관 · 홈런 2개 · 목표 홈런 · 25%
    const bytes = [0, 0xff, 0xff, 0xff, 0xff, 0, 2, 2, 2, 25, 4, 4, 2, 4, 0, 0]

    expect(decodeBurstRow(bytes, 3)).toEqual({
      index: 3,
      situation: 0,
      bases: [-1, -1, -1],
      outs: -1,
      scoreDifference: 0,
      recordKind: 2,
      recordCount: 2,
      goal: 2,
      chancePercent: 25,
      successRewards: [
        { kind: 4, amount: 4 },
        { kind: 2, amount: 4 },
      ],
      failurePenalty: { kind: 0, amount: 0 },
    })
  })

  it('조건 칸은 부호 있는 바이트다 — 0xff 가 −1(무관), 0xfe 가 −2(2점 차로 지는 중)', () => {
    const row = decodeBurstRow([0, 1, 1, 0, 0xff, 0xfe, 0, 0, 2, 15, 2, 4, 3, 5, 3, 3], 18)

    expect(row.bases).toEqual([1, 1, 0])
    expect(row.outs).toBe(-1)
    expect(row.scoreDifference).toBe(-2)
  })

  it('보상 양은 부호 없이 읽는다 — 실패 페널티도 양수로 담기고 뺄 때 부호가 붙는다', () => {
    const row = decodeBurstRow([0, 0xff, 0xff, 0xff, 0xff, 0, 0, 0, 0, 1, 1, 3, 3, 3, 3, 3], 0)

    expect(row.failurePenalty).toEqual({ kind: 3, amount: 3 })
  })

  it('16바이트가 아니면 거절한다', () => {
    expect(() => decodeBurstRow([0, 1, 2], 0)).toThrow()
  })
})

describe('표 고르기', () => {
  it('모드 4 → BATTER · 3 → PITCHER · 2 → SEASON, 그 밖은 없음 (로더 0x8e1b0)', () => {
    expect(burstTableNameOf(BURST_MODE.나리타자)).toBe('BATTER')
    expect(burstTableNameOf(BURST_MODE.나리투수)).toBe('PITCHER')
    expect(burstTableNameOf(BURST_MODE.시즌)).toBe('SEASON')
    // 모드 0·1(일반 경기)·5·6(미션)·7(홈런더비)에는 돌발 객체 자체가 없다 (0x48c08)
    expect([0, 1, 5, 6, 7].map(burstTableNameOf)).toEqual([null, null, null, null, null])
  })

  it('표마다 행 수가 정해져 있다 — 타자 40 · 투수 44 · 시즌 56', () => {
    expect(BURST_ROW_COUNTS).toEqual({ BATTER: 40, PITCHER: 44, SEASON: 56 })
  })

  it('원본 표가 그 행 수만큼 들어와 있다', () => {
    expect(BURST_TABLES.BATTER).toHaveLength(BURST_ROW_COUNTS.BATTER)
    expect(BURST_TABLES.PITCHER).toHaveLength(BURST_ROW_COUNTS.PITCHER)
    expect(BURST_TABLES.SEASON).toHaveLength(BURST_ROW_COUNTS.SEASON)
  })

  it('시즌 표만 반으로 갈린다 — 공격이면 0~30, 수비면 31~55 (0x8f000)', () => {
    const season = Array.from({ length: BURST_ROW_COUNTS.SEASON }, (_, index) => 행({ index }))
    const tables = { BATTER: [], PITCHER: [], SEASON: season }

    const 공격 = burstRowsFor(BURST_MODE.시즌, true, tables)
    const 수비 = burstRowsFor(BURST_MODE.시즌, false, tables)

    expect(공격[0]?.index).toBe(SEASON_BATTING_ROWS.from)
    expect(공격.at(-1)?.index).toBe(SEASON_BATTING_ROWS.to)
    expect(공격).toHaveLength(31)
    expect(수비[0]?.index).toBe(SEASON_FIELDING_ROWS.from)
    expect(수비.at(-1)?.index).toBe(SEASON_FIELDING_ROWS.to)
    expect(수비).toHaveLength(25)
  })

  it('나만의리그 표는 공수로 갈리지 않는다', () => {
    const batter = [행({ index: 0 }), 행({ index: 1 })]
    const tables = { BATTER: batter, PITCHER: [], SEASON: [] }

    expect(burstRowsFor(BURST_MODE.나리타자, true, tables)).toHaveLength(2)
    expect(burstRowsFor(BURST_MODE.나리타자, false, tables)).toHaveLength(2)
  })
})
