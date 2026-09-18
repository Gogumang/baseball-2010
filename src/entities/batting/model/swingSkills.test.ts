import { describe, expect, it } from 'vitest'
import { applySwingSkills, atBatRecordCodeOf } from '@/entities/batting/model/swingSkills'
import type { SwingSituation } from '@/entities/batting/model/swingSkills'

const 상황 = (overrides: Partial<SwingSituation> = {}): SwingSituation => ({
  inning: 1,
  isLosing: false,
  runnerCount: 0,
  hasSecondBaseRunner: false,
  pitcherSide: 0,
  batterSide: 0,
  balls: 1,
  strikes: 1,
  batterOrderIndex: 0,
  recentAtBatCodes: [],
  ...overrides,
})

describe('스윙 스킬 보정 — 0xab214 (점검 10차)', () => {
  it('스킬마다 그때 값에 차례로 더한다 — 8(+1%) 뒤 9(+2%)', () => {
    // 5000 → 5000 + 50 = 5050 → 5050 + 101 = 5151 (합산 3% 면 5150)
    expect(applySwingSkills({ solid: 5000, homeRun: 1000 }, [8, 9], [], 상황())).toEqual({ solid: 5151, homeRun: 1010 })
  })

  it('37(주자 1명당 −2%)은 주자 수만큼 반복한다', () => {
    expect(applySwingSkills({ solid: 1000, homeRun: 1000 }, [], [37], 상황({ runnerCount: 2 }))).toEqual({ solid: 961, homeRun: 961 })
  })

  it('31 은 0부터 센 타순 2·3·4(클린업)일 때만 C −10%', () => {
    const 적용 = (batterOrderIndex: number) => applySwingSkills({ solid: 1000, homeRun: 1000 }, [], [31], 상황({ batterOrderIndex })).homeRun
    expect([1, 2, 3, 4, 5].map(적용)).toEqual([1000, 900, 900, 900, 1000])
  })

  it('16 상승세는 최근 두 타석이 모두 안타(0<x<5), 17 하락세는 모두 아웃(4<x<8)일 때만', () => {
    const 기록 = (recentAtBatCodes: number[]) => 상황({ recentAtBatCodes })
    expect(applySwingSkills({ solid: 1000, homeRun: 1000 }, [16], [], 기록([1, 4])).solid).toBe(1050)
    expect(applySwingSkills({ solid: 1000, homeRun: 1000 }, [16], [], 기록([1, 5])).solid).toBe(1000)
    expect(applySwingSkills({ solid: 1000, homeRun: 1000 }, [17], [], 기록([5, 7])).solid).toBe(900)
    expect(applySwingSkills({ solid: 1000, homeRun: 1000 }, [17], [], 기록([7])).solid).toBe(1000)
  })

  it('타석 기록 코드 — 안타 1~4, 아웃 5~7, 볼넷 8 (추정)', () => {
    expect(atBatRecordCodeOf({ kind: '안타', bases: 2 })).toBe(2)
    expect(atBatRecordCodeOf({ kind: '홈런' })).toBe(4)
    expect(atBatRecordCodeOf({ kind: '삼진' })).toBe(5)
    expect(atBatRecordCodeOf({ kind: '아웃', detail: '뜬공아웃' })).toBe(7)
    expect(atBatRecordCodeOf({ kind: '볼넷' })).toBe(8)
  })
})
