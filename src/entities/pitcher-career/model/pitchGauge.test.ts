import { describe, expect, it } from 'vitest'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import {
  GAUGE_FRAME,
  GAUGE_LAST_CELL,
  MAGIC_PITCH_GRADE,
  SCATTER_MULTIPLIERS,
  SCATTER_TABLE,
  aimScatterOf,
  gaugeCursorAt,
  gaugeFrameOf,
  gaugeGradeOf,
  gradeForMagicPitch,
  scatterMultiplierOf,
  scatterRankOf,
  usesGauge,
} from '@/entities/pitcher-career/model/pitchGauge'

const fixedRandom = (value: number): RandomPort => ({
  next: () => value,
  nextInRange: (minimum) => minimum,
  pick: (candidates) => candidates[0],
})

describe('게이지를 쓰는가 (0x3f500)', () => {
  const on = { defenseIsHuman: true, gaugeSettingOn: true, pitchTypeNumber: 1 }

  it('셋이 다 참일 때만 쓴다', () => {
    expect(usesGauge(on)).toBe(true)
    expect(usesGauge({ ...on, defenseIsHuman: false })).toBe(false)
    expect(usesGauge({ ...on, gaugeSettingOn: false })).toBe(false)
  })

  it('마구(구질 22)는 게이지를 쓰지 않는다', () => {
    expect(usesGauge({ ...on, pitchTypeNumber: 22 })).toBe(false)
  })
})

describe('누른 칸 g → 등급 t (0x50e2a)', () => {
  it('원본 표 그대로다 — 1~5 → 1 · 6 → 2 · 7 → 3 · 8 → 4 · 9 → 5', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9].map(gaugeGradeOf)).toEqual([1, 1, 1, 1, 1, 2, 3, 4, 5])
  })

  it('안 누르거나 칸 밖이면 0 이다', () => {
    expect(gaugeGradeOf(0)).toBe(0)
    expect(gaugeGradeOf(GAUGE_LAST_CELL + 1)).toBe(0)
    expect(gaugeGradeOf(-3)).toBe(0)
  })

  it('마구는 게이지를 거치지 않고 늘 5 다', () => {
    expect(gradeForMagicPitch()).toBe(MAGIC_PITCH_GRADE)
  })
})

describe('결과 그림은 원 한 장뿐이다 (S5 U-15 — PERFECT/GOOD 글자는 원본에 없다)', () => {
  it('프레임은 0x3b + g 이고 0x43 에서 잘린다', () => {
    expect(gaugeFrameOf(1)).toBe(0x3c)
    expect(gaugeFrameOf(8)).toBe(GAUGE_FRAME.smallest)
    expect(gaugeFrameOf(9)).toBe(GAUGE_FRAME.smallest)
  })

  it('t=4 와 t=5 는 화면에서 구별되지 않는다', () => {
    expect(gaugeFrameOf(8)).toBe(gaugeFrameOf(9))
    expect(gaugeGradeOf(8)).not.toBe(gaugeGradeOf(9))
  })

  it('첫 칸은 테두리 원 하나다', () => {
    expect(gaugeFrameOf(0)).toBe(GAUGE_FRAME.first)
  })

  it('커서는 틱마다 한 칸 나아간다', () => {
    expect([0, 1, 2, 9].map(gaugeCursorAt)).toEqual([0, 1, 2, 9])
  })
})

describe('목표점 흩어짐 등급 (표 0xcfd60)', () => {
  it('표는 6행 × 4칸 누적 100% 다', () => {
    expect(SCATTER_TABLE).toHaveLength(6)
    for (const row of SCATTER_TABLE) expect(row[row.length - 1]).toBe(100)
  })

  it('굴림이 0 이면 어느 등급에서도 k=0 이다', () => {
    for (let grade = 0; grade <= 5; grade += 1) {
      expect(scatterRankOf(grade, fixedRandom(0))).toBe(0)
    }
  })

  it('굴림이 커질수록 흩어짐 등급이 올라간다 — t=0 은 굴림 50 에서 k=2', () => {
    expect(scatterRankOf(0, fixedRandom(0.5))).toBe(2)
    expect(scatterRankOf(5, fixedRandom(0.5))).toBe(0)
  })

  it('등급이 높을수록 평균 흩어짐이 작다', () => {
    const meanRank = (grade: number) => {
      const random = createSeededRandom(17)
      let total = 0
      for (let index = 0; index < 400; index += 1) total += scatterRankOf(grade, random)
      return total / 400
    }
    expect(meanRank(5)).toBeLessThan(meanRank(0))
  })

  it('배율 표는 [12, 20, 25, 30] 이다', () => {
    expect(SCATTER_MULTIPLIERS).toEqual([12, 20, 25, 30])
    expect(scatterMultiplierOf(0)).toBe(12)
    expect(scatterMultiplierOf(99)).toBe(30)
  })
})

describe('목표점 이동은 반지름을 모르면 채울 수 없다', () => {
  it('그림 폭을 모르면 반지름이 null 이다', () => {
    const scatter = aimScatterOf(3, null, createSeededRandom(5))
    expect(scatter.radius).toBeNull()
    expect(scatter.angleDegrees).toBeGreaterThanOrEqual(1)
    expect(scatter.angleDegrees).toBeLessThanOrEqual(360)
  })

  it('그림 폭을 주면 폭/2 둘레로 흔들린다', () => {
    const scatter = aimScatterOf(3, 40, createSeededRandom(5))
    expect(scatter.radius).toBeGreaterThanOrEqual(18)
    expect(scatter.radius).toBeLessThanOrEqual(22)
  })
})
